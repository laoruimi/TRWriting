(function(root){
 'use strict';
 const words=s=>Array.from(s.replace(/\s/gu,'')).length;
 function inspect(text,terms=[],indent=false){
  const issues=[],stack=[],pairs={'“':'”','‘':'’','「':'」','『':'』','《':'》','〈':'〉','【':'】','[':']','（':'）','(':')','{':'}','〔':'〕','〖':'〗','［':'］','｛':'｝','«':'»','‹':'›','｢':'｣','〘':'〙','〚':'〛','｟':'｠','＜':'＞'},closing=new Set(Object.values(pairs));
  const add=(start,end,message,kind='error')=>issues.push({start,end,message,kind});
  for(let i=0;i<text.length;i++){
   const c=text[i];if(c==='\\'){i++;continue;}
   if((c==="'"||c==='’')&&/[a-z0-9]/i.test(text[i-1]||'')&&/[a-z0-9]/i.test(text[i+1]||''))continue;
   if(c==='"'||c==="'"){if(stack.at(-1)?.close===c)stack.pop();else stack.push({close:c,start:i});}
   else if(pairs[c])stack.push({close:pairs[c],start:i});
   else if(closing.has(c)){if(stack.at(-1)?.close===c)stack.pop();else add(i,i+1,'闭合符号缺少匹配的开头');}
  }
  for(const p of stack)add(p.start,p.start+1,'符号未闭合，缺少 '+p.close);
  for(const m of text.matchAll(/([，。！？、；：,.!?;:])\1+|[ \t]+$/gm))add(m.index,m.index+m[0].length,/\s/.test(m[0])?'行尾多余空格':'重复标点');
  for(const m of text.matchAll(/(?<=\S)[ \t]{2,}(?=\S)/g))add(m.index,m.index+m[0].length,'正文中有多余空格');
  for(const m of text.matchAll(/(?<=[\p{Script=Han}])[ \t]+(?=[\p{Script=Han}])/gu))add(m.index,m.index+m[0].length,'中文之间有多余空格');
  if(indent){let offset=0;for(const line of text.split('\n')){if(line.trim()&&!line.startsWith('　　'))add(offset,offset+Math.min(2,line.length),'段首缺少两个全角空格');offset+=line.length+1;}}
  for(const term of [...new Set(terms)].filter(Boolean)){let at=0;while((at=text.indexOf(term,at))!==-1){add(at,at+term.length,'敏感词提醒：'+term,'warning');at+=term.length;}}
  return issues.sort((a,b)=>a.start-b.start||a.end-b.end);
 }
 function matches(text,query,caseSensitive=true){const result=[];if(!query)return result;const source=caseSensitive?text:text.toLowerCase(),needle=caseSensitive?query:query.toLowerCase();let at=0;while((at=source.indexOf(needle,at))!==-1){result.push({start:at,end:at+query.length});at+=query.length;}return result;}
 function diff(before,after){const a=before.split('\n'),b=after.split('\n');let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;let ae=a.length,be=b.length;while(ae>start&&be>start&&a[ae-1]===b[be-1]){ae--;be--;}return {prefix:a.slice(0,start),removed:a.slice(start,ae),added:b.slice(start,be),suffix:a.slice(ae)};}
 function mapPosition(pos,before,after){let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;let end=before.length,next=after.length;while(end>start&&next>start&&before[end-1]===after[next-1]){end--;next--;}return pos<=start?pos:pos>=end?pos+next-end:Math.min(start,after.length);}
 function xml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');}
 function docx(title,chapters,options={}){
  const p=(s,heading=false)=>'<w:p><w:pPr>'+(heading?'<w:pStyle w:val="Heading1"/>':options.indent?'<w:ind w:firstLineChars="200"/>':'')+'<w:spacing w:after="120" w:line="'+(Math.round((options.lineHeight||1.5)*240))+'"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="'+xml(options.font||'宋体')+'"/><w:sz w:val="'+Math.round((options.size||12)*2)+'"/></w:rPr><w:t xml:space="preserve">'+xml(s)+'</w:t></w:r></w:p>';
  const files={'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+p(title,true)+chapters.map(c=>p(c.title,true)+c.text.split('\n').map(l=>p(l)).join('')).join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>'};
  return root.fflate.zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,root.fflate.strToU8(v)])));
 }
 const api={words,inspect,matches,diff,mapPosition,docx};if(typeof module==='object'&&module.exports)module.exports=api;else root.TRStudioCore=api;
})(globalThis);
