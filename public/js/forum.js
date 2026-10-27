'use strict';

// Fórum: busca, filtros, lista de discussões e criação de uma nova discussão.

const discList = document.getElementById('discList');
const busca = document.getElementById('busca');
const filtroPanel = document.getElementById('filtroPanel');
const btnFiltrar = document.getElementById('btnFiltrar');
const filtroTagsEl = document.getElementById('filtroTags');
const modalDiscussao = document.getElementById('modalDiscussao');
const formDiscussao = document.getElementById('formDiscussao');
const discMsg = document.getElementById('discMsg');
const dTags = document.getElementById('dTags');

let TAGS = [];
let filtroTags = Rascunho.get('filtroTags', []);
let novasTags = Rascunho.get('novasTags', []);

persistirCampos(document.querySelector('.forum-toolbar'), 'forum');
persistirCampos(formDiscussao, 'nova-discussao');

function chipsHtml(tags, selecionadas) {
  return tags.map((t) => `<button type="button" class="tag-chip" data-tag="${escapeHtml(t)}" aria-pressed="${selecionadas.includes(t)}">${escapeHtml(t)}</button>`).join('');
}

function atualizarContadorFiltros() {
  const n = filtroTags.length + (document.getElementById('filtroStatus').value ? 1 : 0)
    + (document.getElementById('filtroMinhas').checked ? 1 : 0)
    + (document.getElementById('filtroOrdem').value !== 'recentes' ? 1 : 0);
  const el = document.getElementById('filtroCount');
  el.hidden = !n;
  el.textContent = n;
  btnFiltrar.classList.toggle('active', n > 0);
}

async function carregar() {
  const q = new URLSearchParams();
  if (busca.value.trim()) q.set('q', busca.value.trim());
  if (filtroTags.length) q.set('tags', filtroTags.join(','));
  const status = document.getElementById('filtroStatus').value;
  if (status) q.set('status', status);
  if (document.getElementById('filtroMinhas').checked) q.set('minhas', '1');
  q.set('ordem', document.getElementById('filtroOrdem').value);
  atualizarContadorFiltros();

  try {
    const lista = await api('/api/forum?' + q);
    if (!lista.length) {
      discList.innerHTML = `<p class="empty-state">${q.has('q') || filtroTags.length || status
        ? 'Nenhuma discussão encontrada com esses filtros.'
        : 'Ainda não há discussões.<br>Seja o primeiro a iniciar uma!'}</p>`;
      return;
    }
    discList.innerHTML = lista.map((d) => `
      <a class="disc-card" href="discussao.html?id=${d.id_discussao}">
        <h3>${d.trancada ? `<span class="lock-badge" title="Discussão trancada">${icone('cadeado')} Trancada</span>` : ''}${escapeHtml(d.titulo)}</h3>
        <div class="disc-tags">${d.tags.map((t) => `<span class="tag-chip sm">${escapeHtml(t)}</span>`).join('')}</div>
        <p class="disc-resumo">${escapeHtml(d.resumo)}</p>
        <div class="disc-meta">
          <span>por <strong>${escapeHtml(d.autor)}</strong>${d.sou_dono ? ' (você)' : ''}</span>
          <span>${escapeHtml(tempoRelativo(d.criado_em))}</span>
          <span>${icone('comentario')} ${d.comentarios} comentário(s)</span>
        </div>
      </a>`).join('');
  } catch (err) {
    discList.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  }
}

// ---- Busca (espera o produtor parar de digitar) ----
let tBusca;
busca.addEventListener('input', () => {
  clearTimeout(tBusca);
  tBusca = setTimeout(carregar, 300);
});

// ---- Painel de filtros ----
btnFiltrar.addEventListener('click', (e) => {
  e.stopPropagation();
  filtroPanel.hidden = !filtroPanel.hidden;
  btnFiltrar.setAttribute('aria-expanded', String(!filtroPanel.hidden));
});
filtroPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => {
  if (!filtroPanel.hidden) {
    filtroPanel.hidden = true;
    btnFiltrar.setAttribute('aria-expanded', 'false');
  }
});
filtroTagsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const t = chip.dataset.tag;
  filtroTags = filtroTags.includes(t) ? filtroTags.filter((x) => x !== t) : [...filtroTags, t];
  chip.setAttribute('aria-pressed', String(filtroTags.includes(t)));
  Rascunho.set('filtroTags', filtroTags);
});
document.getElementById('filtroAplicar').addEventListener('click', () => {
  filtroPanel.hidden = true;
  carregar();
});
document.getElementById('filtroLimpar').addEventListener('click', () => {
  filtroTags = [];
  Rascunho.del('filtroTags');
  filtroTagsEl.innerHTML = chipsHtml(TAGS, filtroTags);
  document.getElementById('filtroStatus').value = '';
  document.getElementById('filtroOrdem').value = 'recentes';
  document.getElementById('filtroMinhas').checked = false;
  ['status', 'ordem', 'minhas'].forEach((k) => Rascunho.del('campo:forum:' + k));
  carregar();
});

// ---- Nova discussão ----
document.getElementById('btnNovaDiscussao').addEventListener('click', () => {
  discMsg.className = 'form-msg';
  abrirModal(modalDiscussao);
});
dTags.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const t = chip.dataset.tag;
  if (novasTags.includes(t)) novasTags = novasTags.filter((x) => x !== t);
  else if (novasTags.length >= 5) return toast('Escolha no máximo 5 tags.', true);
  else novasTags = [...novasTags, t];
  chip.setAttribute('aria-pressed', String(novasTags.includes(t)));
  Rascunho.set('novasTags', novasTags);
});

formDiscussao.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = document.getElementById('dTitulo').value.trim();
  const descricao = document.getElementById('dDesc').value.trim();
  const erro = !titulo ? 'O título é obrigatório.' : !descricao ? 'A descrição é obrigatória.'
    : !novasTags.length ? 'Escolha ao menos uma tag.' : '';
  if (erro) {
    discMsg.textContent = erro;
    discMsg.className = 'form-msg show error';
    return;
  }
  const btn = document.getElementById('discSubmit');
  btn.disabled = true;
  try {
    const r = await api('/api/forum', { method: 'POST', body: JSON.stringify({ titulo, descricao, tags: novasTags }) });
    limparCampos(formDiscussao, 'nova-discussao');
    novasTags = [];
    Rascunho.del('novasTags');
    fecharModal(modalDiscussao);
    window.location.href = 'discussao.html?id=' + r.id_discussao;
  } catch (err) {
    discMsg.textContent = err.message;
    discMsg.className = 'form-msg show error';
  } finally {
    btn.disabled = false;
  }
});

// ---- Início ----
(async () => {
  try {
    TAGS = await api('/api/forum/tags');
  } catch (_) {}
  filtroTags = filtroTags.filter((t) => TAGS.includes(t));
  novasTags = novasTags.filter((t) => TAGS.includes(t));
  filtroTagsEl.innerHTML = chipsHtml(TAGS, filtroTags);
  dTags.innerHTML = chipsHtml(TAGS, novasTags);
  // Atalhos do menu lateral: ?acao=nova (iniciar discussão) e ?minhas=1
  const q = new URLSearchParams(location.search);
  if (location.search) history.replaceState(null, '', location.pathname);
  if (q.get('minhas') === '1') {
    const chk = document.getElementById('filtroMinhas');
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
  }
  const salvo = modalSalvo();
  if (q.get('acao') === 'nova' || (salvo && salvo.id === 'modalDiscussao')) {
    discMsg.className = 'form-msg';
    abrirModal(modalDiscussao);
  }
  carregar();
})();
