const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, exec } = require('child_process');
const crypto = require('crypto');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Paths
const BIN_DIR = path.join(__dirname, 'bin');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const ffmpegPath = ffmpeg.path;

// Ensure directories exist
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR);
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// Serve downloaded files via dedicated download endpoint with proper Content-Disposition
app.get(['/api/download/:taskId', '/api/files/:taskId', '/api/files/:taskId/:fileName'], (req, res) => {
  const { taskId, fileName } = req.params;
  const taskDir = path.join(DOWNLOADS_DIR, taskId);
  
  if (!fs.existsSync(taskDir)) {
    return res.status(404).json({ error: 'Download ou tarefa não encontrada.' });
  }
  
  let targetFile = fileName;
  
  // Locate or verify the real file on disk
  try {
    const files = fs.readdirSync(taskDir).filter(f => 
      !f.endsWith('.part') && !f.endsWith('.temp') && !f.endsWith('.ytdl') && !f.endsWith('.aria2')
    );
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'Nenhum arquivo encontrado para este download.' });
    }
    
    if (!targetFile || !files.includes(targetFile)) {
      // Pick first matching or available file
      targetFile = files[0];
    }
  } catch (err) {
    console.error('Erro ao ler diretório de downloads:', err);
    return res.status(500).json({ error: 'Erro ao acessar os arquivos baixados.' });
  }
  
  const filePath = path.join(taskDir, targetFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado no disco.' });
  }
  
  // res.download sets Content-Disposition: attachment, Content-Type, and streams the media file
  res.download(filePath, targetFile, (err) => {
    if (err && !res.headersSent) {
      console.error('Erro ao enviar arquivo para download:', err.message);
      res.status(500).json({ error: 'Falha ao enviar arquivo.' });
    }
  });
});

// State variables
let ytDlpReady = false;
let ytDlpError = null;

// Determine binary name and download URL based on OS
function getBinaryInfo() {
  const platform = process.platform;
  let binaryName = 'yt-dlp';
  let downloadUrl = '';

  if (platform === 'win32') {
    binaryName = 'yt-dlp.exe';
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  } else if (platform === 'darwin') {
    binaryName = 'yt-dlp_macos';
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
  } else {
    binaryName = 'yt-dlp';
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  }

  return {
    binaryPath: path.join(BIN_DIR, binaryName),
    downloadUrl
  };
}

const { binaryPath, downloadUrl } = getBinaryInfo();

// Follow redirects and download file helper
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function get(currentUrl) {
      https.get(currentUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          get(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download binary: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        
        file.on('finish', () => {
          file.close(() => {
            try {
              fs.chmodSync(destPath, 0o755);
            } catch (e) {
              console.warn('Failed to set execute permissions:', e.message);
            }
            resolve();
          });
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    }

    get(url);
  });
}

// Ensure yt-dlp binary is present
async function ensureYtDlp() {
  if (fs.existsSync(binaryPath)) {
    ytDlpReady = true;
    return true;
  }
  
  console.log(`Baixando yt-dlp de ${downloadUrl}...`);
  try {
    await downloadFile(downloadUrl, binaryPath);
    console.log('yt-dlp baixado com sucesso!');
    ytDlpReady = true;
    ytDlpError = null;
    return true;
  } catch (err) {
    console.error('Erro ao baixar yt-dlp:', err);
    ytDlpReady = false;
    ytDlpError = err.message;
    throw err;
  }
}

// Check for and apply updates to yt-dlp
function updateYtDlp() {
  return new Promise((resolve) => {
    if (!fs.existsSync(binaryPath)) return resolve(false);
    console.log('Verificando se há atualizações para o yt-dlp...');
    const child = spawn(binaryPath, ['-U']);
    child.stdout.on('data', (d) => {
      console.log(`[yt-dlp update]: ${d.toString().trim()}`);
    });
    child.stderr.on('data', (d) => {
      console.warn(`[yt-dlp update err]: ${d.toString().trim()}`);
    });
    child.on('close', (code) => {
      console.log(`Verificação do yt-dlp concluída (código: ${code})`);
      resolve(code === 0);
    });
    child.on('error', (err) => {
      console.warn('Erro ao verificar atualizações do yt-dlp:', err.message);
      resolve(false);
    });
  });
}

// Memory storage for tasks
const tasks = {};

function sendEvent(res, eventName, data) {
  if (res) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function updateTask(taskId, updates) {
  const task = tasks[taskId];
  if (!task) return;
  
  Object.assign(task, updates);
  
  if (task.client) {
    sendEvent(task.client, 'state', {
      status: task.status,
      progress: task.progress,
      speed: task.speed,
      eta: task.eta,
      title: task.title,
      thumbnail: task.thumbnail,
      duration: task.duration,
      platform: task.platform,
      fileName: task.fileName,
      error: task.error
    });
  }
}

// Fetch video info using --dump-json
function fetchVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const processArgs = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--windows-filenames',
      '--trim-filenames', '120',
      '--js-runtimes', `node:${process.execPath}`,
      '--ffmpeg-location', ffmpegPath,
      url
    ];
    const child = spawn(binaryPath, processArgs);
    
    let stdoutData = '';
    let stderrData = '';
    
    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = stdoutData.split('\n').map(l => l.trim()).filter(Boolean);
          const jsonLine = lines.find(l => l.startsWith('{') && l.endsWith('}')) || stdoutData.trim();
          const info = JSON.parse(jsonLine);
          resolve({
            title: info.title || 'Vídeo sem título',
            thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : ''),
            duration: formatDuration(info.duration),
            platform: info.extractor_key || info.extractor || 'Vídeo'
          });
        } catch (e) {
          console.error('Falha ao interpretar JSON do vídeo:', e.message, stdoutData);
          reject(new Error('Falha ao obter metadados do vídeo.'));
        }
      } else {
        const lines = stderrData.split('\n').map(l => l.trim()).filter(Boolean);
        let errorLine = lines.reverse().find(l => l.startsWith('ERROR:')) || lines[0] || `yt-dlp encerrou com o código ${code}`;
        console.error(`yt-dlp fetchVideoInfo erro: ${errorLine}`);
        errorLine = errorLine.replace(/^ERROR:\s*/, '');
        if (errorLine.includes('login') || errorLine.includes('This account is private') || errorLine.includes('checkpoint_required')) {
          errorLine = 'Conteúdo privado ou restrito pelo Instagram/plataforma. Apenas mídias públicas podem ser acessadas diretamente.';
        }
        reject(new Error(errorLine));
      }
    });
  });
}

function formatDuration(seconds) {
  if (!seconds) return 'Desconhecida';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Start downloading process
async function runDownload(taskId, url, format, quality) {
  const task = tasks[taskId];
  const taskDir = path.join(DOWNLOADS_DIR, taskId);
  
  try {
    if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir);
    
    // Step 1: Fetch Video details
    updateTask(taskId, { status: 'fetching_info' });
    const info = await fetchVideoInfo(url);
    updateTask(taskId, {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      platform: info.platform,
      status: 'downloading',
      progress: 0
    });
    
    // Step 2: Build yt-dlp arguments
    const args = [
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '--windows-filenames',
      '--trim-filenames', '120',
      '--js-runtimes', `node:${process.execPath}`,
      '--ffmpeg-location', ffmpegPath
    ];
    
    if (format === 'mp3') {
      args.push(
        '-f', 'ba/b',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', quality === 'high' ? '320K' : quality === 'medium' ? '192K' : '128K'
      );
    } else {
      // mp4 video - Universal vertical & horizontal resolution sorting
      let sortArg;
      if (quality === 'high') {
        sortArg = 'res:1080,ext:mp4:m4a';
      } else if (quality === 'medium') {
        sortArg = 'res:720,ext:mp4:m4a';
      } else {
        sortArg = 'res:480,ext:mp4:m4a';
      }
      
      // Exclude watermarked streams when clean streams exist, gracefully falling back to best
      args.push(
        '-f', 'bv*[format_id!*=watermark][format_note!*=watermark]+ba/b[format_id!*=watermark][format_note!*=watermark]/bv*+ba/b',
        '-S', sortArg,
        '--merge-output-format', 'mp4',
        '--remux-video', 'mp4'
      );
    }
    
    // Output template
    args.push('-o', path.join(taskDir, '%(title)s.%(ext)s'));
    args.push(url);
    
    console.log(`Iniciando yt-dlp com args: ${args.join(' ')}`);
    const child = spawn(binaryPath, args);
    
    const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+(?:~\s*)?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s|Unknown speed)\s+ETA\s+([\d:]+|Unknown)/;
    
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        console.log(`[yt-dlp stdout]: ${line}`);
        
        // Parse progress
        const match = line.match(progressRegex);
        if (match) {
          const progress = parseFloat(match[1]);
          const speed = match[3];
          const eta = match[4];
          updateTask(taskId, {
            status: 'downloading',
            progress,
            speed,
            eta
          });
          continue;
        }
        
        // Parse transitions
        if (line.includes('[ExtractAudio]')) {
          updateTask(taskId, { status: 'converting', progress: 100 });
        } else if (line.includes('[Merger]')) {
          updateTask(taskId, { status: 'merging', progress: 100 });
        } else if (line.includes('[VideoRemuxer]')) {
          updateTask(taskId, { status: 'remuxing', progress: 100 });
        }
        
        // Parse Destination
        if (line.includes('Destination:')) {
          const destPath = line.split('Destination:')[1].trim();
          const ext = path.extname(destPath).toLowerCase();
          if (ext === '.mp3' || ext === '.mp4') {
            updateTask(taskId, { fileName: path.basename(destPath) });
          }
        } else if (line.includes('Merging formats into')) {
          const matchMerge = line.match(/Merging formats into "(.+?)"/);
          if (matchMerge) {
            updateTask(taskId, { fileName: path.basename(matchMerge[1]) });
          }
        } else if (line.includes('Remuxing video from')) {
          const matchRemux = line.match(/to "(.+?)"/);
          if (matchRemux) {
            updateTask(taskId, { fileName: path.basename(matchRemux[1]) });
          }
        } else if (line.includes('has already been downloaded')) {
          const matchAlready = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/);
          if (matchAlready) {
            updateTask(taskId, { fileName: path.basename(matchAlready[1]) });
          }
        }
      }
    });
    
    let stderrBuffer = '';
    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      console.log(`[yt-dlp stderr]: ${data.toString()}`);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        // Always locate and verify the actual existing file on disk in taskDir
        try {
          const files = fs.readdirSync(taskDir).filter(f => 
            !f.endsWith('.part') && !f.endsWith('.temp') && !f.endsWith('.ytdl') && !f.endsWith('.aria2')
          );
          const targetExt = `.${format}`.toLowerCase();
          const matchedFile = files.find(f => f.toLowerCase().endsWith(targetExt)) || files[0];
          if (matchedFile) {
            task.fileName = matchedFile;
          }
        } catch (err) {
          console.error('Erro ao ler diretório da tarefa:', err);
        }
        
        if (task.fileName && fs.existsSync(path.join(taskDir, task.fileName))) {
          updateTask(taskId, { fileName: task.fileName, status: 'completed', progress: 100 });
        } else {
          updateTask(taskId, { status: 'failed', error: 'Arquivo final não pôde ser localizado.' });
        }
      } else {
        const lines = stderrBuffer.split('\n').map(l => l.trim()).filter(Boolean);
        let errorLine = lines.reverse().find(l => l.startsWith('ERROR:')) || lines[0] || 'Erro desconhecido durante o download.';
        console.error(`Falha no download [${code}]: ${errorLine}`);
        errorLine = errorLine.replace(/^ERROR:\s*/, '');
        if (errorLine.includes('login') || errorLine.includes('This account is private') || errorLine.includes('checkpoint_required')) {
          errorLine = 'Conteúdo privado ou restrito pelo Instagram/plataforma. Apenas mídias públicas podem ser acessadas diretamente.';
        }
        updateTask(taskId, {
          status: 'failed',
          error: errorLine
        });
      }
    });
    
  } catch (err) {
    console.error('Task error:', err);
    updateTask(taskId, { status: 'failed', error: err.message });
  }
}

// Endpoints
app.post('/api/download', async (req, res) => {
  const { url, format, quality } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'A URL do vídeo é obrigatória.' });
  }
  if (!['mp3', 'mp4'].includes(format)) {
    return res.status(400).json({ error: 'Formato inválido. Escolha mp3 ou mp4.' });
  }
  if (!['high', 'medium', 'low'].includes(quality)) {
    return res.status(400).json({ error: 'Qualidade inválida.' });
  }

  // Ensure yt-dlp is ready
  if (!ytDlpReady) {
    try {
      await ensureYtDlp();
    } catch (err) {
      return res.status(500).json({ error: `Não foi possível inicializar o conversor: ${err.message}` });
    }
  }

  const taskId = crypto.randomUUID();
  tasks[taskId] = {
    id: taskId,
    status: 'pending',
    progress: 0,
    speed: '',
    eta: '',
    title: '',
    thumbnail: '',
    duration: '',
    platform: '',
    fileName: '',
    error: '',
    client: null
  };

  // Start background task
  runDownload(taskId, url, format, quality);

  res.json({ taskId });
});

// SSE progress stream endpoint
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks[taskId];
  
  if (!task) {
    return res.status(404).json({ error: 'Download não encontrado.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  task.client = res;

  // Send current state immediately
  sendEvent(res, 'state', {
    status: task.status,
    progress: task.progress,
    speed: task.speed,
    eta: task.eta,
    title: task.title,
    thumbnail: task.thumbnail,
    duration: task.duration,
    platform: task.platform,
    fileName: task.fileName,
    error: task.error
  });

  req.on('close', () => {
    if (tasks[taskId]) {
      tasks[taskId].client = null;
    }
  });
});

// Serve frontend fallback for any other requests (excluding /api routes)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint da API não encontrado.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-cleaner for files and tasks (runs every 15 minutes, deletes assets older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  fs.readdir(DOWNLOADS_DIR, (err, folders) => {
    if (err) return;
    
    folders.forEach(folder => {
      const folderPath = path.join(DOWNLOADS_DIR, folder);
      fs.stat(folderPath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtimeMs > oneHour) {
          fs.rm(folderPath, { recursive: true, force: true }, (err) => {
            if (err) {
              console.error(`Error deleting folder ${folderPath}:`, err);
            } else {
              console.log(`Cleaned up folder: ${folder}`);
              delete tasks[folder];
            }
          });
        }
      });
    });
  });
}, 15 * 60 * 1000);

// Browser auto-open utility
function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`, (err) => {
    if (err) console.error('Failed to auto-open browser:', err.message);
  });
}

// Endpoint to manually trigger yt-dlp update
app.post('/api/update', async (req, res) => {
  try {
    const success = await updateYtDlp();
    res.json({ success, message: success ? 'yt-dlp verificado/atualizado com sucesso!' : 'yt-dlp já está na versão mais recente ou a verificação falhou.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function init() {
  console.log('Iniciando o servidor e verificando os binários necessários...');
  try {
    await ensureYtDlp();
    console.log('Conversor inicializado.');
    // Check for yt-dlp updates in background
    updateYtDlp().catch((err) => {
      console.warn('Verificação de atualização em segundo plano:', err.message);
    });
  } catch (err) {
    console.warn('Alerta: Não foi possível verificar o yt-dlp de início. Tentará novamente durante a primeira requisição.');
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
    openBrowser(`http://localhost:${PORT}`);
  });
}

init();
