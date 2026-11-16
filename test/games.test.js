import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {io as client} from 'socket.io-client';
import {server,io} from '../server.js';
let url;const sockets=[];
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;});
after(()=>{for(const s of sockets)s.disconnect();io.close();});
async function connect(){const s=client(url,{transports:['websocket'],forceNew:true});sockets.push(s);s.on('state',v=>s.state=v);await new Promise(r=>s.on('connect',r));return s;}
const call=(s,e,d={})=>new Promise((resolve,reject)=>s.timeout(2000).emit(e,d,(err,r)=>err?reject(err):resolve(r)));
test('room auth, validation, reconnect and complete games',async()=>{
 const h=await connect(),a=await connect(),b=await connect();let controller=a;const room=await call(h,'create');assert.ok(room.ok);assert.equal(room.code.length,5);
 const aa=await call(a,'join',{code:room.code,name:'Аня'});assert.ok(aa.ok);assert.equal((await call(b,'join',{code:room.code,name:'АНЯ'})).ok,false);
 assert.ok((await call(b,'join',{code:room.code,name:'Боря'})).ok);assert.equal((await call(h,'start',{game:'quiz'})).ok,false);
 const outsider=await connect();assert.equal((await call(outsider,'resume',{code:room.code,token:'bad'})).ok,false);
 a.disconnect();const resumed=await connect();assert.ok((await call(resumed,'resume',aa)).ok);assert.equal(resumed.state.me,a.state.me);controller=resumed;
 for(const game of ['quiz','most','bluff']){
 assert.ok((await call(controller,'start',{game})).ok);assert.equal(h.state.round,1);assert.equal((await call(outsider,'join',{code:room.code,name:'Поздний'})).ok,false);
 for(let round=1;round<=5;round++){
 assert.equal(h.state.round,round);assert.equal(h.state.result,null);
 assert.equal((await call(h,'answer',{value:'0'})).ok,false);
 if(game==='bluff'){
 assert.ok((await call(resumed,'answer',{value:'Выдумка А '+round})).ok);
 assert.ok((await call(b,'answer',{value:'Выдумка Б '+round})).ok);assert.equal(h.state.phase,'vote');
 const options=h.state.options;const mine=options.find(o=>o.text==='Выдумка А '+round);assert.equal((await call(resumed,'answer',{value:mine.id})).ok,false);
 const truth=options.find(o=>!o.text.startsWith('Выдумка'));await call(resumed,'answer',{value:truth.id});await call(b,'answer',{value:truth.id});
 }else if(game==='most'){
 assert.equal((await call(resumed,'answer',{value:resumed.state.me})).ok,false);
 await call(resumed,'answer',{value:b.state.me});await call(b,'answer',{value:resumed.state.me});
 }else{assert.equal((await call(resumed,'answer',{value:'invalid'})).ok,false);await call(resumed,'answer',{value:'0'});assert.equal((await call(resumed,'answer',{value:'1'})).ok,false);await call(b,'answer',{value:'0'});}
 assert.equal(h.state.phase,'result');assert.ok(h.state.result);assert.equal((await call(b,'next')).ok,false);assert.ok((await call(controller,'next')).ok);
 }
 assert.equal(h.state.phase,'finished');if(game==='bluff')assert.equal(h.state.players[0].score,5000);if(game==='most')assert.equal(h.state.players[0].score,1000);
 assert.ok((await call(controller,'lobby')).ok);assert.equal(h.state.phase,'lobby');
 }
});
test('static files and health',async()=>{assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url+'/app.js')).status,200);assert.equal((await fetch(url+'/unknown')).status,404);assert.deepEqual(await (await fetch(url+'/health')).json(),{ok:true});});
function waitState(s,predicate){if(predicate(s.state))return Promise.resolve();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{s.off('state',listener);reject(Error('State timeout'));},2000);function listener(v){if(predicate(v)){clearTimeout(timeout);s.off('state',listener);resolve();}}s.on('state',listener);});}
test('return to same lobby mid-game, switch game, leave and close room',async()=>{
 const h=await connect(),a=await connect(),b=await connect(),c=await connect();let controller=a;const room=await call(h,'create');
 const aa=await call(a,'join',{code:room.code,name:'Лена'});await call(b,'join',{code:room.code,name:'Макс'});await call(c,'join',{code:room.code,name:'Саша'});
 await call(controller,'start',{game:'bluff'});assert.equal((await call(b,'lobby')).ok,false);
 await call(controller,'lobby');await waitState(a,s=>s.phase==='lobby');await waitState(b,s=>s.phase==='lobby');assert.equal(a.state.phase,'lobby');assert.equal(a.state.code,room.code);assert.equal(a.state.me,b.state.players.find(p=>p.name==='Лена').id);assert.equal(h.state.players.length,3);assert.equal(h.state.deadline,null);
 await call(controller,'start',{game:'quiz'});await waitState(a,s=>s.game==='quiz');assert.equal(a.state.game,'quiz');assert.equal(a.state.code,room.code);
 await call(a,'answer',{value:'0'});await call(b,'answer',{value:'0'});await call(c,'leave');await waitState(h,s=>s.phase==='result');assert.equal(h.state.phase,'result');assert.equal(h.state.players.length,2);
 const retry=await connect();assert.equal((await call(retry,'resume',aa)).ok,true);controller=retry;
 await call(controller,'lobby');assert.equal(h.state.players.length,2);await call(a,'leave');assert.equal(h.state.players.length,2); // replaced socket has no room
 await call(retry,'leave');await waitState(h,s=>s.players.length===1);assert.equal(h.state.players.length,1);assert.equal((await call(a,'resume',aa)).ok,false);
 const closed=new Promise(resolve=>b.once('closed',resolve));await call(b,'closeRoom');await closed;assert.equal((await call(b,'resume',{code:room.code,token:'bad'})).ok,false);assert.ok((await call(b,'create')).ok);
});
