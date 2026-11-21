namespace Kontakt {
  export function assetUrl(name:string):string {return ((window as any).__KONTAKT_ASSETS__||{})[name]||'assets/'+name;}
  type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;r:number;red:boolean};
  type Spot={x:number;y:number;rx:number;ry:number;rot:number;alpha:number};
  const P:Record<Pose,{face:[number,number];shirt:[number,number];glove:[number,number];leg:[number,number]}>= {
    idle:{face:[281,106],shirt:[244,217],glove:[344,139],leg:[209,357]},
    jaw:{face:[203,120],shirt:[213,216],glove:[424,125],leg:[221,345]},
    elbow:{face:[270,101],shirt:[244,204],glove:[394,137],leg:[300,358]},
    knee:{face:[229,93],shirt:[228,197],glove:[296,127],leg:[253,365]},
    sweep:{face:[204,248],shirt:[246,321],glove:[102,451],leg:[384,431]},
    kneel:{face:[308,264],shirt:[316,362],glove:[281,455],leg:[357,460]}
  };
  function rnd(i:number,s:number){const v=Math.sin(i*39.135+s*78.3)*45758.55;return v-Math.floor(v);}
  function ellipse(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,rot=0){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  export class ArenaView {
    host:HTMLElement;
    game:any=null;scene:any=null;mode:'phaser'|'canvas'='canvas';
    canvas:HTMLCanvasElement;fxCanvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;fx:CanvasRenderingContext2D;
    stageImg=new Image();images:Record<string,HTMLImageElement>={};
    sprites:any[]=[]; shadows:any[]=[];spots:Spot[]=[];particles:Particle[]=[];
    shake=0;flash=0;last=0;state:Battle|null=null;ready=false;
    readonly W=1280;readonly H=720;
    constructor(host:HTMLElement){
      this.host=host; this.canvas=document.createElement('canvas');this.canvas.width=this.W;this.canvas.height=this.H;this.canvas.className='arena-render';
      this.fxCanvas=document.createElement('canvas');this.fxCanvas.width=this.W;this.fxCanvas.height=this.H;this.fxCanvas.className='arena-effects';
      this.ctx=this.canvas.getContext('2d',{alpha:false})!;this.fx=this.fxCanvas.getContext('2d')!;
      const ph=(window as any).Phaser;
      if(ph){try{this.initPhaser(ph);return;}catch(e){console.warn('WebGL/Phaser unavailable, switching to canvas',e);this.host.innerHTML='';}}
      this.initCanvas();
    }
    private initCanvas(){
      this.mode='canvas';this.host.appendChild(this.canvas);this.ready=true;
      this.stageImg.src=assetUrl('arena.webp');
      for(const kit of ['a','b'])for(const pose of ['idle','jaw','elbow','knee','sweep','kneel']){
        const im=new Image();this.images[`${kit}_${pose}`]=im; im.src=assetUrl(`fighter_${kit}_${pose}.webp`);
      }
    }
    private initPhaser(Phaser:any){
      const self=this;
      this.mode='phaser';
      this.game=new Phaser.Game({type:Phaser.AUTO,width:1280,height:720,parent:this.host,
        backgroundColor:'#0b121b',antialias:true,pixelArt:false,transparent:false,
        scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:1280,height:720},
        scene:{preload:function(this:any){
          this.load.image('arena',assetUrl('arena.webp'));
          for(const k of ['a','b'])for(const pose of ['idle','jaw','elbow','knee','sweep','kneel'])this.load.image(`${k}_${pose}`,assetUrl(`fighter_${k}_${pose}.webp`));
        },create:function(this:any){
          self.scene=this;this.add.image(640,360,'arena').setDisplaySize(1280,720).setDepth(0);
          for(let i=0;i<2;i++){
            const sh=this.add.ellipse(0,658,260,32,0x080e13,.56).setDepth(1);self.shadows.push(sh);
            const image=this.add.image(0,666,'a_idle').setOrigin(.5,1).setDepth(2+i);
            self.sprites.push(image);
          }
          self.host.appendChild(self.fxCanvas);self.ready=true;
        },update:function(){}}});
    }
    public reset(){this.spots=[];this.particles=[];this.flash=0;this.shake=0;}
    public impact(def:Fighter,kind:'head'|'body'|'leg'|'none',hit:boolean,crit=false){
      if(!hit)return;
      const y=kind==='head'?338:kind==='body'?467:577;
      const x=def.x+def.facing*30;
      this.shake=crit?17:10;this.flash=crit?.21:.10;
      const n=crit?36:24;
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*1.6 + (def.facing===1?-Math.PI*.8:-Math.PI*.35),v=2+Math.random()*9;
        this.particles.push({x,y,vx:Math.cos(a)*v,vy:-3+Math.sin(a)*v,r:1.2+Math.random()*3.5,life:60+Math.random()*35,max:90,red:true});
      }
      for(let i=0;i<5;i++)this.spots.push({x:def.x+Math.random()*160-80,y:660+Math.random()*48,rx:3+Math.random()*18,ry:2+Math.random()*4,rot:Math.random(),alpha:.33+Math.random()*.36});
      if(this.spots.length>170)this.spots.splice(0,30);
    }
    private woundOverlay(ctx:CanvasRenderingContext2D,f:Fighter){
      const s=P[f.pose];
      ctx.save();ctx.translate(f.x+f.offsetX,f.down?Math.min(700,666+f.offsetY):666+f.offsetY);
      ctx.rotate(f.angle);ctx.scale(f.facing*(f.build==='power'?1.06:f.build==='slim'?.93:1),1);
      ctx.translate(-232,-465);ctx.scale(464/512,465/512);
      // orbital bruising - purple under visible eye, naturally layered into face
      for(let j=0;j<f.bruises;j++){
        const a=.19+Math.min(.19,f.bruises*.04);
        ellipse(ctx,s.face[0]+7+j*.38,s.face[1]+8,18+j*.8,12+j*.5,`rgba(49,20,83,${a})`,.08);
        ellipse(ctx,s.face[0]+6,s.face[1]+6,8,6,`rgba(66,33,101,${.22+f.bruises*.035})`);
      }
      // superficial abrasions and reddish scratches
      for(let i=0;i<f.abrasions;i++){
        const x=s.face[0]-6+rnd(i,2)*28,y=s.face[1]+11+rnd(i,6)*23;
        ctx.strokeStyle='rgba(141,32,45,.72)';ctx.lineWidth=1.8+rnd(i,1)*1.7;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5+rnd(i,4)*7,y+3+rnd(i,8)*7);ctx.stroke();
      }
      // chin blood, streaks accumulate and drip
      for(let i=0;i<f.faceBlood;i++){
        const x=s.face[0]-2+rnd(i,17)*21,y=s.face[1]+17+rnd(i,5)*10;
        ellipse(ctx,x,y,2.8+rnd(i,3)*3.1,7+rnd(i,6)*13,`rgba(155,19,31,${.5+rnd(i,9)*.32})`,rnd(i,21)*.25);
      }
      // fabric stains with distinct pools and fine spatter
      for(let i=0;i<f.shirtBlood;i++){
        const x=s.shirt[0]-40+rnd(i,12)*76,y=s.shirt[1]-45+rnd(i,24)*88;
        ellipse(ctx,x,y,8+rnd(i,21)*15,5+rnd(i,22)*9,`rgba(104,12,23,${.43+rnd(i,42)*.31})`,rnd(i,5)*1.8);
        if(i%2===0)ellipse(ctx,x+8,y+6,3,4+rnd(i,3)*5,'rgba(189,34,44,.40)');
      }
      // blood on wrapped hands
      for(let i=0;i<f.gloveBlood;i++){
        const x=s.glove[0]-11+rnd(i,7)*23,y=s.glove[1]-10+rnd(i,14)*20;
        ellipse(ctx,x,y,2.7+rnd(i,4)*4,3+rnd(i,8)*5,`rgba(151,15,27,${.56+rnd(i,99)*.27})`);
      }
      ctx.restore();
    }
    private drawGround(ctx:CanvasRenderingContext2D){
      for(const s of this.spots){ellipse(ctx,s.x,s.y,s.rx,s.ry,`rgba(112,9,20,${s.alpha})`,s.rot);}
    }
    private drawParticles(ctx:CanvasRenderingContext2D,dt:number){
      for(const p of this.particles){
        p.life-=dt*.08; p.x+=p.vx*dt/16.7;p.y+=p.vy*dt/16.7;p.vy+=.35*dt/16.7;
        if(p.y>680 && p.vy>0){p.life=0;this.spots.push({x:p.x,y:Math.min(708,p.y),rx:p.r*2,ry:1+rnd(p.x,9)*2,rot:0,alpha:.28});}
        if(p.life>0)ellipse(ctx,p.x,p.y,p.r,p.r*.85,`rgba(177,16,30,${Math.min(.9,p.life/75)})`);
      }
      this.particles=this.particles.filter(x=>x.life>0 && x.x>0&&x.x<1280);
    }
    public frame(state:Battle,t:number){
      this.state=state;
      const dt=Math.min(34,t-(this.last||t));this.last=t;
      if(!this.ready)return;
      if(this.mode==='phaser'){
        const sc=this.scene;
        for(const i of [0,1]){
          const f=state.fighters[i],sprite=this.sprites[i]; if(!sprite)continue;
          const key=`${f.kit}_${f.pose}`;if(sprite.texture.key!==key)sprite.setTexture(key);
          sprite.setPosition(f.x+f.offsetX,666+f.offsetY);
          const w=464*(f.build==='power'?1.06:f.build==='slim'?.93:1);
          sprite.setDisplaySize(w,465);sprite.setFlipX(f.facing===-1);
          sprite.setRotation(f.angle);
          this.shadows[i].setPosition(f.x+f.offsetX,662).setAlpha(f.down?.2:.56);
        }
        const fx=this.fx;fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,1280,720);
        if(this.shake>1){sc.cameras.main.setScroll(Math.sin(t*.07)*this.shake*.2,Math.cos(t*.11)*this.shake*.1);}
        else sc.cameras.main.setScroll(0,0);
        this.drawGround(fx);
        for(const f of state.fighters)this.woundOverlay(fx,f);
        this.drawParticles(fx,dt);
        if(this.flash>.01){fx.fillStyle=`rgba(255,237,212,${this.flash})`;fx.fillRect(0,0,1280,720);}
      }else{
        const ctx=this.ctx;
        ctx.clearRect(0,0,1280,720);
        ctx.save();ctx.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake*.55);
        if(this.stageImg.complete&&this.stageImg.naturalWidth)ctx.drawImage(this.stageImg,0,0,1280,720);
        else{ctx.fillStyle='#15242d';ctx.fillRect(0,0,1280,720);}
        this.drawGround(ctx);
        for(const f of state.fighters){
          const width=464*(f.build==='power'?1.06:f.build==='slim'?.93:1);
          ellipse(ctx,f.x+f.offsetX,668,115,.12*width,'rgba(3,8,12,.42)');
          ctx.save();ctx.translate(f.x+f.offsetX,666+f.offsetY);ctx.rotate(f.angle);ctx.scale(f.facing,1);
          const img=this.images[`${f.kit}_${f.pose}`];
          if(img?.complete&&img.naturalWidth)ctx.drawImage(img,-width/2,-465,width,465);
          ctx.restore();
          this.woundOverlay(ctx,f);
        }
        this.drawParticles(ctx,dt);
        if(this.flash>.01){ctx.fillStyle=`rgba(255,237,212,${this.flash})`;ctx.fillRect(0,0,1280,720);}
        ctx.restore();
      }
      this.shake*=.83;this.flash*=.77;
    }
  }
}
