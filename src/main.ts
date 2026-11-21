namespace Kontakt {
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
  const stage=q('#stage');
  const view=new ArenaView(stage);
  const audio=new AudioFX();
  let battle:Battle=newBattle('ai',{name:'РЭЙНА',kit:'a',build:'athletic'},{name:'СЭЙБЛ',kit:'b',build:'power'});
  let selectedKit:Kit='a',selectedBuild:Build='athletic',selectedMode:Mode='ai';
  let roundRunning=false;
  let hitStopMs=92;
  function say(message:string,highlight=false){
    const area=q('#combatLog'); const n=document.createElement('div');n.className='log-entry'+(highlight?' hot':'');n.textContent=message;
    area.prepend(n);while(area.children.length>8)area.lastElementChild?.remove();
  }
  function setBar(id:string,pct:number){const e=q(id);e.style.width=clamp(pct,0,100)+'%';}
  function setText(id:string,t:string){q(id).textContent=t;}
  function updateHUD(){
    const [p1,p2]=battle.fighters;
    for(const [f,i] of [[p1,1],[p2,2]] as const){
      setText(`#name${i}`,f.name);setText(`#hpText${i}`,`${f.hp} / ${f.maxHp}`);
      setText(`#stText${i}`,`${Math.round(f.stamina)} EN`);
      setBar(`#hp${i}`,100*f.hp/f.maxHp);setBar(`#st${i}`,f.stamina);
      setText(`#damage${i}`,f.bruises+f.abrasions+f.faceBlood>0?`ТРАВМЫ · ${f.bruises} СИН. / ${f.abrasions} ССАД.`:'БЕЗ ПОВРЕЖДЕНИЙ');
    }
    setText('#round',String(battle.round).padStart(2,'0'));
    setText('#distance',`${Math.round(distance(p1,p2))} PX`);
    setText('#modeLabel',battle.mode==='ai'?'VS CPU':'2 ИГРОКА');
    const kneeler=p1.kneelTurns>0?p1:p2.kneelTurns>0?p2:null;
    const status=battle.over?'БОЙ ЗАВЕРШЁН':kneeler?`${kneeler.name}: НА КОЛЕНЕ`:(battle.busy?'ОБМЕН УДАРАМИ':'ВЫБЕРИ ПРИЁМ');
    setText('#statusText',status);
  }
  function updateButtons(){
    const active=battle.mode==='local'&&battle.pending?battle.fighters[1]:battle.fighters[0];
    const kneeling=active.kneelTurns>0;
    document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b=>{
      b.disabled=battle.busy||battle.over||(kneeling&&b.dataset.move!=='recover')||(!kneeling&&b.dataset.move==='recover');
    });
    const recover=q<HTMLButtonElement>('#recoverButton');recover.hidden=!kneeling;
    const turn=battle.mode==='local'&&battle.pending?'ИГРОК 2':battle.mode==='local'?'ИГРОК 1':'ТВОЙ ХОД';
    setText('#turnActor',kneeling?'ВОССТАНОВЛЕНИЕ СТОЙКИ':turn);
    setText('#turnHelp',kneeling?`${active.name} потерял равновесие. Подъём занимает весь ход.`:
      battle.mode==='local'&&battle.pending?'Приём первого игрока скрыт. Выбери ответ.':'Выбери удар, защиту или движение.');
    updateHUD();
  }
  function resetBattle(){
    const name=(q<HTMLInputElement>('#fighterName').value||'РЭЙНА').trim().slice(0,16)||'РЭЙНА';
    const rivalKit:Kit=selectedKit==='a'?'b':'a';
    battle=newBattle(selectedMode,{name,kit:selectedKit,build:selectedBuild},
      {name:rivalKit==='b'?'СЭЙБЛ':'РЭЙНА',kit:rivalKit,build:'power'});
    audio.init();view.reset();roundRunning=false;
    q('#intro').classList.add('is-hidden');q('#gameOver').classList.add('is-hidden');
    q('#combatLog').replaceChildren();
    say('Бойцы на арене. Первый раунд.');
    updateButtons();
  }
  const delay=(ms:number)=>new Promise<void>(r=>window.setTimeout(r,ms));
  function animate(duration:number,onUpdate:(p:number)=>void):Promise<void>{
    return new Promise(resolve=>{const t0=performance.now();function tick(now:number){const p=clamp((now-t0)/duration,0,1);onUpdate(p);if(p>=1)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
  }
  function approachTarget(a:Fighter,b:Fighter,move:Move):number {
    const step=move==='approach'?Math.min(85,Math.max(0,distance(a,b)-195)):-75;
    return clamp(a.x+Math.sign(b.x-a.x)*step,215,1065);
  }
  async function playAction(actor:Fighter,def:Fighter,move:Move){
    const data=MOVES[move];
    const result=roll(actor,def,move);
    const startX=actor.x,endX=(move==='approach'||move==='retreat')?approachTarget(actor,def,move):startX;
    let contacted=false;
    const dur=move==='sweep'?880:move==='throw'?920:move==='recover'?650:move==='guard'?510:move==='approach'||move==='retreat'?550:760;
    const lunge=(move==='jaw'?88:move==='elbow'?52:move==='knee'?52:move==='sweep'?70:move==='throw'?76:0);
    audio.move(move);
    await animate(dur+(result.hit?hitStopMs:0),(r)=>{
      const p= r>=.53?Math.max(0,(r*dur+hitStopMs)/(dur+hitStopMs)):r*(dur+hitStopMs)/dur;
      const z=clamp(p,0,1);
      actor.pose=(z>.18&&z<.77)?data.pose:(actor.kneelTurns>0?'kneel':'idle');
      if(move==='recover')actor.pose=z<.6?'kneel':'idle';
      if(move==='guard')actor.pose='idle';
      if(move==='approach'||move==='retreat')actor.offsetX=(endX-startX)*(z*z*(3-2*z));
      else actor.offsetX=Math.sign(def.x-actor.x)*lunge*Math.sin(Math.PI*clamp((z-.1)/.78,0,1));
      actor.offsetY=(move==='knee'?-5*Math.sin(Math.PI*z):move==='sweep'?28*Math.sin(Math.PI*z):0);
      if(move==='sweep')actor.angle=-actor.facing*.025*Math.sin(Math.PI*z);
      if(!contacted&&z>=.5){
        contacted=true;
        if(move!=='approach'&&move!=='retreat')apply(battle,actor,def,move,result);
        if(result.hit){
          if(move!=='guard'&&move!=='approach'&&move!=='retreat'){
            def.offsetX=Math.sign(def.x-actor.x)*(result.crit?45:26);
            def.offsetY=move==='sweep'?34:move==='throw'?20:0;
            if(move==='throw')def.angle=-def.facing*.63;
            if(result.knockdown)def.pose='kneel';
            view.impact(def,result.target,true,result.crit);audio.hit(result.crit);
          }
        }else if(!['guard','approach','retreat','recover'].includes(move))audio.miss();
        updateHUD();say(result.message,result.hit);
      }
      if(contacted&&z>.56){
        const back=(1-clamp((z-.56)/.42,0,1));
        if(!def.down){
          def.offsetX*=Math.max(.15,back);if(move!=='sweep'&&move!=='throw')def.offsetY*=back;
          def.angle*=back;
        }
      }
    });
    actor.offsetX=0;actor.offsetY=0;actor.angle=0;
    if(move==='approach'||move==='retreat'){
      actor.x=endX;actor.stamina=clamp(actor.stamina+10,0,100);
      actor.offsetX=0;
    }
    actor.pose=actor.kneelTurns>0?'kneel':'idle';
    if(!def.down){def.offsetX=0;def.angle=0;def.offsetY=0;def.pose=def.kneelTurns>0?'kneel':'idle';}
  }
  async function fallKO(f:Fighter){
    f.pose='kneel';audio.finish();say(`${f.name} падает на настил. НОКАУТ!`,true);
    await animate(950,p=>{
      const ease=1-Math.pow(1-p,3);
      f.angle=-f.facing*1.42*ease;
      f.offsetX=f.facing*-95*ease;
      f.offsetY=100*Math.sin(Math.PI*.5*ease);
    });
  }
  async function doRound(first:Move,second:Move){
    if(roundRunning)return;
    roundRunning=true;battle.busy=true;updateButtons();
    for(const f of battle.fighters)f.guard=false;
    const jobs:[Fighter,Fighter,Move][]= [
      [battle.fighters[0],battle.fighters[1],first],
      [battle.fighters[1],battle.fighters[0],second]
    ];
    jobs.sort((a,b)=>initiative(b[0],b[2])-initiative(a[0],a[2]));
    for(const [actor,def,move] of jobs){
      if(actor.down||def.down)break;
      if(actor.kneelTurns>0 && move!=='recover'){
        // A successful sweep has interrupted the already committed action.
        say(`${actor.name} теряет атаку: сбит с ног.`,true);continue;
      }
      await playAction(actor,def,move);
      if(actor.down||def.down)break;
      await delay(110);
    }
    for(const f of battle.fighters)f.stamina=clamp(f.stamina+8,0,100);
    const [p1,p2]=battle.fighters;
    if(p1.down||p2.down){
      battle.over=true;battle.winner=p1.down&&p2.down?null:p1.down?1:0;
      await fallKO(p1.down?p1:p2);
      setText('#winner',battle.winner===null?'НИЧЬЯ':`ПОБЕДИЛ ${battle.fighters[battle.winner].name}`);
      q('#gameOver').classList.remove('is-hidden');
      setText('#winnerDetails',`Раундов: ${battle.round}. Получено повреждений: ${p1.blood+p2.blood}.`);
    }else battle.round++;
    battle.busy=false;roundRunning=false;updateButtons();
  }
  function chooseMove(move:Move){
    if(battle.busy||battle.over||roundRunning)return;
    audio.init();
    const p1=battle.fighters[0],p2=battle.fighters[1];
    if(battle.mode==='local' && !battle.pending){
      battle.pending=p1.kneelTurns>0?'recover':move;
      say('Игрок 1 выбрал приём. Передай управление игроку 2.');updateButtons();return;
    }
    const first=battle.mode==='local'?(battle.pending||'guard'):(p1.kneelTurns>0?'recover':move);
    const second=battle.mode==='local'?(p2.kneelTurns>0?'recover':move):chooseBot(p2,p1);
    battle.pending=null;
    void doRound(first,second);
  }
  // UI
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b=>b.addEventListener('click',()=>chooseMove(b.dataset.move as Move)));
  document.querySelectorAll<HTMLButtonElement>('[data-kit]').forEach(b=>b.addEventListener('click',()=>{
    selectedKit=b.dataset.kit as Kit;
    document.querySelectorAll('[data-kit]').forEach(el=>el.classList.toggle('chosen',el===b));
    q<HTMLImageElement>('#introFighter').src=assetUrl(`fighter_${selectedKit}_idle.webp`);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-build]').forEach(b=>b.addEventListener('click',()=>{
    selectedBuild=b.dataset.build as Build;document.querySelectorAll('[data-build]').forEach(el=>el.classList.toggle('chosen',el===b));
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    selectedMode=b.dataset.mode as Mode;document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('chosen',el===b));
  }));
  q('#startButton').addEventListener('click',resetBattle);
  q('#rematch').addEventListener('click',resetBattle);
  q('#editButton').addEventListener('click',()=>{if(roundRunning)return;q('#intro').classList.remove('is-hidden');});
  q('#soundButton').addEventListener('click',()=>{const enabled=audio.toggle();setText('#soundButton',enabled?'ЗВУК: ВКЛ':'ЗВУК: ВЫКЛ');});
  document.addEventListener('keydown',(e)=>{
    if(e.target instanceof HTMLInputElement)return;
    if(!q('#intro').classList.contains('is-hidden'))return;
    const seq:Move[]=['jaw','elbow','knee','sweep','throw','guard','approach','retreat'];
    if(/^[1-8]$/.test(e.key)){e.preventDefault();chooseMove(seq[Number(e.key)-1]);}
    if(e.key.toLowerCase()==='r'){chooseMove('recover');}
  });
  const render=(t:number)=>{view.frame(battle,t);requestAnimationFrame(render);};requestAnimationFrame(render);
  updateHUD();updateButtons();
  (window as any).__KONTAKT_DEBUG={
    battle:()=>battle,view:()=>view,choose:(move:Move)=>chooseMove(move),start:resetBattle,
    setHP:(id:number,hp:number)=>{battle.fighters[id].hp=hp;updateHUD();},
    forceKneel:(id:number)=>{const f=battle.fighters[id];f.kneelTurns=1;f.pose='kneel';updateButtons();},
    version:'0.6.0'
  };
}
