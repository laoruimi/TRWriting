(function(root){
  const tiers = [
    [0,'NICE','故事开始流动'],[10,'GOOD','保持这份节奏'],[30,'GREAT','渐入佳境'],
    [60,'AMAZING','灵感正在燃烧'],[100,'PERFECT','笔下，自有天地'],[150,'EXCELLENT','突破你的节奏'],
    [200,'LEGENDARY','故事，由你创造'],[300,'UNSTOPPABLE','落笔不停'],[450,'OVERDRIVE','灵感超频'],
    [650,'UNREAL','超越想象'],[900,'GODLIKE','进入创作领域'],[1200,'INFINITE','灵感没有终点']
  ];
  function tier(n){let index=0;for(let i=1;i<tiers.length;i++)if(n>=tiers[i][0])index=i;return {index,threshold:tiers[index][0],name:tiers[index][1],hint:tiers[index][2],power:1+index*.38};}
  function zoom(value){return Math.max(60,Math.min(200,Math.round(Number(value)||100)));}
  function slicePlan(duration,bpm,offset,cursor,index){
    const beat=60/Math.max(40,Math.min(300,Number(bpm)||120));
    const step=beat/(index>=6?4:2),start=Math.max(0,Math.min(Number(offset)||0,duration-.025));
    const count=Math.max(1,Math.floor((duration-start)/step));
    const position=start+(cursor%count)*step;
    return {position,length:Math.min(step*1.12,duration-position),next:(cursor+1)%count,step};
  }
  const voiceFiles={NICE:'go-human',GOOD:'nice-human',GREAT:'great-human',AMAZING:'congratulations-human',PERFECT:'perfect-human',EXCELLENT:'level-up-human',LEGENDARY:'highscore-human',UNSTOPPABLE:'perfect-human',OVERDRIVE:'level-up-human',UNREAL:'congratulations-human',GODLIKE:'highscore-human',INFINITE:'perfect-human'};
  class Sound {
    constructor(){this.context=null;this.master=null;this.enabled=true;this.volume=.35;this.last=-Infinity;this.voices=new Map();this.spoken=null;this.active=new Set();this.music=null;this.mode='synth';this.bpm=120;this.offset=0;this.cursor=0;this.voiceEnabled=true;this.noise=null;this.musicUntil=0;this.musicPosition=0;}
    ensure(){
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();
        this.master.gain.value=this.enabled?this.volume:0;
        const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;
        this.master.connect(limiter);limiter.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,this.context.sampleRate*.3,this.context.sampleRate);
        const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      return this.context;
    }
    unlock(){if(this.enabled)try{this.ensure().resume().catch(()=>{});}catch{}}
    configure(enabled,volume,mode='synth',bpm=120,offset=0,voice=true){
      if(this.mode!==mode||this.bpm!==bpm||this.offset!==offset){this.stop();this.cursor=0;this.musicPosition=offset;}
      this.enabled=enabled;this.volume=volume;this.mode=mode;this.bpm=bpm;this.offset=offset;this.voiceEnabled=voice;
      if(this.master)this.master.gain.value=enabled?volume:0;if(!enabled)this.stop();
      if((!voice||mode==='music')&&this.spoken){this.spoken.pause();this.spoken=null;}
      if(this.spoken)this.spoken.volume=Math.min(1,this.volume*1.4);
    }
    stop(){
      if(this.spoken){this.spoken.pause();this.spoken.currentTime=0;this.spoken=null;}
      for(const node of this.active)try{node.stop();}catch{}this.active.clear();
      if(this.context)this.context.suspend().catch(()=>{});
      this.last=-Infinity;this.musicUntil=0;
    }
    track(node,...connections){this.active.add(node);node.onended=()=>{this.active.delete(node);node.disconnect();for(const c of connections)c.disconnect();};}
    tone(frequency,start,duration,amplitude,type='sine',endFrequency){
      const c=this.context,o=c.createOscillator(),gain=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,start);
      if(endFrequency)o.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(amplitude,start+.004);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
      if(type==='sawtooth'||type==='square'){
        const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(3400,start);filter.frequency.exponentialRampToValueAtTime(900,start+duration);filter.Q.value=.8;
        o.connect(filter);filter.connect(gain);this.track(o,filter,gain);
      }else{o.connect(gain);this.track(o,gain);}
      gain.connect(this.master);o.start(start);o.stop(start+duration+.01);
    }
    drum(start,index){
      this.tone(155,start,.16,.46,'sine',42);
      const n=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();n.buffer=this.noise;
      filter.type='highpass';filter.frequency.value=3600+index*160;
      gain.gain.setValueAtTime(.055+index*.006,start);gain.gain.exponentialRampToValueAtTime(.001,start+.045+index*.004);
      n.connect(filter);filter.connect(gain);gain.connect(this.master);this.track(n,filter,gain);n.start(start);n.stop(start+.1);
    }
    async decode(buffer){const decoded=await this.ensure().decodeAudioData(buffer.slice(0));if(decoded.duration<.1||decoded.duration>600)throw Error('音乐时长需在 0.1 秒至 10 分钟之间');return decoded;}
    setMusic(buffer){this.stop();this.music=buffer;this.cursor=0;this.musicPosition=this.offset;}
    musicHit(index,now){
      if(!this.music)return;
      // Queue adjoining regions of the original song. Fast input adds playback time,
      // never truncates a playing region or jumps ahead in the source song.
      const beat=60/Math.max(40,Math.min(300,Number(this.bpm)||120));
      const step=Math.min(.35,beat/(index>=6?4:2));
      if(this.musicUntil-now+step>.45)return; // Coalesce input rather than build a long backlog.
      const base=Math.max(0,Math.min(this.offset,this.music.duration-.05));
      const fade=Math.min(.012,(this.music.duration-base)/8),end=this.music.duration-fade;
      let start=Math.max(now+.008,this.musicUntil),budget=step;
      while(budget>.00001){
        if(this.musicPosition<base||this.musicPosition>=end-.00001)this.musicPosition=base;
        const body=Math.min(budget,end-this.musicPosition);
        const source=this.context.createBufferSource(),gain=this.context.createGain(),level=.65+index*.025;
        source.buffer=this.music;source.sliceGain=gain;
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.min(fade,body));
        gain.gain.setValueAtTime(level,start+body);gain.gain.linearRampToValueAtTime(0,start+body+fade);
        source.connect(gain);gain.connect(this.master);this.track(source,gain);
        source.start(start,this.musicPosition,body+fade);source.stop(start+body+fade+.002);
        this.musicPosition+=body;start+=body;budget-=body;
      }
      this.musicUntil=start;this.cursor++;
    }
    hit(n,upgrade=false){
      if(!this.enabled)return;this.unlock();if(!this.context)return;
      const t=tier(n),now=this.context.currentTime;if(now-this.last<.045&&!upgrade)return;this.last=now;this.master.gain.value=this.volume;
      if(this.mode==='music'){this.musicHit(t.index,now,upgrade);}
      else {
        const scale=[0,7,12,7,3,10,15,19],f=220*2**(scale[n%scale.length]/12);
        this.drum(now,t.index);this.tone(f,now,.12+t.index*.005,.15,'sawtooth');this.tone(f*1.004,now,.13,.10,'triangle');
        if(t.index>=3)this.tone(f*2,now+.018,.11,.09,'square');
        if(t.index>=6){this.tone(f*.5,now,.19,.18);this.tone(f*2,now+.065,.08,.06,'triangle');}
        if(upgrade){for(let i=0;i<4+Math.floor(t.index/3);i++)this.tone(f*2**([0,4,7,12,16,19,24][i]/12),now+i*.043,.18,.14,'triangle');this.drum(now+.13,t.index);}
      }
      if(upgrade&&this.mode!=='music')this.announce(t.name);
    }
    announce(name){
      if(!this.enabled||!this.voiceEnabled||this.mode==='music')return;if(this.spoken)this.spoken.pause();
      const file=voiceFiles[name];if(!file)return;let audio=this.voices.get(file);
      if(!audio){audio=new Audio('assets/voice/'+file+'.wav');this.voices.set(file,audio);}
      audio.currentTime=0;audio.volume=Math.min(1,this.volume*1.4);this.spoken=audio;audio.play().catch(()=>{});
    }
  }
  const api={tiers,tier,zoom,slicePlan,voiceFiles,Sound};if(typeof module==='object'&&module.exports)module.exports=api;else root.TRRhythm=api;
})(globalThis);
