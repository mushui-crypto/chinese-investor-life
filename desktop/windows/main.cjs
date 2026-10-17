const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_SCHEME = 'life';
const APP_HOST = 'game';
const CONTENT_ROOT = path.join(app.getAppPath(), 'game');
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

app.setName('中国式赌狗');

if (app.isPackaged) {
  const portableData = path.join(path.dirname(process.execPath), 'userdata');
  try {
    fs.mkdirSync(portableData, { recursive: true });
    fs.accessSync(portableData, fs.constants.W_OK);
    app.setPath('userData', portableData);
  } catch {
    app.setPath('userData', path.join(app.getPath('appData'), '中国式赌狗'));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function response(body, status, type = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' } });
}

async function serveGame(request) {
  const url = new URL(request.url);
  if (url.hostname !== APP_HOST || !['GET', 'HEAD'].includes(request.method)) return response('Forbidden', 403);

  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
  } catch {
    return response('Bad request', 400);
  }
  const root = path.resolve(CONTENT_ROOT);
  const file = path.resolve(root, relative || 'index.html');
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return response('Forbidden', 403);

  try {
    const info = await fs.promises.stat(file);
    if (!info.isFile()) return response('Not found', 404);
    const body = request.method === 'HEAD' ? null : await fs.promises.readFile(file);
    return response(body, 200, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  } catch {
    return response('Not found', 404);
  }
}

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#274f43',
    title: '中国式赌狗 · 一生的筹码',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  if (!app.isPackaged && process.env.GAME_DESKTOP_DEVTOOLS === '1') mainWindow.webContents.openDevTools();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  protocol.handle(APP_SCHEME, serveGame);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await createWindow();
});

app.on('window-all-closed', () => app.quit());
