'use strict';

// Calculadora simples no estilo da calculadora do Google.
// A conta é resolvida por um analisador próprio (sem eval), com suporte a
// parênteses, porcentagem, sinal negativo e multiplicação implícita: 2(3+1).

const exprEl = document.getElementById('calcExpr');
const prevEl = document.getElementById('calcPrev');
const btnClear = document.getElementById('btnClear');

// Estado (salvo como rascunho para continuar a conta ao voltar à página)
let estado = Rascunho.get('calc', { expr: '', prev: '', resultado: false, ans: null });

const OPS = ['+', '−', '×', '÷'];
const ultimo = () => estado.expr.slice(-1);
const ehDigito = (c) => /[0-9.]/.test(c);

function salvar() { Rascunho.set('calc', estado); }

function formatar(n) {
  if (!Number.isFinite(n)) return 'Erro';
  const r = Number(n.toPrecision(12));
  if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0)) return r.toExponential(6).replace('.', ',');
  return String(r).replace('.', ',');
}

function render() {
  // Parênteses que ainda faltam fechar aparecem em cinza (como no Google)
  const faltam = (estado.expr.match(/\(/g) || []).length - (estado.expr.match(/\)/g) || []).length;
  const visivel = escapeHtml(estado.expr.replace(/\./g, ',')) || '0';
  exprEl.innerHTML = visivel + (faltam > 0 ? `<span style="color:var(--text-muted)">${')'.repeat(faltam)}</span>` : '');
  prevEl.textContent = estado.prev;
  btnClear.textContent = estado.resultado || !estado.expr ? 'AC' : 'CE';
  btnClear.setAttribute('aria-label', btnClear.textContent === 'AC' ? 'Limpar tudo' : 'Apagar último');
  salvar();
}

// ---------- Analisador (descida recursiva) ----------
function calcular(texto) {
  const tokens = texto.match(/\d*\.?\d+(?:e[+-]?\d+)?|\d+\.|[+\−×÷%()]/g) || [];
  // Fecha parênteses pendentes
  let abertos = 0;
  tokens.forEach((t) => { if (t === '(') abertos++; if (t === ')') abertos--; });
  while (abertos-- > 0) tokens.push(')');

  let i = 0;
  const ver = () => tokens[i];
  const pegar = () => tokens[i++];

  function expressao() {
    let v = termo();
    while (ver() === '+' || ver() === '−') v = pegar() === '+' ? v + termo() : v - termo();
    return v;
  }
  function termo() {
    let v = unario();
    for (;;) {
      if (ver() === '×') { pegar(); v *= unario(); }
      else if (ver() === '÷') { pegar(); const d = unario(); if (d === 0) throw new Error('divisão por zero'); v /= d; }
      else if (ver() === '(' || (ver() && /\d|\./.test(ver()[0]))) v *= unario(); // multiplicação implícita
      else return v;
    }
  }
  function unario() {
    if (ver() === '−') { pegar(); return -unario(); }
    if (ver() === '+') { pegar(); return unario(); }
    return posfixo();
  }
  function posfixo() {
    let v = primario();
    while (ver() === '%') { pegar(); v /= 100; }
    return v;
  }
  function primario() {
    const t = pegar();
    if (t === '(') {
      const v = expressao();
      if (pegar() !== ')') throw new Error('parênteses');
      return v;
    }
    if (t != null && /\d|\./.test(t[0])) return parseFloat(t);
    throw new Error('expressão inválida');
  }

  const v = expressao();
  if (i < tokens.length) throw new Error('expressão inválida');
  return v;
}

// ---------- Teclas ----------
function tecla(k) {
  if (k === 'clear') {
    if (estado.resultado || !estado.expr) {
      estado = { expr: '', prev: estado.ans != null ? 'Ans = ' + formatar(estado.ans) : '', resultado: false, ans: estado.ans };
    } else {
      estado.expr = estado.expr.slice(0, -1);
    }
    return render();
  }
  if (k === 'back') {
    if (estado.resultado) return tecla('clear');
    estado.expr = estado.expr.slice(0, -1);
    return render();
  }
  if (k === '=') {
    if (!estado.expr) return;
    try {
      const r = calcular(estado.expr);
      if (!Number.isFinite(r)) throw new Error('resultado inválido');
      const completa = estado.expr + ')'.repeat(Math.max(0, (estado.expr.match(/\(/g) || []).length - (estado.expr.match(/\)/g) || []).length));
      estado.prev = completa.replace(/\./g, ',') + ' =';
      estado.ans = Number(r.toPrecision(12));
      estado.expr = String(estado.ans);
      estado.resultado = true;
    } catch (_) {
      estado.prev = estado.expr.replace(/\./g, ',') + ' =';
      estado.expr = '';
      estado.resultado = true;
      render();
      exprEl.textContent = 'Erro';
      return;
    }
    return render();
  }

  // Depois de um resultado: número novo começa outra conta; operador continua dela
  if (estado.resultado) {
    estado.prev = 'Ans = ' + formatar(estado.ans);
    if (ehDigito(k) || k === '(') estado.expr = '';
    estado.resultado = false;
  }

  const u = ultimo();
  if (OPS.includes(k)) {
    if (!estado.expr && k !== '−') return render();
    if (OPS.includes(u)) {
      // Troca o operador (mas permite "×−" para número negativo)
      if (k === '−' && (u === '×' || u === '÷')) estado.expr += k;
      else estado.expr = estado.expr.replace(/[+\−×÷]+$/, '') + k;
      if (!estado.expr.replace(/[+\−×÷]/g, '')) estado.expr = k === '−' ? '−' : '';
      return render();
    }
    if (u === '(' && k !== '−') return render();
    estado.expr += k;
    return render();
  }
  if (k === '.') {
    const numeroAtual = (estado.expr.match(/[\d.]*$/) || [''])[0];
    if (numeroAtual.includes('.')) return render();
    estado.expr += numeroAtual ? '.' : '0.';
    return render();
  }
  if (k === ')') {
    const faltam = (estado.expr.match(/\(/g) || []).length - (estado.expr.match(/\)/g) || []).length;
    if (faltam <= 0 || OPS.includes(u) || u === '(' || !u) return render();
  }
  if (k === '%' && (!u || OPS.includes(u) || u === '(')) return render();
  estado.expr += k;
  render();
}

document.getElementById('calcKeys').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (b) tecla(b.dataset.k);
});

// Teclado físico
const MAPA = { '*': '×', x: '×', '/': '÷', '-': '−', ',': '.', Enter: '=', '=': '=', Backspace: 'back', Escape: 'clear', Delete: 'clear' };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('.modal-overlay.open')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  let k = MAPA[e.key] || e.key;
  if (!/^[0-9.%()+]$/.test(k) && !['×', '÷', '−', '=', 'back', 'clear'].includes(k)) return;
  e.preventDefault();
  tecla(k);
  // Efeito visual no botão correspondente
  const alvo = k === 'back' ? btnClear : document.querySelector(`[data-k="${CSS.escape(k)}"]`);
  if (alvo) {
    alvo.classList.add('pressed');
    setTimeout(() => alvo.classList.remove('pressed'), 110);
  }
});

render();
