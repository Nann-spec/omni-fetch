document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Elements
  const videoUrlInput = document.getElementById('video-url');
  const convertBtn = document.getElementById('convert-btn');
  const formatSelect = document.getElementById('format-select');
  const qualitySelect = document.getElementById('quality-select');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');
  
  const qualityLabelHigh = document.getElementById('quality-label-high');
  const qualityLabelMedium = document.getElementById('quality-label-medium');
  const qualityLabelLow = document.getElementById('quality-label-low');

  const formSection = document.getElementById('form-section');
  const progressSection = document.getElementById('progress-section');
  const successSection = document.getElementById('success-section');
  const errorSection = document.getElementById('error-section');
  
  // Progress Elements
  const videoInfoCard = document.getElementById('video-info');
  const videoThumbnail = document.getElementById('video-thumbnail');
  const videoTitle = document.getElementById('video-title');
  const videoLength = document.getElementById('video-length');
  const videoPlatform = document.getElementById('video-platform');
  const platformChips = document.querySelectorAll('.platform-chip');
  
  const metadataLoader = document.getElementById('metadata-loader');
  const downloadProgressContainer = document.getElementById('download-progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const downloadStatus = document.getElementById('download-status');
  
  const statSpeed = document.getElementById('stat-speed');
  const statEta = document.getElementById('stat-eta');
  
  // Success / Error Actions
  const successMessage = document.getElementById('success-message');
  const downloadLink = document.getElementById('download-link');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const newConvertBtn = document.getElementById('new-convert-btn');
  const errorMessage = document.getElementById('error-message');
  const retryBtn = document.getElementById('retry-btn');

  // History Elements
  const historySection = document.getElementById('history-section');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // Toast & Modal Elements
  const toastContainer = document.getElementById('toast-container');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalIconWrap = document.getElementById('modal-icon-wrap');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  // State
  let selectedFormat = 'mp3';
  let selectedQuality = 'high';
  let eventSource = null;
  let currentFileUrl = '';
  let onModalConfirmCallback = null;

  // ==========================================================================
  // Toast Notification System (Auto-dismiss timer with visual progress bar)
  // ==========================================================================
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="toast-icon"></i>
      <div class="toast-content">
        <p class="toast-message">${escapeHtml(message)}</p>
      </div>
      <button type="button" class="toast-close-btn" title="Fechar">
        <i data-lucide="x" class="btn-icon-xs"></i>
      </button>
      <div class="toast-progress">
        <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
      </div>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons({ root: toast });

    let dismissTimeout = null;

    function dismiss() {
      if (dismissTimeout) clearTimeout(dismissTimeout);
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 220);
    }

    toast.querySelector('.toast-close-btn').addEventListener('click', dismiss);

    if (duration > 0) {
      dismissTimeout = setTimeout(dismiss, duration);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // Modal Confirmation System (When user choice is required)
  // ==========================================================================
  function showConfirmModal({
    title = 'Confirmação',
    message = 'Deseja prosseguir com esta ação?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'warning', // 'warning', 'danger', 'info'
    onConfirm = () => {}
  }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirmBtn.textContent = confirmText;
    modalCancelBtn.textContent = cancelText;

    // Set styling and icon based on variant
    modalIconWrap.className = `modal-icon-badge ${variant}`;
    let iconName = 'help-circle';
    if (variant === 'danger') iconName = 'alert-octagon';
    if (variant === 'warning') iconName = 'alert-triangle';
    if (variant === 'info') iconName = 'info';

    modalIconWrap.innerHTML = `<i data-lucide="${iconName}"></i>`;
    lucide.createIcons({ root: modalIconWrap });

    if (variant === 'danger') {
      modalConfirmBtn.style.background = 'var(--status-error)';
      modalConfirmBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      modalConfirmBtn.style.background = '';
      modalConfirmBtn.style.borderColor = '';
    }

    onModalConfirmCallback = onConfirm;
    modalOverlay.classList.remove('hidden');
    modalConfirmBtn.focus();
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    onModalConfirmCallback = null;
  }

  modalCancelBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalConfirmBtn.addEventListener('click', () => {
    if (typeof onModalConfirmCallback === 'function') {
      onModalConfirmCallback();
    }
    closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ==========================================================================
  // Quality Labels Adaptation based on Format
  // ==========================================================================
  function updateQualityLabels(format) {
    if (format === 'mp3') {
      qualityLabelHigh.textContent = '320 kbps';
      qualityLabelMedium.textContent = '192 kbps';
      qualityLabelLow.textContent = '128 kbps';
    } else {
      qualityLabelHigh.textContent = '1080p FHD';
      qualityLabelMedium.textContent = '720p HD';
      qualityLabelLow.textContent = '480p SD';
    }
  }

  // Segmented Controls Setup
  setupSegmentControl(formatSelect, (val) => {
    selectedFormat = val;
    updateQualityLabels(selectedFormat);
  });

  setupSegmentControl(qualitySelect, (val) => {
    selectedQuality = val;
  });

  function setupSegmentControl(container, onChange) {
    const buttons = container.querySelectorAll('.segment-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.getAttribute('data-value'));
      });
    });
  }

  // ==========================================================================
  // Platform Detection & Input Handling
  // ==========================================================================
  function detectPlatform(urlStr) {
    if (!urlStr) return null;
    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : 'https://' + urlStr);
      const host = url.hostname.toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
      if (host.includes('tiktok.com')) return 'tiktok';
      if (host.includes('instagram.com')) return 'instagram';
      if (url.protocol === 'http:' || url.protocol === 'https:') return 'generic';
    } catch (_) {}
    return null;
  }

  function updateInputState() {
    const val = videoUrlInput.value.trim();
    
    // Toggle clear button
    if (val.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }

    // Update platform chips
    const platform = detectPlatform(val);
    platformChips.forEach(chip => {
      if (platform && chip.getAttribute('data-platform') === platform) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  videoUrlInput.addEventListener('input', updateInputState);
  videoUrlInput.addEventListener('paste', () => setTimeout(updateInputState, 20));

  // Clear Button
  clearBtn.addEventListener('click', () => {
    videoUrlInput.value = '';
    updateInputState();
    videoUrlInput.focus();
  });

  // Paste Button (Clipboard API with Toast Feedback)
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        videoUrlInput.value = text.trim();
        updateInputState();
        videoUrlInput.focus();
        showToast('Link colado da área de transferência!', 'info', 2000);
      } else {
        showToast('A área de transferência está vazia.', 'warning', 3000);
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
      videoUrlInput.focus();
      showToast('Permissão de leitura negada. Cole utilizando Ctrl + V.', 'warning', 3500);
    }
  });

  // Navigation functions
  function showSection(sectionToShow) {
    const sections = [formSection, progressSection, successSection, errorSection];
    sections.forEach(sec => {
      sec.classList.remove('active');
      sec.style.display = 'none';
    });

    sectionToShow.style.display = 'flex';
    requestAnimationFrame(() => {
      sectionToShow.classList.add('active');
    });
  }

  // Validate URL
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // ==========================================================================
  // Convert Trigger & Validation (Replaced alerts with toasts)
  // ==========================================================================
  convertBtn.addEventListener('click', async () => {
    let url = videoUrlInput.value.trim();

    if (!url) {
      showToast('Por favor, cole um link de vídeo do YouTube, Instagram ou TikTok.', 'warning', 3500);
      videoUrlInput.focus();
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    if (!isValidUrl(url)) {
      showToast('URL inválida. Por favor, insira um endereço web válido (ex: https://...).', 'error', 4000);
      videoUrlInput.focus();
      return;
    }

    // Reset Progress View
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    downloadStatus.textContent = 'Iniciando requisição...';
    statSpeed.textContent = '-- MB/s';
    statEta.textContent = '--:--';

    videoInfoCard.classList.add('hidden');
    videoPlatform.classList.add('hidden');
    metadataLoader.classList.remove('hidden');
    downloadProgressContainer.classList.add('hidden');

    showSection(progressSection);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          format: selectedFormat,
          quality: selectedQuality
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao iniciar processamento.');
      }

      startProgressListening(data.taskId);

    } catch (err) {
      console.error(err);
      errorMessage.textContent = err.message;
      showToast(err.message || 'Falha ao iniciar download.', 'error', 5000);
      showSection(errorSection);
    }
  });

  // ==========================================================================
  // Progress Listener (SSE)
  // ==========================================================================
  function startProgressListening(taskId) {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/progress/${taskId}`);

    eventSource.addEventListener('state', (event) => {
      const task = JSON.parse(event.data);

      // Handle Video Info updates
      if (task.title) {
        videoTitle.textContent = task.title;
        videoLength.textContent = task.duration || 'Desconhecida';
        if (task.thumbnail) {
          videoThumbnail.src = task.thumbnail;
        }
        if (task.platform) {
          videoPlatform.textContent = task.platform;
          videoPlatform.classList.remove('hidden');
        }
        videoInfoCard.classList.remove('hidden');
      }

      // Handle transitions
      switch (task.status) {
        case 'fetching_info':
          metadataLoader.classList.remove('hidden');
          downloadProgressContainer.classList.add('hidden');
          break;

        case 'downloading':
          metadataLoader.classList.add('hidden');
          downloadProgressContainer.classList.remove('hidden');

          progressBar.style.width = `${task.progress}%`;
          progressPercent.textContent = `${Math.round(task.progress)}%`;
          downloadStatus.textContent = 'Baixando fluxo de mídia...';

          statSpeed.textContent = task.speed || 'Calculando...';
          statEta.textContent = task.eta || '--:--';
          break;

        case 'converting':
          metadataLoader.classList.add('hidden');
          downloadProgressContainer.classList.remove('hidden');

          progressBar.style.width = '100%';
          progressPercent.textContent = '99%';
          downloadStatus.textContent = 'Extraindo áudio de alta fidelidade (MP3)...';
          statSpeed.textContent = 'Processando...';
          statEta.textContent = '--:--';
          break;

        case 'merging':
          metadataLoader.classList.add('hidden');
          downloadProgressContainer.classList.remove('hidden');

          progressBar.style.width = '100%';
          progressPercent.textContent = '99%';
          downloadStatus.textContent = 'Mesclando áudio e vídeo em contêiner MP4...';
          statSpeed.textContent = 'Processando...';
          statEta.textContent = '--:--';
          break;

        case 'remuxing':
          metadataLoader.classList.add('hidden');
          downloadProgressContainer.classList.remove('hidden');

          progressBar.style.width = '100%';
          progressPercent.textContent = '99%';
          downloadStatus.textContent = 'Otimizando formato do arquivo (MP4)...';
          statSpeed.textContent = 'Finalizando...';
          statEta.textContent = '--:--';
          break;

        case 'completed':
          eventSource.close();
          progressBar.style.width = '100%';
          progressPercent.textContent = '100%';

          currentFileUrl = `/api/download/${taskId}`;
          downloadLink.href = currentFileUrl;
          downloadLink.setAttribute('download', task.fileName);
          successMessage.textContent = `O arquivo "${task.fileName}" foi concluído com sucesso.`;

          // Automatically trigger download
          downloadLink.click();
          showToast('Download concluído e iniciado automaticamente!', 'success', 3500);

          // Save to local session history
          addToHistory({
            title: task.title || task.fileName,
            fileName: task.fileName,
            format: selectedFormat.toUpperCase(),
            url: currentFileUrl,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });

          showSection(successSection);
          break;

        case 'failed':
          eventSource.close();
          errorMessage.textContent = task.error || 'Erro desconhecido durante o download.';
          showToast(task.error || 'Erro desconhecido durante o download.', 'error', 5000);
          showSection(errorSection);
          break;
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      errorMessage.textContent = 'Conexão interrompida com o servidor local.';
      showToast('Conexão interrompida com o servidor local.', 'error', 4500);
      showSection(errorSection);
    };
  }

  // ==========================================================================
  // Copy Link Button (Replaced alert with toast)
  // ==========================================================================
  copyLinkBtn.addEventListener('click', async () => {
    if (!currentFileUrl) return;
    const fullUrl = window.location.origin + currentFileUrl;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link do arquivo copiado para a área de transferência!', 'success', 3000);
      const originalText = copyLinkBtn.querySelector('span').textContent;
      copyLinkBtn.querySelector('span').textContent = 'Copiado!';
      setTimeout(() => {
        copyLinkBtn.querySelector('span').textContent = originalText;
      }, 2000);
    } catch (_) {
      showToast('Link local: ' + fullUrl, 'info', 6000);
    }
  });

  // Reset form listeners
  newConvertBtn.addEventListener('click', () => {
    videoUrlInput.value = '';
    updateInputState();
    showSection(formSection);
    videoUrlInput.focus();
  });

  retryBtn.addEventListener('click', () => {
    showSection(formSection);
    videoUrlInput.focus();
  });

  // ==========================================================================
  // History Management (Choice Modal for Clear History)
  // ==========================================================================
  const HISTORY_KEY = 'omnifetch_recent_downloads';

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function addToHistory(item) {
    const list = getHistory();
    list.unshift(item);
    if (list.length > 5) list.pop(); // Keep 5 most recent
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (_) {}
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (!list || list.length === 0) {
      historySection.classList.add('hidden');
      return;
    }

    historySection.classList.remove('hidden');
    historyList.innerHTML = '';

    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-item-left">
          <div class="history-item-icon">
            <i data-lucide="${item.format === 'MP3' ? 'headphones' : 'film'}" class="btn-icon-sm"></i>
          </div>
          <div class="history-item-info">
            <span class="history-item-name" title="${item.title}">${item.title}</span>
            <span class="history-item-tag">${item.format} • ${item.time}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <a href="${item.url}" class="btn-text" download="${escapeHtml(item.fileName)}" title="Baixar novamente">
            <i data-lucide="download" class="btn-icon-xs"></i>
            <span>Baixar</span>
          </a>
        </div>
      `;
      historyList.appendChild(div);
    });

    lucide.createIcons();
  }

  // Clear History with Confirmation Modal (User Choice)
  clearHistoryBtn.addEventListener('click', () => {
    showConfirmModal({
      title: 'Limpar Histórico de Downloads',
      message: 'Deseja remover os registros de downloads desta sessão? Os arquivos já baixados em seu computador continuarão salvos normalmente.',
      confirmText: 'Limpar Histórico',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: () => {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        showToast('Histórico de downloads limpo com sucesso.', 'info', 2500);
      }
    });
  });

  // Initial History Render & Quality Label Setup
  updateQualityLabels(selectedFormat);
  renderHistory();
});
