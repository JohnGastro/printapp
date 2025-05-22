const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // File operations
  saveDroppedFile: (fileData) => ipcRenderer.invoke('save-dropped-file', fileData),
  
  // OCR processing
  processOCR: (filePath) => ipcRenderer.invoke('process-ocr', filePath),
  
  // Tag generation
  generateTags: (data) => ipcRenderer.invoke('generate-tags', data),
  
  // Notion integration
  saveToNotion: (data) => ipcRenderer.invoke('save-to-notion', data),
  
  // Print file
  printFile: (filePath) => ipcRenderer.invoke('print-file', filePath)
});
