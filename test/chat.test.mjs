import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createChatService,MODEL,messagesFromThread} from '../chat.mjs';import {markdown} from '../dist/chat.js';
const topic={id:'test',projectId:'korean',title:'있다 / 없다',category:'Grammar',notes:'Keep these notes',links:[]};
test('chat selects Luna, isolates topics, resumes saved chats, and stops active turns',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'upheavel-chat-'));const calls=[];let seq=0;const saved=new Map();const bridge={listeners:new Set(),ready:async()=>{},close(){},async call(method,params){calls.push({method,params});if(method==='thread/start'){const thread={id:'thread-'+(++seq),turns:[]};saved.set(thread.id,thread);return {model:MODEL,thread};}if(method==='thread/resume')return {model:MODEL,thread:saved.get(params.threadId)};if(method==='turn/start'){saved.get(params.threadId).turns.push({items:[{type:'userMessage',id:'u',content:params.input},{type:'agentMessage',id:'a',text:'**Example**'}]});return {turn:{id:'turn-1'}};}if(method==='turn/interrupt')return {};}};
 const origin='http://127.0.0.1:8793';try{const chat=createChatService(root,{bridge,sessionsRoot:root});const first=await chat.action({action:'open',topic},origin);assert.equal(first.model,MODEL);await chat.action({action:'send',key:first.key,text:'Explain this'},origin);assert.equal(calls.find(c=>c.method==='turn/start').params.model,MODEL);await assert.rejects(chat.action({action:'send',key:first.key,text:'Duplicate'},origin),/Wait/);await assert.rejects(chat.action({action:'state',key:first.key},'http://localhost:8793'),/Reopen/);await chat.action({action:'stop',key:first.key},origin);assert.ok(calls.some(c=>c.method==='turn/interrupt'));const other=await chat.action({action:'open',topic:{...topic,id:'other'}},origin);assert.notEqual(first.key,other.key);assert.equal(other.messages.length,0);const again=createChatService(root,{bridge,sessionsRoot:root});const resumed=await again.action({action:'open',topic},origin);assert.equal(resumed.messages[0].text,'Explain this');assert.equal(resumed.messages[1].text,'**Example**');assert.equal(calls.filter(c=>c.method==='thread/start').length,2);}finally{await rm(root,{recursive:true,force:true});}
});
test('message formatting renders safe markup and excludes tool/internal text',()=>{const html=markdown('**Bold** and *italic*\n<script>alert(1)</script>\n[bad](javascript:alert(1))\n[Source](https://example.com)');assert.ok(html.includes('<strong>Bold</strong>'));assert.ok(html.includes('<em>italic</em>'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('rel="noopener noreferrer"'));assert.deepEqual(messagesFromThread({turns:[{items:[{type:'reasoning',text:'private'},{type:'commandExecution',command:'hidden'}]}]}),[]);});
test('learner profile reaches new and resumed chats and refreshes before each message',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'upheavel-profile-'));const calls=[];
 const bridge={listeners:new Set(),ready:async()=>{},close(){},async call(method,params){calls.push({method,params});return method==='turn/start'?{turn:{id:'turn'}}:{model:MODEL,thread:{id:'saved-thread',turns:[]}};}};
 const origin='http://127.0.0.1:8793';try{
  await writeFile(path.join(root,'learner-profile.md'),'Intermediate writing; listening unmeasured.');
  const service=createChatService(root,{bridge,sessionsRoot:root});const chat=await service.action({action:'open',topic},origin);
  assert.match(calls[0].params.developerInstructions,/Intermediate writing; listening unmeasured/);
  await writeFile(path.join(root,'learner-profile.md'),'Updated dated evidence; no official TOPIK score.');
  await service.action({action:'send',key:chat.key,text:'Practice please'},origin);
  const sent=calls.find(c=>c.method==='turn/start').params.input[0].text;
  assert.match(sent,/Updated dated evidence/);assert.ok(!sent.includes('Intermediate writing'));
  const resumed=createChatService(root,{bridge,sessionsRoot:root});await resumed.action({action:'open',topic},origin);
  assert.match(calls.find(c=>c.method==='thread/resume').params.developerInstructions,/Updated dated evidence/);
  assert.equal(messagesFromThread({turns:[{items:[{type:'userMessage',id:'u',content:[{type:'text',text:sent}]}]}]})[0].text,'Practice please');
 }finally{await rm(root,{recursive:true,force:true});}
});
