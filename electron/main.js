const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeTheme, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { translateWithGemini } = require('./gemini');

// electron-store must be loaded with dynamic import due to ESM
let store;
(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store();
})();

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use a simple fallback if icon doesn't exist yet
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show i18n Tool', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('i18n Tool');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Locale Files',
    filters: [{ name: 'Locale Files', extensions: ['json', 'ts'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    return {
      path: filePath,
      name: path.basename(filePath, ext),
      content,
      ext
    };
  });
});

ipcMain.handle('dialog:saveFile', async (_event, { filePath, content, format }) => {
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  }
  const extensions = format === 'ts' ? ['ts'] : ['json'];
  const name = format === 'ts' ? 'TypeScript Files' : 'JSON Files';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Locale File',
    filters: [{ name, extensions }],
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { success: true, path: result.filePath };
});

ipcMain.handle('file:parseTs', (_event, content) => {
  const { parseTs } = require('./tsParser');
  return parseTs(content);
});

ipcMain.handle('dialog:saveCsv', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as CSV',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { success: true, path: result.filePath };
});

ipcMain.handle('ai:translate', async (_event, { text, sourceLang, targetLang, apiKey, model }) => {
  return translateWithGemini({ text, sourceLang, targetLang, apiKey, model });
});

ipcMain.handle('ai:batchTranslate', async (_event, { entries, sourceLang, targetLang, apiKey, model }) => {
  const { batchTranslateWithGemini } = require('./gemini');
  return batchTranslateWithGemini({ entries, sourceLang, targetLang, apiKey, model });
});

ipcMain.handle('ai:fetchModels', async (_event, apiKey) => {
  if (!apiKey) return [];
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName || m.name.replace('models/', '')
      }));
  } catch (err) {
    console.error('Failed to list Gemini models:', err);
    throw err;
  }
});

ipcMain.handle('store:get', (_event, key) => {
  return store ? store.get(key) : undefined;
});

ipcMain.handle('store:set', (_event, key, value) => {
  if (store) store.set(key, value);
});

ipcMain.handle('theme:get', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  if (process.platform !== 'linux') createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
