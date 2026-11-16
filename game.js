/* KONTAKT CINEMATIC: turn-based JS fighting game with procedural 3D rigs and WebAudio. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), {Arena3D,clamp,mix,smooth}=window.Arena3D;
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)], clone=a=>JSON.parse(JSON.stringify(a));
const ARCH={balanced:{name:'ТАКТИК',power:1,speed:1.0,aim:.05,hp:106,def:1},power:{name:'ТАРАН',power:1.14,speed:.89,aim:-.02,hp:120,def:1.09},agile:{name:'ТЕНЬ',power:.92,speed:1.17,aim:.02,hp:96,def:.93}};
const BUILD={slim:{hp:-7,power:.95,speed:1.05},athletic:{hp:0,power:1,speed:1},heavy:{hp:13,power:1.07,speed:.95}};
const MOVES={
 jaw:{name:'Удар в челюсть',accuracy:.81,damage:[15,23],cost:17,range:3.3,crit:.20,duration:.81,speed:1.1,zone:'face'},
 elbow:{name:'Удар локтем',accuracy:.84,damage:[17,25],cost:19,range:2.6,crit:.13,duration:.79,speed:1.04,zone:'face'},
 knee:{name:'Удар коленом',accuracy:.75,damage:[19,27],cost:23,range:2.85,crit:.14,duration:.92,speed:.97,zone:'torso'},
 sweep:{name:'Подсечка',accuracy:.87,damage:[10,17],cost:14,range:3.15,crit:.06,duration:.93,speed:1.16,zone:'leg'},
 hipthrow:{name:'Бросок через бедро',accuracy:.69,damage:[25,34],cost:29,range:2.45,crit:.13,duration:1.62,speed:.83,zone:'torso',isThrow:true},
 tripthrow:{name:'Задняя подножка',accuracy:.76,damage:[20,29],cost:25,range:2.6,crit:.09,duration:1.48,speed:.91,zone:'leg',isThrow:true},
 stepin:{name:'Шаг вперёд',cost:6,duration:.70,speed:1.3,utility:true},
 stepback:{name:'Шаг назад',cost:5,duration:.70,speed:1.3,utility:true},
 guard:{name:'Защита',cost:0,duration:.55,speed:1.2,utility:true}
};
const COLORSETS={skin:['#edc7a8','#c58a67','#986b50','#624638'],eyes:['#9dcbec','#83b58a','#a07c5c','#c9d0d0'],top:['#ae554a','#d4cdc0','#416f7f','#536075','#607355'],pants:['#283946','#665e55','#40564b','#815e4b']};
const P1={name:'НОВА',archetype:'balanced',build:'athletic',hair:'short',outfit:'tank',eyes:'#9dcbec',skin:'#c58a67',top:'#ae554a',pants:'#283946'};
const P2={name:'КРАШ',archetype:'power',build:'heavy',hair:'mohawk',outfit:'tee',eyes:'#a07c5c',skin:'#986b50',top:'#416f7f',pants:'#40564b'};
let mode='ai',editorIndex=0,editing=clone(P1),chosen=[null,null],game=null,screen='setup', muted=false,cinematic=true,lastTime=0,preview,fight;
const active={};
class Sound {
 constructor(){this.ctx=null;this.buffer=null;this.enabled=true;}
 init(){if(!this.enabled)return;try{if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=this.ctx=new C();this.buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);let d=this.buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}if(this.ctx.state==='suspended')this.ctx.resume();}catch(e){console.warn('WebAudio:',e)}}
 tone(hz,to,duration=.15,gain=.18,type='sine',delay=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,now=c.currentTime+delay,osc=c.createOscillator(),env=c.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(20,hz),now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),now+duration);env.gain.setValueAtTime(.001,now);env.gain.exponentialRampToValueAtTime(gain,now+.009);env.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(env);env.connect(c.destination);osc.start(now);osc.stop(now+duration+.02)}
 noise(duration=.17,hz=700,gain=.14,delay=0){if(!this.enabled||!this.ctx||!this.buffer)return;const c=this.ctx,now=c.currentTime+delay,src=c.createBufferSource(),f=c.createBiquadFilter(),env=c.createGain();src.buffer=this.buffer;src.loop=true;f.type='bandpass';f.frequency.value=hz;f.Q.value=.7;env.gain.setValueAtTime(.001,now);env.gain.exponentialRampToValueAtTime(gain,now+.007);env.gain.exponentialRampToValueAtTime(.001,now+duration);src.connect(f);f.connect(env);env.connect(c.destination);src.start(now);src.stop(now+duration+.02)}
 play(kind){if(!this.enabled)return;this.init();if(!this.ctx)return;
  switch(kind){
  case 'bell':this.tone(550,430,.55,.12,'triangle');this.tone(830,600,.55,.045,'sine',.06);break;
  case 'step':this.noise(.085,120,.12);this.tone(85,58,.10,.08,'sine');break;
  case 'guard':this.tone(350,230,.15,.065,'triangle');this.noise(.09,1250,.05);break;
  case 'whoosh':this.noise(.23,1750,.17);this.noise(.13,3400,.05,.05);break;
  case 'punch':this.tone(120,54,.18,.26);this.noise(.16,320,.20);this.noise(.08,2800,.08);break;
  case 'elbow':this.tone(140,55,.20,.28);this.noise(.20,430,.22);this.noise(.08,3800,.10);break;
  case 'knee':this.tone(105,44,.27,.34);this.noise(.26,230,.19);break;
  case 'sweep':this.tone(105,45,.17,.14);this.noise(.22,990,.11);break;
  case 'grab':this.noise(.21,520,.13);this.tone(170,100,.12,.10,'triangle');break;
  case 'throw':this.tone(105,41,.35,.35);this.noise(.35,170,.32);this.noise(.15,700,.12,.03);break;
  case 'whiff':this.noise(.18,2300,.16);break;
  case 'ko':this.tone(94,31,.70,.26);this.tone(228,50,.70,.10,'triangle',.08);break;
  }
 }
}
const sound=new Sound();
function makeFighter(cfg,side){const a=ARCH[cfg.archetype],b=BUILD[cfg.build],hp=a.hp+b.hp;return {cfg:clone(cfg),name:(cfg.name||'БОЕЦ').trim().slice(0,14).toUpperCase(),side,facing:side===1?1:-1,hp,maxHp:hp,energy:100,power:a.power*b.power,speed:a.speed*b.speed,aim:a.aim,def:a.def,scars:[],x:side===1?-1.50:1.50,renderX:side===1?-1.50:1.50,renderZ:side===1?.09:-.09,pose:{},guard:false,ko:null,stumble:0,miss:0};}
function setupSwatches(){for(let [key,values] of Object.entries(COLORSETS)){const host=$(key);host.replaceChildren();for(let v of values){const b=document.createElement('button');b.className='swatch';b.style.setProperty('--sw',v);b.type='button';b.dataset.colorKey=key;b.dataset.colorValue=v;b.setAttribute('aria-label',key+': '+v);b.title=v;host.append(b);}}}
function renderSetup(){for(let [key,id] of [['archetype','class'],['build','build'],['hair','hair'],['outfit','outfit']])$(id).value=editing[key];$('name').value=editing.name;
 document.querySelectorAll('[data-color-key]').forEach(b=>{const on=editing[b.dataset.colorKey]===b.dataset.colorValue;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false')});
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 $('previewName').textContent=editing.name||'БОЕЦ';$('previewSubtitle').textContent=ARCH[editing.archetype].name+' · '+({slim:'СУХОЙ',athletic:'АТЛЕТ',heavy:'МАССИВНЫЙ'})[editing.build];
 const st=ARCH[editing.archetype],bu=BUILD[editing.build];$('powerStat').textContent=Math.round(st.power*bu.power*70);$('speedStat').textContent=Math.round(st.speed*bu.speed*70);$('defStat').textContent=Math.round((st.hp+bu.hp)*.69);
 $('personNum').textContent=editorIndex===0?'БОЕЦ 01':'БОЕЦ 02';$('setupStep').textContent=editorIndex===0?'01 / СОЗДАНИЕ БОЙЦА':'01 / СОЗДАНИЕ СОПЕРНИКА';
 $('modeChoice').style.display=editorIndex===0?'flex':'none';$('startBtn').textContent=mode==='local'&&editorIndex===0?'ДАЛЕЕ →':'НА АРЕНУ ↗';
 $('editorNote').textContent=mode==='local'&&editorIndex===0?'После этого второй игрок создаст своего бойца.':'Цвета и анатомия видны в 3D сразу.';
}
setupSwatches();
function initRenderers(){try{preview=new Arena3D($('previewCanvas'),{preview:true});fight=new Arena3D($('fightCanvas'));if(preview.software){document.querySelector('.headright span').textContent='● 2.5D FALLBACK';document.querySelector('.footer span:last-child').textContent='СОВМЕСТИМЫЙ 2.5D-РЕЖИМ · WEB AUDIO';}}catch(e){console.error(e);$('previewError').classList.add('show');$('fightError').classList.add('show');}}
function showScreen(to){screen=to;$('setupScreen').classList.toggle('active',to==='setup');$('battleScreen').classList.toggle('active',to==='battle');window.scrollTo({top:0,behavior:'instant'});}
function startBattle(){if(fight){fight.floorStains=[];fight.bursts=[];fight.dust=[];}chosen[0]=chosen[0]||clone(editing);chosen[1]=chosen[1]||(mode==='ai'?clone(P2):clone(editing));game={p1:makeFighter(chosen[0],1),p2:makeFighter(chosen[1],2),round:1,pending:null,busy:false,over:false,action:null,koPending:false,koTime:0,log:0,announcerTime:0,shake:0};
 $('result').classList.remove('show');$('logList').replaceChildren();$('announcer').classList.remove('visible');addLog('Бойцы выходят на арену. Соблюдай дистанцию.');
 showScreen('battle');hud();turnUI();sound.play('bell');announce('FIGHT!',.85);}
function hud(){if(!game)return;for(let i=1;i<=2;i++){const f=game['p'+i];$('p'+i+'Name').textContent=f.name;$('p'+i+'Class').textContent=ARCH[f.cfg.archetype].name;$('hp'+i).style.width=(100*clamp(f.hp/f.maxHp,0,1))+'%';$('en'+i).style.width=f.energy+'%';$('hp'+i+'Txt').textContent=f.hp+' / '+f.maxHp+' HP';$('en'+i+'Txt').textContent=f.energy+' EN';}
 $('distanceTxt').textContent=Math.abs(game.p2.x-game.p1.x).toFixed(1);$('roundPill').textContent='РАУНД '+String(game.round).padStart(2,'0');}
function addLog(msg,critical=false){let div=document.createElement('div');div.className='logitem'+(critical?' critical':'');div.textContent=msg;$('logList').prepend(div);while($('logList').children.length>14)$('logList').lastElementChild.remove();if(game){game.log++;$('logCount').textContent=String(game.log).padStart(2,'0');}}
function announce(text,time=1.1){if(!game)return;game.announcerTime=time;$('announcer').textContent=text;$('announcer').classList.add('visible')}
function popNumber(defender,text){const el=$('hitNumber');el.textContent=text;el.style.left=defender.side===1?'30%':'64%';el.style.top='38%';el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
function turnUI(){if(!game)return;let dis=game.busy||game.over;document.querySelectorAll('[data-action]').forEach(b=>b.disabled=dis);
 if(game.over){$('turnName').textContent='Бой окончен';$('turnHint').textContent='Нокаут или завершение поединка. Выбери реванш.';return;}
 if(game.busy){$('turnName').textContent='Идёт обмен приёмами';$('turnHint').textContent='Смотри на контакт, инерцию тела и перемещение ног.';return;}
 $('turnCounter').textContent='РАУНД '+String(game.round).padStart(2,'0')+(mode==='local'?(game.pending?' / ИГРОК 2':' / ИГРОК 1'):' / ТВОЙ ХОД');
 $('turnName').textContent=mode==='local'?(game.pending?'Ход игрока 2':'Ход игрока 1'):'Выбери приём';
 $('turnHint').textContent=mode==='local'?(game.pending?'Приём первого игрока скрыт. Выбери ответ.':'Выбери приём и передай управление.'):'Для броска сблизься с соперником. A / D — шаги, 1–6 — удары.';
 $('fightStatus').textContent='ОЖИДАНИЕ ХОДА';
}
function aiAction(bot,player){const dist=Math.abs(bot.x-player.x);if(dist>3.6&&Math.random()<.84)return 'stepin';if(bot.energy<18&&Math.random()<.55)return 'guard';if(dist<2.2&&Math.random()<.10)return 'stepback';
 const options=Object.entries(MOVES).filter(([k,m])=>!m.utility).map(([k,m])=>({k,w:(m.range>=dist?1:.1)*(m.isThrow?(dist<2.5?1.6:.15):1)*(bot.energy<m.cost?.18:1)*(k==='elbow'?1.2:1)*(k==='jaw'&&player.hp<25?1.4:1)}));
 let total=options.reduce((s,a)=>s+a.w,0),r=Math.random()*total;for(let it of options){r-=it.w;if(r<=0)return it.k}return 'jaw';}
function selectAction(key){if(!game||game.busy||game.over||!MOVES[key])return; sound.init();if(mode==='local'&&!game.pending){game.pending=key;addLog('Игрок 1 выбрал приём. Ожидается второй игрок.');turnUI();return;}
 let p1=mode==='local'?game.pending:key,p2=mode==='local'?key:aiAction(game.p2,game.p1);game.pending=null;runRound(p1,p2);}
function roll(f,d,key){const m=MOVES[key];if(m.utility)return {key,hit:false,damage:0,crit:false};let distance=Math.abs(f.x-d.x),stam=f.energy<m.cost;
 let accuracy=clamp(m.accuracy+f.aim-(d.cfg.archetype==='agile'?.048:0)-(stam?.16:0),.22,.98);
 if(distance>m.range)accuracy=0;
 const hit=Math.random()<accuracy,crit=hit&&Math.random()<m.crit;
 const shield=d.guard?.48:1;
 let damage=hit?Math.max(1,Math.round(rnd(...m.damage)*f.power*(crit?1.42:1)*(stam?.62:1)*shield/d.def)):0;
 return {key,hit,damage,crit,stam,far:distance>m.range,guarded:!!d.guard};}
function makeAbrasion(target,key,damage){if(!damage)return;const m=MOVES[key],n=clamp(Math.ceil(damage/14),1,3);for(let i=0;i<n;i++){target.scars.push({zone:m.zone==='leg'?'leg':m.zone==='face'?'face':'torso',dx:rnd(-.065,.065),dy:rnd(-.075,.075),size:rnd(.055,.095),rot:rnd(-.5,.5)});}if(Math.random()<.5){target.scars.push({zone:pick(['arm','torso']),dx:rnd(-.03,.03),dy:rnd(-.06,.06),size:.05,rot:0});}if(target.scars.length>24)target.scars.splice(0,target.scars.length-24);}
function applyMove(actor,defender,action){if(!game)return;const k=action.key,m=MOVES[k],r=action.roll;actor.energy=clamp(actor.energy-m.cost,0,100);
 if(m.utility){if(k==='guard'){actor.guard=true;actor.energy=clamp(actor.energy+13,0,100);sound.play('guard');addLog(actor.name+' закрывает голову и корпус.');}else{const direction=k==='stepin'?1:-1;const nx=actor.x+actor.facing*direction*.58,dist=Math.abs(defender.x-nx);actor.x=clamp(nx,-3.25,3.25);if(dist<1.63)actor.x=defender.x-actor.facing*1.63;sound.play('step');addLog(actor.name+(k==='stepin'?' сокращает дистанцию.':' отступает и перестраивает стойку.'));}hud();return;}
 if(!r.hit){sound.play('whiff');addLog(actor.name+': '+m.name.toLowerCase()+(r.far?' — слишком далеко.':' — промах.'));popNumber(defender,r.far?'ДАЛЕКО':'ПРОМАХ');hud();return;}
 defender.hp=Math.max(0,defender.hp-r.damage);defender.stumble=m.isThrow?1.0:0;defender.miss=1;makeAbrasion(defender,k,r.damage);
 if(m.isThrow){sound.play('grab');}
 else{sound.play(k==='jaw'?'punch':k);if(fight)fight.impact(defender.renderX,k==='sweep'?'low':'hit');}
 if(fight)fight.shake=m.isThrow?.12:r.crit?.11:.065;
 popNumber(defender,(r.crit?'КРИТ · ':'')+'−'+r.damage);addLog(actor.name+': '+m.name.toLowerCase()+' — '+r.damage+' урона.'+(r.crit?' КРИТ!':''),true);
 if(r.guarded)addLog(defender.name+' частично смягчает удар блоком.');hud();}
function runAction(actor,defender,key){return new Promise(resolve=>{
 if(!game){resolve();return}const m=MOVES[key],r=roll(actor,defender,key);game.action={actor,defender,key,roll:r,start:performance.now(),duration:m.duration*1000,progress:0,hitTriggered:false,whoosh:false,hitstop:false,pauseUntil:0,landing:false,resolve,fromX:actor.x,toX:actor.x};
 if(key==='stepin'||key==='stepback'){const delta=actor.facing*(key==='stepin'?.58:-.58),dest=clamp(actor.x+delta,-3.25,3.25);game.action.toX=Math.abs(defender.x-dest)<1.63?defender.x-actor.facing*1.63:dest;}
 $('fightStatus').textContent=m.name.toUpperCase();
 });}
async function runRound(a,b){const battle=game;if(!battle)return;battle.busy=true;turnUI();const f1=battle.p1,f2=battle.p2;
 // Prevent a protected opponent from retaining the previous round's guard forever.
 f1.guard=false;f2.guard=false;
 let order=[{att:f1,def:f2,key:a},{att:f2,def:f1,key:b}];order.sort((A,B)=>((B.att.speed*MOVES[B.key].speed)-(A.att.speed*MOVES[A.key].speed))+(Math.random()-.5)*.10);
 for(const step of order){if(game!==battle||battle.over)return;await runAction(step.att,step.def,step.key);if(game!==battle)return;if(step.def.hp<=0||step.att.hp<=0)break;}
 if(game!==battle)return;
 f1.energy=clamp(f1.energy+12,0,100);f2.energy=clamp(f2.energy+12,0,100);hud();
 if(f1.hp<=0||f2.hp<=0){startKO();return;}
 battle.round++;battle.busy=false;turnUI();}
function startKO(){if(!game)return;game.koPending=true;game.koTime=0;game.action=null;game.over=true;
 const f=game.p1.hp<=0?game.p1:game.p2;
 const alreadyThrown=f.stumble>.7;f.ko={angle:alreadyThrown?1.05:0,angularVel:alreadyThrown?1.65:.72,drop:alreadyThrown?.70:0,dropVel:alreadyThrown?1.1:0,groundHit:false,time:0};
 $('fightStatus').textContent='НОКАУТ';sound.play('ko');announce('K.O.',1.5);addLog('НОКАУТ! '+f.name+' больше не может продолжать бой.',true);turnUI();}
function completeKO(){if(!game||!game.koPending)return;game.koPending=false;let a=game.p1,b=game.p2;let winner=a.hp>0?a:b;
 const draw=a.hp<=0&&b.hp<=0;$('resultTitle').textContent=draw?'НИЧЬЯ':winner.side===1?'ПОБЕДА!':(mode==='ai'?'ПОРАЖЕНИЕ':'ПОБЕДА ИГРОКА 2');
 $('resultSubtitle').textContent=draw?'Оба бойца были нокаутированы.':winner.name+' победил. Раундов: '+game.round+'. Ссадины остались после ударов.';
 $('result').classList.add('show');}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(.003,(now-lastTime)/1000||.016)),t=now*.001;lastTime=now;
 if(!preview||!fight)return;
 if(screen==='setup'){
  preview.start(t);preview.stage(t);let f={cfg:editing,side:1,facing:1,renderX:0,renderZ:0,scars:[],pose:{}};
  preview.shadow(0,0,1);preview.drawFighter(f,t);preview.end();return;
 }
 if(!game)return;
 const battle=game,fs=[battle.p1,battle.p2];for(let f of fs){f.stumble=Math.max(0,f.stumble-dt*.78);f.miss=Math.max(0,f.miss-dt*2.5);f.pose={flinch:f.miss,guard:f.guard?1:0};f.renderX=mix(f.renderX,f.x,clamp(dt*9,0,1));
  if(f.ko){let q=f.ko;q.time+=dt;q.angularVel+=5.8*dt;q.angle+=q.angularVel*dt;q.dropVel+=4.0*dt;q.drop+=q.dropVel*dt;
   if(q.angle>=1.39){q.angle=1.39;q.angularVel=Math.max(0,-q.angularVel*.14)}
   if(q.drop>=1.11){if(!q.groundHit){q.groundHit=true;sound.play('throw');fight.impact(f.renderX,'throw');}q.drop=1.11;q.dropVel=-q.dropVel*.13;if(Math.abs(q.dropVel)<.13)q.dropVel=0;}
   f.pose.down=clamp(q.angle/1.39,0,1);f.pose.lift=-Math.max(0,q.drop-1.11)*.2;
  }else if(f.stumble>0.05){f.pose.thrown=f.stumble;f.pose.lift=-.10*f.stumble;}
 }
 if(battle.action){const A=battle.action;let p=clamp((now-A.start)/A.duration,0,1);if(A.pauseUntil&&now<A.pauseUntil){A.start+=dt*1000;p=A.progress;}else{A.pauseUntil=0;}A.progress=p;
  const striker=A.actor,def=A.defender,m=MOVES[A.key],isUtility=!!m.utility;
  if(isUtility){if(A.key==='stepin'||A.key==='stepback'){striker.pose.moving=1;striker.pose.guard=.55;striker.renderX=mix(A.fromX,A.toX,smooth(p));}else if(A.key==='guard'){striker.pose.guard=1;}}
  else {striker.pose.action=A.key;striker.pose.progress=p;const dist=Math.abs(striker.x-def.x);
    const closeNeeded=Math.max(.38,dist-(m.isThrow?1.05:A.key==='jaw'?1.72:A.key==='sweep'?1.82:1.39));
    const lunge=clamp(closeNeeded,m.isThrow?.58:.42,m.isThrow?1.28:1.32);
    let step=smooth((p-.09)/.43)*(1-smooth((p-.70)/.29));striker.renderX=striker.x+striker.facing*lunge*step;
    striker.pose.moving=.65*step;
    if(m.isThrow&&A.roll.hit&&p>.34){let pull=smooth((p-.33)/.26),fall=smooth((p-.52)/.37);
      def.renderX=def.x-def.facing*(.40*pull + .16*fall);
      def.pose.thrown=fall;def.pose.lift=.44*Math.sin(Math.PI*clamp((p-.40)/.55,0,1));
      striker.pose.lean=-.13*pull;}
    else if(A.roll.hit&&p>.51){let v=Math.sin(Math.PI*clamp((p-.51)/.42,0,1));def.pose.flinch=Math.max(def.pose.flinch,v*.8)}
  }
  if(p>.30&&!A.whoosh&&!isUtility){A.whoosh=true;sound.play(m.isThrow?'grab':'whoosh');}
  if(p>=.57&&!A.hitTriggered){A.hitTriggered=true;applyMove(striker,def,A);if(cinematic&&!isUtility&&A.roll.hit){A.hitstop=true;A.pauseUntil=now+(m.isThrow?75:90);}}
  if(m.isThrow && A.roll.hit && p>.80 && !A.landing){A.landing=true;sound.play('throw');if(fight)fight.impact(def.renderX,'throw');}
  if(p>=1){if(!A.hitTriggered)applyMove(striker,def,A);if(A.key==='stepin'||A.key==='stepback')striker.renderX=striker.x;battle.action=null;A.resolve();}
 }
 if(battle.koPending){battle.koTime+=dt;if(battle.koTime>2.0)completeKO();}
 fight.shake*=Math.pow(.025,dt);const focusMove=battle.action;const filmLens=cinematic?(focusMove?(MOVES[focusMove.key].isThrow?.84:.28):battle.koPending?.68:0):0;fight.camDolly=mix(fight.camDolly,filmLens,clamp(dt*(filmLens>0?3.6:1.8),0,1));
 let focus=(fs[0].renderX+fs[1].renderX)*.5;fight.start(t,{focus});fight.stage(t);
 for(let f of fs)fight.shadow(f.renderX,f.renderZ,1.1,f.ko?.12:.34);
 for(let f of fs)fight.drawFighter(f,t);
 fight.effects(dt);fight.end();hud();
 if(battle.announcerTime>0){battle.announcerTime-=dt;if(battle.announcerTime<=0)$('announcer').classList.remove('visible');}
}
// Editor and gameplay input
for(let id of ['class','build','hair','outfit'])$(id).addEventListener('change',e=>{editing[id==='class'?'archetype':id]=e.target.value;renderSetup()});
$('name').addEventListener('input',e=>{editing.name=e.target.value.toUpperCase().slice(0,14);$('previewName').textContent=editing.name||'БОЕЦ'});
$('name').addEventListener('change',()=>{editing.name=editing.name.trim()||'БОЕЦ';renderSetup()});
document.addEventListener('click',e=>{
 const sw=e.target.closest('[data-color-key]');if(sw){editing[sw.dataset.colorKey]=sw.dataset.colorValue;renderSetup();}
 const mo=e.target.closest('[data-mode]');if(mo&&editorIndex===0){mode=mo.dataset.mode;renderSetup();}
 const a=e.target.closest('[data-action]');if(a&&screen==='battle')selectAction(a.dataset.action);
});
$('startBtn').addEventListener('click',()=>{sound.init();editing.name=(editing.name||'БОЕЦ').trim().toUpperCase().slice(0,14)||'БОЕЦ';
 if(mode==='local'&&editorIndex===0){chosen[0]=clone(editing);editorIndex=1;editing=clone(P2);renderSetup();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(editorIndex===1){chosen[1]=clone(editing);}else{chosen[0]=clone(editing);chosen[1]=mode==='ai'?clone(P2):clone(editing);}startBattle();});
function backToEditor(){if(game?.action){let a=game.action;game.action=null;a.resolve();}game=null;editorIndex=0;editing=clone(chosen[0]||P1);$('result').classList.remove('show');renderSetup();showScreen('setup');}
$('backBtn').addEventListener('click',backToEditor);$('recreateBtn').addEventListener('click',backToEditor);$('rematchBtn').addEventListener('click',()=>{sound.init();startBattle()});
$('soundBtn').addEventListener('click',()=>{muted=!muted;sound.enabled=!muted;$('soundBtn').setAttribute('aria-pressed',String(!muted));$('soundBtn').textContent=muted?'♫ ЗВУК ВЫКЛ':'♫ ЗВУК ВКЛ';if(!muted)sound.play('bell')});
$('cameraBtn').addEventListener('click',()=>{cinematic=!cinematic;const btn=$('cameraBtn');btn.setAttribute('aria-pressed',String(cinematic));btn.textContent=cinematic?'◉ КИНОКАМЕРА':'◎ СТАТИЧНАЯ КАМЕРА';if(fight)fight.camDolly=0;});
document.addEventListener('keydown',e=>{if(screen!=='battle'||e.target.closest('input,select,textarea')||e.altKey||e.ctrlKey||e.metaKey)return;
 const table={'1':'jaw','2':'elbow','3':'knee','4':'sweep','5':'hipthrow','6':'tripthrow',a:'stepback',A:'stepback',ArrowLeft:'stepback',d:'stepin',D:'stepin',ArrowRight:'stepin',' ':'guard'};
 if(table[e.key]){e.preventDefault();selectAction(table[e.key]);}});
renderSetup();initRenderers();requestAnimationFrame(frame);
})();

