(function (root) {
  'use strict';
  const presets = {
    midnight: { label:'午夜墨蓝', background:'#181b22', paper:'#20252e' },
    graphite: { label:'石墨深灰', background:'#161616', paper:'#222222' },
    forest: { label:'深林夜色', background:'#141e1b', paper:'#1c2b25' },
    light: { label:'暖白纸张', background:'#f0eee8', paper:'#fffefa' }
  };
  const validColor = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  function luminance(color) {
    const rgb = [1,3,5].map(index => {
      const v=parseInt(color.slice(index,index+2),16)/255;
      return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
    });
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  }
  function mix(a,b,amount) {
    return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
  }
  function surface(color) {
    const dark=luminance(color)<.35;
    return {dark,ink:dark?'#e6e6df':'#302f2c',muted:dark?'#a5acb8':'#78746c',line:mix(color,dark?'#ffffff':'#000000',.12),raised:mix(color,dark?'#ffffff':'#000000',.045)};
  }
  const api={presets,validColor,luminance,mix,surface};
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.TRTheme=api;
})(globalThis);
