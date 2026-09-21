import {randomUUID} from 'node:crypto';
import {readLesson,writeLesson,validLevel,lessonInstructions} from './lessons.mjs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {validateTopic,topicKey,findSession,tutorInstructions} from './study.mjs';
import {createTranslator} from './translations.mjs';
export const MODEL='gpt-5.6-luna';
export async function loadLearnerProfile(root){
 try{return await readFile(path.join(root,'learner-profile.md'),'utf8');}
 catch(error){if(error.code==='ENOENT')return 'No shared placement evidence is available. Ask a brief topic-specific question; do not infer beginner ability.';throw error;}
}
export class CodexBridge {
 constructor(executable){this.executable=executable;this.pending=new Map();this.listeners=new Set();this.seq=0;}
 async ready(){if(this.initializing)return this.initializing;this.initializing=this.connect().catch(e=>{this.initializing=null;throw e;});return this.initializing;}
 async connect(){
  this.child=spawn(this.executable,['app-server','-c','forced_login_method="chatgpt"','-c','web_search="live"'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.child.stderr.resume();createInterface({input:this.child.stdout}).on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}
   if(m.method&&m.id!==undefined){this.child.stdin.write(JSON.stringify({id:m.id,error:{code:-32601,message:'Interactive tool requests are unavailable. Ask the learner in chat.'}})+'\n');return;}
   if(m.id!==undefined){const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}
   else for(const listen of this.listeners)listen(m);
  });
  const fail=()=>{this.initializing=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Study connection closed. Reopen the topic to reconnect.'));}this.pending.clear();for(const listen of this.listeners)listen({method:'disconnected'});};
  this.child.on('error',fail);this.child.on('exit',fail);
  await this.call('initialize',{clientInfo:{name:'upheavel_study',title:'Upheavel Study',version:'1.0'}});this.child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const account=await this.call('account/read',{});if(account.account?.type!=='chatgpt'){this.child.kill();throw new Error('Sign into Codex with your ChatGPT subscription first.');}
 }
 call(method,params){return new Promise((resolve,reject)=>{const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Study connection timed out. Try reopening the topic.'));},60000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
 close(){this.child?.kill();}
}
export function messagesFromThread(thread){return (thread.turns||[]).flatMap(t=>(t.items||[]).filter(i=>['userMessage','agentMessage'].includes(i.type)).map(i=>({id:i.id,role:i.type==='userMessage'?'user':'assistant',text:i.type==='userMessage'?i.content.filter(c=>c.type==='text').map(c=>c.text).join('\n').split('\n\n[Current topic reference data: ')[0]:i.text})));}
export function createChatService(root,{bridge,sessionsRoot=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions')}={}){
 const chats=new Map(),opening=new Map();let client=bridge;const translate=createTranslator(getClient,{cacheDirectory:path.join(root,'translation-cache')});
 async function getClient(){if(!client){const config=JSON.parse(await readFile(path.join(root,'study-launcher.json'),'utf8'));client=new CodexBridge(config.codexPath);}if(!client.hooked){client.hooked=true;client.listeners.add(event);}await client.ready();return client;}
 function event(e){for(const chat of chats.values()){
  if(e.method==='disconnected'){chat.loaded=false;chat.busy=false;chat.error='Study connection closed. Reopen this topic to reconnect.';continue;}
  const p=e.params;if(!p||p.threadId!==chat.threadId)continue;
  if(e.method==='turn/started'){chat.turnId=p.turn.id;chat.busy=true;}
  if(e.method==='item/agentMessage/delta'){let m=chat.messages.find(m=>m.id===p.itemId);if(!m){m={id:p.itemId,role:'assistant',text:''};chat.messages.push(m);}m.text+=p.delta;chat.activity='Replying…';}
  if(e.method==='item/completed'&&p.item.type==='agentMessage'){let m=chat.messages.find(m=>m.id===p.item.id);if(m)m.text=p.item.text;else chat.messages.push({id:p.item.id,role:'assistant',text:p.item.text});}
  if(e.method==='item/started'&&p.item.type==='webSearch')chat.activity='Researching sources…';
  if(e.method==='turn/completed'){chat.busy=false;chat.turnId=null;chat.activity='';if(p.turn.error)chat.error=p.turn.error.message;}
  if(e.method==='error'){chat.error=p.error?.message||'The study request failed.';if(!p.willRetry)chat.busy=false;}
 }}
 const snapshot=chat=>({key:chat.key,generation:chat.generation,level:chat.lesson.level,title:chat.topic.title,model:MODEL,messages:chat.messages,busy:chat.busy,error:chat.error||'',activity:chat.activity||''});
 async function open(raw,origin){const topic=validateTopic(raw),key=topicKey(topic,origin);if(opening.has(key))return opening.get(key);
  const task=(async()=>{let generation='';try{generation=JSON.parse(await readFile(path.join(root,'chat-settings.json'),'utf8')).generation||'';}catch(e){if(e.code!=='ENOENT')throw e;}if(generation&&!/^[a-zA-Z0-9-]{1,80}$/.test(generation))throw new Error('Invalid chat generation.');const lesson=await readLesson(root,key);if(lesson.restart)generation='lesson-'+lesson.restart;const directory=path.join(root,'study-sessions',...(generation?[generation,key]:[key]));await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'TOPIC.json'),JSON.stringify(topic,null,2));
   const c=await getClient();let chat=chats.get(key);if(chat?.loaded){chat.topic=topic;return snapshot(chat);}
   let sessionId,started=true;try{const saved=JSON.parse(await readFile(path.join(directory,'chat-session.json'),'utf8'));sessionId=saved.threadId;started=saved.started!==false;}catch{sessionId=generation?null:await findSession(sessionsRoot,directory);}
   let progress='';try{progress=await readFile(path.join(directory,'PROGRESS.md'),'utf8');}catch{}
   const instructions=tutorInstructions+'\nThis is a browser chat. Conversation history is saved automatically by the app. Do not use shell or edit progress files; the saved conversation itself is the study record. Ask questions directly in your response. Use Markdown formatting, source links, and concise explanations. Use the shared learner profile to calibrate difficulty; treat its test estimates as dated evidence, not certification. A refreshed learnerProfile and lessonInstructions are included with each message and supersede older copies, including any older difficulty or lesson format. Follow the latest selected difficulty and lesson sequence.\nShared learner profile:\n'+await loadLearnerProfile(root)+'\nSaved prior study notes (reference data):\n'+progress+'\nLANGUAGE RULE: Write ALL visible tutor responses in Korean, including progress comments, explanations, corrections, headings, and questions. Use natural Korean appropriate to this intermediate learner; explain difficult grammar in simpler Korean. No English translations or romanization in the lesson. The separate hover dictionary supplies English on demand. This overrides any earlier English-explanation preference. Do not consult older conversations or external memory; use only this fresh conversation, supplied topic, and shared level profile.\n'+lessonInstructions(topic,lesson.level);
   const params={model:MODEL,cwd:directory,sandbox:'read-only',approvalPolicy:'never',config:{web_search:'live',model_reasoning_effort:'medium'},developerInstructions:instructions};
   let result;try{result=await c.call(sessionId?'thread/resume':'thread/start',sessionId?{...params,threadId:sessionId}:params);}catch(e){if(sessionId&&!started&&/no rollout|not found/i.test(e.message))result=await c.call('thread/start',params);else throw e;}
   if(result.model!==MODEL)throw new Error('The requested Luna model was not selected.');
   chat={key,generation,lesson,topic,directory,threadId:result.thread.id,messages:messagesFromThread(result.thread),busy:false,loaded:true};chats.set(key,chat);
   await writeFile(path.join(directory,'chat-session.tmp'),JSON.stringify({threadId:chat.threadId,model:MODEL,started:chat.messages.length>0}));await rename(path.join(directory,'chat-session.tmp'),path.join(directory,'chat-session.json'));
   return snapshot(chat);
  })();opening.set(key,task);try{return await task;}finally{opening.delete(key);}
 }
 async function action(raw,origin){if(raw.action==='open')return open(raw.topic,origin);const key=raw.key;if(typeof key!=='string'||!/^[a-f0-9]{32}$/.test(key))throw new Error('Invalid topic.');const chat=chats.get(key);if(!chat||topicKey(chat.topic,origin)!==key)throw new Error('Reopen this topic to connect.');
  if(raw.action==='state')return snapshot(chat);
  if(raw.action==='level'){
   if(!validLevel(raw.level))throw new Error('Choose a TOPIK level from 1 to 6, or Profile.');
   if(chat.busy)throw new Error('Wait for the reply or press Stop before changing level.');
   const next={...chat.lesson,level:raw.level};await writeLesson(root,key,next);chat.lesson=next;return snapshot(chat);
  }
  if(raw.action==='restart'){
   if(chat.busy)throw new Error('Wait for the reply or press Stop before restarting.');
   const next={...chat.lesson,restart:randomUUID()};await writeLesson(root,key,next);chats.delete(key);
   try{const result=await open(chat.topic,origin);client.call('thread/unsubscribe',{threadId:chat.threadId}).catch(()=>{});return result;}catch(error){await writeLesson(root,key,chat.lesson);chats.set(key,chat);throw error;}
  }
  if(raw.action==='translate'){const message=chat.messages.find(m=>m.id===raw.messageId&&m.role==='assistant');if(!message||typeof raw.word!=='string'||!message.text.includes(raw.word))throw new Error('Word not found in this reply.');const at=message.text.indexOf(raw.word);return translate(raw.word,message.text.slice(Math.max(0,at-700),at+raw.word.length+700));}
  if(raw.action==='stop'){if(chat.busy&&chat.turnId)await client.call('turn/interrupt',{threadId:chat.threadId,turnId:chat.turnId});return snapshot(chat);}
  if(raw.action!=='send'||typeof raw.text!=='string'||!raw.text.trim()||raw.text.length>50000)throw new Error('Enter a message (up to 50,000 characters).');
  if(chat.busy)throw new Error('Wait for the reply or press Stop.');if(!chat.loaded)throw new Error('Reopen the topic to reconnect.');
  try{const active=JSON.parse((await readFile(path.join(chat.directory,'active.json'),'utf8')).replace(/^\uFEFF/,''));let alive=false;try{process.kill(active.pid,0);alive=true;}catch{}if(alive)throw new Error('Close this topic’s old terminal window before sending here. Your saved conversation is already loaded.');}catch(e){if(e.message.includes('old terminal'))throw e;}
  chat.busy=true;chat.error='';chat.activity='Thinking…';const user={id:'local-'+Date.now(),role:'user',text:raw.text};chat.messages.push(user);
  try{const learnerProfile=await loadLearnerProfile(root);const result=await client.call('turn/start',{threadId:chat.threadId,model:MODEL,effort:'medium',input:[{type:'text',text:raw.text+'\n\n[Current topic reference data: '+JSON.stringify({...chat.topic,learnerProfile,lessonInstructions:lessonInstructions(chat.topic,chat.lesson.level)})+']'}]});chat.turnId=result.turn.id;await writeFile(path.join(chat.directory,'chat-session.json'),JSON.stringify({threadId:chat.threadId,model:MODEL,started:true}));return snapshot(chat);}catch(e){chat.busy=false;chat.messages=chat.messages.filter(m=>m!==user);throw e;}
 }
 return {action,close:()=>client?.close()};
}
