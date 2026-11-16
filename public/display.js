let last=null,page=0,pageKey='',slideCount=1;
const chunks=(items,n)=>Array.from({length:Math.ceil(items.length/n)},(_,i)=>items.slice(i*n,i*n+n));
setInterval(()=>{if(last&&document.body.classList.contains('tv-display')&&slideCount>1){page=(page+1)%slideCount;renderDisplay(last);}},8000);
export function renderDisplay(context){last=context;const {state:s,app,games,levels,esc,avatar,drawStroke}=context;document.body.classList.add('tv-display');document.querySelector('#app-nav').innerHTML='';const key=[s.code,s.game,s.round,s.phase,s.preview].join(':');if(key!==pageKey){page=0;pageKey=key;}const leader=s.players.find(p=>p.id===s.leaderId);const active=s.players.find(p=>p.id===s.active);const g=games[s.game];const name=id=>esc(s.players.find(p=>p.id===id)?.name||'Игрок');
const roster=(ps=s.players)=>`<div class="tv-roster">${ps.map(p=>`<div class="tv-person ${p.online?'':'offline'}"><span class="avatar">${avatar(p)}</span><span>${esc(p.name)}${p.id===s.leaderId?' <small>★ лидер</small>':''}</span><b>${p.score}</b></div>`).join('')}</div>`;
const scores=()=>`<div class="tv-score-list">${[...s.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div><span>${i+1}. ${esc(p.name)}</span><b>${p.score}</b></div>`).join('')}</div>`;
const options=(items,result=false)=>`<div class="tv-options">${items.map(o=>`<div class="tv-option ${o.correct?'correct':''}"><strong>${o.correct?'✓ ':''}${esc(o.text)}</strong>${result?`<span>${o.votes} голосов${o.correct?' · '+(s.game==='spy'?'шпион':'правильный ответ'):''}${o.author?' · '+name(o.author):''}</span>`:''}</div>`).join('')}</div>`;
let body='',slides=[];
if(s.phase==='lobby'){
 const preview=games[s.preview];body=`<div class="tv-lobby"><div class="tv-join"><img src="/qr.svg?room=${s.code}" width="300" height="300" alt="QR комнаты ${s.code}"><div class="tv-code">${s.code}</div><p>Откройте QR камерой телефона</p></div><div class="tv-lobby-info"><span class="eyebrow">${s.players.length}/12 В КОМНАТЕ</span><h1>${leader?`Лидер — ${esc(leader.name)}`:'Первый вошедший — лидер'}</h1>${roster()}<div class="tv-preview">${preview?`<h2>${preview.icon} ${esc(preview.name)}</h2><p>${esc(preview.desc)}</p><p>${preview.min}–12 игроков · ${preview.time} · ${levels[s.level].name}${preview.themes?' · '+esc(preview.themes[s.topic||'mixed']):''}</p>`:`<h2>${leader?'Выберите игру на телефоне лидера':'Собираем компанию'}</h2><p>Игры, настройки и управление — на телефонах. Лидер тоже играет.</p>`}</div></div></div>`;
 slideCount=1;
}else{
 let title=s.prompt||g?.name||'';let content='';let note='';
 if(s.phase==='finished'){
 title=s.result?.summary||'Партия окончена!';content=`<div class="tv-finish"><div class="tv-trophy">♛</div>${scores()}<p>Следующую игру выбирает лидер на телефоне</p></div>`;
 }else if(s.phase==='result'){
 note=s.result?.summary||'Результаты раунда';
 if(s.result?.votes?.length)slides=chunks(s.result.votes,innerHeight<800||innerWidth<1200?2:4).map(items=>options(items,true));
 else if(s.game==='wavelength'){slides=chunks(s.result.guesses||[],6).map(items=>`<div class="tv-wave"><h2>Точка: ${s.result.target}/100</h2><p>«${esc(s.hint||'')}»</p>${items.map(v=>`<p>${name(v.pid)}: ${v.value} → +${v.score}</p>`).join('')}</div>`);}
 else if(s.game==='draw')content='<canvas class="tv-drawing" id="tv-drawing" width="640" height="420" aria-label="Рисунок раунда"></canvas>';
 else content='<div class="tv-wait-symbol">✳</div>';
 }else if(s.game==='codenames'){
 title=s.clue?`${s.clue.text} · ${s.clue.count}`:'Капитан придумывает подсказку';note=`Ход ${s.turn==='red'?'красных':'синих'} · Красных осталось ${s.left.red} · Синих ${s.left.blue}`;
 content=`<div class="tv-word-board">${s.board.map(c=>`<div class="tv-word ${c.revealed?c.color:'unknown'} ${c.revealed?'revealed':''}">${esc(c.text)}</div>`).join('')}</div>`;
 }else if(s.game==='draw'){
 note=`Рисует ${active?.name||'игрок'} · догадки вводите на телефонах`;content='<canvas class="tv-drawing" id="tv-drawing" width="640" height="420" aria-label="Общий рисунок"></canvas>';
 }else if(s.game==='taboo'){
 note=s.lastWord||'Ответы вводите на телефонах';content=`<div class="tv-center"><span class="tv-wait-symbol">⊘</span><h2>Объясняет ${esc(active?.name||'игрок')}</h2><p>Секретное слово и запреты — только на его телефоне</p></div>`;
 }else if(s.game==='spy'&&s.phase==='discuss'){
 note='Локацию вслух не называйте';content=`<div class="tv-center"><span class="tv-wait-symbol">◉</span><h2>Задавайте друг другу вопросы</h2><p>Лидер включает голосование со своего телефона</p>${roster()}</div>`;
 }else if(s.game==='wavelength'){
 note=s.phase==='hint'?`Подсказку придумывает ${active?.name||'игрок'}`:'Выберите точку на телефоне';content=`<div class="tv-center"><div class="tv-scale"><strong>${esc(s.scale[0])}</strong><span>↔</span><strong>${esc(s.scale[1])}</strong></div><h2>${s.hint?'«'+esc(s.hint)+'»':'Ловим волну…'}</h2></div>`;
 }else if(s.game==='bomb'){
 title=`Слово с «${esc(s.fragment)}»`;note=s.lastWord||'12 секунд на ход';content=`<div class="tv-center"><h2>💣 Бомба у ${esc(active?.name||'игрока')}</h2><div class="tv-lives">${s.players.map(p=>`<div class="${s.lives[p.id]===0?'offline':''}"><span class="avatar">${avatar(p)}</span><strong>${esc(p.name)}</strong><span>${'♥'.repeat(s.lives[p.id])||'выбыл'}</span></div>`).join('')}</div></div>`;
 }else if(s.phase==='write'){
 content=`<div class="tv-center"><div class="tv-wait-symbol">❞</div><h2>Пишите ${s.game==='bluff'?'убедительную выдумку':'свою лучшую шутку'}</h2><p>Ответили ${s.count} из ${s.players.length}</p></div>`;
 }else if(s.options?.length){slides=chunks(s.options,s.game==='most'||s.game==='spy'?6:((s.game==='bluff'||s.game==='quips')&&(innerHeight<800||innerWidth<1200)?2:4)).map(items=>options(items));note=`Ответили ${s.count} из ${s.players.length} · выбирайте на телефонах`;}
 if(slides.length){slideCount=slides.length;page%=slideCount;content=slides[page];}else slideCount=1;
 body=`<div class="tv-play"><div class="tv-question"><h1>${esc(title)}</h1>${note?`<p>${esc(note)}</p>`:''}</div><div class="tv-play-grid"><div class="tv-main">${content}</div>${s.phase==='result'?`<aside class="tv-results">${scores()}</aside>`:''}</div></div>`;
}
app.innerHTML=`<div class="tv-layout"><div class="tv-top"><span class="logo">туса<span>✳</span></span><span>${g?esc(g.name)+' · '+(s.total?`Раунд ${s.round}/${s.total}`:`Ход ${s.round}`):'Общий экран'}</span><span class="tv-room-label">Комната ${s.code}</span>${s.deadline?'<span class="clock" id="clock"></span>':''}</div><div class="tv-body">${body}</div><div class="tv-bottom"><span>${leader?(leader.online?'★ ':'○ ')+esc(leader.name)+(leader.online?' · управление на телефоне':' · ждём подключение, затем передадим лидерство'):'Войдите с телефона, чтобы стать лидером'}</span><span>${slideCount>1?`Экран ${page+1}/${slideCount} · сменится автоматически`:levels[s.level].name}</span></div></div>`;
const canvas=document.querySelector('#tv-drawing');if(canvas){const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9ee';ctx.fillRect(0,0,640,420);for(const stroke of s.drawing||[])drawStroke(ctx,stroke);}
const clock=document.querySelector('#clock');if(clock)clock.textContent=Math.max(0,Math.ceil((s.deadline-Date.now())/1000))+' с';
}

window.addEventListener('resize',()=>{if(last&&document.body.classList.contains('tv-display'))renderDisplay(last);});
