const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const iconv = require('iconv-lite');
const { createWorker } = require('tesseract.js');
const { Client } = require('@notionhq/client');
require('dotenv').config();
const { PDFDocument } = require('pdf-lib');
const { createCanvas } = require('canvas');


// Path to store temporary PDF files
const INPUT_PDF_DIR = path.join(__dirname, '../../input_pdf');

// Create input_pdf directory if it doesn't exist
if (!fs.existsSync(INPUT_PDF_DIR)) {
  fs.mkdirSync(INPUT_PDF_DIR, { recursive: true });
}

async function convertPdfToImage(pdfPath, pageNum = 0) {
  try {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.js');
    
    const workerPath = path.join(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
    
    const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
    
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    const page = await pdf.getPage(pageNum + 1); // Pages are 1-based in PDF.js
    
    const viewport = page.getViewport({ scale: 300 / 72 }); // 300 DPI / 72 (PDF default DPI)
    
    // Create a canvas with the right dimensions
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw error;
  }
}

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for file operations
ipcMain.handle('save-dropped-file', async (event, fileData) => {
  try {
    const buffer = Buffer.from(fileData.content, 'base64');
    const filePath = path.join(INPUT_PDF_DIR, fileData.name);
    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// OCR processing
ipcMain.handle('process-ocr', async (event, filePath) => {
  try {
    let imageData;
    
    if (filePath.toLowerCase().endsWith('.pdf')) {
      console.log('Converting PDF to image before OCR processing');
      imageData = await convertPdfToImage(filePath);
      console.log('PDF conversion complete, file size:', imageData.length);
    } else {
      imageData = filePath;
    }
    
    const worker = await createWorker('jpn');
    const { data } = await worker.recognize(imageData);
    await worker.terminate();
    
    let title = '';
    const lines = data.text.split('\n').filter(line => line.trim() !== '');
    if (lines.length > 0) {
      title = lines[0].trim();
    }
    
    return { success: true, text: data.text, title };
  } catch (error) {
    console.error('OCR processing error:', error);
    return { success: false, error: error.message };
  }
});

// Generate tags from filename or content
ipcMain.handle('generate-tags', async (event, { fileName, content }) => {
  try {
    // Simple tag generation from filename
    // Remove extension and split by common separators
    const nameWithoutExt = path.basename(fileName, path.extname(fileName));
    const tags = nameWithoutExt.split(/[_\-\s]/).filter(tag => tag.length > 0);
    
    // Could be extended with content-based tagging using NLP or AI
    
    return { success: true, tags };
  } catch (error) {
    console.error('Tag generation error:', error);
    return { success: false, error: error.message };
  }
});

// Notion integration
ipcMain.handle('save-to-notion', async (event, { title, text, tags, filePath, documentType }) => {
  try {
    // Notion API requires an integration token and database ID
    const notionToken = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!notionToken || !databaseId) {
      throw new Error('Notion API token or database ID not configured');
    }
    
    const notion = new Client({ auth: notionToken });
    
    const fileName = path.basename(filePath);
    
    const now = new Date();
    const japaneseDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes()} (UTC)`;
    
    // Create a new page in the database
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "名前": {
          title: [{ text: { content: title } }]
        },
        "ファイル": {
          rich_text: [{ text: { content: fileName } }]
        },
        "書類種別": {
          rich_text: [{ text: { content: documentType || '' } }]
        },
        "日付": {
          rich_text: [{ text: { content: japaneseDate } }]
        }
      }
    });
    
    return { success: true, pageId: response.id };
  } catch (error) {
    console.error('Notion integration error:', error);
    return { success: false, error: error.message };
  }
});

// Print file
ipcMain.handle('print-file', async (event, filePath) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    
    if (!win) {
      throw new Error('ウィンドウが見つかりません');
    }
    
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        plugins: true
      }
    });
    
    await pdfWindow.loadFile(filePath);
    
    pdfWindow.webContents.print({ silent: false, printBackground: true, showPrintDialog: true }, (success, errorType) => {
      pdfWindow.close();
      if (!success) {
        console.error(`印刷エラー: ${errorType}`);
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('印刷エラー:', error);
    return { success: false, error: error.message };
  }
});
