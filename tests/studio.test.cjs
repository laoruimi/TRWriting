const {test}=require('node:test'),assert=require('node:assert/strict');
global.fflate=require('fflate');const C=require('../studio-core.js');
test('diagnostics preserve offsets and distinguish yellow vocabulary from red formatting',()=>{
 const text='😀他说：“未闭合\n重复！！  空格  \n敏感词',issues=C.inspect(text,['敏感词']);
 assert.ok(issues.some(i=>i.start===text.indexOf('“')&&i.message.includes('未闭合')));
 assert.ok(issues.some(i=>i.message==='重复标点'));
 assert.ok(issues.some(i=>i.message==='行尾多余空格'));
 assert.equal(issues.find(i=>i.kind==='warning').start,text.indexOf('敏感词'));
 assert.equal(C.inspect('他说：“『你好』。”',[]).length,0);
 assert.equal(C.inspect("don't stop",[]).length,0);
 assert.ok(C.inspect('正文',[],true).length);
});
test('closed dialogue needs no punctuation after its closing quote and recovers from inner mismatches',()=>{
 for(const text of ['“为什么？”','“为什么？”\n“我知道了。”','他说：“为什么？”','“走！”','「为什么？」','『为什么？』','“他说‘为什么？’”'])assert.deepEqual(C.inspect(text),[],text);
 const text='“为什么（没有回答？”',issues=C.inspect(text);
 assert.deepEqual(issues,[{start:text.indexOf('（'),end:text.indexOf('（')+1,message:'符号未闭合，缺少 ）',kind:'error'}]);
 assert.ok(C.inspect('“为什么？').some(i=>i.message.includes('未闭合')));
 assert.ok(C.inspect('为什么？”').some(i=>i.message.includes('缺少匹配')));
 assert.ok(C.inspect('“为什么？？”').some(i=>i.message==='重复标点'));
});
test('literal matching and replacement offsets handle regex characters and emoji',()=>{
 assert.deepEqual(C.matches('😀[x][x]','[x]'),[{start:2,end:5},{start:5,end:8}]);
 assert.equal(C.matches('AaAa','aa',false).length,2);
 assert.equal(C.matches('abc','').length,0);
 assert.equal(C.mapPosition(4,'前文后文','前文新增后文'),6);
});
test('history difference preserves changed and unchanged line boundaries',()=>{
 assert.deepEqual(C.diff('前\n旧\n尾','前\n新\n尾'),{prefix:['前'],removed:['旧'],added:['新'],suffix:['尾']});
});
test('Word export is a valid ZIP and round trips Chinese text with mammoth',async()=>{
 const bytes=C.docx('作品',[{title:'第一章',text:'他说：“你好。”\n😀 & <正文>'}],{indent:true,size:14});
 const files=fflate.unzipSync(bytes);assert.ok(files['word/document.xml']);assert.ok(fflate.strFromU8(files['word/document.xml']).includes('&amp; &lt;正文&gt;'));
 const result=await require('mammoth').extractRawText({buffer:Buffer.from(bytes)});assert.ok(result.value.includes('他说：“你好。”'));assert.ok(result.value.includes('😀 & <正文>'));
});
