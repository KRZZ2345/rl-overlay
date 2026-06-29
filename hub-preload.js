// hub-preload.js — pont IPC du Hub (lecture seule + fermeture + réglages).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hub', {
  onUpdate: (cb) => ipcRenderer.on('hub-update', (_e, vm) => cb(vm)),
  close: () => ipcRenderer.invoke('hub-close'),
  setFlag: (key, value) => ipcRenderer.invoke('set-overlay-flag', key, value),
  diagnostics: () => ipcRenderer.invoke('get-diagnostics'),
  matches: () => ipcRenderer.invoke('get-matches'),
  resetSettings: () => ipcRenderer.invoke('reset-overlay-settings'),
  openLogs: () => ipcRenderer.invoke('open-logs-folder'),
  forceUpdateCheck: () => ipcRenderer.invoke('force-update-check')
});
