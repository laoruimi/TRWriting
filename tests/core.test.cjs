const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const names=['countWords','validBackup','escapeHtml','highlightText','textDiff','rating'];
const syntax=require('../syntax.js');
const theme=require('../theme.js');
const rhythm=require('../rhythm.js');
const context=vm.createContext({TRRhythm:rhythm,highlightText:syntax.highlightText,escapeHtml:syntax.escapeHtml});
const selected=source.split('\n').filter(line=>names.some(name=>line.startsWith(`function ${name}(`)||line.startsWith(`const ${name}=`)||line.startsWith(`const ${name} =`)));
vm.runInContext(selected.join('\n')+'\nthis.api={'+names.join(',')+'};',context);
const api=context.api;
test('highlights all five requested syntax categories and escapes markup',()=>{
  const html=api.highlightText('他说：“你好” ‘秘密’ [任务] 【系统】\n提示：继续\n<script>alert(1)</script>');
  for(const name of ['dialogue','single','bracket','system','colon'])assert.ok(html.includes(`syntax-${name}`));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('unclosed quotes stop at line boundaries',()=>{
  assert.equal(api.highlightText('“未结束\n普通正文'),'<span class="syntax-dialogue">“未结束</span>\n普通正文');
});
test('edit diff preserves emoji and reconstructs replacement text',()=>{
  for(const [before,after] of [['你好世界','你好新的世界'],['😀结束','😁结束'],['前文\n后文','前文后文'],['重复重复','重复'],['','新章']]){
    const diff=api.textDiff(before,after);
    assert.equal(before.slice(0,diff.start)+diff.added+before.slice(diff.start+diff.removed.length),after);
  }
  assert.equal(api.textDiff('😀','😁').removed,'😀');
});
test('backup validation rejects malformed chapters and duplicate ids',()=>{
  const base={version:1,book:'书',chapters:[{id:'a',title:'章',text:'正文'}]};
  assert.equal(api.validBackup(base),true);
  assert.equal(api.validBackup({...base,chapters:[...base.chapters,...base.chapters]}),false);
  assert.equal(api.validBackup({...base,chapters:[{id:'a',title:'章',text:7}]}),false);
  assert.equal(api.validBackup({...base,chapters:[]}),false);
});
test('unicode counts and combo thresholds',()=>{
  assert.equal(api.countWords('你 好\n😀'),3);
  for(const [n,label] of [[9,'NICE'],[10,'GOOD'],[30,'GREAT'],[60,'AMAZING'],[100,'PERFECT'],[200,'LEGENDARY']])assert.equal(api.rating(n)[0],label);
});
test('every configured punctuation pair colors its whole contents',()=>{
  for(const [style,pairs] of syntax.groups) for(const [open,close] of pairs){
    assert.equal(syntax.highlightText(open+'正文'+close),`<span class="syntax-${style}">${syntax.escapeHtml(open+'正文'+close)}</span>`);
    assert.ok(syntax.highlightText(open+'未完成\n普通正文').endsWith('\n普通正文'));
  }
});
test('nested pairs return to the outer color and colon resumes afterwards',()=>{
  assert.equal(syntax.highlightText('提示：《书中『对白』续文》尾声'),'提示<span class="syntax-colon">：</span><span class="syntax-book">《书中</span><span class="syntax-dialogue">『对白』</span><span class="syntax-book">续文》</span><span class="syntax-colon">尾声</span>');
});
test('English apostrophes do not swallow following text',()=>{
  assert.ok(!syntax.highlightText("don't stop").includes('syntax-single'));
});
test('theme color validation and readable foreground for custom surfaces',()=>{
  assert.equal(theme.validColor('#123abc'),true);
  assert.equal(theme.validColor('url(evil)'),false);
  assert.equal(theme.surface('#000000').ink,'#e6e6df');
  assert.equal(theme.surface('#ffffff').ink,'#302f2c');
  assert.equal(theme.mix('#000000','#ffffff',.5),'#808080');
  for(const preset of Object.values(theme.presets)){
    assert.ok(theme.validColor(preset.background));
    assert.ok(theme.validColor(preset.paper));
  }
});
test('rhythm has twelve monotonic tiers and bounded zoom',()=>{
  assert.equal(rhythm.tiers.length,12);
  let previous=0;
  for(const [threshold,name] of rhythm.tiers){
    const current=rhythm.tier(threshold);
    assert.equal(current.name,name);
    assert.ok(current.power>=previous);
    if(threshold>0)assert.ok(rhythm.tier(threshold-1).index<current.index);
    previous=current.power;
    assert.ok(fs.statSync(require('node:path').join(__dirname,'../assets/voice',rhythm.voiceFiles[name]+'.wav')).size>1000);
  }
  assert.equal(rhythm.zoom(10),60);
  assert.equal(rhythm.zoom(300),200);
  assert.equal(rhythm.zoom(125),125);
});

// A source slice must never pass the decoded buffer end, including short clips and late downbeats.
test('music slices follow BPM, wrap safely and grow denser at high tiers',()=>{
  const normal=rhythm.slicePlan(10,120,1,0,0);
  assert.equal(normal.position,1);assert.equal(normal.step,.25);
  assert.equal(rhythm.slicePlan(10,120,1,1,0).position,1.25);
  assert.equal(rhythm.slicePlan(10,120,1,0,6).step,.125);
  for(const duration of [.1,.26,1,9.88])for(const bpm of [40,120,300])for(const offset of [0,.08,10]){
    let cursor=0;
    for(let i=0;i<200;i++){
      const p=rhythm.slicePlan(duration,bpm,offset,cursor,11);cursor=p.next;
      assert.ok(p.position>=0&&p.length>0&&p.position+p.length<=duration+.000001);
    }
  }
});

test('music keeps source order across rapid hits and tier changes, with bounded lookahead',()=>{
  const sound=new rhythm.Sound(),sources=[];
  const gain=()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}});
  sound.context={createGain:gain,createBufferSource(){const node={connect(){},disconnect(){},start(...args){this.started=args;},stop(time){this.stopped=time;}};sources.push(node);return node;}};
  sound.master={};sound.music={duration:10};sound.offset=1;sound.musicPosition=1;
  for(let i=0;i<100;i++){const now=i*.02;sound.musicHit(i>30?8:2,now);assert.ok(sound.musicUntil-now<=.459);}
  assert.ok(sources.length<100,'fast input is coalesced');
  for(let i=1;i<sources.length;i++){
    const previous=sources[i-1].started,current=sources[i].started;
    assert.ok(Math.abs(current[1]-(previous[1]+previous[2]-.012))<.000001,'source samples are adjacent');
    assert.ok(Math.abs(current[0]-(previous[0]+previous[2]-.012))<.000001,'timeline has a crossfade overlap');
  }
  for(const source of sources)assert.ok(Math.abs(source.stopped-(source.started[0]+source.started[2]+.002))<.000001,'later hits never truncate earlier sources');
});
test('music mode suppresses voice even if the saved voice preference is on',()=>{
  const sound=new rhythm.Sound();sound.mode='music';sound.voiceEnabled=true;
  assert.doesNotThrow(()=>sound.announce('GREAT'));
  let paused=false;sound.spoken={pause(){paused=true;}};
  sound.configure(true,.35,'music',120,0,true);
  assert.ok(paused);assert.equal(sound.spoken,null);
});
