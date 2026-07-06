const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')

ipcMain.handle('settings:get', () => {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) } catch { return {} }
})
ipcMain.handle('settings:set', (e, s) => fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)))

ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return null
  const dir = r.filePaths[0]
  if (!fs.existsSync(path.join(dir, '.beads'))) return { error: `No .beads directory found in ${dir}` }
  return { dir }
})

// GUI apps don't inherit the shell PATH, so add the usual bd install locations
const ENV = { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }

ipcMain.handle('bd', (e, cwd, args) => new Promise(resolve => {
  execFile('bd', args, { cwd, env: ENV, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
    resolve({ ok: !err, stdout: stdout || '', stderr: stderr || (err ? String(err) : '') })
  })
}))

ipcMain.handle('save-attachment', (e, dir, name, bytes) => {
  const attDir = path.join(dir, '.beads', 'attachments')
  fs.mkdirSync(attDir, { recursive: true })
  fs.writeFileSync(path.join(attDir, name), Buffer.from(bytes))
  return path.join('.beads', 'attachments', name)
})

ipcMain.handle('open-path', (e, p) => shell.openPath(p))

ipcMain.handle('delete-attachment', (e, dir, rel) => {
  const abs = path.resolve(dir, rel)
  if (!abs.startsWith(path.join(dir, '.beads', 'attachments') + path.sep)) return false
  try { fs.unlinkSync(abs); return true } catch { return false }
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { ...(process.env.TAB && { tab: process.env.TAB }), ...(process.env.SEL && { sel: process.env.SEL }) } })

  // ponytail: headless smoke test — SHOT=/path.png captures the window and quits
  if (process.env.SHOT) {
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const img = await win.webContents.capturePage()
      fs.writeFileSync(process.env.SHOT, img.toPNG())
      app.quit()
    }, 3000))
  }
}

app.whenReady().then(() => {
  const icon = path.join(__dirname, '../build/icon.png')
  if (app.dock && fs.existsSync(icon)) app.dock.setIcon(icon) // packaged app uses the bundle icon instead
  createWindow()
})
app.on('window-all-closed', () => app.quit())
