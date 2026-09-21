import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createChatService,MODEL} from '../chat.mjs';import {lessonInstructions,readLesson} from '../lessons.mjs';
test('difficulty is per topic, persists, reaches prompts and survives a fresh conversation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'upheavel-lessons-'));const calls=[];let seq=0;const saved=new Map();
 const bridge={listeners:new Set(),ready:async()=>{},close(){},async call(method,params){calls.push({method,params});if(method==='thread/start'){const thread={id:'chat-'+(++seq),turns:[]};saved.set(thread.id,thread);return {model:MODEL,thread};}if(method==='thread/resume')return {model:MODEL,thread:saved.get(params.threadId)};if(method==='turn/start')return {turn:{id:'turn'}};return {};}};
 const topic={id:'grammar',projectId:'korean',title:'은/는',category:'Grammar',notes:'Preserved',links:[]},origin='http://127.0.0.1:8793';
 try{const service=createChatService(root,{bridge,sessionsRoot:root});let a=await service.action({action:'open',topic},origin);assert.equal(a.level,null);
  a=await service.action({action:'level',key:a.key,level:3},origin);assert.equal(a.level,3);
  const b=await service.action({action:'open',topic:{...topic,id:'vocabulary',category:'Vocabulary'}},origin);assert.equal(b.level,null);
  await assert.rejects(service.action({action:'level',key:a.key,level:7},origin),/TOPIK level/);
  await service.action({action:'send',key:a.key,text:'Start'},origin);let sent=calls.find(c=>c.method==='turn/start').params.input[0].text;assert.match(sent,/TOPIK 3/);assert.match(sent,/SIX multiple-choice/);assert.match(sent,/English-to-Korean/);
  await assert.rejects(service.action({action:'restart',key:a.key},origin),/Wait/);
  for(const listener of bridge.listeners)listener({method:'turn/completed',params:{threadId:'chat-1',turn:{}}});
  await service.action({action:'level',key:a.key,level:6},origin);
  const beforeNext=await service.action({action:'state',key:a.key},origin);
  const previousMessageCount=beforeNext.messages.length;
  await service.action({action:'send',key:a.key,text:'B'},origin);
  const nextTurn=calls.filter(c=>c.method==='turn/start').at(-1);
  assert.equal(nextTurn.params.threadId,'chat-1');
  const reference=JSON.parse(nextTurn.params.input[0].text.split('[Current topic reference data: ')[1].slice(0,-1));
  assert.match(reference.lessonInstructions,/TOPIK 6/);
  assert.doesNotMatch(reference.lessonInstructions,/TOPIK 3/);
  assert.match(reference.lessonInstructions,/Changing difficulty changes subsequent questions without resetting the phase/);
  const continued=await service.action({action:'state',key:a.key},origin);
  assert.equal(continued.generation,beforeNext.generation);
  assert.equal(continued.messages.length,previousMessageCount+1);
  for(const listener of bridge.listeners)listener({method:'turn/completed',params:{threadId:'chat-1',turn:{}}});
  const restarted=await service.action({action:'restart',key:a.key},origin);assert.equal(restarted.level,6);assert.deepEqual(restarted.messages,[]);assert.notEqual(restarted.generation,a.generation);assert.equal(restarted.key,a.key);
  const newThread=calls.filter(c=>c.method==='thread/start').at(-1);assert.match(newThread.params.developerInstructions,/TOPIK 6/);assert.match(newThread.params.cwd,/lesson-/);
  assert.equal((await readLesson(root,a.key)).level,6);const afterReload=createChatService(root,{bridge,sessionsRoot:root});const loaded=await afterReload.action({action:'open',topic},origin);assert.equal(loaded.level,6);assert.equal(loaded.generation,restarted.generation);
  assert.equal((await service.action({action:'state',key:b.key},origin)).level,null);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('lesson structure is limited to grammar and vocabulary with an English prompt exception',()=>{
 assert.match(lessonInstructions({category:'Vocabulary'},null),/English exercise sentences are an explicit exception/);
 assert.match(lessonInstructions({category:'Grammar'},1),/ONE question per turn/);
 assert.ok(!lessonInstructions({category:'Listening'},3).includes('SIX multiple-choice'));
});

