'use strict';

// Vigia do Colheita+: mantém o servidor (porta 3000) e o túnel ngrok no ar.
// A cada minuto testa o site local e o endereço público; se algo cair, religa.
// Uso:  node scripts/watchdog.js   (ou scripts/start-watchdog.vbs, janela oculta)
// Registro em scripts/watchdog.log

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const RAIZ = path.join(__dirname, '..');
const LOG = path.join(__dirname, 'watchdog.log');
const URL_LOCAL = 'http://localhost:3000/';
const URL_PUBLICA = 'https://consuming-raving-recovery.ngrok-free.dev/';
const INTERVALO = 60 * 1000;

let falhasLocal = 0;
let falhasPublica = 0;

function log(msg) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${msg}\n`;
  try { fs.appendFileSync(LOG, linha); } catch (_) {}
}

function testar(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 15000, headers: { 'ngrok-skip-browser-warning': '1' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.on('error', () => resolve(0));
  });
}

function pidsNaPorta3000() {
  return new Promise((resolve) => {
    execFile('netstat', ['-ano'], { windowsHide: true }, (err, out) => {
      if (err) return resolve([]);
      const pids = new Set();
      out.split(/\r?\n/).forEach((l) => {
        const m = l.match(/:3000\s+\S+\s+LISTENING\s+(\d+)/);
        if (m) pids.add(m[1]);
      });
      resolve([...pids]);
    });
  });
}

function ngrokRodando() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq ngrok.exe'], { windowsHide: true }, (err, out) => {
      resolve(!err && /ngrok\.exe/i.test(out));
    });
  });
}

function matar(pid) {
  return new Promise((resolve) => execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, () => resolve()));
}

function iniciarServidor() {
  const saida = fs.openSync(path.join(__dirname, 'server.log'), 'a');
  const p = spawn(process.execPath, ['server.js'], { cwd: RAIZ, detached: true, stdio: ['ignore', saida, saida], windowsHide: true });
  p.unref();
  log(`Servidor iniciado (PID ${p.pid}).`);
}

function iniciarNgrok() {
  const p = spawn('ngrok', ['http', '--url=' + URL_PUBLICA.replace(/\/$/, ''), '3000'],
    { detached: true, stdio: 'ignore', windowsHide: true, shell: true });
  p.unref();
  log('ngrok iniciado.');
}

async function verificar() {
  // 1) Servidor local
  const local = await testar(URL_LOCAL);
  if (local === 200) {
    if (falhasLocal) log('Servidor respondendo novamente.');
    falhasLocal = 0;
  } else {
    falhasLocal++;
    const pids = await pidsNaPorta3000();
    log(`Servidor não respondeu (status ${local}, tentativa ${falhasLocal}).`);
    if (!pids.length) {
      iniciarServidor();
    } else if (falhasLocal >= 3) {
      // Processo existe mas travou: reinicia
      for (const pid of pids) await matar(pid);
      log('Servidor travado: reiniciando.');
      setTimeout(iniciarServidor, 2000);
      falhasLocal = 0;
    }
    return; // sem servidor não adianta testar o túnel agora
  }

  // 2) Túnel ngrok (endereço público)
  const publica = await testar(URL_PUBLICA);
  if (publica === 200) {
    if (falhasPublica) log('Endereço público respondendo novamente.');
    falhasPublica = 0;
    return;
  }
  falhasPublica++;
  log(`Endereço público não respondeu (status ${publica}, tentativa ${falhasPublica}).`);
  if (!(await ngrokRodando())) {
    iniciarNgrok();
  } else if (falhasPublica >= 3) {
    execFile('taskkill', ['/F', '/IM', 'ngrok.exe'], { windowsHide: true }, () => {
      log('ngrok sem resposta: reiniciando.');
      setTimeout(iniciarNgrok, 3000);
    });
    falhasPublica = 0;
  }
}

log('Vigia iniciado.');
verificar();
setInterval(verificar, INTERVALO);
