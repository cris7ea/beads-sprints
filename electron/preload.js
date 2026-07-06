const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  bd: (cwd, args) => ipcRenderer.invoke('bd', cwd, args),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: s => ipcRenderer.invoke('settings:set', s),
  saveAttachment: (dir, name, bytes) => ipcRenderer.invoke('save-attachment', dir, name, bytes),
  openPath: p => ipcRenderer.invoke('open-path', p),
  deleteAttachment: (dir, rel) => ipcRenderer.invoke('delete-attachment', dir, rel),
})
