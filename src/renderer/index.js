document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInfo = document.getElementById('file-info');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress-bar');
  const resultArea = document.getElementById('result-area');
  const tagsList = document.getElementById('tags-list');
  const notionStatus = document.getElementById('notion-status');
  const printStatus = document.getElementById('print-status');
  const documentDetails = document.getElementById('document-details');
  const documentTitle = document.getElementById('document-title');
  const documentType = document.getElementById('document-type');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle dropped files
  dropArea.addEventListener('drop', handleDrop, false);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight() {
    dropArea.classList.add('highlight');
  }
  
  function unhighlight() {
    dropArea.classList.remove('highlight');
  }
  
  async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length === 0) {
      updateStatus('ファイルがドロップされていません', false);
      return;
    }
    
    if (files.length > 1) {
      updateStatus('一度に処理できるのは1つのファイルのみです', false);
      return;
    }
    
    const file = files[0];
    
    // Check if file is PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      updateStatus('PDFファイルのみ処理できます', false);
      return;
    }
    
    fileInfo.textContent = `ファイル名: ${file.name} (${formatFileSize(file.size)})`;
    updateStatus('処理を開始します...', true);
    updateProgress(10);
    
    try {
      // Read file as base64
      const fileContent = await readFileAsBase64(file);
      
      // Save file to temporary directory
      updateStatus('ファイルを保存中...', true);
      updateProgress(20);
      const saveResult = await window.api.saveDroppedFile({
        name: file.name,
        content: fileContent
      });
      
      if (!saveResult.success) {
        throw new Error(`ファイル保存エラー: ${saveResult.error}`);
      }
      
      updateStatus('ファイル処理中...', true);
      updateProgress(40);
      documentDetails.style.display = 'block';
      
      documentTitle.value = file.name;
      
      // Generate tags
      updateStatus('タグを生成中...', true);
      updateProgress(60);
      const tagsResult = await window.api.generateTags({
        fileName: file.name
      });
      
      if (!tagsResult.success) {
        throw new Error(`タグ生成エラー: ${tagsResult.error}`);
      }
      
      // Display tags
      tagsList.innerHTML = '';
      tagsResult.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag');
        tagElement.textContent = tag;
        tagsList.appendChild(tagElement);
      });
      
      // Save to Notion
      updateStatus('Notionに保存中...', true);
      updateProgress(80);
      const notionResult = await window.api.saveToNotion({
        title: documentTitle.value || file.name,
        tags: tagsResult.tags,
        filePath: saveResult.filePath,
        documentType: documentType.value || ''
      });
      
      if (notionResult.success) {
        notionStatus.textContent = 'Notionに正常に保存されました';
        notionStatus.classList.add('success');
      } else {
        notionStatus.textContent = `Notion保存エラー: ${notionResult.error}`;
        notionStatus.classList.add('error');
      }
      
      // Print file
      updateStatus('印刷中...', true);
      updateProgress(90);
      const printResult = await window.api.printFile(saveResult.filePath);
      
      if (printResult.success) {
        printStatus.textContent = '印刷ジョブが送信されました';
        printStatus.classList.add('success');
      } else {
        printStatus.textContent = `印刷エラー: ${printResult.error}`;
        printStatus.classList.add('error');
      }
      
      // Complete
      updateStatus('処理が完了しました', true);
      updateProgress(100);
      resultArea.classList.add('show');
      
    } catch (error) {
      console.error('Error processing file:', error);
      updateStatus(`エラー: ${error.message}`, false);
      updateProgress(0);
    }
  }
  
  function updateStatus(message, isProcessing) {
    statusMessage.textContent = message;
    statusMessage.className = isProcessing ? 'processing' : 'error';
  }
  
  function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
});
