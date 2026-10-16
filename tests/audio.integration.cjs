const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'TRWriting-audio-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
function wav(){const rate=22050,length=rate*4,b=Buffer.alloc(44+length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length*2,40);for(let i=0;i<length;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*(220+Math.floor(i/rate*2)*55))*12000),44+i*2);return b.toString('base64');}
app.whenReady().then(async()=>{
 const w=new BrowserWindow({show:false,width:1360,height:920,webPreferences:{sandbox:true,contextIsolation:true}});
 const errors=[];w.webContents.on('console-message',(_e,d)=>{if(d.level==='error')errors.push(d.message)});
 const run=s=>w.webContents.executeJavaScript(s,true);
 try{
  await w.loadFile(path.join(root,process.argv.includes('--packaged')?'release/win-unpacked/resources/app.asar/index.html':'index.html'));
  await new Promise(r=>setTimeout(r,300));
  const voices=Object.fromEntries(Object.values(require('../rhythm.js').voiceFiles).map(file=>[file,fs.readFileSync(path.join(root,'assets/voice',file+'.wav')).toString('base64')]));
  const result=await run(`(async()=>{
   const check=(v,m)=>{if(!v)throw Error(m)},wait=ms=>new Promise(r=>setTimeout(r,ms));
   if(!state.settings.effects)$('effectsToggle').click();state.settings.voice=false;applySettings();
   const bytes=Uint8Array.from(atob(${JSON.stringify(wav())}),c=>c.charCodeAt(0));
   const transfer=new DataTransfer();transfer.items.add(new File([bytes],'test-song.wav',{type:'audio/wav'}));$('musicFile').files=transfer.files;await $('musicFile').onchange({target:$('musicFile')});
   check(sound.music&&state.settings.soundMode==='music','import selects music mode');
   const original=sound.music,bad=new DataTransfer();bad.items.add(new File(['not audio'],'broken.wav',{type:'audio/wav'}));$('musicFile').files=bad.files;await $('musicFile').onchange({target:$('musicFile')});check(sound.music===original&&musicRecord.name==='test-song.wav','bad import preserves current music');check($('musicInfo').textContent.includes('test-song.wav'),'file shown');
   $('musicBpm').value=150;$('musicBpm').dispatchEvent(new Event('change'));$('musicOffset').value=.2;$('musicOffset').dispatchEvent(new Event('change'));
   let tones=0;const tone=sound.tone.bind(sound);sound.tone=(...args)=>{tones++;return tone(...args)};
   sound.hit(30,true);check(sound.cursor===1&&sound.active.size===1&&tones===0,'music replaces synth');
   for(let i=0;i<25;i++){await wait(50);sound.hit(450,i===3)}check(sound.active.size<10,'slice overlap bounded');
   sound.stop();await wait(40);check(sound.active.size===0&&sound.context.state==='suspended','stop cancels sources');
   const ctx=sound.context;for(const [file,data] of Object.entries(${JSON.stringify(voices)})){const decoded=await ctx.decodeAudioData(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer);check(decoded.duration>0,'decode human '+file);}
   state.settings.voice=true;applySettings();sound.announce('GREAT');sound.hit(100,true);check(!sound.spoken&&$('voiceEnabled').disabled,'music mode blocks all speech');
   const cursorBefore=sound.cursor;await wait(500);check(sound.active.size===0&&sound.cursor===cursorBefore,'music stops after short tail');
   state.settings.soundMode='synth';applySettings();sound.announce('GREAT');await wait(300);check(sound.spoken.readyState>=2&&!sound.spoken.error&&!$('voiceEnabled').disabled,'synth restores voice');
   state.settings.soundMode='music';applySettings();check(!sound.spoken,'switching to music cancels speech');
   sound.stop();const record=await musicStore('readonly');check(record.name==='test-song.wav'&&record.buffer.byteLength===bytes.length,'music persisted');save();
   return {humanVoices:Object.keys(${JSON.stringify(voices)}).length,musicImport:true,bpm:state.settings.musicBpm,offset:state.settings.musicOffset,boundedOverlap:true};
  })()`);
  await w.webContents.reload();await new Promise(r=>setTimeout(r,500));
  assert.equal(await run("!!sound.music&&state.settings.soundMode==='music'&&state.settings.musicBpm===150&&state.settings.musicOffset===.2"),true,'restart restores track and settings');
  await run("$('removeMusic').click()");await new Promise(r=>setTimeout(r,100));
  assert.equal(await run("!sound.music&&state.settings.soundMode==='synth'"),true,'remove resets mode');
  assert.equal(await run("musicStore('readonly').then(v=>v===undefined)"),true,'remove clears stored track');
  await run("sound.hit(450,true)");assert.ok(await run('sound.active.size>5'),'synth creates layered sounds');await run('sound.stop()');
  assert.deepEqual(errors,[]);console.log('Audio integration passed:',JSON.stringify({...result,restart:true,remove:true,synth:true}));app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
