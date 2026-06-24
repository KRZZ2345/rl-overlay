const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rl', {
  onUpdate: (cb) => ipcRenderer.on('update', (_e, data) => cb(data)),
  resetSession: () => ipcRenderer.invoke('reset-session')
});
