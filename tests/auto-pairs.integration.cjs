const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path'),os=require('os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'TRWriting-pairs-')));
app.whenReady().then(async()=>{const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});try{await w.loadFile(path.resolve(process.argv.includes('--packaged')?'release/win-unpacked/resources/app.asar/index.html':'index.html'));
const r=await w.webContents.executeJavaScript(String.raw`(async()=>{
const check=(x,m)=>{if(!x)throw Error(m)};
const reset=text=>{Studio.changeText(text,'test');editor.setSelectionRange(text.length,text.length)};
const type=(data,inputType='insertText')=>{const e=new InputEvent('beforeinput',{bubbles:true,cancelable:true,data,inputType});editor.dispatchEvent(e);if(!e.defaultPrevented){const s=editor.selectionStart;editor.setRangeText(data||'',s,editor.selectionEnd,'end');editor.dispatchEvent(new InputEvent('input',{inputType,data}));}};
check($('autoPairs').checked,'enabled by default');
for(const [,entries]of TRSyntax.groups)for(const [a,b]of entries){reset('');type(a);check(editor.value===a+b,'pair '+a);check(editor.selectionStart===1,'caret '+a);type(b);check(editor.value===a+b&&editor.selectionStart===2,'skip '+b);}
reset('原文');editor.setSelectionRange(0,2);type('“');check(editor.value==='“原文”'&&editor.selectionStart===1&&editor.selectionEnd===3,'wrap');Studio.undo();check(editor.value==='原文','undo wrap');Studio.undo(true);check(editor.value==='“原文”','redo wrap');
reset('');type('(');type(null,'deleteContentBackward');check(editor.value==='','delete empty pair');
reset('don');type("'");type('t');check(editor.value==="don't",'apostrophe');
reset('');editor.dispatchEvent(new CompositionEvent('compositionstart'));editor.value='“';editor.setSelectionRange(1,1);editor.dispatchEvent(new InputEvent('input',{data:'“',inputType:'insertCompositionText',isComposing:true}));editor.dispatchEvent(new CompositionEvent('compositionend',{data:'“'}));check(editor.value==='“”'&&editor.selectionStart===1,'IME punctuation');Studio.undo();check(editor.value==='','IME undo single step');
reset('');type('“你好”','insertFromPaste');check(editor.value==='“你好”','paste unchanged');
$('autoPairs').checked=false;$('autoPairs').dispatchEvent(new Event('change'));reset('');type('(');check(editor.value==='(','disabled');save();return 'All pairs, caret, skip, wrap, undo/redo, delete, apostrophe, IME, paste and toggle passed';})().catch(e=>({failure:e.stack}))`);console.log(r);if(r.failure)throw Error(r.failure);await w.reload();await new Promise(r=>setTimeout(r,400));if(!await w.webContents.executeJavaScript(`state.settings.autoPairs===false&&!$('autoPairs').checked`))throw Error('toggle persistence');console.log('Setting persistence passed');app.exit(0);}catch(e){console.error(e);app.exit(1)}});
