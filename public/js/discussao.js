'use strict';

// Página de uma discussão do fórum: descrição completa, comentários e
// ações do criador (editar, trancar / destrancar e excluir).

const discId = new URLSearchParams(location.search).get('id');
const area = document.getElementById('discArea');
const AVATAR = 'assets/img/perfil.png';

async function carregar() {
  if (!discId) {
    area.innerHTML = '<p class="empty-state">Discussão não encontrada.</p>';
    return;
  }
  let d;
  try {
    d = await api('/api/forum/' + encodeURIComponent(discId));
  } catch (err) {
    area.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    return;
  }
  document.title = d.titulo + ' | Fórum | Colheita+';

  area.innerHTML = `
    <article class="box disc-full">
      <div class="disc-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${d.trancada ? `<span class="lock-badge">${icone('cadeado')} Trancada</span>` : ''}
        ${d.tags.map((t) => `<span class="tag-chip sm">${escapeHtml(t)}</span>`).join('')}
      </div>
      <h1>${escapeHtml(d.titulo)}</h1>
      <div class="disc-author">
        <img class="avatar-sm" src="${escapeHtml(d.autor_foto || AVATAR)}" alt="">
        <span>Iniciada por <strong>${escapeHtml(d.autor)}</strong>${d.sou_dono ? ' (você)' : ''} · ${escapeHtml(fmtDataHora(d.criado_em))}</span>
      </div>
      <div class="disc-desc">${escapeHtml(d.descricao)}</div>
      ${d.sou_dono ? `
      <div class="disc-owner-actions">
        <button type="button" class="btn btn-outline btn-sm" id="btnEditar">${icone('editar')} Editar discussão</button>
        <button type="button" class="btn btn-outline btn-sm" id="btnTrancar">
          ${icone(d.trancada ? 'cadeadoAberto' : 'cadeado')} ${d.trancada ? 'Destrancar discussão' : 'Trancar discussão'}
        </button>
        <button type="button" class="btn btn-danger btn-sm" id="btnExcluir">${icone('lixeira')} Excluir discussão</button>
      </div>` : ''}
    </article>

    <section class="box" aria-labelledby="tComents">
      <h2 class="coments-title" id="tComents">Comentários (${d.comentarios.length})</h2>
      <div id="listaComentarios">
        ${d.comentarios.length ? d.comentarios.map((c) => `
          <div class="comentario" data-id="${c.id_comentario}">
            <img class="avatar-sm" src="${escapeHtml(c.autor_foto || AVATAR)}" alt="">
            <div class="c-body">
              <div class="c-head"><strong>${escapeHtml(c.autor)}</strong><span>${escapeHtml(fmtDataHora(c.criado_em))}</span></div>
              <div class="c-text">${escapeHtml(c.texto)}</div>
            </div>
            ${c.sou_autor && !d.trancada ? `<button type="button" class="edit-btn" data-edit="${c.id_comentario}" aria-label="Editar meu comentário" title="Editar">${icone('editar')}</button>` : ''}
            ${c.sou_autor ? `<button type="button" class="del-btn" data-del="${c.id_comentario}" aria-label="Excluir meu comentário" title="Excluir">&times;</button>` : ''}
          </div>`).join('') : '<p class="reg-empty">Nenhum comentário ainda.</p>'}
      </div>

      ${d.trancada ? `
        <div class="locked-note">${icone('cadeado')} Esta discussão foi trancada pelo criador e não aceita novos comentários.</div>` : `
        <form id="formComentario" class="composer" style="margin-top:14px" novalidate>
          <label class="sr-only" for="novoComentario">Escreva um comentário</label>
          <textarea id="novoComentario" data-persist="comentario" placeholder="Escreva um comentário..."></textarea>
          <div class="composer-actions"><button type="submit" class="btn btn-sm">Comentar</button></div>
        </form>`}
    </section>`;

  persistirCampos(area, 'discussao');
  ligarAcoes(d);
}

function ligarAcoes(d) {
  const form = document.getElementById('formComentario');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = document.getElementById('novoComentario');
      const texto = ta.value.trim();
      if (!texto) return toast('Escreva um comentário.', true);
      try {
        await api(`/api/forum/${discId}/comentarios`, { method: 'POST', body: JSON.stringify({ texto }) });
        limparCampos(form, 'discussao');
        toast('Comentário publicado!');
        carregar();
      } catch (err) {
        toast(err.message, true);
        if (/trancada/i.test(err.message)) carregar();
      }
    });
  }

  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Excluir seu comentário?', { titulo: 'Excluir comentário', ok: 'Excluir', perigo: true }))) return;
    try {
      await api('/api/forum/comentarios/' + b.dataset.del, { method: 'DELETE' });
      carregar();
    } catch (err) { toast(err.message, true); }
  }));

  // Editar comentário: o texto vira uma caixa de edição no próprio lugar
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const c = d.comentarios.find((x) => String(x.id_comentario) === b.dataset.edit);
    const body = b.closest('.comentario').querySelector('.c-body');
    const textoEl = body.querySelector('.c-text');
    if (!c || body.querySelector('.composer')) return;
    textoEl.hidden = true;
    const ed = document.createElement('div');
    ed.className = 'composer';
    ed.style.marginTop = '6px';
    ed.innerHTML = `
      <label class="sr-only" for="edit-${c.id_comentario}">Editar comentário</label>
      <textarea id="edit-${c.id_comentario}"></textarea>
      <div class="composer-actions">
        <button type="button" class="btn btn-outline btn-sm" data-cancelar>Cancelar</button>
        <button type="button" class="btn btn-sm" data-salvar>Salvar</button>
      </div>`;
    const ta = ed.querySelector('textarea');
    ta.value = c.texto;
    body.appendChild(ed);
    ta.focus();
    ed.querySelector('[data-cancelar]').addEventListener('click', () => { ed.remove(); textoEl.hidden = false; });
    ed.querySelector('[data-salvar]').addEventListener('click', async () => {
      const texto = ta.value.trim();
      if (!texto) return toast('Escreva um comentário.', true);
      try {
        await api('/api/forum/comentarios/' + c.id_comentario, { method: 'PUT', body: JSON.stringify({ texto }) });
        toast('Comentário atualizado!');
        carregar();
      } catch (err) { toast(err.message, true); }
    });
  }));

  const btnEditar = document.getElementById('btnEditar');
  if (btnEditar) btnEditar.addEventListener('click', () => abrirEdicao(d));

  const btnTrancar = document.getElementById('btnTrancar');
  if (btnTrancar) btnTrancar.addEventListener('click', async () => {
    const trancar = !d.trancada;
    const ok = await confirmar(trancar
      ? 'Trancar a discussão? Ninguém poderá comentar até você destrancá-la (útil quando o assunto já foi resolvido).'
      : 'Destrancar a discussão e permitir novos comentários?', { titulo: trancar ? 'Trancar discussão' : 'Destrancar discussão', ok: trancar ? 'Trancar' : 'Destrancar' });
    if (!ok) return;
    try {
      await api(`/api/forum/${discId}/trancar`, { method: 'PUT', body: JSON.stringify({ trancada: trancar }) });
      toast(trancar ? 'Discussão trancada.' : 'Discussão destrancada.');
      carregar();
    } catch (err) { toast(err.message, true); }
  });

  const btnExcluir = document.getElementById('btnExcluir');
  if (btnExcluir) btnExcluir.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta discussão e todos os comentários? Essa ação não pode ser desfeita.', { titulo: 'Excluir discussão', ok: 'Excluir', perigo: true }))) return;
    try {
      await api('/api/forum/' + discId, { method: 'DELETE' });
      window.location.href = 'forum.html';
    } catch (err) { toast(err.message, true); }
  });
}

// ---- Editar discussão (título, descrição e tags) ----
const modalEditar = document.getElementById('modalEditar');
const formEditar = document.getElementById('formEditar');
const editMsg = document.getElementById('editMsg');
const eTags = document.getElementById('eTags');
let TAGS = null;
let tagsEdicao = [];

async function abrirEdicao(d) {
  if (!TAGS) {
    try { TAGS = await api('/api/forum/tags'); } catch (err) { return toast(err.message, true); }
  }
  tagsEdicao = d.tags.filter((t) => TAGS.includes(t));
  eTags.innerHTML = TAGS.map((t) => `<button type="button" class="tag-chip" data-tag="${escapeHtml(t)}" aria-pressed="${tagsEdicao.includes(t)}">${escapeHtml(t)}</button>`).join('');
  document.getElementById('eTitulo').value = d.titulo;
  document.getElementById('eDesc').value = d.descricao;
  editMsg.className = 'form-msg';
  abrirModal(modalEditar);
}

eTags.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const t = chip.dataset.tag;
  if (tagsEdicao.includes(t)) tagsEdicao = tagsEdicao.filter((x) => x !== t);
  else if (tagsEdicao.length >= 5) return toast('Escolha no máximo 5 tags.', true);
  else tagsEdicao = [...tagsEdicao, t];
  chip.setAttribute('aria-pressed', String(tagsEdicao.includes(t)));
});

formEditar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = document.getElementById('eTitulo').value.trim();
  const descricao = document.getElementById('eDesc').value.trim();
  const erro = !titulo ? 'O título é obrigatório.' : !descricao ? 'A descrição é obrigatória.'
    : !tagsEdicao.length ? 'Escolha ao menos uma tag.' : '';
  if (erro) {
    editMsg.textContent = erro;
    editMsg.className = 'form-msg show error';
    return;
  }
  const btn = document.getElementById('editSubmit');
  btn.disabled = true;
  try {
    await api('/api/forum/' + encodeURIComponent(discId), { method: 'PUT', body: JSON.stringify({ titulo, descricao, tags: tagsEdicao }) });
    fecharModal(modalEditar);
    toast('Discussão atualizada!');
    carregar();
  } catch (err) {
    editMsg.textContent = err.message;
    editMsg.className = 'form-msg show error';
  } finally {
    btn.disabled = false;
  }
});

carregar();
