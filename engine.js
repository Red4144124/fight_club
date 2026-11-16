/* KONTAKT Arena: dependency-free WebGL2 3D renderer. Procedural shaded meshes and two-bone inverse kinematics. */
(()=>{
'use strict';
const PI=Math.PI, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const V=(x=0,y=0,z=0)=>[x,y,z], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mul=(a,s)=>a.map(v=>v*s), len=a=>Math.hypot(...a), norm=a=>{let l=len(a)||1;return mul(a,1/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], lerpVec=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mm(a,b){let r=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)r[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];return r}
function T(x,y,z){let m=I();m[12]=x;m[13]=y;m[14]=z;return m}
function S(x,y,z){let m=I();m[0]=x;m[5]=y;m[10]=z;return m}
function RX(r){let m=I(),c=Math.cos(r),s=Math.sin(r);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
function RY(r){let m=I(),c=Math.cos(r),s=Math.sin(r);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
function RZ(r){let m=I(),c=Math.cos(r),s=Math.sin(r);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m}
function Perspective(fov,aspect,near,far){let f=1/Math.tan(fov*.5),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m}
function LookAt(e,p,up){let z=norm(sub(e,p)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}
function alignY(a,b,rx,rz){const dy=sub(b,a),height=len(dy);if(height<.01)return mm(T(...a),S(rx,.01,rz));const y=norm(dy),q=Math.abs(y[2])>.85?V(0,1,0):V(0,0,1),x=norm(cross(y,q)),z=norm(cross(x,y)),m=new Float32Array(16);m[0]=x[0]*rx;m[1]=x[1]*rx;m[2]=x[2]*rx;m[4]=y[0]*height*.5;m[5]=y[1]*height*.5;m[6]=y[2]*height*.5;m[8]=z[0]*rz;m[9]=z[1]*rz;m[10]=z[2]*rz;m[12]=(a[0]+b[0])*.5;m[13]=(a[1]+b[1])*.5;m[14]=(a[2]+b[2])*.5;m[15]=1;return m}
function IK(start, target, l1, l2, pole){const delta=sub(target,start);let d=clamp(len(delta),.002,l1+l2-.006),dir=norm(delta);const newEnd=add(start,mul(dir,d));const along=(l1*l1-l2*l2+d*d)/(2*d);const altitude=Math.sqrt(Math.max(0,l1*l1-along*along));let p=sub(pole,start);p=sub(p,mul(dir,dot(p,dir)));p=norm(p);return {joint:add(add(start,mul(dir,along)),mul(p,altitude)),end:newEnd}}
function color(hex){if(Array.isArray(hex))return hex;const h=String(hex||'#cccccc').replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}
function matPoint(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]]}
function css(c,lum=1){let vals=color(c);return `rgb(${vals.map(v=>Math.round(clamp(v*lum,0,1)*255)).join(',')})`}
function makeSphere(rows=16,cols=24){let v=[],indices=[];for(let j=0;j<=rows;j++){let t=j/rows*PI;for(let i=0;i<=cols;i++){let p=i/cols*2*PI,x=Math.sin(t)*Math.cos(p),y=Math.cos(t),z=Math.sin(t)*Math.sin(p);v.push(x,y,z,x,y,z);}}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1)}return {v,indices}}
// Anatomically shaped surface meshes: ring-defined anatomy rather than disconnected capsules.
function makeLoft(rings,cols=32){
 const v=[],indices=[];
 for(let j=0;j<rings.length;j++){
  const [yy,rx,rz,cx=0]=rings[j],prev=rings[Math.max(0,j-1)],next=rings[Math.min(rings.length-1,j+1)];
  const dy=Math.max(.001,next[0]-prev[0]),gradX=(next[1]-prev[1])/dy,gradZ=(next[2]-prev[2])/dy,gradC=(next[3]||0)-(prev[3]||0);
  for(let i=0;i<=cols;i++){
   const t=i/cols*2*PI,co=Math.cos(t),si=Math.sin(t),x=cx+rx*co,z=rz*si;
   const n=norm([co/Math.max(rx,.01),-(co*gradX+si*gradZ+gradC/dy),si/Math.max(rz,.01)]);
   v.push(x,yy,z,...n);
  }
 }
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);
 }
 return {v,indices};
}
const loftShapes={
 torso:[[-1,.52,.61,-.04],[-.88,.77,.75,0],[-.62,.80,.79,.01],[-.22,.86,.82,.015],[.22,1.12,1.03,-.018],[.54,1.17,1.23,-.02],[.74,1.0,1.17,-.02],[.95,.50,.57,-.04],[1,.06,.07,-.04]],
 head:[[-1,.06,.11,.11],[-.94,.49,.49,.11],[-.76,.78,.72,.07],[-.52,.84,.85,.03],[-.30,.97,1.00,.02],[.05,1.02,.99,.01],[.32,1.02,.96,-.035],[.67,.89,.91,-.06],[.93,.50,.57,-.085],[1,.05,.07,-.09]],
 arm:[[-1,.87,.84,0],[-.8,.99,.95,0],[-.36,1.04,.97,0],[.22,1.11,1.05,0],[.66,1.04,.99,0],[.98,.79,.78,0],[1,.63,.62,0]],
 forearm:[[-1,.91,.87,0],[-.78,1.02,.95,0],[-.18,1.08,1.03,0],[.40,.94,.89,0],[.85,.69,.72,0],[1,.58,.60,0]],
 thigh:[[-1,.90,.92,0],[-.80,1.08,1.10,0],[-.30,1.13,1.16,0],[.25,1.02,1.03,0],[.80,.79,.84,0],[1,.74,.75,0]],
 shin:[[-1,.88,.84,0],[-.69,1.03,1.0,0],[-.22,1.09,1.07,0],[.39,.86,.82,0],[.85,.65,.66,0],[1,.59,.58,0]],
 glove:[[-1,.78,.75,0],[-.79,.94,.94,0],[-.34,1.01,1.03,0],[.14,1.02,1.0,.03],[.65,.94,.91,.03],[.94,.55,.59,0],[1,.05,.07,0]],
 bag:[[-1,.94,.88,0],[-.95,1.02,.93,0],[.3,1.05,1.0,0],[.9,.72,.75,0],[1,.01,.01,0]],
 beam:[[-1,.97,.97,0],[1,.08,.08,0]],
};
function makeBox(){let v=[],idx=[];const faces=[[[1,0,0],[[1,-1,-1],[1,-1,1],[1,1,1],[1,1,-1]]],[[-1,0,0],[[-1,-1,1],[-1,-1,-1],[-1,1,-1],[-1,1,1]]],[[0,1,0],[[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]]],[[0,-1,0],[[-1,-1,1],[1,-1,1],[1,-1,-1],[-1,-1,-1]]],[[0,0,1],[[1,-1,1],[-1,-1,1],[-1,1,1],[1,1,1]]],[[0,0,-1],[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]]]];for(let f of faces){let base=v.length/6;for(let p of f[1])v.push(...p,...f[0]);idx.push(base,base+2,base+1,base,base+3,base+2)}return {v,indices:idx}}
function makeCylinder(sides=20){let v=[],idx=[];for(let k=0;k<=sides;k++){let a=2*PI*k/sides,cs=Math.cos(a),sn=Math.sin(a);v.push(cs,-1,sn,cs,0,sn,cs,1,sn,cs,0,sn);}for(let k=0;k<sides;k++){let a=k*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}return {v,indices:idx}}
function makeTorus(R=1,r=.033,rows=28,cols=9){let v=[],idx=[];for(let j=0;j<=rows;j++){let u=j/rows*2*PI;for(let i=0;i<=cols;i++){let t=i/cols*2*PI,rad=R+r*Math.cos(t),x=rad*Math.cos(u),y=rad*Math.sin(u),z=r*Math.sin(t),nx=Math.cos(t)*Math.cos(u),ny=Math.cos(t)*Math.sin(u),nz=Math.sin(t);v.push(x,y,z,nx,ny,nz);}}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,b,b+1,a+1)}return {v,indices:idx}}
const VERT=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNorm;uniform mat4 uVP;uniform mat4 uModel;out vec3 vWorld;out vec3 vNorm;void main(){vec4 w=uModel*vec4(aPos,1.0);vWorld=w.xyz;vNorm=normalize(transpose(inverse(mat3(uModel)))*aNorm);gl_Position=uVP*w;}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vWorld;in vec3 vNorm;
uniform vec3 uColor;uniform vec3 uEye;uniform float uType;uniform float uAlpha;
out vec4 color;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float valueNoise(vec3 p){vec3 i=floor(p), f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){
 vec3 n=normalize(vNorm),v=normalize(uEye-vWorld);
 float grain=valueNoise(vWorld*13.0),micro=valueNoise(vWorld*94.0);
 float rough=(uType<1.5?0.90:uType<2.5?0.61:uType<3.5?0.34:0.52);
 float skin=step(1.5,uType)*(1.0-step(2.5,uType));
 n=normalize(n+skin*(vec3(micro-.5,grain-.5,hash(floor(vWorld*150.0))-.5))*.065);
 vec3 warm=normalize(vec3(-.47,.87,1.25)),cool=normalize(vec3(.83,.49,-.14)),rimdir=normalize(vec3(-.34,.67,-1.2));
 float kw=max(dot(n,warm),0.),kc=max(dot(n,cool),0.),kr=max(dot(n,rimdir),0.);
 float viewRim=pow(1.0-max(dot(n,v),0.0),2.15);
 vec3 base=pow(max(uColor,vec3(0.0)),vec3(2.0));
 base*=.88+grain*.14+(micro-.5)*.042;
 if(uType>3.5&&uType<4.5){
  float pores=valueNoise(vec3(vWorld.x*16.0,vWorld.y*16.0,vWorld.z*16.0));
  float wet=smoothstep(.72,.88,pores);
  base*=.72+.24*pores+.10*wet;
  float scuff=hash(floor(vWorld.xzz*2.7+vWorld.yyx*1.7));base*=.88+.18*scuff;
 }
 if(uType>4.5&&uType<5.5){base*=.76+.20*grain;rough=.85;}
 float shininess=mix(9.0,52.0,1.0-rough);
 vec3 h1=normalize(warm+v),h2=normalize(cool+v);
 float sp1=pow(max(dot(n,h1),0.),shininess)*(.05+.49*(1.0-rough));
 float sp2=pow(max(dot(n,h2),0.),shininess*.72)*(.05+.33*(1.0-rough));
 float pore=skin*(micro-.5)*.10;
 vec3 lighting=vec3(.23,.27,.30) + vec3(1.36,1.04,.80)*kw*1.02 + vec3(.32,.70,1.18)*kc*.52 + vec3(.91,.46,.31)*kr*.27;
 vec3 lit=base*lighting + vec3(1.0,.80,.62)*sp1 + vec3(.40,.70,1.0)*sp2;
 lit+=base*vec3(.26,.11,.08)*viewRim*.45+skin*vec3(.05,.028,.013)*kw;
 if(uType>5.5){lit=pow(uColor,vec3(1.6))*vec3(2.7,2.3,2.1)+vec3(.08);}
 float fog=smoothstep(9.0,19.0,length(uEye-vWorld))*.19;
 lit=mix(lit,vec3(.017,.042,.057),fog);
 vec3 srgb=pow(aces(lit*1.0),vec3(.48));
 color=vec4(srgb,uAlpha);
}`;
function shader(gl,type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl){let p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
class Arena3D {
 constructor(canvas,{preview=false}={}){
  this.canvas=canvas;this.preview=preview;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false});
  this.software=!gl;this.ctx=this.software?canvas.getContext('2d',{alpha:false}):null;this.gl=gl;
  if(!this.software){this.p=program(gl);gl.useProgram(this.p);
    this.u={vp:gl.getUniformLocation(this.p,'uVP'),model:gl.getUniformLocation(this.p,'uModel'),color:gl.getUniformLocation(this.p,'uColor'),eye:gl.getUniformLocation(this.p,'uEye'),type:gl.getUniformLocation(this.p,'uType'),alpha:gl.getUniformLocation(this.p,'uAlpha')};
    this.mesh={};let shapes={sphere:makeSphere(24,32),box:makeBox(),cylinder:makeCylinder(28),torus:makeTorus(),smallTorus:makeTorus(1,.010,32,7)};for(let [n,r] of Object.entries(loftShapes))shapes[n]=makeLoft(r);for(let [name,m] of Object.entries(shapes))this.mesh[name]=this.upload(m);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }
  this.w=0;this.h=0;this.eye=[0,2.8,9.0];this.time=0;this.cameraFocus=0;this.shake=0;this.camDolly=0;this.bursts=[];this.dust=[];this.floorStains=[];this.frame=0;this.queue=[];
 }
 upload(m){const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.v),gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(m.indices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);return {vao,n:m.indices.length}}
 start(t,options={}){
  const gl=this.gl,dpr=Math.min(window.devicePixelRatio||1,1.8),w=Math.max(10,Math.round(this.canvas.clientWidth*dpr)),h=Math.max(10,Math.round(this.canvas.clientHeight*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}this.w=w;this.h=h;this.time=t;this.frame++;
  if(!this.software){gl.viewport(0,0,w,h);gl.clearColor(.025,.048,.069,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.p);}
  else{this.queue=[];const ctx=this.ctx,g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#12202a');g.addColorStop(.55,'#15212a');g.addColorStop(1,'#1a2428');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  const aspect=w/h,pr=this.preview;const distance=pr?(aspect<1?7.1:6.0):aspect<1.1?11.8:aspect<1.5?9.95:8.45;
  const focus=pr?[0,1.82,0]:[options.focus||0,1.65,0];const shake=this.shake;this.eye=[focus[0]+(pr?2.35:0)+Math.sin(t*100)*shake,pr?2.70:2.50,pr?distance:distance-this.camDolly];
  const target=[focus[0],pr?1.78:1.72,0];let vp=mm(Perspective((pr?37:41)*PI/180,aspect,.1,80),LookAt(this.eye,target,[0,1,0]));this.vp=vp;
  if(!this.software){gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform3fv(this.u.eye,this.eye);}
 }
 draw(mesh,transform,col,material=0,alpha=1){
  if(this.software){const center=matPoint(transform,[0,0,0]);this.queue.push({mesh,transform,col,material,alpha,depth:Math.hypot(center[0]-this.eye[0],center[1]-this.eye[1],center[2]-this.eye[2])});return;}
  const gl=this.gl,m=this.mesh[mesh];if(!m)return;gl.bindVertexArray(m.vao);gl.uniformMatrix4fv(this.u.model,false,transform);gl.uniform3fv(this.u.color,color(col));gl.uniform1f(this.u.type,material);gl.uniform1f(this.u.alpha,alpha);if(alpha<1)gl.depthMask(false);gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0);if(alpha<1)gl.depthMask(true)}
 part(mesh,x,y,z,sx,sy,sz,col,mat=0,rot=0,alpha=1){this.draw(mesh,mm(T(x,y,z),mm(RZ(rot),S(sx,sy,sz))),col,mat,alpha)}
 stage(t){
  // Concrete hall, floating haze, wet patches, steel trusses and two-stage spot lighting.
  this.part('box',0,-.24,0,7.75,.24,4.15,'#0b1318',4);
  this.part('box',0,-.038,0,7.45,.065,3.91,'#485259',4);
  for(let z of [-3.88,3.88])this.part('box',0,-.035,z,7.45,.045,.09,'#945a4c',3);
  this.part('box',0,2.58,-5.65,19.1,4.5,.22,'#101f29',4);
  this.part('box',0,5.0,-5.52,19.2,.11,.41,'#293842',3);
  // Architectural alcoves and illuminated slits.
  for(let i=-4;i<=4;i++){
    const x=i*2.05;
    this.part('box',x,2.45,-5.44,.075,4.2,.19,'#283a43',3);
    this.part('box',x,3.70,-5.25,.025,1.9,.045,i%2===0?'#638c95':'#a16e60',6,0,.78);
    this.part('box',x,4.50,-5.35,.59,.042,.11,'#435661',3);
  }
  // A monumental backlit numerals 07 made with individually lit strips.
  const digit=(x,seg,col)=>{const W=.52,H=.84,sz=.057,z=-5.05,y=2.8;
   for(let i of seg){const pp=[[0,H,0],[W/2,H/2,1],[W/2,-H/2,1],[0,-H,0],[-W/2,-H/2,1],[-W/2,H/2,1],[0,0,0]][i];
    const xx=x+pp[0],yy=y+pp[1];this.part('box',xx,yy,z,pp[2]?sz:W*.88,pp[2]?H*.79:sz,.023,col,6,0,.78);
    this.part('box',xx,yy,z-.015,pp[2]?.095:W*.96,pp[2]?H*.87:.095,.016,col,6,0,.09);
   }
  };
  digit(-4.5,[0,1,2,3,4,5],'#4aafbd');digit(4.48,[0,1,2],'#ec785d');
  // Upper rigging and exposed power cables.
  for(let h of [4.2,4.65]){this.part('box',0,h,-3.85,8.4,.04,.05,'#5d6667',3);for(let x=-4;x<=4;x+=.9)this.part('box',x,h,-3.9,.045,.11,.20,'#39464b',3)}
  // Ring fencing, turnbuckles and distinctive horizontal ropes.
  for(let x of [-4.1,4.1]){
   this.part('cylinder',x,1.93,-3.68,.10,1.94,.10,'#59646a',3);
   for(let h of [1.2,1.92,2.65,3.30]){this.part('sphere',x,h,-3.6,.13,.08,.15,'#c77a69',3)}
  }
  for(let h of [1.18,1.90,2.60,3.27]){
   this.part('box',0,h,-3.71,8.1,.017,.016,h===2.60?'#b96656':'#626d70',3);
  }
  // Tiny crowd silhouettes behind the cage.
  for(let i=0;i<25;i++){const x=-7.65+i*.64,y=.96+Math.sin(i*17.3)*.13;
   this.part('sphere',x,y+.11,-5.02,.24,.31,.19,'#111a22',3);
   this.part('head',x,y+.58,-5.05,.11,.14,.12,'#1b2730',3);
  }
  // Key lights + subtle translucent dust in the air.
  for(let [x,col] of [[-3.9,'#53b7cc'],[3.9,'#f4a66f']]){
   this.part('box',x,4.66,-3.55,.51,.13,.38,'#6a7372',3);
   this.part('box',x,4.48,-3.48,.45,.043,.32,col,6);
   this.part('sphere',x,4.47,-3.47,.48,.075,.38,col,6,0,.15);
   this.draw('beam',mm(T(x*0.82,2.30,-2.5),mm(S(1.32,2.1,1.3),I())),col,6,.025);
  }
  // Metal grating floor perimeter and inlaid competition circle.
  this.draw('torus',mm(T(0,.068,0),mm(RX(-PI/2),S(2.45,1.18,1))),'#9a8275',3,.42);
  this.draw('torus',mm(T(0,.069,0),mm(RX(-PI/2),S(1.52,.71,1))),'#6d8185',3,.22);
  for(let x of [-4.08,4.08])this.part('box',x,.012,0,.037,.006,3.69,'#a96b59',3);
  for(let z of [-3.78,3.78])this.part('box',0,.012,z,4.06,.006,.038,'#a96b59',3);
  for(let i=0;i<21;i++){
   const x=-6.9+i*.66;
   this.part('box',x,-.001,3.69,.11,.006,.17,'#6a7779',3);
  }
  // Persistent contact marks and splatter decals embedded in the floor.
  for(const s of this.floorStains){this.part('sphere',s.x,.025,s.z,s.s,.006,s.s*.54,'#562b2a',4,s.rot,s.a);this.part('sphere',s.x+.03,.027,s.z+.02,s.s*.49,.007,s.s*.19,'#943c38',4,0,s.a*.33);}
  // Scuffs and sweat-stained floor.
  for(let i=0;i<28;i++){const a=i*2.399,rad=1.4+Math.sin(i*1.23)*1.7;
   this.part('sphere',Math.cos(a)*rad,.022,Math.sin(a)*rad*.58,.14+Math.sin(i*.3)**2*.15,.002,.045,'#0b181e',4,0,.21);
  }
 }
 shadow(x,z,scale=1,alpha=.28){for(let i=0;i<5;i++)this.part('sphere',x,.012+i*.001,z,(.45+i*.16)*scale,.004,(.19+i*.07)*scale,'#050a0e',4,0,alpha*(.33-i*.045));}
 drawFighter(f,t,opts={}){
  if(!f)return; const cfg=f.cfg||f,heavy=cfg.build==='heavy'?1.16:cfg.build==='slim'?.90:1;
  const skin=cfg.skin||'#c58a67',shirt=cfg.top||'#ac5146',pants=cfg.pants||'#283946',eye=cfg.eyes||'#7bafc5';
  const exposure=cfg.outfit==='tank'?1:cfg.outfit==='tee'?.65:.18;
  const action=f.pose?.action||null,progress=f.pose?.progress||0;
  const wind=smooth(progress/.29),strike=smooth((progress-.28)/.27),returning=smooth((progress-.61)/.36),drive=strike*(1-returning);
  const idle=Math.sin(t*2.9+(f.side===2?2:0)),breath=Math.sin(t*1.6+(f.side===2?1:0));
  const flinch=f.pose?.flinch||0,guard=f.pose?.guard||0,down=f.pose?.down||0,thrown=f.pose?.thrown||0,side=f.facing||1;
  const moving=f.pose?.moving||0;
  const lean=(f.pose?.lean||0) + flinch*.15 + (action==='sweep'?-.15*drive:0)+(action==='knee'?-.07*drive:0)+(action==='jaw'?-.035*drive:0)+(action==='elbow'?-.06*drive:0)+(action==='hipthrow'?-.21*drive:0)+(action==='tripthrow'?-.16*drive:0);
  const tilt=down*1.39+thrown*1.17 + lean + Math.sin(t*1.9)*.010;
  const baseY=-(down*1.1+thrown*.76)+(f.pose?.lift||0)+(action==='sweep'?-.10*drive:0)+Math.abs(moving)*.06*Math.sin(t*14);
  const pivot=(action==='hipthrow'?-.52*drive:action==='tripthrow'?-.17*drive:action==='jaw'?.11*drive:action==='elbow'?.18*drive:0);const root=mm(T(f.renderX||0,baseY,f.renderZ||0),mm(RY((side===1?0:PI)+pivot),mm(T(0,1.68,0),mm(RZ(tilt),T(0,-1.68,0)))));
  const draw=(shape,pos,scale,c,mat=0,rot=0,alpha=1)=>this.draw(shape,mm(root,mm(T(...pos),mm(RZ(rot),S(...scale)))),c,mat,alpha);
  const limb=(a,b,width,matcolor,kind=2,shape='arm')=>this.draw(shape,mm(root,alignY(a,b,width,width*.92)),matcolor,kind);
  const joint=(p,s,col,mat=2)=>draw('sphere',p,[s,s,s],col,mat);
  const pelvis=[0,1.64,0], chest=[-.06,2.29,0],neck=[-.02,2.79,0],head=[0,3.18,0];
  // Planted base stance and alternating footwork.
  let frontAnkle=[.48,.20,.28],backAnkle=[-.39,.20,-.28],frontKnee=[.35,.95,.27],backKnee=[-.23,.96,-.29];
  if(moving){let gait=Math.sin(t*14),amp=Math.min(1,Math.abs(moving));frontAnkle[0]+=gait*.22*amp;frontAnkle[1]+=Math.max(0,gait)*.16*amp;backAnkle[0]-=gait*.20*amp;backAnkle[1]+=Math.max(0,-gait)*.14*amp;frontKnee[0]+=gait*.10*amp;backKnee[0]-=gait*.08*amp;}
  if(action==='sweep') {frontKnee=lerpVec(frontKnee,[.65,.68,.30],drive);frontAnkle=lerpVec(frontAnkle,[1.65,.37,.22],drive);backKnee=lerpVec(backKnee,[-.41,.70,-.32],drive);}
  if(action==='knee'){frontKnee=lerpVec(frontKnee,[1.12,1.47,.26],drive);frontAnkle=lerpVec(frontAnkle,[.84,.78,.29],drive);backKnee[0]-=.10*drive;}
  if(action==='hipthrow'){frontAnkle[0]+=.46*drive;frontKnee[0]+=.35*drive;backAnkle[0]+=.17*drive;}
  if(action==='tripthrow'){backAnkle[0]-=.36*drive;frontKnee[0]+=.26*drive;}
  if(down||thrown){const q=Math.max(down,thrown);frontKnee[0]+=.20*q;frontAnkle[0]+=.36*q;backKnee[0]-=.17*q;}
  const frontHip=[.05,1.67,.24],backHip=[-.05,1.67,-.24];
  const palePants=cfg.build==='heavy'?'#3d4750':pants;
  // Rear leg
  limb(backHip,backKnee,.210*heavy,pants,1,'thigh');joint(backKnee,.168*heavy,pants,1);limb(backKnee,backAnkle,.158*heavy,pants,1,'shin');
  draw('sphere',add(backAnkle,[.19,-.08,.01]),[.32,.13,.205], '#171d23',3);draw('box',add(backAnkle,[.18,-.164,.015]),[.34,.026,.215],'#a6a9a2',3);
  // Front leg
  limb(frontHip,frontKnee,.210*heavy,palePants,1,'thigh');joint(frontKnee,.17*heavy,pants,1);limb(frontKnee,frontAnkle,.158*heavy,pants,1,'shin');
  draw('sphere',add(frontAnkle,[.23,-.078,.01]),[.33,.145,.208],'#161d25',3);draw('box',add(frontAnkle,[.20,-.165,.01]),[.345,.027,.214],'#bec3b9',3);
  // Hip / core / torso. Anatomical overlapping shapes, visible cloth folds.
  draw('bag',pelvis,[.36*heavy,.24,.40*heavy],pants,1);
  draw('sphere',[0,2.08,0],[.35*heavy,.49,.395*heavy],shirt,1);
  draw('sphere',[-.075,2.38,0],[.395*heavy,.48,.485*heavy],shirt,1,-.07);
  draw('sphere',[.1,2.27,.24*heavy],[.21,.25,.24],shirt,1);
  draw('sphere',[.1,2.27,-.24*heavy],[.21,.25,.24],shirt,1);
  draw('sphere',[.11,1.91,0],[.31*heavy,.07,.39*heavy],'#1b232a',1);
  if(cfg.outfit==='tank'){draw('sphere',[0,2.77,0],[.19,.16,.25],skin,2);}else if(cfg.outfit==='rash'){
   draw('sphere',[-.085,2.69,0],[.28,.19,.31],shirt,1);
   for(let z of [-.28,.28])draw('sphere',[-.15,2.38,z],[.20,.42,.04],'#23313b',1);
  }
  for(let i=0;i<4;i++){
   draw('sphere',[.25,2.48-i*.15,.37*heavy],[.018,.015,.09],i%2?'#26313a':'#e2c2a4',1,0,.20);
  }
  // Anatomically plausible shoulder cap and stylised deltoid taper.
  for(let zz of [-1,1]){
    draw('sphere',[-.12,2.50,zz*.385*heavy],[.17,.19,.16],cfg.outfit==='tank'?skin:shirt,cfg.outfit==='tank'?2:1);
    if(cfg.outfit==='rash')draw('sphere',[-.13,2.50,zz*.42*heavy],[.155,.19,.13],shirt,1);
  }
  // Tailored fabric seams, cloth folds, compression panels and woven trouser waistband.
  for(let k=0;k<4;k++){
    const y=1.86+k*.072;
    draw('sphere',[.33,y,-.25*heavy],[.012,.014,.12],k%2?'#8b796d':'#c5b09b',1,-.08,.18);
  }
  for(let z of [-.47,.47]){
    draw('sphere',[-.10,2.32,z*heavy],[.025,.25,.033],'#f2d6bd',1,-.12,.18);
    draw('sphere',[-.01,1.58,z*.74],[.03,.09,.065],'#c6c0b8',1,0,.27);
  }
  // Neck and anatomy
  limb([-.045,2.68,0],neck,.17,skin);
  draw('head',head,[.30*heavy,.38,.31*heavy],skin,2);
  // Sculpted mandibular plane and cheekbones rather than a spherical mask.
  draw('sphere',[.06,3.007,0],[.195,.10,.23],skin,2);
  for(let z of [-.20,.20])draw('sphere',[.104,3.205,z],[.13,.08,.105],skin,2,0,.91);
  // Eyes and ears are placed along the facial surface; side profile avoids the old goggle-like look.
  for(let z of [-.296*heavy,.296*heavy]){
    draw('sphere',[-.035,3.16,z],[.057,.091,.038],skin,2);
    draw('sphere',[-.005,3.165,z+Math.sign(z)*.025],[.035,.052,.015],'#9d6b55',2,0,.44);
  }
  const nearZ=(side===1?1:-1)*.205;
  draw('sphere',[.126,3.20,nearZ],[.11,.045,.092],skin,2,0,.92);
  draw('sphere',[.284,3.248,nearZ],[.022,.015,.032],'#d7c6b1',2);
  draw('sphere',[.302,3.246,nearZ],[.010,.013,.016],eye,2);
  draw('sphere',[.313,3.246,nearZ],[.006,.009,.010],'#10181c',3);
  draw('sphere',[.283,3.320,nearZ],[.021,.011,.088],'#252125',3,-.06);
  draw('sphere',[.282,3.202,nearZ],[.031,.009,.061],'#a36d61',2,0,.32);
  draw('sphere',[.324,3.131,0],[.084,.061,.092],skin,2);
  for(let z of [-.041,.041])draw('sphere',[.380,3.108,z],[.011,.009,.016],'#6c4b41',3);
  draw('sphere',[.259,3.013,0],[.086,.014,.105],'#6b433d',2);
  draw('sphere',[.263,2.992,0],[.075,.011,.093],'#bb8170',2);
  // Hair: short, fade, mohawk, bun, bald.
  const hair='#1b191b';
  if(cfg.hair!=='bald'){
   draw('head',[-.055,3.413,0],[.298,.17,.315],hair,3);
   if(cfg.hair==='mohawk'){for(let i=0;i<6;i++)draw('sphere',[-.23+i*.085,3.50+Math.sin(i*.6)*.07,0],[.073,.15,.075],hair,3)}
   else if(cfg.hair==='bun')draw('sphere',[-.25,3.40,0],[.21,.22,.22],hair,3);
   else if(cfg.hair==='fade'){draw('sphere',[.085,3.46,0],[.245,.11,.22],'#2a2728',3);}else{for(let i=0;i<7;i++){let z=(i-3)*.078;draw('sphere',[.015+Math.sin(i*2)*.05,3.48+Math.cos(i*2)*.025,z],[.105,.07,.07],'#302629',3);}}
  }
  // Fighting guard with IK hands near cheek, correct bending elbow.
  let backShoulder=[-.095,2.53,-.45*heavy],frontShoulder=[-.095,2.54,.45*heavy];
  let backHand=[.50,2.79,-.40],frontHand=[.56,2.77,.44];
  let frontPole=[.10,1.94,.95],backPole=[-.28,2.05,-.91];
  backHand[1]+=breath*.022;frontHand[1]+=breath*.018;
  if(guard){backHand[1]+=.12*guard;frontHand[1]+=.12*guard;backHand[0]-=.18*guard;frontHand[0]-=.19*guard;}
  if(action==='jaw'){
   frontShoulder[0]+=.27*drive;
   frontHand=lerpVec(frontHand,[1.45,2.88,.37],drive);
   frontPole=[.92,2.31,.80];backHand[0]-=.12*drive;
  }else if(action==='elbow'){
   frontShoulder[0]+=.19*drive;frontHand=lerpVec(frontHand,[1.00,2.92,.32],drive);
   frontPole=[1.35,2.32,.76];backHand[0]-=.08*drive;
  }else if(action==='knee'){
   frontHand=lerpVec(frontHand,[.97,2.47,.42],drive);backHand=lerpVec(backHand,[.81,2.46,-.37],drive);
  }else if(action==='hipthrow'||action==='tripthrow'){
   frontHand=lerpVec(frontHand,[1.05,2.47,.34],drive);backHand=lerpVec(backHand,[1.03,2.38,-.34],drive);frontPole=[.75,2.11,.84];backPole=[.78,2.05,-.84];
  }else if(action==='sweep'){
   frontHand=lerpVec(frontHand,[.27,2.58,.52],drive);backHand=lerpVec(backHand,[.21,2.56,-.52],drive);
  }
  if(flinch){frontHand[0]-=flinch*.21;backHand[0]-=flinch*.19;frontHand[1]+=flinch*.1;backHand[1]+=flinch*.13;}
  if(thrown||down){frontHand=lerpVec(frontHand,[.74,2.41,.72],Math.max(thrown,down));backHand=lerpVec(backHand,[-.35,2.33,-.81],Math.max(thrown,down));}
  const doArm=(shoulder,wrist,pole,near)=>{
   const ik=IK(shoulder,wrist,.59*heavy,.61*heavy,pole),el=ik.joint,w=ik.end;
   joint(shoulder,.16*heavy,skin);limb(shoulder,el,.16*heavy,exposure===1?skin:shirt,exposure===1?2:1,'arm');
   if(cfg.outfit!=='tank'){limb(shoulder,lerpVec(shoulder,el,.57),.17*heavy,shirt,1,'arm');}
   joint(el,.12*heavy,skin);limb(el,w,.113*heavy,skin,2,'forearm');
   draw('glove',w,[.142,.12,.132], '#242a2d',3);
   draw('sphere',lerpVec(el,w,.83),[.125,.042,.13],'#d2c5b0',1);
   draw('sphere',lerpVec(el,w,.91),[.09,.072,.098],skin,2);
   for(let k=0;k<3;k++)draw('sphere',add(w,[.057,.065-k*.046,(near?.055:-.055)]),[.042,.028,.025],skin,2);
  };
  doArm(backShoulder,backHand,backPole,false);
  doArm(frontShoulder,frontHand,frontPole,true);
  // Layer of dirt, bruises and abrasions: attached to local anatomical regions.
  const scars=f.scars||[];
  for(let s of scars){let amount=s.size||.065;
    const visible=side===1?1:-1;const loc=s.zone==='face'?[.18+s.dx,3.11+s.dy,.293*visible]:s.zone==='torso'?[.32+s.dx,2.17+s.dy,.35*visible]:s.zone==='arm'?lerpVec(visible===1?frontHand:backHand,visible===1?frontShoulder:backShoulder,.42):s.zone==='leg'?lerpVec(visible===1?frontKnee:backKnee,visible===1?frontAnkle:backAnkle,.36):[.24,2.17,.32*visible];
    draw('sphere',loc,[amount*.25,amount*.82,amount*1.0],'#6e3132',3,s.rot||0,.80);
    draw('sphere',add(loc,[.016,.012,.003]),[amount*.12,amount*.56,amount*.86],'#c16c59',3,s.rot||0,.55);
    for(let k=0;k<3;k++)draw('sphere',add(loc,[(k-1)*.025,(k%2)*.03,.006]),[amount*.11,amount*.28,amount*.23],'#682e31',3,s.rot||0,.65);
  }
  // Soft rim strips on fabric
  draw('sphere',[-.25,2.41,.38*heavy],[.027,.30,.035],'#d4b3a0',1,-.18,.13);
 }
 impact(x=0,kind='hit'){
  if(!this.floorStains)this.floorStains=[];for(let i=0;i<(kind==='throw'?7:2);i++){const a=Math.random()*6.283;this.floorStains.push({x:x+(Math.random()-.5)*.50,z:(Math.random()-.5)*.55,s:(kind==='throw'?.10:.045)+Math.random()*(kind==='throw'?.11:.042),a:.34+Math.random()*.23,rot:a});}if(this.floorStains.length>110)this.floorStains.splice(0,this.floorStains.length-110);
  this.bursts.push({x,z:0,y:kind==='low'?.65:kind==='throw'?.25:2.3,life:1});
  if(kind==='throw')for(let i=0;i<18;i++){let a=i*2*PI/18;this.dust.push({x:x,z:(Math.random()-.5)*.4,y:.06,vx:Math.cos(a)*(1+Math.random())*.55,vz:Math.sin(a)*.5,vy:.22+Math.random()*.5,life:1});}
 }
 effects(dt){for(let b of this.bursts){b.life-=dt*2.6;let radius=(1-b.life)*.6+.08;this.part('sphere',b.x,b.y,b.z,radius,radius*.07,radius,'#e9a88d',3,0,Math.max(0,b.life)*.3);}this.bursts=this.bursts.filter(b=>b.life>0);
  for(let d of this.dust){d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;d.vy-=dt*1.4;d.y=Math.max(.04,d.y);d.life-=dt*1.2;this.part('sphere',d.x,d.y,d.z,.09,.055,.07,'#b8aa97',2,0,Math.max(0,d.life)*.38)}this.dust=this.dust.filter(d=>d.life>0);}
 // GPUless fallback: projects the same articulated 3D rig as shaded 2.5D volumes.
 project(p){const t=matPoint(this.vp,p),w=Math.abs(t[3])>.0001?t[3]:.0001;return [(t[0]/w*.5+.5)*this.w,(-t[1]/w*.5+.5)*this.h,t[2]/w]}
 softwareDraw(d){const c=this.ctx,m=d.transform,center=matPoint(m,[0,0,0]),pt=this.project(center),alpha=clamp(d.alpha,0,1);if(alpha<.01||pt[0]<-this.w*1.2||pt[0]>this.w*2.2)return;
  c.save();c.globalAlpha=alpha;
  if(d.mesh==='torus'||d.mesh==='smallTorus'){
    c.beginPath();for(let i=0;i<=64;i++){let a=i*PI/32,xyz=matPoint(m,[Math.cos(a),Math.sin(a),0]),p=this.project(xyz);if(i===0)c.moveTo(p[0],p[1]);else c.lineTo(p[0],p[1]);}c.strokeStyle=css(d.col,.85);c.lineWidth=Math.max(1,this.w*.0015);c.stroke();c.restore();return;
  }
  if(d.mesh==='box'){
    const a=[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]];
    const points=a.map(v=>this.project(matPoint(m,v)));
    const faces=[[0,1,2,3],[4,5,6,7],[3,2,6,7],[0,1,5,4],[1,2,6,5],[0,3,7,4]];
    for(let [i,ids] of faces.entries()){
      c.beginPath();ids.forEach((id,j)=>j===0?c.moveTo(points[id][0],points[id][1]):c.lineTo(points[id][0],points[id][1]));c.closePath();c.fillStyle=css(d.col,i===2?1.10:i===3?.66:i===0?.86:.80);c.fill();
    }c.restore();return;
  }
  const axis=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
  const vecs=axis.map(v=>{const p=this.project(add(center,v));return [p[0]-pt[0],p[1]-pt[1]]});
  let xx=0,yy=0,xy=0;for(let v of vecs){xx+=v[0]*v[0];yy+=v[1]*v[1];xy+=v[0]*v[1]}
  const tr=xx+yy,disc=Math.sqrt(Math.max(0,(xx-yy)*(xx-yy)+4*xy*xy)),a=Math.sqrt(Math.max(.01,(tr+disc)/2)),b=Math.sqrt(Math.max(.01,(tr-disc)/2)),theta=.5*Math.atan2(2*xy,xx-yy);
  if(![pt[0],pt[1],a,b].every(Number.isFinite)){c.restore();return;} const grad=c.createRadialGradient(pt[0]-a*.3,pt[1]-b*.4,Math.max(1,b*.05),pt[0]+a*.1,pt[1]+b*.08,Math.max(a,b)*1.25);
  grad.addColorStop(0,css(d.col,1.19));grad.addColorStop(.55,css(d.col,.97));grad.addColorStop(1,css(d.col,.49));
  c.beginPath();c.ellipse(pt[0],pt[1],Math.min(a,5000),Math.min(b,5000),theta,0,PI*2);c.fillStyle=grad;c.fill();
  if(d.material!==4&&a>4&&b>3){c.strokeStyle='rgba(12,16,20,.22)';c.lineWidth=1;c.stroke();}
  c.restore();
 }
 end(){if(this.software){this.queue.sort((a,b)=>b.depth-a.depth);for(let d of this.queue)this.softwareDraw(d);}else this.gl.flush();}
}
window.Arena3D={Arena3D,clamp,mix,smooth};
})();

