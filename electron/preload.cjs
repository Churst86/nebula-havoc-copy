const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  readSaveSync: () => ipcRenderer.sendSync('desktop:save:read'),
  writeSaveSync: (payload) => ipcRenderer.sendSync('desktop:save:write', payload),
  deleteSaveSync: () => ipcRenderer.sendSync('desktop:save:delete'),
  exportSaveSlot: (payload) => ipcRenderer.invoke('desktop:save:export-slot', payload),
  pickImportSaveFile: () => ipcRenderer.invoke('desktop:save:pick-import'),
  getAppVersion: () => ipcRenderer.invoke('desktop:app:version'),
  checkForPatch: (payload) => ipcRenderer.invoke('desktop:update:check', payload),
  downloadPatch: (patch) => ipcRenderer.invoke('desktop:update:download', patch),
  applyPatchAndRestart: (payload) => ipcRenderer.invoke('desktop:update:apply-and-restart', payload),
  onPatchProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('desktop:update:progress', listener);
    return () => ipcRenderer.removeListener('desktop:update:progress', listener);
  },
});