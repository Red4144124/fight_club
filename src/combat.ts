namespace Kontakt {
  export type Move = 'jaw'|'elbow'|'knee'|'sweep'|'throw'|'guard'|'approach'|'retreat'|'recover';
  export type Pose = 'idle'|'jaw'|'elbow'|'knee'|'sweep'|'kneel';
  export type Mode = 'ai'|'local';
  export type Kit = 'a'|'b';
  export type Build = 'slim'|'athletic'|'power';
  export interface Fighter {
    id:number; name:string; kit:Kit; build:Build; x:number; facing:number;
    hp:number; maxHp:number; stamina:number; guard:boolean; kneelTurns:number;
    pose:Pose; offsetX:number; offsetY:number; scaleX:number; angle:number;
    blood:number; shirtBlood:number; gloveBlood:number; faceBlood:number; bruises:number; abrasions:number;
    hurt:number; down:boolean;
  }
  export interface MoveData {
    label:string; detail:string; damage:[number,number]; cost:number; chance:number;
    reach:number; speed:number; target:'head'|'body'|'leg'|'none'; pose:Pose;
  }
  export const MOVES:Record<Move,MoveData>={
    jaw:{label:'В ЧЕЛЮСТЬ',detail:'Прямой в голову',damage:[17,25],cost:18,chance:.79,reach:465,speed:7,target:'head',pose:'jaw'},
    elbow:{label:'ЛОКТЕМ',detail:'Ближняя дистанция',damage:[14,21],cost:15,chance:.86,reach:320,speed:8,target:'head',pose:'elbow'},
    knee:{label:'КОЛЕНОМ',detail:'Удар в корпус',damage:[18,26],cost:22,chance:.76,reach:330,speed:6,target:'body',pose:'knee'},
    sweep:{label:'ПОДСЕЧКА',detail:'Опустить на колено',damage:[7,12],cost:17,chance:.83,reach:355,speed:5,target:'leg',pose:'sweep'},
    throw:{label:'БРОСОК',detail:'Нужен близкий контакт',damage:[19,27],cost:27,chance:.71,reach:255,speed:4,target:'body',pose:'sweep'},
    guard:{label:'БЛОК',detail:'Снижает получаемый урон',damage:[0,0],cost:0,chance:1,reach:0,speed:10,target:'none',pose:'idle'},
    approach:{label:'ШАГ ВПЕРЁД',detail:'Сократить дистанцию',damage:[0,0],cost:0,chance:1,reach:0,speed:12,target:'none',pose:'idle'},
    retreat:{label:'ОТСТУПИТЬ',detail:'Увеличить дистанцию',damage:[0,0],cost:0,chance:1,reach:0,speed:12,target:'none',pose:'idle'},
    recover:{label:'ПОДНЯТЬСЯ',detail:'Вернуться в стойку',damage:[0,0],cost:0,chance:1,reach:0,speed:13,target:'none',pose:'kneel'}
  };
  export interface Outcome {hit:boolean; damage:number; crit:boolean; blocked:boolean; interrupted:boolean; message:string; target:'head'|'body'|'leg'|'none'; knockdown:boolean;}
  export interface Battle {fighters:[Fighter,Fighter]; round:number; mode:Mode; busy:boolean; over:boolean; winner:number|null; pending:Move|null; eventLog:string[];}
  export function fighter(id:number,name:string,kit:Kit,build:Build):Fighter {
    const hp=build==='power'?118:build==='slim'?94:106;
    return {id,name,kit,build,x:id===0?402:878,facing:id===0?1:-1,hp,maxHp:hp,stamina:100,guard:false,kneelTurns:0,
      pose:'idle',offsetX:0,offsetY:0,scaleX:1,angle:0,blood:0,shirtBlood:0,gloveBlood:0,faceBlood:0,
      bruises:0,abrasions:0,hurt:0,down:false};
  }
  export function newBattle(mode:Mode,hero:{name:string;kit:Kit;build:Build}, enemy:{name:string;kit:Kit;build:Build}):Battle {
    return {fighters:[fighter(0,hero.name,hero.kit,hero.build),fighter(1,enemy.name,enemy.kit,enemy.build)],
      round:1,mode,busy:false,over:false,winner:null,pending:null,eventLog:['Соперники вышли на арену.']};
  }
  export function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v));}
  export function distance(a:Fighter,b:Fighter){return Math.abs(a.x-b.x);}
  export function chooseBot(bot:Fighter,player:Fighter):Move {
    if(bot.kneelTurns>0)return 'recover';
    const dist=distance(bot,player), r=Math.random();
    if(dist>420)return 'approach';
    if(bot.hp<28 && r<.18)return 'retreat';
    if(bot.stamina<20)return r<.55?'guard':'approach';
    if(dist<235&&r<.21)return 'throw';
    if(dist<315&&r<.38)return 'elbow';
    if(dist<355&&r<.51)return 'sweep';
    return r<.55?'jaw':r<.82?'knee':'guard';
  }
  export function initiative(f:Fighter,m:Move):number {return MOVES[m].speed+(f.build==='slim'?1.1:0)+Math.random()*1.5;}
  export function roll(f:Fighter,def:Fighter,m:Move):Outcome {
    const d=MOVES[m];
    if(m==='guard')return {hit:false,damage:0,crit:false,blocked:false,interrupted:false,message:`${f.name} ставит блок.`,target:'none',knockdown:false};
    if(m==='recover')return {hit:false,damage:0,crit:false,blocked:false,interrupted:false,message:`${f.name} поднимается и возвращает стойку.`,target:'none',knockdown:false};
    if(m==='approach'||m==='retreat')return {hit:false,damage:0,crit:false,blocked:false,interrupted:false,message:`${f.name} ${m==='approach'?'сближается':'отступает'}.`,target:'none',knockdown:false};
    const dist=distance(f,def);
    if(dist>d.reach)return {hit:false,damage:0,crit:false,blocked:false,interrupted:false,message:`${f.name}: слишком далеко для «${d.label.toLowerCase()}»!`,target:d.target,knockdown:false};
    const tired=f.stamina<d.cost;
    const hitChance=clamp(d.chance-(tired?.19:0)-(def.guard?.13:0)+(def.kneelTurns>0?.12:0),.2,.98);
    const hit=Math.random()<hitChance;
    const crit=hit&&Math.random()<(.08+(m==='jaw'?.12:0));
    const base=d.damage[0]+Math.random()*(d.damage[1]-d.damage[0]);
    let damage=hit?Math.round(base*(crit?1.45:1)*(f.build==='power'?1.13:1)*(tired?.65:1)*(def.guard?.40:1)):0;
    const knockdown=hit&&m==='sweep';
    let message=hit?`${f.name}: ${d.label.toLowerCase()} — ${damage} урона${crit?' · КРИТ!':''}${def.guard?' · БЛОК':''}.`:`${f.name}: ${d.label.toLowerCase()} — промах.`;
    if(knockdown)message+=` ${def.name} опускается на колено!`;
    return {hit,damage,crit,blocked:!!def.guard,interrupted:false,message,target:d.target,knockdown};
  }
  export function apply(state:Battle,actor:Fighter,def:Fighter,m:Move,o:Outcome):void {
    if(m==='guard'){actor.guard=true;actor.stamina=clamp(actor.stamina+16,0,100);return;}
    if(m==='recover'){actor.kneelTurns=0;actor.pose='idle';actor.stamina=clamp(actor.stamina+15,0,100);return;}
    if(m==='approach'||m==='retreat'){
      const step=m==='approach'?85:-75;
      const sign=Math.sign(def.x-actor.x);
      let nx=actor.x+sign*step;
      if(m==='approach')nx=actor.x+sign*Math.min(85,Math.max(0,distance(actor,def)-195));
      actor.x=clamp(nx,215,1065);actor.stamina=clamp(actor.stamina+10,0,100);return;
    }
    actor.stamina=clamp(actor.stamina-MOVES[m].cost,0,100);
    if(!o.hit)return;
    def.hp=Math.max(0,def.hp-o.damage);
    def.hurt=1;
    def.blood+=1;
    def.shirtBlood=clamp(def.shirtBlood+(m==='knee'||m==='throw'?3:2),0,14);
    def.faceBlood=clamp(def.faceBlood+(m==='jaw'||m==='elbow'?3:1),0,14);
    if(m==='elbow'||m==='throw')def.abrasions=clamp(def.abrasions+2,0,12);
    if(m==='jaw')def.bruises=clamp(def.bruises+1,0,9);
    actor.gloveBlood=clamp(actor.gloveBlood+(m==='jaw'||m==='elbow'?4:2),0,14);
    if(m==='sweep'){def.kneelTurns=1;def.pose='kneel';}
    if(def.hp<=0){def.down=true;def.kneelTurns=0;}
  }
}
