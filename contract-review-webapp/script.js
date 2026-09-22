(() => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const viewerWrap = document.getElementById('viewerWrap');
  const pdfViewer = document.getElementById('pdfViewer');

  const headerFileTag = document.getElementById('headerFileTag');
  const headerFileName = document.getElementById('headerFileName');
  const headerStatus = document.getElementById('headerStatus');

  const contractFileName = document.getElementById('contractFileName');
  const contractFileMeta = document.getElementById('contractFileMeta');
  const toolbarActions = document.getElementById('toolbarActions');
  const openTabBtn = document.getElementById('openTabBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const removeBtn = document.getElementById('removeBtn');

  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('sendBtn');

  const WEBHOOK_URL = 'https://pc761.app.n8n.cloud/webhook-test/aa805f94-8ba0-4ffa-b074-d8405b3922dc';

  let currentObjectUrl = null;
  let currentFileName = 'contract.pdf';
  let currentFile = null;

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function loadFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }

    currentObjectUrl = URL.createObjectURL(file);
    currentFileName = file.name;
    currentFile = file;
    pdfViewer.src = currentObjectUrl;

    contractFileName.textContent = file.name;
    contractFileMeta.textContent = formatFileSize(file.size);
    toolbarActions.hidden = false;

    headerFileName.textContent = file.name;
    headerFileTag.hidden = false;
    headerStatus.hidden = false;

    dropZone.hidden = true;
    viewerWrap.hidden = false;
  }

  function clearFile() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    pdfViewer.src = '';
    fileInput.value = '';
    currentFile = null;

    contractFileName.textContent = 'Contract';
    contractFileMeta.textContent = '';
    toolbarActions.hidden = true;

    headerFileTag.hidden = true;
    headerStatus.hidden = true;

    viewerWrap.hidden = true;
    dropZone.hidden = false;
  }

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    loadFile(fileInput.files[0]);
  });

  removeBtn.addEventListener('click', clearFile);

  openTabBtn.addEventListener('click', () => {
    if (currentObjectUrl) window.open(currentObjectUrl, '_blank');
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentObjectUrl) return;
    const link = document.createElement('a');
    link.href = currentObjectUrl;
    link.download = currentFileName;
    link.click();
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    loadFile(file);
  });

  function addMessage(text, sender) {
    const message = document.createElement('div');
    message.className = `message ${sender}`;

    if (sender === 'assistant') {
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = 'AI';
      message.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    message.appendChild(bubble);
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return message;
  }

  function addTypingIndicator() {
    const message = document.createElement('div');
    message.className = 'message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = 'AI';
    message.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'bubble typing-indicator';
    bubble.innerHTML = '<span></span><span></span><span></span>';

    message.appendChild(bubble);
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return message;
  }

  function extractReplyText(data) {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      return data.length ? extractReplyText(data[0]) : 'The assistant returned an empty response.';
    }
    if (data && typeof data === 'object') {
      const keys = ['output', 'reply', 'response', 'answer', 'message', 'text', 'result'];
      for (const key of keys) {
        if (typeof data[key] === 'string') return data[key];
      }
    }
    return JSON.stringify(data, null, 2);
  }

  async function sendToWebhook(message, file) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('file', file, file.name);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return extractReplyText(data);
    }
    const text = await response.text();
    return text || 'The assistant returned an empty response.';
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    if (!currentFile) {
      addMessage('Please upload a contract PDF before asking a question.', 'assistant');
      return;
    }

    sendBtn.disabled = true;
    const typingMessage = addTypingIndicator();

    try {
      const reply = await sendToWebhook(text, currentFile);
      typingMessage.remove();
      addMessage(reply, 'assistant');
    } catch (err) {
      typingMessage.remove();
      addMessage('Something went wrong reaching the assistant. Please try again.', 'assistant');
      console.error('Webhook request failed:', err);
    } finally {
      sendBtn.disabled = false;
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });
})();
