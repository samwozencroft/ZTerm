const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');
const { WebLinksAddon } = require('xterm-addon-web-links');

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('terminal');
  if (!container) return console.error('❌ Terminal container not found!');

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"Fira Code", "Menlo", "Consolas", "Courier New", monospace',
    letterSpacing: 0, // Explicitly set to prevent weird spacing
    lineHeight: 1.2,  // Slightly increased line height
    cursorStyle: 'block', // Force block cursor
    allowTransparency: false,
    theme: {
      background: '#1e1e1e',
      foreground: '#f8f8f8',
      cursor: '#00ffcc',
      cursorAccent: '#1e1e1e',
      selection: 'rgba(0, 255, 204, 0.3)',
    },
    windowsMode: false, // Important for Mac/Linux
    convertEol: true,  // Convert newlines properly
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.open(container);
  fitAddon.fit();
  term.focus();

  // Stream user keystrokes to the pty
  term.onData((data) => {
    ipcRenderer.send('terminal.toTerminal', data);
  });

  // Stream pty output to the terminal
  ipcRenderer.on('terminal.incomingData', (_event, data) => {
    term.write(data);
  });

  // Handle terminal resize
  const debounceResize = debounce(() => {
    fitAddon.fit();
    ipcRenderer.send('resize', {
      cols: term.cols,
      rows: term.rows,
    });
  }, 100);

  window.addEventListener('resize', debounceResize);

  // Helper function for debouncing resize events
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
  term.onRender(({ start, end }) => {
    // This helps with rendering artifacts
    term.refresh(start, end);
  });
  
  term.onBinary((data) => {
    // Handle binary data that might be causing the 'wwww'
    console.warn('Received binary data:', data);
  });
});