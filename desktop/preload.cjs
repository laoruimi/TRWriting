const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('TRDesktop',{backup:data=>ipcRenderer.invoke('tr:backup',data),backupFolder:()=>ipcRenderer.invoke('tr:backup-folder')});
