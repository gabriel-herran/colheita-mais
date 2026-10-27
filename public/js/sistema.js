'use strict';

// Tela principal (dashboard): resumo geral, cadastrar propriedade,
// gerenciar produções (atalhos para as telas de gestão) e cadastrar produção.

const modalForm = document.getElementById('modalForm');
const modalGestao = document.getElementById('modalGestao');
const formProp = document.getElementById('formProp');
const propMsg = document.getElementById('propMsg');

// Texto digitado no cadastro fica salvo como rascunho até ser enviado.
persistirCampos(formProp, 'propriedade');

function resetForm() {
  limparCampos(formProp, 'propriedade');
  formProp.reset();
  document.getElementById('propId').value = '';
  propMsg.className = 'form-msg';
}

// ---- Cadastrar propriedade ----
function abrirCadastroPropriedade() {
  propMsg.className = 'form-msg';
  abrirModal(modalForm);
}
document.getElementById('btnCadastrar').addEventListener('click', abrirCadastroPropriedade);

formProp.addEventListener('submit', async (e) => {
  e.preventDefault();
  propMsg.className = 'form-msg';
  const payload = {
    nome_propriedade: document.getElementById('propNome').value.trim(),
    localizacao_propriedade: document.getElementById('propLocal').value.trim(),
    hectares_propriedade: document.getElementById('propArea').value,
    cultura: document.getElementById('propCultura').value.trim(),
    descricao_propriedade: document.getElementById('propObs').value.trim(),
  };
  if (!payload.nome_propriedade) {
    propMsg.textContent = 'O nome da propriedade é obrigatório.';
    propMsg.className = 'form-msg show error';
    return;
  }
  try {
    const nova = await api('/api/propriedades', { method: 'POST', body: JSON.stringify(payload) });
    resetForm();
    fecharModal(modalForm);
    toast('Propriedade cadastrada!');
    SelecaoGestao.salvar({ propriedade: nova.id_propriedade });
    carregarResumo();
  } catch (err) {
    propMsg.textContent = err.message;
    propMsg.className = 'form-msg show error';
  }
});

// ---- Gerenciar produções: janela com as funções de gestão ----
document.getElementById('gestaoGrid').innerHTML = GESTAO.map((g) => `
  <a href="${g.href}">
    ${icone(g.icone)}
    <span><strong>${escapeHtml(g.nome)}</strong><small>${escapeHtml(g.desc)}</small></span>
  </a>`).join('');
document.getElementById('btnGerenciar').addEventListener('click', () => abrirModal(modalGestao));
// Ao ir para uma tela de gestão, a janela não deve reabrir quando o produtor voltar
document.getElementById('gestaoGrid').addEventListener('click', (e) => {
  if (e.target.closest('a')) Rascunho.del('modal');
});

// ---- Cadastrar produção (com lista obrigatória de propriedades) ----
document.getElementById('btnCadastrarProducao').addEventListener('click', () => {
  FormProducao.abrir(null, { propriedade: SelecaoGestao.ler().propriedade });
});
FormProducao.aoSalvar(() => carregarResumo());

document.getElementById('rapidoConfig').addEventListener('click', abrirConfiguracoes);

// ---- Resumo Geral ----
async function carregarResumo() {
  try {
    const r = await api('/api/resumo');
    document.getElementById('rsProps').textContent = r.propriedades;
    document.getElementById('rsProds').textContent = r.producoes;
    document.getElementById('rsGastos').textContent = fmtBRL(r.gastos_mes);
    document.getElementById('rsEventos').textContent = r.eventos_semana;
  } catch (_) {}
}

async function carregarClimaResumo() {
  const cidade = cidadeSelecionada();
  document.getElementById('rsClimaDesc').textContent = 'Clima Atual — ' + cidade.nome;
  try {
    const dados = await buscarClima(cidade);
    const c = dados.current;
    document.getElementById('rsClima').textContent = Math.round(c.temperature_2m) + '° C';
    document.getElementById('rsClimaIco').innerHTML = iconeClima(c.weather_code, 'ico');
  } catch (_) {
    document.getElementById('rsClima').textContent = '—';
  }
}

carregarResumo();
carregarClimaResumo();

// Atalhos vindos do menu lateral (?acao=...) ou janela que estava aberta
const acao = new URLSearchParams(location.search).get('acao');
if (acao) history.replaceState(null, '', 'sistema.html');
if (acao === 'cadastrar-propriedade') abrirCadastroPropriedade();
else if (acao === 'cadastrar-producao') FormProducao.abrir(null, { propriedade: SelecaoGestao.ler().propriedade });
else if (acao === 'gerenciar') abrirModal(modalGestao);
else {
  const salvo = modalSalvo();
  if (salvo && salvo.id === 'modalForm') abrirCadastroPropriedade();
  else if (salvo && salvo.id === 'modalGestao') abrirModal(modalGestao);
  else FormProducao.restaurar(SelecaoGestao.ler().propriedade);
}
