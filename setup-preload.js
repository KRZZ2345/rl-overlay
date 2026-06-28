const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  save: (data) => ipcRenderer.invoke('save-setup', data),
  getTheme: () => ipcRenderer.invoke('get-setup-theme')
});
