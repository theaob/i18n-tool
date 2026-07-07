const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  saveFile: (args) => ipcRenderer.invoke('dialog:saveFile', args),
  saveCsv: (args) => ipcRenderer.invoke('dialog:saveCsv', args),
  parseTs: (content) => ipcRenderer.invoke('file:parseTs', content),

  // AI Translation
  translate: (args) => ipcRenderer.invoke('ai:translate', args),
  batchTranslate: (args) => ipcRenderer.invoke('ai:batchTranslate', args),

  // Settings persistence
  getSetting: (key) => ipcRenderer.invoke('store:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('store:set', key, value),

  // Theme
  getNativeTheme: () => ipcRenderer.invoke('theme:get'),
});
