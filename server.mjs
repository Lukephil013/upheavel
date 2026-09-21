import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createChatService} from './chat.mjs';
import {createStudyService} from './study.mjs';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
export function createServer({study=createStudyService(path.dirname(root)),chat=createChatService(path.dirname(root))}={}){const token=randomBytes(32).toString('hex');const server=http.createServer(async(req,res)=>{
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors http://127.0.0.1:8792; object-src 'none'; base-uri 'none'"};
 const send=(code,body,type='text/plain')=>{res.writeHead(code,{...headers,'Content-Type':type+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:body);};
 if(!['127.0.0.1:8793','localhost:8793'].includes(req.headers.host))return send(403,'Local requests only');
 const route=new URL(req.url,'http://127.0.0.1:8793').pathname;
 if(['/api/study','/api/chat'].includes(route)&&req.method==='POST'){
  if(req.headers.origin!==`http://${req.headers.host}`||req.headers['x-upheavel-token']!==token||req.headers['content-type']!=='application/json')return send(403,'Invalid local study request.');
  try{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>500000)return send(413,'Topic is too large.');}const result=await (route==='/api/chat'?chat.action(JSON.parse(text),req.headers.origin):study(JSON.parse(text),req.headers.origin));return send(200,JSON.stringify(result),'application/json');}catch(error){return send(400,JSON.stringify({error:error.message}),'application/json');}
 }
 if(!['GET','HEAD'].includes(req.method))return send(405,'Method not allowed');
 if(route==='/api/study-token')return send(200,JSON.stringify({token}),'application/json');
 if(route.startsWith('/api/study-status/')){
  if(req.headers['x-upheavel-token']!==token)return send(403,'Invalid local study request.');
  const id=route.split('/').pop();if(!/^[a-f0-9]{32}$/.test(id))return send(400,'Invalid study ID.');
  try{return send(200,(await readFile(path.join(path.dirname(root),'study-sessions',id,'launch-status.json'),'utf8')).replace(/^\uFEFF/,''),'application/json');}catch{return send(404,'Study not found.');}
 }
 if(route==='/api/health')return send(200,JSON.stringify({app:'upheavel',version:1}),'application/json');
 const assets={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/styles.css':['styles.css','text/css'],'/app.js':['app.js','text/javascript'],'/core.js':['core.js','text/javascript'],'/chat.js':['chat.js','text/javascript'],'/chat.css':['chat.css','text/css']};
 if(!Object.hasOwn(assets,route))return send(404,'Not found');
 try{const [file,type]=assets[route];send(200,await readFile(path.join(root,file)),type);}catch{send(500,'Could not load the page.');}
});server.on('close',()=>chat.close());return server;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer().listen(8793,'127.0.0.1',()=>console.log('Upheavel: http://127.0.0.1:8793/'));
