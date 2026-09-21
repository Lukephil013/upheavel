import test from 'node:test';import assert from 'node:assert/strict';import {enterAction} from '../dist/chat.js';
test('Enter sends; modified Enter adds a line; IME and held Enter do not send',()=>{
 assert.equal(enterAction({key:'Enter'}),'send');
 for(const modifier of ['ctrlKey','metaKey','shiftKey'])assert.equal(enterAction({key:'Enter',[modifier]:true}),'newline');
 assert.equal(enterAction({key:'Enter',isComposing:true}),null);
 assert.equal(enterAction({key:'Enter',keyCode:229}),null);
 assert.equal(enterAction({key:'Enter',repeat:true}),'ignore');
 assert.equal(enterAction({key:'a'}),null);
});
