'use strict';
// Keep large local artwork out of manuscript snapshots and localStorage.
const TRAppearance = (() => {
  const dialog = $('settingsDialog');
  const section = document.createElement('section');
  section.className = 'page-art-settings';
  section.innerHTML = `<div class="setting-row"><div><strong>书页背景图</strong><p>给故事一张专属纸面，透明度与文字独立。</p></div><button id="importPageArt" class="primary-button">导入图片</button></div>
    <div class="art-preview" id="artPreview"><span>纯色纸面 · 等待你的灵感</span></div>
    <p id="pageArtInfo" class="font-info" role="status">支持 PNG（含透明图片）、JPG、WebP · 最大 15 MB</p>
    <div class="setting-row"><label for="pageArtOpacity">图片透明度 <output id="pageArtOpacityLabel">80%</output></label><input id="pageArtOpacity" type="range" min="0" max="100" value="80"></div>
    <div class="setting-row"><label for="pageArtFit">图片铺设</label><select id="pageArtFit"><option value="cover">铺满书页</option><option value="contain">完整显示</option><option value="tile">纹理平铺</option></select></div>
    <div class="setting-row"><label for="pageArtPosition">画面位置</label><select id="pageArtPosition"><option value="center">居中</option><option value="top">顶部</option><option value="bottom">底部</option></select><button id="removePageArt" class="plain-button" disabled>移除图片</button></div>
    <p class="settings-note">0% 为完全可见，100% 为完全透明。图片仅保存在本机，不写入正文、导出文稿或作品备份。</p><input id="pageArtFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>`;
  dialog.querySelector('.theme-settings').after(section);
  const layer = document.createElement('div');
  layer.id = 'pageArtwork'; layer.setAttribute('aria-hidden', 'true');
  document.querySelector('.writing-stage').prepend(layer);
  const shortcut = document.createElement('button');
  shortcut.id = 'appearanceShortcut'; shortcut.className = 'plain-button';
  shortcut.textContent = '◩ 纸面'; shortcut.title = '设置书页背景图与透明度';
  $('zoomReset').before(shortcut);

  // Group existing controls without replacing their listeners.
  const groups = [
    ['appearance', '纸面外观', [dialog.querySelector('.theme-settings'), section]],
    ['type', '字体与高亮', []], ['goals', '码字目标', [dialog.querySelector('.goal-settings')]],
    ['audio', '爆震与声音', []]
  ];
  const rows = [...dialog.children];
  let audio = false;
  for (const row of rows) {
    if (row.querySelector?.('#importFont')) audio = false;
    if (row.querySelector?.('#intensity')) audio = true;
    if (row.querySelector?.('#highlightToggle')) audio = false;
    if (row.matches('form,.theme-settings,.goal-settings,.page-art-settings')) continue;
    groups[audio ? 3 : 1][2].push(row);
  }
  const nav = document.createElement('nav'); nav.className = 'settings-nav'; nav.setAttribute('aria-label','设置分类');
  dialog.querySelector('form').after(nav);
  for (const [key, title, elements] of groups) {
    const pane = document.createElement('div'); pane.className = 'settings-pane'; pane.dataset.settingsPane = key;
    elements.forEach(el => pane.append(el)); dialog.append(pane);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = title;
    button.dataset.settingsTab = key; button.onclick = () => selectTab(key); nav.append(button);
  }
  function selectTab(key) {
    dialog.querySelectorAll('[data-settings-pane]').forEach(el => el.hidden = el.dataset.settingsPane !== key);
    nav.querySelectorAll('button').forEach(el => {el.classList.toggle('active', el.dataset.settingsTab === key);el.setAttribute('aria-pressed', String(el.dataset.settingsTab === key));});
    dialog.scrollTop = 0;
  }
  selectTab('appearance');
  $('editChapterGoal').onclick = () => {selectTab('goals');dialog.showModal();$('chapterGoal').focus();$('chapterGoal').select();};
  shortcut.onclick = () => {selectTab('appearance');dialog.showModal();};
  $('fontButton').addEventListener('click', () => selectTab('type'));
  $('settings').addEventListener('click', () => selectTab('appearance'));
  let record = null;
  function db(action, value) {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open('trwriting.appearance',1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database=request.result, tx=database.transaction('images',action==='get'?'readonly':'readwrite'), store=tx.objectStore('images');
        const result=action==='get'?store.get('page'):action==='put'?store.put(value,'page'):store.delete('page');
        tx.oncomplete=()=>{database.close();resolve(result.result);};
        tx.onabort=tx.onerror=()=>{database.close();reject(tx.error||Error('图片存储失败'));};
      };
    });
  }
  function render() {
    const s=state.settings;
    const transparency=Number.isFinite(Number(s.pageArtTransparency))?Math.max(0,Math.min(100,Number(s.pageArtTransparency))):80;
    const fit=['cover','contain','tile'].includes(s.pageArtFit)?s.pageArtFit:'cover';
    const position=['center','top','bottom'].includes(s.pageArtPosition)?s.pageArtPosition:'center';
    for(const el of [layer,$('artPreview')]) {
      el.style.backgroundImage=record?`url("${record.data}")`:'none';
      el.style.backgroundSize=fit==='tile'?'256px auto':fit;
      el.style.backgroundRepeat=fit==='tile'?'repeat':'no-repeat';
      el.style.backgroundPosition=position;
    }
    layer.style.opacity=String(1-transparency/100);
    $('artPreview').classList.toggle('has-image',!!record);
    $('pageArtOpacity').value=transparency;$('pageArtOpacityLabel').textContent=transparency+'%';
    $('pageArtFit').value=fit;$('pageArtPosition').value=position;
    $('removePageArt').disabled=!record;
    $('pageArtInfo').textContent=record?`${record.name} · ${record.width} × ${record.height} · 已保存在本机`:'支持 PNG（含透明图片）、JPG、WebP · 最大 15 MB';
  }
  async function importFile(file) {
    if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('请选择 PNG、JPG 或 WebP 图片');
    if(file.size>15*1024*1024) throw Error('图片过大，请选择 15 MB 以内的图片');
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('图片读取失败'));r.readAsDataURL(file);});
    const img=new Image();img.src=data;await img.decode().catch(()=>{throw Error('图片无法解码，请换一张图片');});
    if(img.naturalWidth*img.naturalHeight>40000000) throw Error('图片分辨率过高，请缩小至 4000 万像素以内');
    const next={data,name:file.name,width:img.naturalWidth,height:img.naturalHeight};
    await db('put',next); record=next;render();toast('书页背景已更新');
  }
  $('importPageArt').onclick=()=>$('pageArtFile').click();
  $('pageArtFile').onchange=async()=>{
    const file=$('pageArtFile').files[0];if(!file)return;
    $('importPageArt').disabled=true;$('removePageArt').disabled=true;
    try{await ready;await importFile(file);}catch(e){toast(e.message||'图片保存失败，请重试');}
    finally{$('pageArtFile').value='';$('importPageArt').disabled=false;render();}
  };
  $('removePageArt').onclick=async()=>{try{await db('delete');record=null;render();toast('已恢复纯色书页');}catch{toast('移除失败，请重试');}};
  for(const [control,key] of [['pageArtOpacity','pageArtTransparency'],['pageArtFit','pageArtFit'],['pageArtPosition','pageArtPosition']]) {
    $(control).addEventListener('input',()=>{state.settings[key]=control==='pageArtOpacity'?Number($(control).value):$(control).value;render();scheduleSave();});
  }
  const originalApply=applySettings;
  applySettings=function(){originalApply();render();};
  render();
  const ready=db('get').then(saved=>{record=saved||null;render();}).catch(()=>toast('暂时无法读取本机背景图，可重新导入'));
  return {ready,importFile,render,selectTab};
})();
