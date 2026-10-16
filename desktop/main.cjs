'use strict';
const { app, BrowserWindow, Menu, session, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// A stable profile keeps installed and portable editions on the same local library.
app.setPath('userData', path.join(app.getPath('appData'), 'TRWriting'));
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) app.setPath('userData', path.join(app.getPath('temp'), 'TRWriting-smoke-' + process.pid));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.whenReady().then(() => {
    const backupDir=path.join(app.getPath('userData'),'backups');
    ipcMain.handle('tr:backup',async(_event,data)=>{
      if(typeof data!=='string'||Buffer.byteLength(data)>50*1024*1024)throw Error('备份过大');
      const parsed=JSON.parse(data);if(parsed.version!==1||!Array.isArray(parsed.chapters))throw Error('无效备份');
      await fs.mkdir(backupDir,{recursive:true});
      const name=Date.now()+'-'+Math.random().toString(16).slice(2)+'.json',target=path.join(backupDir,name);
      await fs.writeFile(target+'.tmp',data,'utf8');await fs.rename(target+'.tmp',target);
      const files=(await fs.readdir(backupDir)).filter(f=>/^\d+-[a-f0-9]+\.json$/.test(f)).sort();
      for(const file of files.slice(0,Math.max(0,files.length-100)))await fs.unlink(path.join(backupDir,file));
      return name;
    });
    ipcMain.handle('tr:backup-folder',async()=>{await fs.mkdir(backupDir,{recursive:true});return shell.openPath(backupDir);});
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window = new BrowserWindow({
      title: 'TRWriting', width: 1360, height: 920, minWidth: 840, minHeight: 620,
      backgroundColor: '#181b22', show: false,
      icon: path.join(__dirname, '../assets/icon.ico'),
      webPreferences: { preload:path.join(__dirname,'preload.cjs'),nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('ready-to-show', () => { if (!smokeTest) window.show(); });
    if (smokeTest) {
      let failed = false;
      window.webContents.on('console-message', (_event, details) => {
        if (details.level === 'error') { failed = true; console.error(details.message); }
      });
      window.webContents.on('did-fail-load', (_event, code, description) => {
        console.error('LOAD FAILED', code, description); app.exit(1);
      });
      window.webContents.on('render-process-gone', () => app.exit(1));
      window.webContents.once('did-finish-load', () => {
        console.log('TRWriting packaged renderer loaded.');
        setTimeout(() => app.exit(failed ? 1 : 0), 1500);
      });
      setTimeout(() => app.exit(2), 20000).unref();
    }
    window.loadFile(path.join(__dirname, '../index.html'));
  });
  app.on('window-all-closed', () => app.quit());
}
