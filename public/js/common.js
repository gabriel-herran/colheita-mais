'use strict';

// Utilidades compartilhadas por todas as páginas:
// API, toast, ícones, janelas (modais), rascunhos, cabeçalho (configurações,
// notificações e perfil), menu lateral e leitura em voz alta.

// ======================================================================
// API
// ======================================================================
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const msg = (data && data.erro) || 'Ocorreu um erro. Tente novamente.';
    throw new Error(msg);
  }
  return data;
}

let _usuarioPromise = null;
function getUsuarioAtual() {
  if (!_usuarioPromise) _usuarioPromise = api('/api/me').catch(() => null);
  return _usuarioPromise;
}

// ======================================================================
// Formatação
// ======================================================================
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR'));
function fmtData(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function fmtDataHora(ts) {
  const d = new Date(ts);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
// Data local (não UTC) no formato AAAA-MM-DD
function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tempoRelativo(ts) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} dia(s)`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

// ======================================================================
// Toast
// ======================================================================
function toast(msg, isError = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('err', !!isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ======================================================================
// Ícones (SVG em linha; herdam a cor do texto)
// ======================================================================
const ICONES = {
  plus: '<path d="M12 4v16M4 12h16" stroke-width="3"/>',
  celeiro: '<path d="M3 21V10l9-6 9 6v11z"/><path d="M8 21v-7h8v7M8 14l8 7M16 14l-8 7"/><path d="M10 9h4"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5" fill="currentColor" stroke="none"/><rect x="7.5" y="5" width="9" height="3.5" rx=".8" fill="var(--ico-fundo, #fff)" stroke="none"/><path d="M8.5 12.5h3M10 11v3M13 12.5h3M8.8 16.2l2.4 2.4M11.2 16.2l-2.4 2.4M13 17.4h3" stroke="var(--ico-fundo, #fff)" stroke-width="1.4"/>',
  calendario: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
  forum: '<path d="M4 4h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3.5V15H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M18 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1v3l-3.5-3H11a2 2 0 0 1-2-2v-1"/>',
  grafico: '<path d="M3 3v18h18"/><rect x="6.5" y="12" width="3" height="6" rx=".6"/><rect x="11.5" y="8" width="3" height="10" rx=".6"/><rect x="16.5" y="5" width="3" height="13" rx=".6"/>',
  clima: '<circle cx="8" cy="8" r="3.2"/><path d="M8 1.8v1.4M2.4 8H1M3.9 3.9l1 1M12.1 3.9l-1 1"/><path d="M7 20h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.2A3.5 3.5 0 0 0 7 20z"/>',
  engrenagem: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  broto: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6.5-8-6.5 0 4.5 3 6.5 8 6.5z" fill="#3f9b2f" stroke="#2e7a22"/><path d="M12 10c0-3.5 2.6-6 7.5-6 0 4-2.6 6-7.5 6z" fill="#5bbd40" stroke="#2e7a22"/>',
  moeda: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.6-.9-1.7-1.5-3-1.5-1.8 0-3 1-3 2.4 0 3.3 6.2 1.7 6.2 5 0 1.4-1.3 2.6-3.2 2.6-1.4 0-2.6-.6-3.2-1.6M12 5v2M12 17v2"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  filtro: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  cadeadoAberto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  comentario: '<path d="M4 5h16v11H9l-5 4z"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
  caminhao: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="17.5" r="2" fill="var(--ico-fundo, #fff)"/><circle cx="16.5" cy="17.5" r="2" fill="var(--ico-fundo, #fff)"/>',
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5 5"/>',
  caixa: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
  nota: '<path d="M5 3h10l4 4v14H5z"/><path d="M8 11h8M8 15h8M8 7h4"/>',
  som: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  vento: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
};
function icone(nome, extraClass = '') {
  const corpo = ICONES[nome] || '';
  return `<svg class="ico ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
}
// Substitui <span data-icon="nome"></span> pelo SVG correspondente.
function hidratarIcones(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icone(el.dataset.icon, el.className || '');
  });
}

// ======================================================================
// Rascunhos: mantém o trabalho em andamento se o produtor sair da página.
// Tudo fica no navegador (localStorage) e é apagado ao encerrar a sessão.
// ======================================================================
const PREFIXO_RASCUNHO = 'colheita:rascunho:';
const Rascunho = {
  chave(k) { return PREFIXO_RASCUNHO + location.pathname + location.search + '|' + k; },
  get(k, padrao = null) {
    try {
      const v = localStorage.getItem(this.chave(k));
      return v == null ? padrao : JSON.parse(v);
    } catch (_) { return padrao; }
  },
  set(k, v) { try { localStorage.setItem(this.chave(k), JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(this.chave(k)); } catch (_) {} },
  limparTudo() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO_RASCUNHO)).forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  },
};

// Campos com data-persist="nome" guardam o que foi digitado.
// `grupo` separa rascunhos de formulários diferentes (ex.: uma produção).
function persistirCampos(root = document, grupo = '') {
  root.querySelectorAll('[data-persist]').forEach((el) => {
    const k = 'campo:' + grupo + ':' + el.dataset.persist;
    const salvo = Rascunho.get(k);
    if (salvo != null) {
      if (el.type === 'checkbox') el.checked = !!salvo;
      else el.value = salvo;
    }
    // O grupo pode mudar (ex.: mesmo formulário para cadastrar e editar),
    // então o listener lê o grupo atual do próprio elemento.
    el.dataset.persistGrupo = grupo;
    if (el._persistBound) return;
    el._persistBound = true;
    const salvar = () => Rascunho.set('campo:' + el.dataset.persistGrupo + ':' + el.dataset.persist,
      el.type === 'checkbox' ? el.checked : el.value);
    el.addEventListener('input', salvar);
    el.addEventListener('change', salvar);
  });
}
function limparCampos(root = document, grupo = '') {
  root.querySelectorAll('[data-persist]').forEach((el) => {
    Rascunho.del('campo:' + grupo + ':' + el.dataset.persist);
    if (el.type === 'checkbox') el.checked = false;
    else if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
}

// ======================================================================
// Janelas (modais)
// ======================================================================
function abrirModal(ov, contexto) {
  if (typeof ov === 'string') ov = document.getElementById(ov);
  if (!ov) return;
  ov.classList.add('open');
  // Janelas com data-persist-modal reabrem ao voltar para a página
  if (ov.hasAttribute('data-persist-modal')) Rascunho.set('modal', { id: ov.id, ctx: contexto || null });
  const foco = ov.querySelector('[autofocus], input:not([type=hidden]), textarea, select, button:not(.modal-close)');
  if (foco) setTimeout(() => foco.focus(), 30);
}
function fecharModal(ov) {
  if (typeof ov === 'string') ov = document.getElementById(ov);
  if (!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  if (ov.hasAttribute('data-persist-modal')) {
    const salvo = Rascunho.get('modal');
    if (salvo && salvo.id === ov.id) Rascunho.del('modal');
  }
  ov.dispatchEvent(new Event('modal-fechado'));
}
function modalSalvo() { return Rascunho.get('modal'); }

// Fecha pelo X / Cancelar (data-close), clicando fora ou com Esc.
document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) return fecharModal(closer.closest('.modal-overlay'));
  if (e.target.classList && e.target.classList.contains('modal-overlay') && !e.target.hasAttribute('data-sem-fechar-fora')) {
    fecharModal(e.target);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.loading-overlay.open')) return;
  const abertos = [...document.querySelectorAll('.modal-overlay.open')];
  if (abertos.length) fecharModal(abertos[abertos.length - 1]);
});

// Janela de confirmação (substitui o confirm() do navegador)
function confirmar(mensagem, { titulo = 'Confirmar', ok = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay open';
    ov.innerHTML = `
      <div class="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="cfTitulo">
        <div class="modal-head"><h3 id="cfTitulo">${escapeHtml(titulo)}</h3>
          <button class="modal-close" data-cf="0" aria-label="Fechar">&times;</button></div>
        <div class="modal-body">
          <p class="confirm-text">${escapeHtml(mensagem)}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline btn-sm" data-cf="0">Cancelar</button>
            <button type="button" class="btn btn-sm ${perigo ? 'btn-danger' : ''}" data-cf="1">${escapeHtml(ok)}</button>
          </div>
        </div>
      </div>`;
    const fim = (v) => { ov.remove(); document.removeEventListener('keydown', esc, true); resolve(v); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fim(false); } };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cf]');
      if (b) fim(b.dataset.cf === '1');
      else if (e.target === ov) fim(false);
    });
    document.addEventListener('keydown', esc, true);
    document.body.appendChild(ov);
    ov.querySelector('[data-cf="1"]').focus();
  });
}

// ======================================================================
// Tela de carregamento (bloqueia o sistema até terminar)
// ======================================================================
function mostrarCarregando(msg = 'Carregando...', detalhe = 'Aguarde, isso pode levar alguns segundos.') {
  let ov = document.getElementById('loadingOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'loadingOverlay';
    ov.className = 'loading-overlay';
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-live', 'assertive');
    ov.innerHTML = '<div class="loading-box" tabindex="-1"><div class="spinner"></div><p></p><small></small></div>';
    document.body.appendChild(ov);
  }
  ov.querySelector('p').textContent = msg;
  ov.querySelector('small').textContent = detalhe;
  // Impede cliques e teclado no resto da página
  [...document.body.children].forEach((el) => { if (el !== ov) el.inert = true; });
  ov.classList.add('open');
  ov.querySelector('.loading-box').focus();
}
function esconderCarregando() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.remove('open');
  [...document.body.children].forEach((el) => { el.inert = false; });
}

// Baixa um arquivo (ex.: PDF) mostrando a tela de carregamento.
async function baixarArquivo(url, mensagem) {
  mostrarCarregando(mensagem, 'O arquivo PDF está sendo gerado. Não feche esta página.');
  const inicio = Date.now();
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      let erro = 'Não foi possível gerar o arquivo.';
      try { erro = (await res.json()).erro || erro; } catch (_) {}
      throw new Error(erro);
    }
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const nome = (disp.match(/filename="([^"]+)"/) || [])[1] || 'arquivo.pdf';
    // Mantém a janela visível por um instante para o produtor perceber o processo
    const falta = 700 - (Date.now() - inicio);
    if (falta > 0) await new Promise((r) => setTimeout(r, falta));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    toast('PDF gerado com sucesso!');
  } catch (err) {
    toast(err.message, true);
  } finally {
    esconderCarregando();
  }
}

// ======================================================================
// Cabeçalho: perfil, configurações e notificações
// ======================================================================
async function initProfileMenu() {
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  if (!btn) return;

  const user = await getUsuarioAtual();

  if (user) {
    if (user.foto_usuario) {
      const btnImg = btn.querySelector('img');
      if (btnImg) btnImg.src = user.foto_usuario;
    }
    montarModalPerfil(user);
    // Clicar no ícone do usuário abre direto a janela do perfil
    btn.addEventListener('click', abrirModalPerfil);
    if (menu) menu.remove();
    return;
  }

  if (!menu) return;
  menu.innerHTML = `
    <a href="/login.html">Fazer login</a>
    <a href="/cadastro.html">Criar conta</a>
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', (e) => e.stopPropagation());
}

// Insere os botões de configurações e notificações ao lado do perfil.
function montarBotoesCabecalho() {
  const profile = document.querySelector('.site-header .profile');
  if (!profile || document.getElementById('btnConfig')) return;
  const acoes = document.createElement('div');
  acoes.className = 'header-actions';
  profile.parentNode.insertBefore(acoes, profile);
  acoes.innerHTML = `
    <button type="button" class="header-icon-btn" id="btnConfig" title="Configurações" aria-label="Configurações">
      <img src="assets/img/engrenagem.png" alt="">
    </button>
    <div class="notif-wrap">
      <button type="button" class="header-icon-btn" id="btnNotif" title="Notificações" aria-label="Notificações" aria-expanded="false" aria-controls="notifPanel">
        <img src="assets/img/notificacao.png" alt="">
        <span class="notif-badge" id="notifBadge" hidden></span>
      </button>
      <div class="notif-panel" id="notifPanel" role="region" aria-label="Notificações"></div>
    </div>`;
  acoes.appendChild(profile);
  document.getElementById('btnConfig').addEventListener('click', abrirConfiguracoes);
  initNotificacoes();
}

// ---- Notificações ----
let _notificacoes = [];
async function carregarNotificacoes() {
  try {
    const r = await api('/api/notificacoes');
    _notificacoes = r.notificacoes;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.hidden = !r.nao_lidas;
      badge.textContent = r.nao_lidas > 99 ? '99+' : String(r.nao_lidas);
      document.getElementById('btnNotif').setAttribute('aria-label',
        r.nao_lidas ? `Notificações (${r.nao_lidas} não lidas)` : 'Notificações');
    }
    const panel = document.getElementById('notifPanel');
    if (panel && panel.classList.contains('open')) renderNotificacoes();
  } catch (_) {}
}

function renderNotificacoes() {
  const panel = document.getElementById('notifPanel');
  const temNaoLidas = _notificacoes.some((n) => !n.lida);
  panel.innerHTML = `
    <div class="notif-head">
      <h3>Notificações</h3>
      ${temNaoLidas ? '<button type="button" id="notifLerTodas">Marcar todas como lidas</button>' : ''}
    </div>
    <div class="notif-list">
      ${_notificacoes.length ? _notificacoes.map((n) => `
        <div class="notif-item ${n.lida ? '' : 'nao-lida'}" data-id="${n.id_notificacao}">
          <span class="notif-dot" aria-hidden="true"></span>
          <button type="button" class="notif-main" data-link="${escapeHtml(n.link || '')}">
            <span class="notif-msg">${n.lida ? '' : '<span class="sr-only">Não lida: </span>'}${escapeHtml(n.mensagem)}</span>
            <span class="notif-time">${escapeHtml(tempoRelativo(n.criado_em))}</span>
          </button>
          <button type="button" class="notif-del" aria-label="Remover notificação" title="Remover">&times;</button>
        </div>`).join('') : '<div class="notif-empty">Você não tem notificações.</div>'}
    </div>`;
}

function initNotificacoes() {
  const btn = document.getElementById('btnNotif');
  const panel = document.getElementById('notifPanel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = !panel.classList.contains('open');
    panel.classList.toggle('open', abrir);
    btn.classList.toggle('open', abrir);
    btn.setAttribute('aria-expanded', String(abrir));
    if (abrir) { renderNotificacoes(); carregarNotificacoes(); }
  });
  panel.addEventListener('click', async (e) => {
    e.stopPropagation();
    const item = e.target.closest('.notif-item');
    if (e.target.id === 'notifLerTodas') {
      await api('/api/notificacoes/lidas', { method: 'PUT' }).catch(() => {});
      return carregarNotificacoes();
    }
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.closest('.notif-del')) {
      await api('/api/notificacoes/' + id, { method: 'DELETE' }).catch(() => {});
      return carregarNotificacoes();
    }
    const main = e.target.closest('.notif-main');
    if (main) {
      await api(`/api/notificacoes/${id}/lida`, { method: 'PUT' }).catch(() => {});
      if (main.dataset.link) window.location.href = main.dataset.link;
      else carregarNotificacoes();
    }
  });
  document.addEventListener('click', () => {
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
  carregarNotificacoes();
  setInterval(carregarNotificacoes, 60000);
}

// ---- Janela de Configurações ----
function abrirConfiguracoes() {
  let ov = document.getElementById('modalConfig');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'modalConfig';
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cfgTitulo">
        <div class="modal-head">
          <h3 id="cfgTitulo">Configurações</h3>
          <button class="modal-close" data-close aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-body">
          <section class="cfg-section">
            <h4>Aparência</h4>
            <div class="cfg-row">
              <div><div class="cfg-label">Tema</div><div class="cfg-desc">Modo escuro usa fundo preto e textos claros.</div></div>
              <div class="segmented" role="group" aria-label="Tema" data-pref="tema">
                <button type="button" data-valor="claro">Claro</button>
                <button type="button" data-valor="escuro">Escuro</button>
                <button type="button" data-valor="sistema">Automático</button>
              </div>
            </div>
            <div class="cfg-row cfg-row-zoom">
              <div><label class="cfg-label" for="prefZoom">Zoom da tela</label><div class="cfg-desc">Aumenta ou diminui textos, botões e caixas de todas as telas.</div></div>
              <div class="zoom-control">
                <button type="button" class="zoom-step" data-zoom-passo="-5" aria-label="Diminuir zoom">&minus;</button>
                <input type="range" id="prefZoom" min="70" max="150" step="5" aria-describedby="prefZoomValor">
                <button type="button" class="zoom-step" data-zoom-passo="5" aria-label="Aumentar zoom">+</button>
                <output id="prefZoomValor" for="prefZoom">90%</output>
              </div>
            </div>
          </section>
          <section class="cfg-section">
            <h4>Acessibilidade e visão</h4>
            ${[
              ['negrito', 'Engrossar as escritas', 'Deixa todos os textos em negrito, facilitando a leitura.'],
              ['contraste', 'Alto contraste', 'Reforça as cores de textos, bordas e botões.'],
              ['espacamento', 'Espaçamento de leitura', 'Aumenta o espaço entre letras, palavras e linhas.'],
              ['foco', 'Destacar navegação por teclado', 'Contorno amarelo no item selecionado e links sublinhados.'],
              ['semAnimacao', 'Reduzir animações', 'Remove movimentos e transições da interface.'],
              ['leitura', 'Leitura em voz alta', 'Selecione um texto com o mouse e clique em "Ouvir" para ele ser lido.'],
            ].map(([k, rot, desc]) => `
              <div class="cfg-row">
                <div><label class="cfg-label" for="pref-${k}">${rot}</label><div class="cfg-desc">${desc}</div></div>
                <span class="switch"><input type="checkbox" id="pref-${k}" data-pref-bool="${k}"><span class="slider"></span></span>
              </div>`).join('')}
          </section>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline btn-sm" id="cfgRestaurar">Restaurar padrão</button>
            <button type="button" class="btn btn-sm" data-close>Concluir</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.querySelectorAll('[data-pref]').forEach((grupo) => {
      grupo.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-valor]');
        if (!b) return;
        ColheitaPrefs.salvar({ [grupo.dataset.pref]: b.dataset.valor });
        sincronizarConfiguracoes();
      });
    });
    // Zoom: aplica enquanto a barra é arrastada
    const zoom = ov.querySelector('#prefZoom');
    zoom.addEventListener('input', () => {
      ColheitaPrefs.salvar({ zoom: Number(zoom.value) });
      ov.querySelector('#prefZoomValor').textContent = zoom.value + '%';
    });
    ov.querySelectorAll('[data-zoom-passo]').forEach((b) => b.addEventListener('click', () => {
      const v = Math.min(150, Math.max(70, (Number(ColheitaPrefs.ler().zoom) || 90) + Number(b.dataset.zoomPasso)));
      ColheitaPrefs.salvar({ zoom: v });
      sincronizarConfiguracoes();
    }));
    ov.querySelectorAll('[data-pref-bool]').forEach((chk) => {
      chk.addEventListener('change', () => ColheitaPrefs.salvar({ [chk.dataset.prefBool]: chk.checked }));
    });
    ov.querySelector('#cfgRestaurar').addEventListener('click', () => {
      ColheitaPrefs.restaurar();
      sincronizarConfiguracoes();
      toast('Configurações restauradas.');
    });
  }
  sincronizarConfiguracoes();
  abrirModal(ov);
}
function sincronizarConfiguracoes() {
  const ov = document.getElementById('modalConfig');
  if (!ov) return;
  const p = ColheitaPrefs.ler();
  ov.querySelectorAll('[data-pref]').forEach((grupo) => {
    grupo.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(String(p[grupo.dataset.pref]) === b.dataset.valor));
    });
  });
  ov.querySelectorAll('[data-pref-bool]').forEach((chk) => { chk.checked = !!p[chk.dataset.prefBool]; });
  const zoom = Number(p.zoom) || 90;
  ov.querySelector('#prefZoom').value = zoom;
  ov.querySelector('#prefZoomValor').textContent = zoom + '%';
}

// ======================================================================
// Funções de gestão das produções (uma página para cada)
// ======================================================================
const GESTAO = [
  { id: 'producoes', nome: 'Produções', href: 'producoes.html', icone: 'celeiro', desc: 'Listar, editar, reorganizar e gerar PDFs' },
  { id: 'anotacoes', nome: 'Anotações escritas', href: 'anotacoes.html', icone: 'nota', desc: 'Atividades feitas, com data e hora' },
  { id: 'mao-de-obra', nome: 'Mão de obra', href: 'mao-de-obra.html', icone: 'pessoas', desc: 'Trabalhadores e pagamentos' },
  { id: 'transporte', nome: 'Transporte', href: 'transporte.html', icone: 'caminhao', desc: 'Envios da produção' },
  { id: 'despesas', nome: 'Despesas e gastos', href: 'despesas.html', icone: 'moeda', desc: 'Combustível, manutenção, frete...' },
  { id: 'materiais', nome: 'Materiais usados', href: 'materiais.html', icone: 'caixa', desc: 'Sementes, adubos, defensivos...' },
  { id: 'propriedades', nome: 'Propriedades', href: 'propriedades.html', icone: 'broto', desc: 'Editar, excluir e reorganizar' },
];

// Propriedade/produção escolhida nas telas de gestão (vale para todas elas).
// Fica com o prefixo de rascunho para ser apagada ao encerrar a sessão.
const SelecaoGestao = {
  CHAVE: PREFIXO_RASCUNHO + 'gestao-selecao',
  ler() {
    try { return JSON.parse(localStorage.getItem(this.CHAVE)) || {}; } catch (_) { return {}; }
  },
  salvar(sel) {
    try { localStorage.setItem(this.CHAVE, JSON.stringify(sel)); } catch (_) {}
  },
};

// ======================================================================
// Menu lateral (gaveta / drawer) com subopções
// ======================================================================
const PAGINAS = [
  { id: 'home', nome: 'Tela Inicial do Sistema', href: 'home.html' },
  {
    id: 'sistema', nome: 'Propriedades e Produções', href: 'sistema.html',
    subs: [
      { nome: 'Cadastrar propriedade', href: 'sistema.html?acao=cadastrar-propriedade' },
      { nome: 'Cadastrar produção', href: 'sistema.html?acao=cadastrar-producao' },
      ...GESTAO.map((g) => ({ nome: g.nome, href: g.href, id: g.id })),
    ],
  },
  {
    id: 'forum', nome: 'Fórum', href: 'forum.html',
    subs: [
      { nome: 'Iniciar uma discussão', href: 'forum.html?acao=nova' },
      { nome: 'Minhas discussões', href: 'forum.html?minhas=1' },
    ],
    dinamico: 'forum',
  },
  { id: 'calculadora', nome: 'Calculadora', href: 'calculadora.html' },
  { id: 'calendario', nome: 'Calendário', href: 'calendario.html' },
  { id: 'graficos', nome: 'Visão Gráfica', href: 'graficos.html' },
  { id: 'clima', nome: 'Clima', href: 'clima.html' },
];
// Telas que pertencem a um item do menu
const PAI_DA_PAGINA = { propriedade: 'sistema', discussao: 'forum', ...Object.fromEntries(GESTAO.map((g) => [g.id, 'sistema'])) };
const NOME_SUBPAGINA = { propriedade: 'Propriedades e Produções', discussao: 'Discussão do Fórum', ...Object.fromEntries(GESTAO.map((g) => [g.id, g.nome])) };

function montarDrawer() {
  const pagina = document.body.dataset.page;
  const main = document.querySelector('body > main');
  if (!pagina || !main || document.getElementById('drawer')) return;

  const pai = PAI_DA_PAGINA[pagina] || pagina;
  const atual = NOME_SUBPAGINA[pagina] || (PAGINAS.find((p) => p.id === pagina) || {}).nome || document.title;
  const corpo = document.createElement('div');
  corpo.className = 'app-body';
  main.parentNode.insertBefore(corpo, main);

  const item = (p) => {
    const ehAtual = p.id === pai;
    if (!p.subs) {
      return `<div class="drawer-item ${ehAtual ? 'atual' : ''}"><a class="drawer-link" href="${p.href}"${ehAtual ? ' aria-current="page"' : ''}>${escapeHtml(p.nome)}</a></div>`;
    }
    return `
      <div class="drawer-item has-sub ${ehAtual ? 'atual' : ''}" data-item="${p.id}">
        <button type="button" class="drawer-link drawer-exp" aria-expanded="false" aria-controls="sub-${p.id}">
          <span>${escapeHtml(p.nome)}</span><span class="drawer-chev" aria-hidden="true">&#9662;</span>
        </button>
        <div class="drawer-sub" id="sub-${p.id}">
          <a href="${p.href}" class="drawer-sub-main">Abrir ${escapeHtml(p.nome)}</a>
          ${p.subs.map((s) => `<a href="${s.href}"${s.id === pagina ? ' class="atual" aria-current="page"' : ''}>${escapeHtml(s.nome)}</a>`).join('')}
          ${p.dinamico ? `<div class="drawer-sub-dyn" data-dinamico="${p.dinamico}"></div>` : ''}
        </div>
      </div>`;
  };

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('aria-label', 'Menu de navegação');
  drawer.innerHTML = `
    <div class="drawer-inner">
      <div class="drawer-current">Tela Atual: <strong>${escapeHtml(atual)}</strong></div>
      <nav class="drawer-nav">
        <div class="drawer-label">Navegar para:</div>
        ${PAGINAS.map(item).join('')}
        <div class="drawer-item"><button type="button" class="drawer-link" id="drawerConfig">Configurações</button></div>
        <div class="drawer-item drawer-bottom"><button type="button" class="drawer-link drawer-logout" id="drawerLogout">Encerrar Sessão</button></div>
      </nav>
    </div>`;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'drawer-toggle';
  toggle.setAttribute('aria-controls', 'drawer');

  corpo.append(drawer, toggle, main);

  // Clique abre/fecha as subopções; passar o mouse também mostra (pelo CSS).
  drawer.querySelectorAll('.drawer-item.has-sub').forEach((el) => {
    const btn = el.querySelector('.drawer-exp');
    btn.addEventListener('click', () => {
      const abrir = !el.classList.contains('open');
      el.classList.toggle('open', abrir);
      btn.setAttribute('aria-expanded', String(abrir));
      if (abrir) carregarSubDinamico(el);
    });
    el.addEventListener('mouseenter', () => carregarSubDinamico(el));
  });

  const CHAVE = 'colheita:drawer';
  function definir(aberto, salvar = true) {
    drawer.classList.toggle('open', aberto);
    drawer.inert = !aberto;
    toggle.textContent = aberto ? '<' : '>';
    toggle.setAttribute('aria-expanded', String(aberto));
    toggle.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    toggle.title = aberto ? 'Fechar menu' : 'Abrir menu';
    if (salvar) try { localStorage.setItem(CHAVE, aberto ? '1' : '0'); } catch (_) {}
  }
  let inicial = false;
  try { inicial = localStorage.getItem(CHAVE) === '1'; } catch (_) {}
  if (window.matchMedia('(max-width: 860px)').matches) inicial = false;
  definir(inicial, false);

  toggle.addEventListener('click', () => definir(!drawer.classList.contains('open')));
  drawer.querySelector('#drawerConfig').addEventListener('click', abrirConfiguracoes);
  drawer.querySelector('#drawerLogout').addEventListener('click', confirmarLogout);
}

// Subopções que vêm do servidor (ex.: discussões em que o usuário comentou)
async function carregarSubDinamico(itemEl) {
  const alvo = itemEl.querySelector('[data-dinamico]');
  if (!alvo || alvo.dataset.carregado) return;
  alvo.dataset.carregado = '1';
  if (alvo.dataset.dinamico === 'forum') {
    try {
      const lista = await api('/api/forum/participando');
      alvo.innerHTML = '<div class="drawer-sub-title">Discussões que comentei</div>' + (lista.length
        ? lista.map((d) => `<a href="discussao.html?id=${d.id_discussao}" title="${escapeHtml(d.titulo)}">${d.trancada ? icone('cadeado') + ' ' : ''}${escapeHtml(d.titulo)}</a>`).join('')
        : '<span class="drawer-sub-empty">Você ainda não comentou em nenhuma discussão.</span>');
    } catch (_) {
      alvo.dataset.carregado = '';
    }
  }
}

async function confirmarLogout() {
  if (await confirmar('Deseja realmente encerrar a sessão?', { titulo: 'Encerrar Sessão', ok: 'Encerrar', perigo: true })) logout();
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
    Rascunho.limparTudo();
    window.location.href = '/index.html';
  } catch (err) {
    toast(err.message, true);
  }
}

// ======================================================================
// Perfil do Usuário (o ID não é exibido: é informação interna da conta)
// ======================================================================
function montarModalPerfil(user) {
  if (document.getElementById('modalPerfil')) return;

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'modalPerfil';
  ov.innerHTML = `
    <div class="modal modal-perfil" role="dialog" aria-modal="true" aria-labelledby="perfilTitulo">
      <div class="modal-head">
        <h3 id="perfilTitulo">Perfil do Usuário</h3>
        <button class="modal-close" id="perfilClose" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">
        <button type="button" class="foto-edit" id="btnAlterarFoto">&#9998; Alterar Foto</button>
        <input type="file" id="fotoInput" accept="image/*" hidden>
        <div class="perfil-avatar"><img id="perfilFoto" src="assets/img/perfil.png" alt="Foto do usuário"></div>
        <div class="perfil-nome" id="perfilNome"></div>
        <div class="perfil-collapse" id="blocoNome">
          <input type="text" id="novoNome" maxlength="120" placeholder="Digite novo nome" aria-label="Novo nome">
          <button type="button" class="btn perfil-confirm" id="btnConfirmarNome">Confirmar novo nome</button>
        </div>
        <hr class="perfil-sep">

        <div class="perfil-info">Email do usuário: <span id="perfilEmail"></span></div>
        <div class="perfil-collapse" id="blocoEmail">
          <input type="email" id="novoEmail" placeholder="Digite novo email" aria-label="Novo email">
          <button type="button" class="btn perfil-confirm" id="btnConfirmarEmail">Confirmar novo email</button>
        </div>
        <hr class="perfil-sep">

        <div class="perfil-collapse" id="blocoSenha">
          <input type="password" id="senhaAtual" placeholder="Digite sua senha atual" aria-label="Senha atual">
          <input type="password" id="novaSenha" placeholder="Digite nova senha" aria-label="Nova senha">
          <button type="button" class="btn perfil-confirm" id="btnConfirmarSenha">Confirmar nova senha</button>
        </div>

        <div class="form-msg" id="perfilMsg"></div>
        <hr class="perfil-sep">
        <button type="button" class="btn btn-danger btn-block btn-sm" id="perfilLogout">Encerrar Sessão</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  addPasswordToggles(ov);
  ov.querySelector('#perfilLogout').addEventListener('click', confirmarLogout);

  ov.querySelector('#perfilNome').textContent = user.nome_usuario || '[nome do usuário]';
  ov.querySelector('#perfilEmail').textContent = user.login_usuario || '';
  if (user.foto_usuario) ov.querySelector('#perfilFoto').src = user.foto_usuario;

  const perfilMsg = ov.querySelector('#perfilMsg');
  function showPerfilMsg(text, ok = false) {
    perfilMsg.textContent = text;
    perfilMsg.className = 'form-msg show ' + (ok ? 'ok' : 'error');
  }
  ov.querySelector('#perfilClose').addEventListener('click', fecharModalPerfil);
  ov.addEventListener('click', (e) => { if (e.target === ov) fecharModalPerfil(); });

  const fotoInput = ov.querySelector('#fotoInput');
  ov.querySelector('#btnAlterarFoto').addEventListener('click', () => fotoInput.click());
  fotoInput.addEventListener('change', async () => {
    const file = fotoInput.files && fotoInput.files[0];
    fotoInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return showPerfilMsg('Selecione um arquivo de imagem.');
    try {
      const dataUrl = await redimensionarImagem(file, 400);
      const r = await api('/api/me/foto', { method: 'PUT', body: JSON.stringify({ foto: dataUrl }) });
      ov.querySelector('#perfilFoto').src = r.foto_usuario;
      const btnImg = document.querySelector('#profileBtn img');
      if (btnImg) btnImg.src = r.foto_usuario;
      showPerfilMsg('Foto atualizada!', true);
    } catch (err) {
      showPerfilMsg(err.message || 'Não foi possível atualizar a foto.');
    }
  });

  ov.querySelector('#btnConfirmarNome').addEventListener('click', async () => {
    const nome = ov.querySelector('#novoNome').value.trim();
    if (!nome) return showPerfilMsg('Digite o novo nome.');
    try {
      const atualizado = await api('/api/me/nome', { method: 'PUT', body: JSON.stringify({ nome }) });
      ov.querySelector('#perfilNome').textContent = atualizado.nome_usuario;
      ov.querySelector('#novoNome').value = '';
      showPerfilMsg('Nome atualizado!', true);
    } catch (err) {
      showPerfilMsg(err.message);
    }
  });

  ov.querySelector('#btnConfirmarEmail').addEventListener('click', async () => {
    const email = ov.querySelector('#novoEmail').value.trim();
    if (!email) return showPerfilMsg('Digite o novo e-mail.');
    try {
      const atualizado = await api('/api/me/email', { method: 'PUT', body: JSON.stringify({ email }) });
      ov.querySelector('#perfilEmail').textContent = atualizado.login_usuario;
      ov.querySelector('#novoEmail').value = '';
      showPerfilMsg('E-mail atualizado!', true);
    } catch (err) {
      showPerfilMsg(err.message);
    }
  });

  ov.querySelector('#btnConfirmarSenha').addEventListener('click', async () => {
    const senhaAtual = ov.querySelector('#senhaAtual').value;
    const novaSenha = ov.querySelector('#novaSenha').value;
    if (!senhaAtual || !novaSenha) return showPerfilMsg('Preencha a senha atual e a nova senha.');
    try {
      await api('/api/me/senha', { method: 'PUT', body: JSON.stringify({ senhaAtual, novaSenha }) });
      ov.querySelector('#senhaAtual').value = '';
      ov.querySelector('#novaSenha').value = '';
      showPerfilMsg('Senha atualizada!', true);
    } catch (err) {
      showPerfilMsg(err.message);
    }
  });
}

function abrirModalPerfil() {
  const ov = document.getElementById('modalPerfil');
  if (ov) abrirModal(ov);
}
function fecharModalPerfil() {
  const ov = document.getElementById('modalPerfil');
  if (!ov) return;
  fecharModal(ov);
  ov.querySelector('#novoNome').value = '';
  ov.querySelector('#novoEmail').value = '';
  ov.querySelector('#senhaAtual').value = '';
  ov.querySelector('#novaSenha').value = '';
  ov.querySelector('#perfilMsg').className = 'form-msg';
}

// Redimensiona uma imagem no navegador e devolve um data URL (JPEG).
function redimensionarImagem(file, max) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ======================================================================
// Campos de senha com "olhinho"
// ======================================================================
function eyeIcon(off) {
  const attrs = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return off
    ? `<svg ${attrs}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg ${attrs}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function addPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.hasToggle) return;
    input.dataset.hasToggle = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pass-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pass-toggle';
    btn.setAttribute('aria-label', 'Mostrar senha');
    btn.innerHTML = eyeIcon(false);
    btn.addEventListener('click', () => {
      const revelar = input.type === 'password';
      input.type = revelar ? 'text' : 'password';
      btn.innerHTML = eyeIcon(revelar);
      btn.setAttribute('aria-label', revelar ? 'Ocultar senha' : 'Mostrar senha');
    });
    wrap.appendChild(btn);
  });
}

// ======================================================================
// Leitura em voz alta do texto selecionado (opção de acessibilidade)
// ======================================================================
function initLeituraEmVoz() {
  if (!('speechSynthesis' in window)) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tts-btn';
  btn.innerHTML = icone('som') + ' Ouvir';
  document.body.appendChild(btn);
  let texto = '';

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      if (!ColheitaPrefs.ler().leitura) return btn.classList.remove('show');
      const sel = window.getSelection();
      texto = sel ? sel.toString().trim() : '';
      if (!texto || !sel.rangeCount) return btn.classList.remove('show');
      const r = sel.getRangeAt(0).getBoundingClientRect();
      btn.style.left = Math.min(window.innerWidth - 110, Math.max(8, r.left)) + 'px';
      btn.style.top = Math.max(8, r.top - 44) + 'px';
      btn.classList.add('show');
    }, 10);
  });
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    speechSynthesis.speak(fala);
    btn.classList.remove('show');
  });
}

// ======================================================================
// Inicialização
// ======================================================================
document.addEventListener('DOMContentLoaded', async () => {
  hidratarIcones();
  addPasswordToggles();
  initLeituraEmVoz();
  initProfileMenu();
  // Botões do sistema e menu lateral só aparecem nas telas internas (logado)
  if (document.body.dataset.page) {
    const user = await getUsuarioAtual();
    if (user) {
      montarBotoesCabecalho();
      montarDrawer();
    }
  }
});
