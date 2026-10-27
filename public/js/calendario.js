'use strict';

// Calendário: navegação por meses/anos, seleção de dia (contorno verde)
// e anotações do produtor em cada dia.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const grid = document.getElementById('calGrid');
const selMes = document.getElementById('calMes');
const selAno = document.getElementById('calAno');
const btnAnotar = document.getElementById('btnAnotar');
const modalAnotacao = document.getElementById('modalAnotacao');
const formAnotacao = document.getElementById('formAnotacao');
const anotMsg = document.getElementById('anotMsg');

const hoje = new Date();
// Mês exibido e dia selecionado ficam salvos para quando o produtor voltar
let vista = Rascunho.get('vista', { ano: hoje.getFullYear(), mes: hoje.getMonth() });
let selecionado = Rascunho.get('selecionado', null);
let eventos = [];

persistirCampos(formAnotacao, 'anotacao');

const parse = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const dataExtenso = (iso) => {
  const t = parse(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t[0].toUpperCase() + t.slice(1);
};

// Selects de mês e ano
selMes.innerHTML = MESES.map((m, i) => `<option value="${i}">${m[0].toUpperCase() + m.slice(1)}</option>`).join('');
function preencherAnos() {
  const base = hoje.getFullYear();
  const anos = new Set();
  for (let a = base - 10; a <= base + 5; a++) anos.add(a);
  anos.add(vista.ano);
  selAno.innerHTML = [...anos].sort((a, b) => a - b).map((a) => `<option value="${a}">${a}</option>`).join('');
}

async function render() {
  Rascunho.set('vista', vista);
  preencherAnos();
  selMes.value = vista.mes;
  selAno.value = vista.ano;
  document.getElementById('calTitulo').textContent = `${MESES[vista.mes][0].toUpperCase() + MESES[vista.mes].slice(1)} de ${vista.ano}`;

  // Grade de 6 semanas começando no domingo
  const primeiro = new Date(vista.ano, vista.mes, 1);
  const inicio = new Date(vista.ano, vista.mes, 1 - primeiro.getDay());
  const dias = [...Array(42)].map((_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));

  try {
    eventos = await api(`/api/eventos?de=${isoLocal(dias[0])}&ate=${isoLocal(dias[41])}`);
  } catch (err) {
    eventos = [];
    toast(err.message, true);
  }
  const porDia = {};
  eventos.forEach((e) => (porDia[e.data_evento] = porDia[e.data_evento] || []).push(e));

  const hojeIso = isoLocal(hoje);
  grid.innerHTML = DIAS.map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join('') +
    dias.map((d) => {
      const iso = isoLocal(d);
      const evs = porDia[iso] || [];
      const cls = ['cal-day',
        d.getMonth() !== vista.mes ? 'fora' : '',
        iso === hojeIso ? 'hoje' : '',
        iso === selecionado ? 'selecionado' : '',
        evs.length ? 'tem-ev' : ''].join(' ');
      const rotulo = `${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} anotação(ões)` : ''}`;
      return `<button type="button" class="${cls}" data-dia="${iso}" aria-label="${rotulo}" aria-pressed="${iso === selecionado}">
        <span class="cal-num">${d.getDate()}</span>
        ${evs.slice(0, 2).map((e) => `<span class="cal-ev">${escapeHtml(e.titulo_evento || e.descricao_evento)}</span>`).join('')}
        ${evs.length > 2 ? `<span class="cal-more">+${evs.length - 2} mais</span>` : ''}
      </button>`;
    }).join('');
  renderLado();
}

function renderLado() {
  const lista = document.getElementById('sideLista');
  btnAnotar.hidden = !selecionado;
  if (!selecionado) {
    document.getElementById('sideData').textContent = 'Clique em um dia do calendário.';
    lista.innerHTML = '';
    return;
  }
  document.getElementById('sideData').textContent = dataExtenso(selecionado);
  const evs = eventos.filter((e) => e.data_evento === selecionado);
  lista.innerHTML = evs.length ? evs.map((e) => `
    <div class="cal-note">
      <div class="cn-body">
        ${e.titulo_evento ? `<strong>${escapeHtml(e.titulo_evento)}</strong>` : ''}
        <p>${escapeHtml(e.descricao_evento)}</p>
      </div>
      <button type="button" class="edit-btn" data-edit="${e.id_evento}" aria-label="Editar anotação" title="Editar">${icone('editar')}</button>
      <button type="button" class="del-btn" data-del="${e.id_evento}" aria-label="Excluir anotação" title="Excluir">&times;</button>
    </div>`).join('') : '<p class="reg-empty" style="padding:0">Nenhuma anotação neste dia.</p>';
}

// ---- Interações ----
grid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-dia]');
  if (!b) return;
  selecionado = b.dataset.dia;
  Rascunho.set('selecionado', selecionado);
  const d = parse(selecionado);
  if (d.getMonth() !== vista.mes || d.getFullYear() !== vista.ano) {
    vista = { ano: d.getFullYear(), mes: d.getMonth() };
    render();
  } else {
    grid.querySelectorAll('.cal-day').forEach((el) => {
      const sel = el.dataset.dia === selecionado;
      el.classList.toggle('selecionado', sel);
      el.setAttribute('aria-pressed', String(sel));
    });
    renderLado();
  }
});

function mudarMes(delta) {
  const d = new Date(vista.ano, vista.mes + delta, 1);
  vista = { ano: d.getFullYear(), mes: d.getMonth() };
  render();
}
document.getElementById('calPrev').addEventListener('click', () => mudarMes(-1));
document.getElementById('calNext').addEventListener('click', () => mudarMes(1));
selMes.addEventListener('change', () => { vista.mes = Number(selMes.value); render(); });
selAno.addEventListener('change', () => { vista.ano = Number(selAno.value); render(); });
document.getElementById('calHoje').addEventListener('click', () => {
  vista = { ano: hoje.getFullYear(), mes: hoje.getMonth() };
  selecionado = isoLocal(hoje);
  Rascunho.set('selecionado', selecionado);
  render();
});

document.getElementById('sideLista').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit]');
  if (ed) return abrirAnotacao(Number(ed.dataset.edit));
  const b = e.target.closest('[data-del]');
  if (!b) return;
  if (!(await confirmar('Excluir esta anotação?', { titulo: 'Excluir anotação', ok: 'Excluir', perigo: true }))) return;
  try {
    await api('/api/eventos/' + b.dataset.del, { method: 'DELETE' });
    toast('Anotação excluída.');
    render();
  } catch (err) { toast(err.message, true); }
});

// ---- Janela de anotação (fazer ou editar) ----
let editId = null;
const grupoAnotacao = () => (editId ? 'anotacao-' + editId : 'anotacao');

function abrirAnotacao(id = null) {
  if (!selecionado) return;
  const ev = id ? eventos.find((x) => x.id_evento === id) : null;
  editId = ev ? id : null;
  anotMsg.className = 'form-msg';
  document.getElementById('tAnotacao').textContent = ev ? 'Editar anotação' : 'Fazer uma anotação';
  document.getElementById('anotacaoData').hidden = !!ev;
  document.getElementById('anotacaoData').textContent = dataExtenso(selecionado);
  document.getElementById('campoData').hidden = !ev;
  if (ev) {
    document.getElementById('aData').value = ev.data_evento;
    document.getElementById('aTitulo').value = ev.titulo_evento || '';
    document.getElementById('aDesc').value = ev.descricao_evento;
  } else {
    document.getElementById('aTitulo').value = '';
    document.getElementById('aDesc').value = '';
  }
  // Rascunho separado para cada anotação em edição
  persistirCampos(formAnotacao, grupoAnotacao());
  abrirModal(modalAnotacao, { dia: selecionado, editId });
}
btnAnotar.addEventListener('click', () => abrirAnotacao());

formAnotacao.addEventListener('submit', async (e) => {
  e.preventDefault();
  const descricao = document.getElementById('aDesc').value.trim();
  const dataEvento = editId ? document.getElementById('aData').value : selecionado;
  const erro = !descricao ? 'A descrição é obrigatória.' : !dataEvento ? 'Informe a data.' : '';
  if (erro) {
    anotMsg.textContent = erro;
    anotMsg.className = 'form-msg show error';
    return;
  }
  const dados = { data_evento: dataEvento, titulo_evento: document.getElementById('aTitulo').value.trim(), descricao_evento: descricao };
  try {
    if (editId) {
      await api('/api/eventos/' + editId, { method: 'PUT', body: JSON.stringify(dados) });
    } else {
      await api('/api/eventos', { method: 'POST', body: JSON.stringify(dados) });
    }
    limparCampos(formAnotacao, grupoAnotacao());
    fecharModal(modalAnotacao);
    toast(editId ? 'Anotação atualizada!' : 'Anotação salva!');
    if (editId && dataEvento !== selecionado) {
      // Acompanha a anotação até o novo dia
      selecionado = dataEvento;
      Rascunho.set('selecionado', selecionado);
      const d = parse(selecionado);
      vista = { ano: d.getFullYear(), mes: d.getMonth() };
    }
    editId = null;
    await render();
    carregarNotificacoes(); // o aviso pode aparecer na hora se o dia estiver próximo
  } catch (err) {
    anotMsg.textContent = err.message;
    anotMsg.className = 'form-msg show error';
  }
});

render().then(() => {
  const salvo = modalSalvo();
  if (salvo && salvo.id === 'modalAnotacao' && salvo.ctx && salvo.ctx.dia) {
    selecionado = salvo.ctx.dia;
    renderLado();
    abrirAnotacao(salvo.ctx.editId || null);
  }
});
