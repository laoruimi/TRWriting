'use strict';
(() => {
  const pairs=new Map(TRSyntax.groups.flatMap(([,entries])=>entries));
  const closings=new Set(pairs.values());
  const row=document.createElement('div');row.className='setting-row';
  row.innerHTML='<div><label for="autoPairs">自动补全配对符号</label><p>括号、引号成对输入；选中文字可直接包裹。</p></div><input id="autoPairs" type="checkbox">';
  document.querySelector('[data-settings-pane="type"]').prepend(row);
  if(state.settings.autoPairs===undefined)state.settings.autoPairs=true;
  const sync=()=>{$('autoPairs').checked=state.settings.autoPairs!==false;};
  const baseApply=applySettings;applySettings=function(){baseApply();sync();};sync();
  $('autoPairs').onchange=()=>{state.settings.autoPairs=$('autoPairs').checked;scheduleSave();};

  function replacement(before,start,end,char){
    if(state.settings.autoPairs===false||char.length!==1)return null;
    const selected=before.slice(start,end),left=before[start-1]||'',right=before[end]||'';
    // Apostrophes inside English words are literal, not quotation delimiters.
    if((char==="'"||char==='’')&&/[a-z0-9]/i.test(left))return null;
    if(!selected&&closings.has(char)&&right===char)return {text:before,start:start+1,end:start+1};
    const close=pairs.get(char);if(!close)return null;
    // Avoid completing quotes in the middle of an English identifier.
    if(char===close&&/[a-z0-9]/i.test(left)&&/[a-z0-9]/i.test(right))return null;
    return {text:before.slice(0,start)+char+selected+close+before.slice(end),start:start+1,end:end+1};
  }
  editor.addEventListener('beforeinput',e=>{
    if(e.defaultPrevented||!e.cancelable||composing||e.isComposing)return;
    const before=editor.value,start=editor.selectionStart,end=editor.selectionEnd;
    let next=null;
    if(e.inputType==='insertText'&&e.data)next=replacement(before,start,end,e.data);
    if(state.settings.autoPairs!==false&&e.inputType==='deleteContentBackward'&&start===end&&start>0&&pairs.get(before[start-1])===before[start])next={text:before.slice(0,start-1)+before.slice(start+1),start:start-1,end:start-1};
    if(!next)return;
    e.preventDefault();editor.value=next.text;editor.setSelectionRange(next.start,next.end);commitEdit(before,'insertAutoPair');
  });
  // Some IMEs commit punctuation through non-cancelable composition events.
  // Transform the committed text before app.js records its single undo step.
  editor.addEventListener('compositionend',()=>{
    const before=compositionBase,after=editor.value,diff=textDiff(before,after);
    if(diff.added.length!==1)return;
    const next=replacement(before,diff.start,diff.start+diff.removed.length,diff.added);
    if(next){editor.value=next.text;editor.setSelectionRange(next.start,next.end);}
  },true);
})();
