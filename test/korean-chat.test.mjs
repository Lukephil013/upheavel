import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createTranslator,translationInput,invalidGloss} from '../translations.mjs';import {createChatService,MODEL} from '../chat.mjs';import {topicKey} from '../study.mjs';
test('reset ignores old conversations and progress while preserving shared level',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'upheavel-reset-'));const calls=[];const topic={id:'one',projectId:'korean',title:'있다',category:'Grammar',notes:'Board note',links:[]},origin='http://127.0.0.1:8793';
 try{const dir=path.join(root,'study-sessions',topicKey(topic,origin));await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'chat-session.json'),JSON.stringify({threadId:'old-chat'}));await writeFile(path.join(dir,'PROGRESS.md'),'OLD_PRIVATE_PROGRESS');await writeFile(path.join(root,'chat-settings.json'),JSON.stringify({generation:'fresh-test'}));await writeFile(path.join(root,'learner-profile.md'),'Intermediate learner');
 const bridge={listeners:new Set(),ready:async()=>{},close(){},async call(method,params){calls.push({method,params});return {model:MODEL,thread:{id:'new-chat',turns:[]}};}};const service=createChatService(root,{bridge,sessionsRoot:root});const result=await service.action({action:'open',topic},origin);assert.equal(calls[0].method,'thread/start');assert.equal(result.generation,'fresh-test');assert.deepEqual(result.messages,[]);assert.match(calls[0].params.developerInstructions,/ALL visible tutor responses in Korean/);assert.match(calls[0].params.developerInstructions,/Intermediate learner/);assert.ok(!calls[0].params.developerInstructions.includes('OLD_PRIVATE_PROGRESS'));assert.equal(calls[0].params.cwd,path.join(root,'study-sessions','fresh-test',topicKey(topic,origin)));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('hover translation is contextual, cached and separate from study history',async()=>{
 const calls=[];const c={listeners:new Set(),async call(method,params){calls.push({method,params});if(method==='thread/start')return {thread:{id:'dictionary'}};if(method==='turn/start'){setTimeout(()=>{for(const listener of [...c.listeners]){listener({method:'item/completed',params:{threadId:'dictionary',item:{type:'agentMessage',text:'time (subject marker 이)'}}});listener({method:'turn/completed',params:{threadId:'dictionary',turn:{}}});}},0);return {turn:{id:'translation'}};}return {};}};
 const cacheDirectory=await mkdtemp(path.join(os.tmpdir(),'upheavel-dictionary-'));try{const translate=createTranslator(async()=>c,{cacheDirectory});const a=await translate('시간이','시간이 있어요.');assert.match(a.translation,/time/);assert.deepEqual(await translate('시간이','시간이 있어요.'),a);assert.equal(calls.filter(c=>c.method==='turn/start').length,1);assert.equal(calls[0].params.ephemeral,true);assert.match(calls.find(c=>c.method==='turn/start').params.input[0].text,/⟦시간이⟧ 있어요/);assert.equal(c.listeners.size,0);await assert.rejects(translate('x','irrelevant'),/Invalid/);
 const restarted=createTranslator(async()=>{throw new Error('AI must not be called for a saved translation');},{cacheDirectory});
 assert.deepEqual(await restarted('시간이','시간이   있어요.'),a);
 await assert.rejects(restarted('시간이','시간이 없어요.'),/AI must not/);
 }finally{await rm(cacheDirectory,{recursive:true,force:true});}
});

test('dictionary explicitly marks the visible target and rejects false absence answers',()=>{
 const input=translationInput('새','민지가 왔어요라고 하면 온 사람이 민지라는 새 정보에 초점이 있어요.');
 assert.ok(input.context.includes('⟦새⟧ 정보'));assert.equal(input.word,'새');
 assert.ok(invalidGloss("here, the word isn’t used in the supplied text."));assert.ok(!invalidGloss('new — 새 정보 means new information.'));
});
