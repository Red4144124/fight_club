namespace Kontakt {
  export class AudioFX {
    ctx:AudioContext|null=null; enabled=true;
    public init(){if(!this.enabled)return;try{if(!this.ctx){const AC=(window as any).AudioContext||(window as any).webkitAudioContext;this.ctx=AC?new AC():null;}void this.ctx?.resume();}catch(e){console.warn(e)}}
    public toggle(){this.enabled=!this.enabled;if(this.enabled)this.init();return this.enabled;}
    private tone(f:number,d:number,type:OscillatorType,vol=.07,end?:number){
      const c=this.ctx;if(!this.enabled||!c)return;
      const osc=c.createOscillator(),g=c.createGain(),now=c.currentTime;
      osc.type=type;osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(end||Math.max(40,f*.4),now+d);
      g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+d);
      osc.connect(g).connect(c.destination);osc.start(now);osc.stop(now+d+.02);
    }
    private noise(d=.16,vol=.12,cutoff=900){
      const c=this.ctx;if(!c||!this.enabled)return;
      const len=Math.ceil(c.sampleRate*d),buf=c.createBuffer(1,len,c.sampleRate),a=buf.getChannelData(0);
      for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);
      const src=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();
      src.buffer=buf;filter.type='lowpass';filter.frequency.value=cutoff;g.gain.value=vol;
      src.connect(filter).connect(g).connect(c.destination);src.start();src.stop(c.currentTime+d);
    }
    public move(kind:Move){if(!this.enabled)return;
      if(kind==='guard'){this.tone(250,.1,'triangle',.045,130);return;}
      if(kind==='approach'||kind==='retreat'||kind==='recover'){this.noise(.075,.035,450);return;}
      this.noise(.15,.05,1800);
    }
    public hit(crit=false){this.noise(crit?.36:.23,crit?.27:.19,crit?640:850);this.tone(crit?190:160,.21,'sawtooth',crit?.14:.1,49);}
    public miss(){this.noise(.09,.02,2000);}
    public finish(){this.tone(130,.55,'sawtooth',.16,42);this.noise(.54,.08,390);}
  }
}
