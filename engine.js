import {randomBytes} from 'node:crypto';
import {quiz,bluff} from './questions.js';
import {prompts,words,tabooDeck} from './content.js';
import {games} from './public/catalog.js';
export const shuffle=a=>a.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
const id=()=>randomBytes(8).toString('hex');
const norm=s=>String(s).toLocaleLowerCase('ru').replaceAll('ё','е').replace(/[^а-яa-z0-9]/g,'');
const requireThat=(v,msg)=>{if(!v)throw Error(msg);};
export function takeDeck(r,key,pool,count){
 r.bags ||= {};r.bags[key] ||= [];const out=[],used=new Set();const max=Math.min(count,pool.length);let guard=0;
 while(out.length<max&&guard++<pool.length*3+max){if(!r.bags[key].length)r.bags[key]=shuffle(pool);const item=r.bags[key].shift();const signature=JSON.stringify(item);if(used.has(signature)){r.bags[key].push(item);continue;}used.add(signature);out.push(item);}return out;
}
export function makeEngine(emit){
 function timer(r,sec){clearTimeout(r.timer);r.deadline=Date.now()+sec*1000;r.timer=setTimeout(()=>advance(r),sec*1000);r.timer.unref();}
 function result(r,data={}){clearTimeout(r.timer);r.deadline=null;r.phase='result';r.result={votes:[],gains:{},...data};emit(r);}
 function finish(r,summary){clearTimeout(r.timer);r.deadline=null;r.phase='finished';r.result={votes:[],gains:{},summary};emit(r);}
 function gain(r,pid,n){const p=r.players.find(p=>p.id===pid);if(p)p.score+=n;}
 function eligible(r){return r.players.filter(p=>!(r.phase==='vote'&&r.game==='quips'&&r.options.every(o=>o.author===p.id))&& !(['draw','taboo','wavelength'].includes(r.game)&&p.id===r.active));}
 function all(r){return eligible(r).length>0&&eligible(r).every(p=>Object.hasOwn(r.answers,p.id));}
 function turnCode(r){r.turn=r.turn==='red'?'blue':'red';r.clue=null;r.remaining=0;r.phase='clue';r.round++;timer(r,120);emit(r);}
 function codeWin(r){const team=['red','blue'].find(t=>r.board.filter(c=>c.color===t).every(c=>c.revealed));if(team){r.winner=team;for(const p of r.players)if(p.team===team)gain(r,p.id,2000);finish(r,`Победила ${team==='red'?'красная':'синяя'} команда!`);return true;}return false;}
 function tabooCard(r){r.secret=takeDeck(r,'taboo:'+r.level,tabooDeck(r.level),1)[0];emit(r);}
 function bombTurn(r){const alive=r.players.filter(p=>r.lives[p.id]>0);if(alive.length<=1){if(alive[0])gain(r,alive[0].id,1000);finish(r,alive[0]?`${alive[0].name} обезвредил бомбу!`:'Бомба не пощадила никого.');return;}let index=r.order.indexOf(r.active);for(let i=0;i<r.order.length;i++){index=(index+1)%r.order.length;const pid=r.order[index];if(alive.some(p=>p.id===pid)){r.active=pid;break;}}r.fragment=shuffle(['ст','ко','ра','ро','ка','на','по','ре','ли','во','та','ри','ма','но','са','ла','ар','ор'])[0];r.phase='turn';timer(r,12);emit(r);}
 function round(r){r.round++;r.answers={};r.options=[];r.result=null;r.drawing=[];r.hint=null;r.active=r.order[(r.round-1)%r.order.length];
 const q=r.deck?.[r.round-1];r.question=q;
 if(r.game==='quiz'){r.prompt=q[0];r.options=q[1].map((text,i)=>({id:String(i),text}));r.phase='answer';timer(r,30);}
 if(r.game==='most'){r.prompt=q;r.options=r.players.map(p=>({id:p.id,text:p.name}));r.phase='answer';timer(r,30);}
 if(r.game==='bluff'){r.prompt=q[0];r.phase='write';timer(r,60);}
 if(r.game==='quips'){r.prompt=q;r.phase='write';timer(r,60);}
 if(r.game==='draw'){r.prompt='Что рисует художник?';r.secret=q;r.phase='draw';timer(r,90);}
 if(r.game==='taboo'){r.prompt='Объясняйте вслух, угадывайте с телефонов';r.phase='explain';timer(r,60);tabooCard(r);}
 if(r.game==='spy'){r.prompt='Задавайте вопросы вслух. Кто здесь чужой?';r.secret=q;r.spy=shuffle(r.players)[0].id;r.phase='discuss';r.spyTried=false;timer(r,180);}
 if(r.game==='wavelength'){r.prompt=q.join(' ↔ ');r.scale=q;r.target=10+Math.floor(Math.random()*81);r.phase='hint';timer(r,60);}
 emit(r);}
 function start(r,game){requireThat(games[game],'Неизвестная игра');requireThat(r.phase==='lobby','Игра уже идёт');requireThat(r.players.filter(p=>p.online).length>=games[game].min,`Нужно хотя бы ${games[game].min} подключённых игрока`);
 requireThat(r.players.every(p=>p.online),'Дождитесь подключения всех игроков или удалите ушедших из лобби');
 if(game==='codenames')for(const t of ['red','blue']){requireThat(r.players.filter(p=>p.team===t).length>=2,'В каждой команде нужно хотя бы два игрока');requireThat(r.players.filter(p=>p.team===t&&p.captain).length===1,'Выберите по одному капитану в каждой команде');}
 r.game=game;r.round=0;r.order=r.players.map(p=>p.id);r.total=['draw','taboo','wavelength'].includes(game)?r.players.length:5;r.answers={};r.result=null;r.winner=null;
 for(const p of r.players)p.score=0;
 const level=r.level||'light';r.deck=takeDeck(r,game+':'+level,game==='quiz'?quiz:game==='bluff'?bluff:game==='most'?prompts.most[level]:game==='quips'?prompts.quips[level]:game==='draw'?prompts.draw[level]:game==='spy'?prompts.spy[level]:game==='wavelength'?prompts.scales[level]:[],r.total);
 if(game==='taboo')r.taboo=shuffle(tabooDeck(level));
 if(game==='codenames'){r.total=null;r.round=1;r.turn='red';r.remaining=0;r.clue=null;r.phase='clue';const colors=shuffle([...Array(9).fill('red'),...Array(8).fill('blue'),...Array(7).fill('neutral'),'assassin']);r.board=takeDeck(r,'codenames:'+level+':'+(r.topic||'mixed'),words(level,r.topic),25).map((text,i)=>({id:String(i),text,color:colors[i],revealed:false}));timer(r,120);emit(r);}
 else if(game==='bomb'){r.total=null;r.round=1;r.used=[];r.lives=Object.fromEntries(r.players.map(p=>[p.id,3]));r.active=r.order.at(-1);r.lastWord=null;bombTurn(r);}
 else round(r);
 }
 function advance(r){clearTimeout(r.timer);
 if(r.game==='codenames'){turnCode(r);return;}
 if(r.game==='bomb'){r.lives[r.active]--;r.lastWord='💥 Время вышло!';r.round++;bombTurn(r);return;}
 if(r.game==='spy'&&r.phase==='discuss'){r.phase='vote';r.answers={};r.options=r.players.map(p=>({id:p.id,text:p.name}));timer(r,30);emit(r);return;}
 if(r.game==='wavelength'&&r.phase==='hint'){result(r,{summary:'Подсказка не успела появиться. Следующий игрок!',target:r.target});return;}
 if(r.phase==='write'){
 if(r.game==='bluff'){const opts=new Map([[norm(r.question[1]),{id:id(),text:r.question[1],correct:true,authors:[]}]]);for(const p of r.players){const text=r.answers[p.id];if(!text)continue;const key=norm(text);if(opts.has(key))opts.get(key).authors.push(p.id);else opts.set(key,{id:id(),text,authors:[p.id]});}r.options=shuffle([...opts.values()]);}
 else r.options=shuffle(Object.entries(r.answers).map(([author,text])=>({id:id(),text,author})));
 if(!r.options.length){result(r,{summary:'Никто не прислал шутку. Давайте попробуем ещё раз!'});return;}
 r.answers={};r.phase='vote';timer(r,30);emit(r);return;
 }
 if(['draw','explain'].includes(r.phase)){result(r,{summary:r.game==='draw'?`На рисунке: ${r.secret}`:'Время объясняющего закончилось.'});return;}
 if(r.game==='wavelength'){const gains={};for(const [pid,v]of Object.entries(r.answers)){gains[pid]=Math.max(0,1000-50*Math.abs(v-r.target));gain(r,pid,gains[pid]);}const average=Math.round(Object.values(gains).reduce((a,b)=>a+b,0)/Math.max(1,Object.keys(gains).length));gain(r,r.active,average);result(r,{target:r.target,hint:r.hint,guesses:Object.entries(r.answers).map(([pid,value])=>({pid,value,score:gains[pid]})),summary:`Точка была на ${r.target}. За подсказку: ${average} очков.`});return;}
 if(!['answer','vote'].includes(r.phase))return;
 const gains=Object.fromEntries(r.players.map(p=>[p.id,0]));let correct=null;
 if(r.game==='quiz'){correct=String(r.question[2]);for(const p of r.players)if(r.answers[p.id]===correct)gains[p.id]=1000;}
 if(r.game==='most')for(const p of r.players)if(r.answers[p.id])gains[p.id]=200;
 if(r.game==='bluff'){correct=r.options.find(o=>o.correct).id;for(const [pid,v]of Object.entries(r.answers)){const o=r.options.find(o=>o.id===v);if(o?.correct)gains[pid]+=1000;else for(const author of o?.authors||[])if(author in gains)gains[author]+=500;}}
 if(r.game==='quips')for(const v of Object.values(r.answers)){const author=r.options.find(o=>o.id===v)?.author;if(author in gains)gains[author]+=500;}
 if(r.game==='spy'){const counts=r.players.map(p=>({id:p.id,count:Object.values(r.answers).filter(v=>v===p.id).length})).sort((a,b)=>b.count-a.count);const caught=counts[0]?.id===r.spy&&counts[0].count>0&&counts[0].count>(counts[1]?.count||0);for(const p of r.players)gains[p.id]=caught?(p.id!==r.spy?500:0):(p.id===r.spy?1500:0);correct=r.spy;}
 for(const p of r.players)gain(r,p.id,gains[p.id]);
 result(r,{correct,gains,votes:r.options.map(o=>({id:o.id,text:o.text,votes:Object.values(r.answers).filter(v=>v===o.id).length,correct:o.id===correct,author:r.game==='quips'?o.author:undefined})),summary:r.game==='spy'?`Локация: ${r.secret}. Шпион: ${r.players.find(p=>p.id===r.spy)?.name}. ${gains[r.spy]?'Шпион ушёл!':'Шпион пойман!'}`:null});
 }
 function answer(r,p,value){requireThat(p,'Ведущий не отвечает');
 if(r.game==='draw'||r.game==='taboo'){requireThat(['draw','explain'].includes(r.phase),'Раунд закрыт');requireThat(p.id!==r.active,'Вы сейчас объясняете');const text=String(value||'').trim();requireThat(text.length>0&&text.length<=100,'Введите ответ до 100 символов');requireThat(!Object.hasOwn(r.answers,p.id)||r.game==='taboo','Вы уже угадали');const match=norm(text)===norm(r.game==='draw'?r.secret:r.secret.word);if(!match)return {feedback:'Пока не то. Попробуйте ещё!'};gain(r,p.id,r.game==='draw'?1000:500);gain(r,r.active,500);if(r.game==='draw'){r.answers[p.id]=text;if(all(r))result(r,{summary:`Угадали! На рисунке: ${r.secret}`});else emit(r);}else{r.lastWord=`${p.name} угадал: ${r.secret.word}`;tabooCard(r);}return {feedback:'Точно! +'+(r.game==='draw'?1000:500)};}
 if(r.game==='bomb'){requireThat(r.phase==='turn'&&r.active===p.id,'Сейчас ход другого игрока');const text=String(value||'').trim().toLocaleLowerCase().replaceAll('ё','е');requireThat(/^[а-я]{3,30}$/.test(text),'Нужно русское слово от 3 до 30 букв');requireThat(text.includes(r.fragment),`В слове должно быть «${r.fragment}»`);requireThat(!r.used.includes(text),'Это слово уже было');r.used.push(text);gain(r,p.id,100);r.lastWord=p.name+': '+text;r.round++;bombTurn(r);return;}
 requireThat(['write','answer','vote','guess'].includes(r.phase),'Сейчас нельзя отвечать');requireThat(!Object.hasOwn(r.answers,p.id),'Ответ уже принят');
 if(r.game==='wavelength'){requireThat(p.id!==r.active,'Вы дали подсказку');requireThat(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=100,'Выберите точку от 0 до 100');r.answers[p.id]=value;}
 else{const text=String(value||'').trim();if(r.phase==='write'){requireThat(text.length>=2&&text.length<=140,'Ответ: от 2 до 140 символов');if(r.game==='bluff')requireThat(norm(text)!==norm(r.question[1]),'Вы угадали правду! Придумайте другой ответ');}
 else{const o=r.options.find(o=>o.id===text);requireThat(o,'Выберите ответ');requireThat(!(['most','spy'].includes(r.game)&&text===p.id),'За себя нельзя');requireThat(!(r.game==='bluff'&&o.authors.includes(p.id)),'За свой ответ нельзя');requireThat(!(r.game==='quips'&&o.author===p.id),'За себя нельзя');}
 r.answers[p.id]=text;}
 if(all(r))advance(r);else emit(r);
 }
 function act(r,p,data){requireThat(p,'Используйте телефон игрока');
 if(r.game==='codenames'){
 requireThat(['clue','guess'].includes(r.phase),'Партия завершена');requireThat(p.team===r.turn,'Ход другой команды');
 if(data.kind==='clue'){requireThat(p.captain&&r.phase==='clue','Подсказку даёт капитан в начале хода');const text=String(data.text||'').trim();requireThat(/^[а-яА-ЯёЁa-zA-Z-]{2,30}$/.test(text),'Подсказка — одно слово без цифр');requireThat(!r.board.some(c=>!c.revealed&&norm(c.text)===norm(text)),'Нельзя использовать слово с поля');requireThat(Number.isInteger(data.count)&&data.count>=1&&data.count<=9,'Число от 1 до 9');r.clue={text,count:data.count};r.remaining=data.count+1;r.phase='guess';timer(r,120);emit(r);return;}
 requireThat(!p.captain&&r.phase==='guess','Открывают карты угадывающие после подсказки');
 if(data.kind==='pass'){turnCode(r);return;}
 requireThat(data.kind==='card','Выберите карту');const c=r.board.find(c=>c.id===String(data.id));requireThat(c&&!c.revealed,'Карта уже открыта');c.revealed=true;r.remaining--;
 if(c.color==='assassin'){r.winner=r.turn==='red'?'blue':'red';for(const player of r.players)if(player.team===r.winner)gain(r,player.id,2000);finish(r,`Чёрная карта! Победила ${r.winner==='red'?'красная':'синяя'} команда.`);return;}
 if(codeWin(r))return;if(c.color!==r.turn||r.remaining<=0)turnCode(r);else emit(r);return;
 }
 if(r.game==='draw'){requireThat(r.phase==='draw'&&p.id===r.active,'Сейчас рисует другой игрок');if(data.kind==='clear'){r.drawing=[];emit(r);return;}requireThat(data.kind==='stroke'&&r.drawing.length<120,'Слишком много штрихов: очистите холст');const points=data.points;requireThat(Array.isArray(points)&&points.length>=1&&points.length<=250&&points.every(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)),'Некорректный штрих');r.drawing.push({points,color:['#1d1830','#ff5c77','#6f50dd','#31965c'].includes(data.color)?data.color:'#1d1830',width:data.width===12?12:4});emit(r);return;}
 if(r.game==='wavelength'){requireThat(r.phase==='hint'&&p.id===r.active,'Подсказку даёт другой игрок');const text=String(data.text||'').trim();requireThat(text.length>=2&&text.length<=100&&!/\d/.test(text),'Напишите пример без цифр, от 2 до 100 символов');r.hint=text;r.phase='guess';timer(r,45);emit(r);return;}
 if(r.game==='spy'){requireThat(r.phase==='discuss'&&p.id===r.spy,'Локацию угадывает только шпион во время обсуждения');requireThat(!r.spyTried,'У вас одна попытка');const text=String(data.text||'').trim();requireThat(text.length>=2&&text.length<=100,'Введите локацию');r.spyTried=true;if(norm(text)===norm(r.secret)){gain(r,p.id,1500);result(r,{summary:`Шпион ${p.name} угадал локацию: ${r.secret}. +1 500 очков!`});}else{for(const other of r.players)if(other.id!==r.spy)gain(r,other.id,500);result(r,{summary:`Шпион ${p.name} ошибся. Локация: ${r.secret}. Остальным по 500!`});}return;}
 if(r.game==='taboo'){requireThat(r.phase==='explain'&&p.id===r.active,'Сейчас объясняет другой игрок');requireThat(['skip','foul'].includes(data.kind),'Неизвестное действие');if(data.kind==='foul')gain(r,p.id,-200);r.lastWord=(data.kind==='foul'?'Нарушение: ':'Пропуск: ')+r.secret.word;tabooCard(r);return;}
 throw Error('Действие недоступно');
 }
 function next(r){requireThat(r.phase==='result','Сначала завершите раунд');if(r.round>=r.total)finish(r,'Партия окончена!');else round(r);}
 function lobby(r){clearTimeout(r.timer);for(const key of ['board','drawing','secret','taboo','lives','used','clue','hint','target','spy','active','lastWord','scale'])delete r[key];Object.assign(r,{phase:'lobby',game:null,round:0,answers:{},options:[],result:null,prompt:null,deadline:null});emit(r);}
 function leave(r,p){r.players=r.players.filter(x=>x!==p);delete r.answers[p.id];if(r.phase==='lobby'){emit(r);return;}
 if(r.players.length<games[r.game].min||['codenames','spy','bomb'].includes(r.game)||(['draw','taboo','wavelength'].includes(r.game)&&r.active===p.id)){lobby(r);return;}
 r.order=r.order.filter(pid=>pid!==p.id);if(['draw','taboo','wavelength'].includes(r.game))r.total=Math.max(r.round,r.total-1);
 if(['most','spy'].includes(r.game)){r.options=r.options.filter(o=>o.id!==p.id);for(const [pid,v]of Object.entries(r.answers))if(v===p.id)delete r.answers[pid];}
 if(['write','answer','vote','guess','draw'].includes(r.phase)&&all(r))advance(r);else emit(r);
 }
 function view(r,p){const v={active:r.active,lastWord:r.lastWord};
 if(r.game==='codenames'){v.board=r.board.map(c=>({...c,color:c.revealed||p?.captain||r.phase==='finished'?c.color:null}));v.turn=r.turn;v.clue=r.clue;v.remaining=r.remaining;v.winner=r.winner;v.left={red:r.board.filter(c=>c.color==='red'&&!c.revealed).length,blue:r.board.filter(c=>c.color==='blue'&&!c.revealed).length};}
 if(r.game==='draw'){v.drawing=r.drawing;if(p?.id===r.active&&r.phase==='draw')v.secret=r.secret;}
 if(r.game==='taboo'&&p?.id===r.active&&r.phase==='explain')v.secret=r.secret;
 if(r.game==='spy'&&p&&r.phase==='discuss'){v.role=p.id===r.spy?'spy':'citizen';if(p.id!==r.spy)v.secret=r.secret;}
 if(r.game==='wavelength'){v.scale=r.scale;v.hint=r.hint;if(p?.id===r.active&&r.phase==='hint')v.target=r.target;}
 if(r.game==='bomb'){v.lives=r.lives;v.fragment=r.fragment;v.used=r.used.slice(-12);}
 return v;
 }
 return {start,answer,act,next,lobby,leave,view,advance};
}
