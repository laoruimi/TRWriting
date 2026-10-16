const {app,BrowserWindow}=require('electron');const path=require('path'),fs=require('fs'),os=require('os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'TRWriting-goals-')));
app.whenReady().then(async()=>{const w=new BrowserWindow({show:false,width:1360,height:920,webPreferences:{sandbox:true,contextIsolation:true}});const errors=[];w.webContents.on('console-message',(_,d)=>{if(d.level==='error')errors.push(d.message)});const run=s=>w.webContents.executeJavaScript(s,true);try{
await w.loadFile(path.resolve(process.argv.includes('--packaged')?'release/win-unpacked/resources/app.asar/index.html':'index.html'));await new Promise(r=>setTimeout(r,150));
console.log(await run(`(async()=>{
const check=(v,m)=>{if(!v)throw Error(m)},wait=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
state.settings.effects=false;applySettings();editor.value=('星'.repeat(99)+'😀 \\n').repeat(15);editor.dispatchEvent(new InputEvent('input',{inputType:'insertFromPaste'}));await wait();
check(countWords(editor.value)===1500,'unicode count');check(baselinePositions.length===3,'500 1000 1500 lines');check($('goalPercent').textContent==='50%','default goal progress');
$('chapterGoal').value=1500;$('chapterGoal').dispatchEvent(new Event('change'));check($('goalPanel').classList.contains('complete'),'goal achieved');
const original=editor.value,firstTop=baselinePositions[0].top;editor.scrollTop=firstTop-60;syncScroll();check(Math.abs(parseFloat(baselinePositions[0].node.style.top)-60)<2,'scroll tracks lines');
state.settings.pageZoom=150;applyZoom();await wait();check(baselinePositions.length===3&&editor.value===original,'zoom preserves lines and text');
$('baselineStep').value=1000;$('baselineStep').dispatchEvent(new Event('change'));await wait();check(baselinePositions.length===1,'custom interval');
$('baselineEnabled').checked=false;$('baselineEnabled').dispatchEvent(new Event('change'));await wait();check(baselinePositions.length===0,'disable baselines');
$('baselineEnabled').checked=true;$('baselineEnabled').dispatchEvent(new Event('change'));$('baselineStep').value=500;$('baselineStep').dispatchEvent(new Event('change'));
const first=state.active;state.chapters.push({id:'other',title:'第二章',text:'测试'});loadChapter('other');check(chapterGoal()===3000&&$('chapterGoal').value==='3000','new chapter default');loadChapter(first);check(chapterGoal()===1500,'per chapter goal');
editor.value='字'.repeat(499);editor.dispatchEvent(new InputEvent('input',{inputType:'deleteContentBackward'}));await wait();check(baselinePositions.length===0&&!$('goalPanel').classList.contains('complete'),'deletion updates baseline and goal');
$('chapterGoal').value=0;$('chapterGoal').dispatchEvent(new Event('change'));check($('goalPanel').hidden,'zero hides goal');save();
return 'Goals, milestones, scrolling, zoom, deletion and chapter switching passed';})()`));
await w.webContents.reload();await new Promise(r=>setTimeout(r,200));if(!await run("chapterGoal()===0&&$('goalPanel').hidden&&state.settings.baselineStep===500"))throw Error('persistence');if(errors.length)throw Error(errors.join('\n'));console.log('Persistence and renderer passed');app.exit(0);
}catch(e){console.error(e);app.exit(1)}});
