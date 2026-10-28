'use strict';

// Vigia do Colheita+: mantém o servidor local (porta 3000) no ar.
// A cada minuto testa o site; se ele cair ou travar, religa.
// Uso:  node scripts/watchdog.js   (ou scripts/start-watchdog.vbs, janela oculta)
// Registro em scripts/watchdog.log
//
// O site público agora fica no Render (https://colheita-mais.onrender.com),
// então este vigia cuida só da versão do seu computador.

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = path.join(__dirname, '..');
const LOG = path.join(__dirname, 'watchdog.log');
const URL_LOCAL = 'http://localhost:3000/';
const INTERVALO = 60 * 1000;

let falhas = 0;

function log(msg) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${msg}\n`;
  try { fs.appendFileSync(LOG, linha); } catch (_) {}
}

function testar(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
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

function matar(pid) {
  return new Promise((resolve) => execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, () => resolve()));
}

function iniciarServidor() {
  const saida = fs.openSync(path.join(__dirname, 'server.log'), 'a');
  const p = spawn(process.execPath, ['server.js'], { cwd: RAIZ, detached: true, stdio: ['ignore', saida, saida], windowsHide: true });
  p.unref();
  log(`Servidor iniciado (PID ${p.pid}).`);
}

async function verificar() {
  const status = await testar(URL_LOCAL);
  if (status === 200) {
    if (falhas) log('Servidor respondendo novamente.');
    falhas = 0;
    return;
  }
  falhas++;
  const pids = await pidsNaPorta3000();
  log(`Servidor não respondeu (status ${status}, tentativa ${falhas}).`);
  if (!pids.length) {
    iniciarServidor();
  } else if (falhas >= 3) {
    // Processo existe mas travou: reinicia
    for (const pid of pids) await matar(pid);
    log('Servidor travado: reiniciando.');
    setTimeout(iniciarServidor, 2000);
    falhas = 0;
  }
}

log('Vigia iniciado.');
verificar();
setInterval(verificar, INTERVALO);
