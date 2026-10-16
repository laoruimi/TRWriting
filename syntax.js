(function (root) {
  'use strict';
  const groups = [
    ['dialogue', [['“','”'], ['「','」'], ['『','』'], ['〝','〞'], ['"','"']]],
    ['single', [['‘','’'], ["'","'"], ['`','`']]],
    ['book', [['《','》'], ['〈','〉'], ['«','»'], ['‹','›'], ['<','>'], ['＜','＞']]],
    ['bracket', [['[',']'], ['［','］'], ['〔','〕'], ['｢','｣']]],
    ['system', [['【','】'], ['〖','〗'], ['〘','〙'], ['〚','〛']]],
    ['paren', [['(',')'], ['（','）'], ['｟','｠']]],
    ['brace', [['{','}'], ['｛','｝']]]
  ];
  const openings = new Map(), closings = new Map();
  for (const [style, pairs] of groups) for (const [open, close] of pairs) {
    openings.set(open, { close, style });
    closings.set(close, style);
  }
  const escapeHtml = text => text.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  // A stack handles nested pairs without greedy regular expressions swallowing them.
  // Unfinished pairs remain colored only until the next line, as in a live editor.
  function highlightText(text) {
    const stack = [];
    const output = [];
    let colon = false, run = '', currentStyle = '';
    const flush = () => {
      if (!run) return;
      output.push(currentStyle ? `<span class="syntax-${currentStyle}">${escapeHtml(run)}</span>` : escapeHtml(run));
      run = '';
    };
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      let style = '';
      if (char === '\n') { stack.length = 0; colon = false; }
      else {
        const last = stack.at(-1);
        const apostrophe = (char === "'" || char === '’') && /[A-Za-z0-9]/.test(text[index-1] || '') && /[A-Za-z0-9]/.test(text[index+1] || '');
        const escaped = index > 0 && (() => { let n=0; for(let i=index-1;i>=0 && text[i]==='\\';i--)n++; return n%2===1; })();
        if (!apostrophe && !escaped && last?.close === char) { style = last.style; stack.pop(); }
        else if (!apostrophe && !escaped && openings.has(char)) {
          const pair = openings.get(char); style = pair.style; stack.push(pair);
        } else if (!apostrophe && !escaped && closings.has(char)) { style = closings.get(char); }
        else if (char === ':' || char === '：') { colon = true; style = last?.style || 'colon'; }
        else if (last) style = last.style;
        else if (colon) style = 'colon';
        else if (/\p{P}/u.test(char)) style = 'symbol';
      }
      if (style !== currentStyle) { flush(); currentStyle = style; }
      run += char;
    }
    flush();
    return output.join('');
  }
  const api = { highlightText, escapeHtml, groups };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TRSyntax = api;
})(globalThis);
