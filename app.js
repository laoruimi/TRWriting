'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'trwriting.workspace.v1';
const fontStacks = {serif:'"Noto Serif SC","Source Han Serif SC","Songti SC",SimSun,serif',sans:'"Microsoft YaHei","PingFang SC",sans-serif',mono:'Consolas,"Microsoft YaHei",monospace'};
const fontNames = {serif:'书卷 · 宋体',sans:'简洁 · 黑体',mono:'秩序 · 等宽',custom:'自选字体'};
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const countWords = text => Array.from(text.replace(/\s/g,'')).length;
let state = {version:1,book:'未命名的长篇',active:'',chapters:[],settings:{font:'serif',size:20,effects:!matchMedia('(prefers-reduced-motion: reduce)').matches,highlight:true,intensity:1,theme:'midnight',background:'#181b22',paper:'#20252e',pageZoom:100,sound:true,volume:35,voice:true,soundMode:'synth',musicBpm:120,musicOffset:0,baselineEnabled:true,baselineStep:500}};
function validBackup(data){return data?.version===1 && typeof data.book==='string' && Array.isArray(data.chapters) && data.chapters.length>0 && data.chapters.every(c=>typeof c.id==='string' && typeof c.title==='string' && typeof c.text==='string') && new Set(data.chapters.map(c=>c.id)).size===data.chapters.length;}
let startupWarning='';
try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const saved=JSON.parse(raw);if(!validBackup(saved))throw Error('invalid');state={...state,...saved,settings:{...state.settings,...saved.settings}};}}catch{startupWarning='本地存档无法读取，请勿覆盖重要备份。建议先导入已有备份。';}
if(!state.chapters.length){state.chapters.push({id:id(),title:'第一章 起笔之处',text:''});}
if(!state.chapters.some(c=>c.id===state.active))state.active=state.chapters[0].id;
state.settings.size=Math.max(16,Math.min(32,Number(state.settings.size)||20));
if(!['serif','sans','mono','custom'].includes(state.settings.font))state.settings.font='serif';
if(![.5,1,1.7].includes(Number(state.settings.intensity)))state.settings.intensity=1;
if(!TRTheme.presets[state.settings.theme] && state.settings.theme!=='custom')state.settings.theme='midnight';
if(!TRTheme.validColor(state.settings.background))state.settings.background='#181b22';
if(!TRTheme.validColor(state.settings.paper))state.settings.paper='#20252e';
state.settings.pageZoom=TRRhythm.zoom(state.settings.pageZoom);
state.settings.volume=Math.max(0,Math.min(100,Number(state.settings.volume)||0));
state.settings.musicBpm=Math.max(40,Math.min(300,Number(state.settings.musicBpm)||120));
state.settings.musicOffset=Math.max(0,Math.min(600,Number(state.settings.musicOffset)||0));
if(!['synth','music'].includes(state.settings.soundMode))state.settings.soundMode='synth';
state.settings.baselineStep=Math.max(100,Math.min(10000,Math.round(Number(state.settings.baselineStep)||500)));
const sound=new TRRhythm.Sound();
const editor=$('editor');let previousText='',composing=false,compositionBase='',saveTimer,toastTimer,combo=0,lastTyped=0,peak=0,frame=0,particles=[],shakeAnimation;
const chapter=()=>state.chapters.find(c=>c.id===state.active);
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function save(){clearTimeout(saveTimer);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('saveState').innerHTML='<i class="status-dot"></i> 已保存到本地';return true;}catch{$('saveState').textContent='保存失败 · 请导出备份';toast('本地存储不可用或已满，请立即导出备份。');return false;}}
function scheduleSave(){$('saveState').textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(save,350);}
function renderChapters(){const nav=$('chapterList');nav.replaceChildren();state.chapters.forEach((c,i)=>{const b=document.createElement('button');b.className='chapter-item'+(c.id===state.active?' active':'');b.setAttribute('aria-current',c.id===state.active?'page':'false');const n=document.createElement('span');n.className='chapter-number';n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.className='chapter-label';label.textContent=c.title||'未命名章节';b.title=label.textContent;const dot=document.createElement('span');dot.className='chapter-dot';dot.textContent=c.id===state.active?'●':'';b.append(n,label,dot);b.onclick=()=>loadChapter(c.id);nav.append(b);});$('bookLabel').textContent=state.book;}
function loadChapter(key){if(composing)return;state.active=key;$('chapterGoal').value=chapterGoal();editor.value=chapter().text;previousText=editor.value;$('chapterTitle').value=chapter().title;$('breadcrumbTitle').textContent=chapter().title||'未命名章节';$('chapterOrdinal').textContent=`CHAPTER ${String(state.chapters.indexOf(chapter())+1).padStart(2,'0')}`;editor.scrollTop=0;resetCombo();renderChapters();renderText();updateCounts();scheduleSave();}
const { escapeHtml, highlightText } = TRSyntax;
function renderText(){scheduleBaselines();$('highlight').style.width=editor.clientWidth+'px';$('highlight').innerHTML=(state.settings.highlight?highlightText(editor.value):escapeHtml(editor.value))+'\n';syncScroll();}
function syncScroll(){positionBaselines();$('highlight').scrollTop=editor.scrollTop;$('highlight').scrollLeft=editor.scrollLeft;}
function updateCounts(){$('wordCount').textContent=`${countWords(editor.value).toLocaleString()} 字`;$('totalCount').textContent=`全书 ${state.chapters.reduce((sum,c)=>sum+countWords(c.text),0).toLocaleString()} 字`;updateGoal();updateCursor();}
function updateCursor(){const before=editor.value.slice(0,editor.selectionStart),lines=before.split('\n');$('cursorPosition').textContent=`第 ${lines.length} 行，第 ${Array.from(lines.at(-1)).length+1} 列`;}
function textDiff(before,after){const oldChars=Array.from(before),newChars=Array.from(after);let start=0;while(start<oldChars.length && start<newChars.length && oldChars[start]===newChars[start])start++;let oldEnd=oldChars.length,newEnd=newChars.length;while(oldEnd>start && newEnd>start && oldChars[oldEnd-1]===newChars[newEnd-1]){oldEnd--;newEnd--;}return {start:oldChars.slice(0,start).join('').length,removed:oldChars.slice(start,oldEnd).join(''),added:newChars.slice(start,newEnd).join('')};}
function commitEdit(before,inputType=''){const after=editor.value;const diff=textDiff(before,after);chapter().text=after;previousText=after;renderText();updateCounts();scheduleSave();if(before===after)return;const history=/history/i.test(inputType),paste=/paste|drop/i.test(inputType);if(history)return;if(diff.removed && state.settings.effects)burst(diff.removed,diff.start,true,before);if(diff.added && !paste){const amount=countWords(diff.added);if(amount&&state.settings.effects){addCombo(amount);burst(diff.added,editor.selectionStart,false);}}}
editor.addEventListener('compositionstart',()=>{composing=true;compositionBase=previousText;});
editor.addEventListener('compositionend',()=>{composing=false;commitEdit(compositionBase,'insertCompositionText');});
editor.addEventListener('input',e=>{if(composing||e.isComposing){renderText();return;}commitEdit(previousText,e.inputType);});
editor.addEventListener('scroll',syncScroll);editor.addEventListener('click',updateCursor);editor.addEventListener('keyup',updateCursor);editor.addEventListener('select',updateCursor);
function rating(n){const tier=TRRhythm.tier(n);return [tier.name,tier.hint];}
function addCombo(n){
  const now=performance.now();if(now-lastTyped>5000)combo=0;
  const previousTier=TRRhythm.tier(combo).index,wasEmpty=combo===0;
  combo+=n;peak=Math.max(peak,combo);lastTyped=now;
  const tier=TRRhythm.tier(combo);
  $('comboCount').textContent=combo;$('comboRating').textContent=tier.name;$('comboHint').textContent=tier.hint;
  $('comboCard').style.setProperty('--neon',`hsl(${185+tier.index*19} 100% 72%)`);
  $('comboCard').classList.remove('hit');void $('comboCard').offsetWidth;$('comboCard').classList.add('hit');
  sound.hit(combo,wasEmpty||tier.index>previousTier);
  if(!frame)frame=requestAnimationFrame(animate);
}
function resetCombo(){combo=0;lastTyped=0;$('comboCount').textContent='0';$('comboRating').textContent='READY';$('comboHint').textContent=peak?`本次最高 ${peak} 连击`:'灵感，即将起飞';$('comboProgress').style.width='0';$('comboCard').style.setProperty('--neon','#55eaff');}
function caretPoint(position,text=editor.value){const mirror=$('caretMirror');mirror.style.width=editor.clientWidth+'px';mirror.replaceChildren(document.createTextNode(text.slice(0,position)));const marker=document.createElement('span');marker.textContent='\u200b';mirror.append(marker,document.createTextNode(text.slice(position)||'.'));const rect=marker.getBoundingClientRect(),box=editor.getBoundingClientRect();return {x:rect.left-editor.scrollLeft*state.settings.pageZoom/100,y:rect.top-editor.scrollTop*state.settings.pageZoom/100+Number(state.settings.size)*state.settings.pageZoom/100,box};}
const canvas=$('particles'),ctx=canvas.getContext('2d');
function resizeCanvas(){const ratio=devicePixelRatio||1;canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(ratio,0,0,ratio,0,0);}
addEventListener('resize',resizeCanvas);resizeCanvas();
function burst(text,pos,deleted,oldText){const p=caretPoint(pos,oldText),size=Number(state.settings.size)*state.settings.pageZoom/100,strength=Number(state.settings.intensity),level=TRRhythm.tier(combo);if(p.y<p.box.top||p.y>p.box.bottom)return;const chars=Array.from(text).filter(c=>!(/\s/.test(c))).slice(-8);if(!chars.length)return;const font=getComputedStyle(editor).fontFamily;const now=performance.now();if(deleted){chars.forEach((char,i)=>{const originX=Math.min(p.box.right-size,p.x+i*size);for(let row=0;row<3;row++)for(let col=0;col<3;col++)particles.push({type:'shard',char,x:originX,y:p.y,vx:(col-1)*65+(Math.random()-.5)*100,vy:-60+row*40-Math.random()*90,rotation:0,spin:(Math.random()-.5)*7,size,font,col,row,life:650+Math.random()*200,born:now,color:'#ff6ba8'});});}else{chars.slice(-3).forEach((char,i)=>{for(let j=0;j<4+Math.floor(level.index/3);j++)particles.push({type:'ghost',char,x:p.x-size*(chars.slice(-3).length-i),y:p.y,vx:(j%2?1:-1)*(20+j*13)*level.power,vy:-18-j*9,size,font,life:400+j*85,born:now,color:['#38edff','#ff4bd1','#ae83ff','#f8fcff'][j%4]});});for(let i=0;i<12+level.index*3;i++){const a=Math.random()*Math.PI*2,speed=(35+Math.random()*100)*strength*level.power;particles.push({type:'spark',x:p.x,y:p.y-size*.4,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,size:1+Math.random()*2.5,life:250+Math.random()*250,born:now,color:i%2?'#ff4bd1':'#38edff'});}shakeAnimation?.cancel();const power=Math.min(12,level.power*1.4)*strength;shakeAnimation=$('editorFrame').animate([{transform:`translate(${power}px,${-power*.45}px)`},{transform:`translate(${-power*.7}px,${power*.3}px)`},{transform:`translate(${power*.3}px,0)`},{transform:'translate(0,0)'}],{duration:145+level.index*10,easing:'ease-out'});}particles=particles.slice(-500);if(!frame)frame=requestAnimationFrame(animate);}
let lastFrame=0;
function animate(now){const dt=Math.min((now-(lastFrame||now))/1000,.04);lastFrame=now;ctx.clearRect(0,0,innerWidth,innerHeight);particles=particles.filter(p=>now-p.born<p.life);for(const p of particles){const age=(now-p.born)/p.life;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.save();ctx.globalAlpha=(1-age)*(p.type==='ghost'?.65:.9);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=p.type==='ghost'?18:9;if(p.type==='spark'){ctx.fillRect(p.x,p.y,p.size*(1-age),p.size*(1-age));}else if(p.type==='ghost'){ctx.font=`${p.size}px ${p.font}`;ctx.fillText(p.char,p.x,p.y);}else{p.vy+=360*dt;p.rotation+=p.spin*dt;const w=p.size/3,h=p.size*1.2/3;ctx.translate(p.x+p.col*w+w/2,p.y-p.size+p.row*h+h/2);ctx.rotate(p.rotation);ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.clip();ctx.font=`${p.size}px ${p.font}`;ctx.fillText(p.char,-p.col*w-w/2,p.size-p.row*h-h/2);}ctx.restore();}if(combo){const left=Math.max(0,1-(now-lastTyped)/5000);$('comboProgress').style.width=`${left*100}%`;if(!left)resetCombo();}if(particles.length||combo)frame=requestAnimationFrame(animate);else{frame=0;lastFrame=0;}}
function applySettings(){$('chapterGoal').value=chapterGoal();$('baselineEnabled').checked=state.settings.baselineEnabled;$('baselineStep').value=state.settings.baselineStep;updateGoal();applyTheme();applyZoom();document.body.classList.toggle('effects-active',state.settings.effects);$('comboCard').hidden=!state.settings.effects;$('soundEnabled').checked=state.settings.sound;$('soundVolume').value=state.settings.volume;$('volumeLabel').textContent=state.settings.volume+'%';sound.configure(state.settings.effects&&state.settings.sound,state.settings.volume/100,state.settings.soundMode,state.settings.musicBpm,state.settings.musicOffset,state.settings.voice);$('voiceEnabled').checked=state.settings.soundMode!=='music'&&state.settings.voice;$('voiceEnabled').disabled=state.settings.soundMode==='music';$('voiceEnabled').title=state.settings.soundMode==='music'?'音乐切片模式不播放评价播报':'';$('soundMode').value=state.settings.soundMode;$('musicBpm').value=state.settings.musicBpm;$('musicOffset').value=state.settings.musicOffset;document.documentElement.style.setProperty('--editor-font',state.settings.font==='custom'?'TRCustom,SimSun,serif':fontStacks[state.settings.font]);document.documentElement.style.setProperty('--editor-size',state.settings.size+'px');$('fontSizeValue').textContent=state.settings.size;$('fontSize').value=state.settings.size;$('sizeLabel').textContent=state.settings.size+' px';$('fontFamily').value=state.settings.font;$('fontButton').textContent=(fontNames[state.settings.font]||'自选字体')+' ⌄';$('intensity').value=state.settings.intensity;$('highlightToggle').checked=state.settings.highlight;$('effectsToggle').setAttribute('aria-pressed',String(state.settings.effects));$('effectsToggle').textContent=state.settings.effects?'ϟ 爆震已开启':'ϟ 爆震已关闭';$('decreaseFont').disabled=state.settings.size<=16;$('increaseFont').disabled=state.settings.size>=32;renderText();}
$('effectsToggle').onclick=()=>{state.settings.effects=!state.settings.effects;if(!state.settings.effects){particles=[];shakeAnimation?.cancel();resetCombo();sound.stop();}applySettings();save();};
function applyZoom(){
  const viewport=$('paperViewport'),layout=$('paperLayout'),page=document.querySelector('.writing-stage');
  const css=getComputedStyle(viewport),ratio=state.settings.pageZoom/100;
  const width=Math.min(1150,viewport.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight));
  const height=Math.max(300,viewport.clientHeight-parseFloat(css.paddingTop));
  page.style.width=width+'px';page.style.height=height+'px';
  page.style.setProperty('--page-zoom',ratio);
  layout.style.width=width*ratio+'px';layout.style.height=height*ratio+'px';
  $('zoomReset').textContent=state.settings.pageZoom+'%';renderText();
}
let wheelAmount=0;
$('paperViewport').addEventListener('wheel',e=>{
  if(!e.ctrlKey)return;e.preventDefault();
  wheelAmount+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);
  if(Math.abs(wheelAmount)<40)return;
  state.settings.pageZoom=TRRhythm.zoom(state.settings.pageZoom+(wheelAmount<0?5:-5));wheelAmount=0;
  particles=[];shakeAnimation?.cancel();applyZoom();scheduleSave();
},{passive:false});
$('zoomReset').onclick=()=>{state.settings.pageZoom=100;applyZoom();scheduleSave();};
$('soundEnabled').onchange=e=>{state.settings.sound=e.target.checked;applySettings();scheduleSave();};
$('soundVolume').oninput=e=>{state.settings.volume=Number(e.target.value);applySettings();scheduleSave();};
$('soundPreview').onclick=()=>{if(!state.settings.effects||!state.settings.sound){toast('请先开启爆震和连击音效。');return;}if(state.settings.soundMode==='music'&&!sound.music){toast('请先导入音乐。');return;}sound.hit(30,true);};
$('voiceEnabled').onchange=e=>{state.settings.voice=e.target.checked;applySettings();scheduleSave();};
$('soundMode').onchange=e=>{if(e.target.value==='music'&&!sound.music){toast('请先导入一首音乐。');e.target.value=state.settings.soundMode;return;}state.settings.soundMode=e.target.value;applySettings();scheduleSave();};
$('musicBpm').onchange=e=>{state.settings.musicBpm=Math.max(40,Math.min(300,Number(e.target.value)||120));applySettings();scheduleSave();};
$('musicOffset').onchange=e=>{state.settings.musicOffset=Math.max(0,Math.min(sound.music?Math.max(0,sound.music.duration-.1):600,Number(e.target.value)||0));applySettings();scheduleSave();};
$('audioCredits').onclick=()=>$('audioCreditsDialog').showModal();
$('closeAudioCredits').onclick=()=>$('audioCreditsDialog').close();
let musicGeneration=0,musicRecord=null;
function musicStore(mode,record){return new Promise((resolve,reject)=>{
  const request=indexedDB.open('trwriting.audio',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('tracks');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('tracks',mode),store=tx.objectStore('tracks');
    const action=mode==='readonly'?store.get('music'):record?store.put(record,'music'):store.delete('music');
    tx.oncomplete=()=>{db.close();resolve(action.result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};
  };
});}
function showMusic(){
  $('removeMusic').disabled=!musicRecord;
  $('musicInfo').textContent=musicRecord?musicRecord.name+' · '+sound.music.duration.toFixed(1)+' 秒':'尚未导入音乐 · 支持 MP3 / WAV / OGG / M4A / FLAC';
}
$('importMusic').onclick=()=>$('musicFile').click();
$('musicFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;const generation=++musicGeneration;
  $('importMusic').disabled=true;$('musicInfo').textContent='正在分析音乐…';
  try{
    if(file.size>80*1024*1024)throw Error('音乐文件不能超过 80 MB');
    const record={name:file.name,buffer:await file.arrayBuffer()};
    const decoded=await sound.decode(record.buffer);if(generation!==musicGeneration)return;
    sound.setMusic(decoded);musicRecord=record;state.settings.soundMode='music';state.settings.musicOffset=0;
    applySettings();save();showMusic();
    try{await musicStore('readwrite',record);if(generation===musicGeneration)toast('音乐已保存，请填写歌曲 BPM 和起拍位置。');}
    catch{if(generation===musicGeneration)toast('音乐可用于本次写作，但本机保存失败；下次需重新导入。');}
  }catch(error){showMusic();toast('音乐导入失败：'+error.message);}
  finally{$('importMusic').disabled=false;e.target.value='';}
};
$('removeMusic').onclick=async()=>{
  ++musicGeneration;sound.setMusic(null);musicRecord=null;state.settings.soundMode='synth';applySettings();save();showMusic();
  try{await musicStore('readwrite',null);}catch{toast('本机音乐缓存移除失败，请重试。');}
};
(async()=>{const generation=musicGeneration;try{
  const record=await musicStore('readonly');if(generation!==musicGeneration)return;
  if(!record){if(state.settings.soundMode==='music'){state.settings.soundMode='synth';applySettings();save();}return;}
  const decoded=await sound.decode(record.buffer);if(generation!==musicGeneration)return;
  sound.setMusic(decoded);musicRecord=record;showMusic();applySettings();
}catch{if(generation===musicGeneration){state.settings.soundMode='synth';applySettings();toast('音乐缓存无法读取，请重新导入。');}}})();
editor.addEventListener('keydown',()=>{if(state.settings.effects)sound.unlock();});
editor.addEventListener('pointerdown',()=>{if(state.settings.effects)sound.unlock();});
function changeSize(size){state.settings.size=Math.max(16,Math.min(32,size));applySettings();scheduleSave();}
$('decreaseFont').onclick=()=>changeSize(state.settings.size-1);$('increaseFont').onclick=()=>changeSize(state.settings.size+1);$('fontSize').oninput=e=>changeSize(Number(e.target.value));$('fontFamily').onchange=e=>{state.settings.font=e.target.value;applySettings();save();};$('intensity').onchange=e=>{state.settings.intensity=Number(e.target.value);save();};$('highlightToggle').onchange=e=>{state.settings.highlight=e.target.checked;applySettings();save();};
function applyTheme() {
  const settings=state.settings;
  const preset=TRTheme.presets[settings.theme];
  if(preset){settings.background=preset.background;settings.paper=preset.paper;}
  const shell=TRTheme.surface(settings.background),paper=TRTheme.surface(settings.paper);
  const root=document.documentElement;
  root.dataset.shell=shell.dark?'dark':'light';
  root.dataset.paper=paper.dark?'dark':'light';
  const values={
    '--bg':settings.background,'--paper':settings.paper,'--ink':shell.ink,'--muted':shell.muted,
    '--line':shell.line,'--surface':shell.raised,'--paper-ink':paper.ink,'--paper-muted':paper.muted,
    '--paper-line':paper.line,'--paper-raised':paper.raised
  };
  for(const [key,value] of Object.entries(values))root.style.setProperty(key,value);
  $('themePreset').value=settings.theme;
  $('backgroundColor').value=settings.background;
  $('paperColor').value=settings.paper;
  $('backgroundHex').textContent=settings.background.toUpperCase();
  $('paperHex').textContent=settings.paper.toUpperCase();
}
$('themePreset').onchange=e=>{state.settings.theme=e.target.value;applyTheme();scheduleSave();};
for(const [control,setting] of [['backgroundColor','background'],['paperColor','paper']]){
  $(control).oninput=e=>{state.settings.theme='custom';state.settings[setting]=e.target.value;applyTheme();scheduleSave();};
}
$('settings').onclick=$('fontButton').onclick=()=>$('settingsDialog').showModal();$('focusToggle').onclick=()=>document.body.classList.toggle('focus-mode');
$('chapterTitle').oninput=()=>{chapter().title=$('chapterTitle').value;$('breadcrumbTitle').textContent=chapter().title||'未命名章节';renderChapters();scheduleSave();};
$('addChapter').onclick=()=>{if(composing)return;const c={id:id(),title:`第${state.chapters.length+1}章`,text:''};state.chapters.push(c);loadChapter(c.id);$('chapterTitle').focus();$('chapterTitle').select();};
$('bookName').onclick=()=>{$('bookNameInput').value=state.book;$('bookDialog').showModal();$('bookNameInput').select();};
$('cancelBook').onclick=()=>$('bookDialog').close();
$('bookForm').onsubmit=e=>{e.preventDefault();const name=$('bookNameInput').value.trim();if(name){state.book=name;renderChapters();save();$('bookDialog').close();}};
$('deleteChapter').onclick=()=>{if(state.chapters.length===1){toast('至少保留一个章节。');return;}if(confirm(`确定删除「${chapter().title||'未命名章节'}」？此操作无法撤销，请先导出备份。`)){state.chapters=state.chapters.filter(c=>c.id!==state.active);loadChapter(state.chapters[0].id);save();$('settingsDialog').close();}};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('exportText').onclick=()=>{download(state.book+'\n\n'+state.chapters.map(c=>c.title+'\n\n'+c.text).join('\n\n————————————————\n\n'),state.book+'.txt','text/plain;charset=utf-8');toast('已导出全书文本。');};
$('backup').onclick=()=>{download(JSON.stringify(state,null,2),state.book+'-TRWriting备份.json','application/json');toast('已导出作品和设置；字体文件请单独保留。');};
$('restore').onclick=()=>$('backupFile').click();$('backupFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25*1024*1024)throw Error('备份文件过大（上限 25 MB）');const data=JSON.parse(await file.text());if(!validBackup(data))throw Error('不是有效的 TRWriting 备份');if(!confirm(`将「${data.book}」的 ${data.chapters.length} 个章节作为新章节导入当前作品？现有章节会保留。`))return;const chapters=data.chapters.map(c=>({id:id(),title:c.title,text:c.text,...(Number.isFinite(c.goal)?{goal:Math.max(0,Math.min(1000000,Math.round(c.goal)))}:{})}));state.chapters.push(...chapters);loadChapter(chapters[0].id);save();toast('章节已导入，原有内容已保留。');}catch(error){toast('导入失败：'+error.message);}finally{e.target.value='';}};
let customFace;
function fontDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('trwriting.fonts',1);req.onupgradeneeded=()=>req.result.createObjectStore('fonts');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function fontStore(mode,value){const db=await fontDB();return new Promise((resolve,reject)=>{const tx=db.transaction('fonts',mode);const store=tx.objectStore('fonts');const req=mode==='readwrite'?store.put(value,'custom'):store.get('custom');tx.oncomplete=()=>{db.close();resolve(req.result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});}
async function installFont(record){const face=new FontFace('TRCustom',record.buffer);await face.load();if(customFace)document.fonts.delete(customFace);customFace=face;document.fonts.add(face);fontNames.custom=record.name.replace(/\.[^.]+$/,'');if(!$('fontFamily').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';$('fontFamily').append(option);}$('fontFamily').querySelector('[value="custom"]').textContent=fontNames.custom;$('fontInfo').textContent='当前字体：'+record.name;}
$('importFont').onclick=()=>$('fontFile').click();$('fontFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体');if(file.size>40*1024*1024)throw Error('字体文件不能超过 40 MB');const record={name:file.name,buffer:await file.arrayBuffer()};await installFont(record);state.settings.font='custom';applySettings();save();try{await fontStore('readwrite',record);toast('字体已应用，并保存在此浏览器。');}catch{toast('字体已应用，但无法持久保存；下次打开需重新导入。');}}catch(error){toast('字体导入失败：'+error.message);}finally{e.target.value='';}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(save())toast('已保存到本地。');}if(e.key==='Escape')document.body.classList.remove('focus-mode');});
addEventListener('pagehide',()=>{chapter().text=editor.value;save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.stop();resetCombo();chapter().text=editor.value;save();}});
let baselineFrame=0,baselinePositions=[];
function chapterGoal(){const value=chapter().goal;return value===undefined?3000:Math.max(0,Math.min(1000000,Math.round(Number(value)||0)));}
let goalView=null,goalAnimation=null;
function updateGoal(){
  const target=chapterGoal(),words=countWords(editor.value),percent=target?Math.min(100,Math.floor(words/target*100)):0;
  const panel=$('goalPanel'),complete=target>0&&words>=target;
  panel.hidden=!target;$('goalCurrent').textContent=words.toLocaleString();$('goalTarget').textContent=target.toLocaleString();
  $('goalText').textContent=complete?'本章目标已达成':words?'还差 '+(target-words).toLocaleString()+' 字':'落笔，离故事更近一步';
  $('goalPercent').textContent=percent+'%';$('goalFill').style.width=percent+'%';panel.classList.toggle('complete',complete);
  panel.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',percent);
  if(goalView&&goalView.chapter===state.active&&goalView.target===target&&words>goalView.words&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    goalAnimation?.cancel();
    const achieved=complete&&!goalView.complete;
    goalAnimation=(achieved?panel:$('goalCurrent')).animate(achieved?[{transform:'translateY(0)'},{transform:'translateY(-4px)',boxShadow:'0 0 24px #7fcca536'},{transform:'translateY(0)'}]:[{transform:'translateY(2px)',opacity:.65},{transform:'translateY(0)',opacity:1}],{duration:achieved?650:220,easing:'ease-out'});
  }
  goalView={chapter:state.active,target,words,complete};
}
function scheduleBaselines(){if(!baselineFrame)baselineFrame=requestAnimationFrame(renderBaselines);}
function positionBaselines(){
  for(let i=0;i<baselinePositions.length;i++){
    const {node,top}=baselinePositions[i],y=top-editor.scrollTop;
    node.style.top=y+'px';node.hidden=y<0||y>editor.clientHeight;
  }
}
function renderBaselines(){
  baselineFrame=0;const mirror=$('baselineMirror'),layer=$('baselineLayer');
  mirror.replaceChildren();layer.replaceChildren();baselinePositions=[];
  if(!state.settings.baselineEnabled||!editor.value)return;
  mirror.style.width=editor.clientWidth+'px';
  const text=editor.value,step=state.settings.baselineStep,fragment=document.createDocumentFragment(),marks=[];
  let words=0,start=0,offset=0;
  for(const char of text){
    const next=offset+char.length;
    if(!/\s/u.test(char)&&++words%step===0){
      fragment.append(document.createTextNode(text.slice(start,offset)));
      const marker=document.createElement('span');marker.textContent=char;fragment.append(marker);marks.push({marker,words});start=next;
    }offset=next;
  }
  if(!marks.length)return;
  fragment.append(document.createTextNode(text.slice(start)||'\n'));mirror.append(fragment);
  const lineHeight=parseFloat(getComputedStyle(editor).lineHeight);
  // offsetTop stays in page coordinates, so markers follow whole-page scaling.
  for(const {marker,words} of marks){
    const node=document.createElement('div');node.className='word-baseline';const label=document.createElement('span');label.textContent=words.toLocaleString()+' 字';node.append(label);layer.append(node);
    baselinePositions.push({node,top:marker.offsetTop+marker.offsetHeight+(lineHeight-marker.offsetHeight)/2});
  }
  positionBaselines();
}
$('chapterGoal').onchange=e=>{chapter().goal=Math.max(0,Math.min(1000000,Math.round(Number(e.target.value)||0)));e.target.value=chapterGoal();updateGoal();scheduleBaselines();scheduleSave();};
$('baselineEnabled').onchange=e=>{state.settings.baselineEnabled=e.target.checked;scheduleBaselines();scheduleSave();};
$('baselineStep').onchange=e=>{state.settings.baselineStep=Math.max(100,Math.min(10000,Math.round(Number(e.target.value)||500)));e.target.value=state.settings.baselineStep;scheduleBaselines();scheduleSave();};
loadChapter(state.active);applySettings();
new ResizeObserver(()=>{renderText();}).observe(editor);
new ResizeObserver(()=>{applyZoom();}).observe($('paperViewport'));
$('paperViewport').addEventListener('scroll',()=>{particles=[];});
(async()=>{try{const record=await fontStore('readonly');if(record){await installFont(record);applySettings();}else if(state.settings.font==='custom'){state.settings.font='serif';applySettings();toast('未找到自选字体，请重新导入字体文件。');}}catch{if(state.settings.font==='custom'){state.settings.font='serif';applySettings();}}})();
if(startupWarning)toast(startupWarning);
