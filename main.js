const { app, BrowserWindow, ipcMain } = require('electron');
const os = require('os');
const pty = require('node-pty');
const path = require('path');

// Get the correct shell for the platform
const shell = (() => {
    if (os.platform() === 'win32') {
        return process.env.COMSPEC || 'cmd.exe'; // Default to cmd.exe on Windows
    } else if (os.platform() === 'darwin') {
        return process.env.SHELL || '/bin/zsh'; // Default to zsh on macOS
    } else if (os.platform() === 'linux') {
        return process.env.SHELL || '/bin/bash'; // Default to bash on Linux
    } else {
        return '/bin/sh'; // Fallback to sh for unknown platforms
    }
})();

function createWindow() {
  console.log('Creating window...');
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    }
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();

  // Create a full environment object with necessary variables
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    HOME: process.env.HOME,
    USER: process.env.USER,
    PATH: process.env.PATH,
    SHELL: shell,
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    ZSH: process.env.ZSH || path.join(process.env.HOME, '.oh-my-zsh'),
  };

const ptyProcess = pty.spawn(shell, ['--login'], {
    name: 'xterm-256color', // ← Ensures color/glyph compatibility
    cwd: process.env.HOME,
    env: {
        ...process.env,
        LANG: 'en_US.UTF-8',   // ← Ensures proper UTF-8 handling
        TERM: 'xterm-256color' // ← Ensures compatible terminal capabilities
    },
    cols: 80,
    rows: 30
});

// Clear any initial output from the terminal
ptyProcess.on('data', (data) => {
    if (data.trim() === 'wwwwwwwwww') {
        return; // Ignore this specific output
    }
    win.webContents.send('terminal.incomingData', data);
});
  
  // Add initialization sequence after spawn
  setTimeout(() => {
    ptyProcess.write('\x1b[c'); // Send device attributes query
    ptyProcess.write('clear\n'); // Clear screen
  }, 100);

  console.log('PTY process started with shell:', shell, 'and env:', env);

  // Handle output from the shell
  ptyProcess.on('data', (data) => {
    win.webContents.send('terminal.incomingData', data);
  });

  // Handle input from renderer
  ipcMain.on('terminal.toTerminal', (_event, data) => {
    ptyProcess.write(data);
  });

  // Resize
  ipcMain.on('resize', (_event, size) => {
    ptyProcess.resize(size.cols, size.rows);
  });

  // Initialize the shell properly
  ptyProcess.write('clear\n');

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});