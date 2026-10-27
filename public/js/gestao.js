'use strict';

// Telas de gestão das produções. Cada função (Produções, Anotações, Mão de
// obra, Transporte, Despesas, Materiais e Propriedades) tem a sua página,
// todas com o mesmo formato:
//   1) lista para escolher a propriedade (ocupa a largura toda);
//   2) caixa de informações (vazia até escolher a propriedade; depois mostra
//      a lista de produções e os dados da função);
//   3) caixa de navegação rápida para as outras funções.

const FUNCAO = document.body.dataset.page;
const selPropriedade = document.getElementById('selPropriedade');
const infoBox = document.getElementById('infoBox');
const modalRegistro = document.getElementById('modalRegistro');
const formRegistro = document.getElementById('formRegistro');
const regMsg = document.getElementById('regMsg');

let propriedades = [];
let producoes = [];
let detalhe = null;        // registros da produção selecionada
let sel = SelecaoGestao.ler();
let reordenando = false;

const hojeIso = () => isoLocal();
function mostrarMsg(el, texto) {
  el.textContent = texto;
  el.className = 'form-msg show error';
}

// ======================================================================
// Pagamento da mão de obra
// ======================================================================
const METODOS_PAGAMENTO = ['Pix', 'Dinheiro (físico)', 'Transferência bancária', 'Cartão', 'Cheque', 'Boleto', 'Outro'];
const FREQUENCIAS = {
  'Pagamento único': { dias: 0 },
  'Diário': { dias: 1 },
  'Semanal (1 semana)': { dias: 7 },
  'Quinzenal (2 semanas)': { dias: 14 },
  'Mensal (1 mês)': { meses: 1 },
  'Trimestral (3 meses)': { meses: 3 },
};
function somarPrazo(iso, frequencia) {
  if (!iso) return '';
  const f = FREQUENCIAS[frequencia] || { dias: 0 };
  const [a, m, d] = iso.split('-').map(Number);
  return isoLocal(new Date(a, m - 1 + (f.meses || 0), d + (f.dias || 0)));
}
function situacaoPagamento(r) {
  if (r.pago) return { cls: 'pago', txt: 'Pago' + (r.data_pagamento ? ' em ' + fmtData(r.data_pagamento).slice(0, 5) : '') };
  if (!r.data_vencimento) return { cls: 'pendente', txt: 'A pagar' };
  if (r.data_vencimento < hojeIso()) return { cls: 'atrasado', txt: 'Atrasado desde ' + fmtData(r.data_vencimento).slice(0, 5) };
  if (r.data_vencimento === hojeIso()) return { cls: 'pendente', txt: 'Vence hoje' };
  return { cls: 'pendente', txt: 'Vence em ' + fmtData(r.data_vencimento).slice(0, 5) };
}

// ======================================================================
// Tipos de registro de uma produção
// ======================================================================
const soma = (l, campo) => l.reduce((s, r) => s + Number(r[campo] || 0), 0);
const TIPOS = {
  transporte: {
    api: 'transportes', titulo: 'Transporte', singular: 'transporte', icone: 'caminhao',
    lista: 'transportes', id: 'id_producao_transporte',
    campos: [
      { n: 'tipo_transporte', rot: 'Tipo de transporte', req: true, lista: ['Caminhão', 'Caminhonete', 'Carreta', 'Trator com carreta', 'Van', 'Motocicleta'] },
      { n: 'destino_transporte', rot: 'Destino', ph: 'Ex.: Cooperativa, armazém, cliente' },
      { n: 'data', rot: 'Data', tipo: 'date', req: true, hoje: true },
      { n: 'quantidade_producao', rot: 'Quantidade transportada', tipo: 'number', ph: 'Ex.: 80 (sacas, caixas...)' },
      { n: 'contato_emergencia', rot: 'Contato de emergência', tipo: 'tel', ph: '(17) 91234-5678' },
    ],
    colunas: [
      ['Data', (r) => fmtData(r.data)], ['Tipo', (r) => r.tipo_transporte], ['Destino', (r) => r.destino_transporte || '—'],
      ['Qtd.', (r) => fmtNum(r.quantidade_producao), 'num'], ['Contato', (r) => r.contato_emergencia || '—'],
    ],
    kpis: (l) => [['Transportes', l.length], ['Qtd. transportada', fmtNum(soma(l, 'quantidade_producao'))]],
  },
  'mao-de-obra': {
    api: 'mao-de-obra', titulo: 'Mão de obra', singular: 'mão de obra', icone: 'pessoas',
    lista: 'mao_de_obra', id: 'id_mao_de_obra',
    campos: [
      { n: 'descricao_mao_de_obra', rot: 'Função / serviço realizado', req: true, ph: 'Ex.: Colheita manual, capina, aplicação' },
      { n: 'quantidade_mao_de_obra', rot: 'Quantidade de trabalhadores', tipo: 'number', req: true, step: '1' },
      { n: 'data_trabalhada', rot: 'Data trabalhada', tipo: 'date', req: true, hoje: true },
      { n: 'gasto_total', rot: 'Valor a pagar (R$)', tipo: 'number', ph: '0,00' },
      { n: 'metodo_pagamento', rot: 'Método de pagamento', opcoes: METODOS_PAGAMENTO },
      { n: 'frequencia_pagamento', rot: 'Frequência de pagamento', opcoes: Object.keys(FREQUENCIAS) },
      { n: 'data_vencimento', rot: 'Pagar até', tipo: 'date', dica: 'Calculado pela data trabalhada + frequência. Pode ser alterado.' },
      { n: 'pago', rot: 'Já está pago', tipo: 'checkbox' },
    ],
    colunas: [
      ['Data', (r) => fmtData(r.data_trabalhada)], ['Função', (r) => r.descricao_mao_de_obra || '—'],
      ['Pessoas', (r) => fmtNum(r.quantidade_mao_de_obra), 'num'], ['Valor', (r) => fmtBRL(r.gasto_total), 'num'],
      ['Pagamento', (r) => [r.metodo_pagamento, r.frequencia_pagamento].filter(Boolean).join(' · ') || '—'],
      ['Situação', null, '', (r) => {
        const s = situacaoPagamento(r);
        return `<span class="badge ${s.cls}">${escapeHtml(s.txt)}</span>
          <button type="button" class="pagar-btn" data-acao="pagar" data-item="${r.id_mao_de_obra}" data-pago="${r.pago ? '0' : '1'}">${r.pago ? 'Desfazer' : 'Marcar como pago'}</button>`;
      }],
    ],
    kpis: (l) => {
      const aPagar = l.filter((r) => !r.pago);
      return [['Total', fmtBRL(soma(l, 'gasto_total'))], ['A pagar', fmtBRL(soma(aPagar, 'gasto_total'))],
        ['Atrasados', aPagar.filter((r) => situacaoPagamento(r).cls === 'atrasado').length]];
    },
  },
  despesas: {
    api: 'despesas', titulo: 'Despesas e gastos', singular: 'despesa', icone: 'moeda',
    lista: 'despesas', id: 'id_despesa',
    campos: [
      { n: 'descricao_despesa', rot: 'Descrição', req: true, ph: 'Ex.: Diesel do trator' },
      { n: 'categoria_despesa', rot: 'Categoria', opcoes: ['Combustível', 'Manutenção', 'Energia elétrica', 'Água', 'Aluguel de máquinas', 'Frete', 'Armazenagem', 'Impostos e taxas', 'Outros'] },
      { n: 'valor_despesa', rot: 'Valor (R$)', tipo: 'number', req: true, ph: '0,00' },
      { n: 'data_despesa', rot: 'Data', tipo: 'date', req: true, hoje: true },
    ],
    colunas: [
      ['Data', (r) => fmtData(r.data_despesa)], ['Descrição', (r) => r.descricao_despesa],
      ['Categoria', (r) => r.categoria_despesa || '—'], ['Valor', (r) => fmtBRL(r.valor_despesa), 'num'],
    ],
    kpis: (l) => [['Total gasto', fmtBRL(soma(l, 'valor_despesa'))], ['Registros', l.length]],
  },
  materiais: {
    api: 'insumos', titulo: 'Materiais usados', singular: 'material', icone: 'caixa',
    lista: 'insumos', id: 'id_insumo',
    campos: [
      { n: 'nome_insumo', rot: 'Material', req: true, ph: 'Ex.: Adubo NPK 20-05-20' },
      { n: 'tipo_insumo', rot: 'Tipo', opcoes: ['Semente / Muda', 'Fertilizante', 'Defensivo agrícola', 'Corretivo de solo', 'Ferramenta', 'Embalagem', 'Outro'] },
      { n: 'quantidade_insumo', rot: 'Quantidade usada', tipo: 'number', req: true },
      { n: 'unidade_insumo', rot: 'Unidade', opcoes: ['kg', 'g', 't', 'L', 'mL', 'sacas', 'unidades', 'm³'] },
      { n: 'custo_insumo', rot: 'Custo (R$)', tipo: 'number', ph: '0,00' },
      { n: 'data_uso', rot: 'Data de uso', tipo: 'date', req: true, hoje: true },
    ],
    colunas: [
      ['Data', (r) => fmtData(r.data_uso)], ['Material', (r) => r.nome_insumo], ['Tipo', (r) => r.tipo_insumo || '—'],
      ['Quantidade', (r) => `${fmtNum(r.quantidade_insumo)} ${r.unidade_insumo || ''}`.trim(), 'num'],
      ['Custo', (r) => fmtBRL(r.custo_insumo), 'num'],
    ],
    kpis: (l) => [['Custo total', fmtBRL(soma(l, 'custo_insumo'))], ['Registros', l.length]],
  },
  anotacoes: {
    api: 'atividades', titulo: 'Anotações escritas', singular: 'anotação', icone: 'nota',
    lista: 'atividades', id: 'id_atividade',
    campos: [{ n: 'descricao_atividade', rot: 'Atividade feita', req: true, area: true }],
  },
};
const CFG = TIPOS[FUNCAO];

// ======================================================================
// Seleção de propriedade / produção
// ======================================================================
function lerParametrosDaUrl() {
  const q = new URLSearchParams(location.search);
  if (q.has('propriedade')) {
    sel = { propriedade: Number(q.get('propriedade')) || null, producao: Number(q.get('producao')) || null };
    SelecaoGestao.salvar(sel);
  }
  // Limpa a URL para os rascunhos ficarem ligados à página, não aos parâmetros
  if (location.search) history.replaceState(null, '', location.pathname);
}

async function carregarPropriedades() {
  try {
    propriedades = await api('/api/propriedades');
  } catch (err) {
    toast(err.message, true);
    propriedades = [];
  }
  selPropriedade.innerHTML = `<option value="">${propriedades.length ? 'Selecione uma propriedade...' : 'Nenhuma propriedade cadastrada'}</option>` +
    propriedades.map((p) => `<option value="${p.id_propriedade}">${escapeHtml(p.nome_propriedade)}${p.localizacao_propriedade ? ' — ' + escapeHtml(p.localizacao_propriedade) : ''}</option>`).join('');
  if (sel.propriedade && !propriedades.some((p) => p.id_propriedade === sel.propriedade)) sel = {};
  selPropriedade.value = sel.propriedade ? String(sel.propriedade) : '';
}

selPropriedade.addEventListener('change', () => {
  sel = { propriedade: Number(selPropriedade.value) || null, producao: null };
  SelecaoGestao.salvar(sel);
  reordenando = false;
  render();
});

const propAtual = () => propriedades.find((p) => p.id_propriedade === sel.propriedade);

// ======================================================================
// Renderização da caixa de informações
// ======================================================================
const vazioHtml = (texto, icon = 'celeiro') => `<div class="info-vazia">${icone(icon)}${texto}</div>`;

function cabecalho(titulo, acoes = '') {
  const g = GESTAO.find((x) => x.id === FUNCAO);
  return `<div class="info-head"><h2 class="box-title">${icone(g ? g.icone : 'nota')} ${escapeHtml(titulo)}</h2>
    <div class="info-acoes">${acoes}</div></div>`;
}

async function render() {
  if (!sel.propriedade) {
    infoBox.innerHTML = cabecalho('Informações') + vazioHtml('Selecione uma Propriedade', 'broto');
    return;
  }
  if (FUNCAO === 'propriedades') return renderPropriedade();
  infoBox.innerHTML = cabecalho('Carregando...') + '<p class="reg-empty">Carregando...</p>';
  try {
    producoes = await api(`/api/propriedades/${sel.propriedade}/producoes`);
  } catch (err) {
    infoBox.innerHTML = cabecalho('Informações') + vazioHtml(escapeHtml(err.message));
    return;
  }
  if (FUNCAO === 'producoes') return renderProducoes();
  return renderRegistros();
}

// Lista de produções da propriedade (usada nas telas de registros)
function seletorProducao() {
  return `
    <div class="prod-sel sel-box">
      <label class="sel-label" for="selProducao">Produção</label>
      <select id="selProducao" class="sel-full">
        <option value="">Selecione uma produção...</option>
        ${producoes.map((p) => `<option value="${p.id_producao}">${escapeHtml(p.nome_producao || 'Produção')} (${escapeHtml(p.conteudo_producao || '')})</option>`).join('')}
      </select>
    </div>`;
}

function semProducoes() {
  return vazioHtml(`Esta propriedade ainda não tem produções.<br><br>
    <button type="button" class="btn btn-sm" data-acao="nova-producao">${icone('plus')} Cadastrar produção</button>`);
}

// ---------- Telas de registros (anotações, mão de obra, transporte...) ----------
async function renderRegistros() {
  const p = propAtual();
  if (!producoes.length) {
    infoBox.innerHTML = cabecalho(CFG.titulo + ' — ' + p.nome_propriedade) + semProducoes();
    return;
  }
  if (!producoes.some((x) => x.id_producao === sel.producao)) {
    sel.producao = producoes.length === 1 ? producoes[0].id_producao : null;
    SelecaoGestao.salvar(sel);
  }
  infoBox.innerHTML = cabecalho(CFG.titulo + ' — ' + p.nome_propriedade) + seletorProducao() + '<div id="regArea"></div>';
  const selProd = document.getElementById('selProducao');
  selProd.value = sel.producao ? String(sel.producao) : '';
  selProd.addEventListener('change', () => {
    sel.producao = Number(selProd.value) || null;
    SelecaoGestao.salvar(sel);
    renderAreaRegistros();
  });
  await renderAreaRegistros();
}

async function carregarDetalhe() {
  detalhe = null;
  if (!sel.producao) return;
  try {
    detalhe = await api('/api/producoes/' + sel.producao);
  } catch (err) {
    toast(err.message, true);
  }
}

async function renderAreaRegistros(recarregar = true) {
  const area = document.getElementById('regArea');
  if (!area) return;
  if (!sel.producao) {
    area.innerHTML = vazioHtml('Selecione uma produção para ver os registros.', CFG.icone);
    return;
  }
  if (recarregar) {
    area.innerHTML = '<p class="reg-empty">Carregando...</p>';
    await carregarDetalhe();
  }
  if (!detalhe) {
    area.innerHTML = vazioHtml('Não foi possível carregar a produção.');
    return;
  }
  const lista = detalhe[CFG.lista];
  const resumo = `<div class="info-resumo">
    <span>Produção: <strong>${escapeHtml(detalhe.nome_producao)}</strong></span>
    <span>Cultura: <strong>${escapeHtml(detalhe.conteudo_producao || '—')}</strong></span>
    <span>Início: <strong>${fmtData(detalhe.data_inicio)}</strong></span>
  </div>`;

  if (FUNCAO === 'anotacoes') {
    area.innerHTML = resumo + `
      <div class="composer">
        <label class="sel-label" for="novaAnotacao">Nova anotação</label>
        <textarea id="novaAnotacao" data-persist="anotacao" placeholder="Escreva o que foi feito. A data e a hora serão salvas automaticamente."></textarea>
        <div class="composer-actions"><button type="button" class="btn btn-sm" data-acao="salvar-anotacao">Salvar anotação</button></div>
      </div>
      <div class="reg-box atividades-box">
        ${lista.length ? lista.map((a) => `
          <div class="reg-line">
            <span class="rl-text">[${escapeHtml(fmtDataHora(a.criado_em).replace(' ', '] '))} - ${escapeHtml(a.descricao_atividade)}</span>
            <button type="button" class="edit-btn" data-acao="editar" data-item="${a.id_atividade}" aria-label="Editar anotação" title="Editar">${icone('editar')}</button>
            <button type="button" class="del-btn" data-acao="excluir" data-item="${a.id_atividade}" aria-label="Excluir anotação" title="Excluir">&times;</button>
          </div>`).join('') : '<p class="reg-empty">Nenhuma anotação ainda.</p>'}
      </div>`;
    persistirCampos(area, 'anot-' + sel.producao);
    return;
  }

  area.innerHTML = resumo + `
    <div class="kpi-grid">${CFG.kpis(lista).map(([r, v]) => `<div class="kpi"><div class="kpi-label">${r}</div><div class="kpi-value">${escapeHtml(v)}</div></div>`).join('')}</div>
    <div class="info-head">
      <span class="sel-label">${lista.length} registro(s)</span>
      <button type="button" class="btn btn-sm" data-acao="cadastrar">${icone('plus')} Cadastrar ${CFG.singular}</button>
    </div>
    <div class="reg-box reg-table-wrap">
      ${lista.length ? `
      <table class="reg-table">
        <thead><tr>${CFG.colunas.map(([t, , c]) => `<th class="${c || ''}">${t}</th>`).join('')}<th class="acoes"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${lista.map((r) => `<tr>${CFG.colunas.map(([, f, c, html]) => `<td class="${c || ''}">${html ? html(r) : escapeHtml(f(r))}</td>`).join('')}
          <td class="acoes"><button type="button" class="edit-btn" data-acao="editar" data-item="${r[CFG.id]}" aria-label="Editar registro" title="Editar">${icone('editar')}</button><button type="button" class="del-btn" data-acao="excluir" data-item="${r[CFG.id]}" aria-label="Excluir registro" title="Excluir">&times;</button></td></tr>`).join('')}
        </tbody>
      </table>` : `<p class="reg-empty">Nenhum registro de ${CFG.singular} nesta produção ainda.</p>`}
    </div>`;
}

// ---------- Tela Produções ----------
function renderProducoes() {
  const p = propAtual();
  const acoes = `
    ${producoes.length > 1 ? `<button type="button" class="btn btn-gray btn-sm ${reordenando ? 'active' : ''}" data-acao="reorganizar">${reordenando ? 'Concluir' : 'Reorganizar'}</button>` : ''}
    <button type="button" class="btn btn-sm" data-acao="nova-producao">${icone('plus')} Cadastrar produção</button>`;
  if (!producoes.length) {
    infoBox.innerHTML = cabecalho('Produções — ' + p.nome_propriedade, acoes) + semProducoes();
    return;
  }
  const total = (x) => Number(x.total_mao_de_obra) + Number(x.total_insumos) + Number(x.total_despesas);
  infoBox.innerHTML = cabecalho('Produções — ' + p.nome_propriedade, acoes) + `
    <div class="prod-cards ${reordenando ? 'reordering' : ''}" id="prodCards">
      ${producoes.map((x) => `
        <article class="prod-card2" data-id="${x.id_producao}">
          <div class="pc-body">
            <h3>${escapeHtml(x.nome_producao || 'Produção')}<small>${escapeHtml(x.conteudo_producao || '')}</small></h3>
            <div class="pc-meta">
              <span>Área: <strong>${x.area_plantada != null ? fmtNum(x.area_plantada) + ' ha' : '—'}</strong></span>
              <span>Ruas: <strong>${fmtNum(x.quantidade_ruas)}</strong></span>
              <span>Mão de obra prevista: <strong>${fmtNum(x.quantidade_mao_de_obra)}</strong></span>
              <span>Início: <strong>${fmtData(x.data_inicio)}</strong></span>
              <span>Término previsto: <strong>${fmtData(x.data_fim_prevista)}</strong></span>
              <span>Gasto total: <strong>${fmtBRL(total(x))}</strong></span>
              <span>Anotações: <strong>${x.qtd_atividades}</strong></span>
              <span>Transportes: <strong>${x.qtd_transportes}</strong></span>
            </div>
            <div class="pc-acoes">
              <button type="button" class="btn btn-olive btn-sm" data-acao="relatorio">${icone('pdf')} Relatório da produção</button>
              <button type="button" class="btn btn-olive btn-sm" data-acao="historico">${icone('pdf')} Histórico bruto</button>
              <button type="button" class="btn btn-outline btn-sm" data-acao="editar-producao">${icone('editar')} Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-acao="excluir-producao">${icone('lixeira')} Excluir</button>
            </div>
          </div>
          <div class="prod-arrows">
            <button type="button" class="arrow-btn" data-acao="subir" aria-label="Mover para cima">&#8593;</button>
            <button type="button" class="arrow-btn" data-acao="descer" aria-label="Mover para baixo">&#8595;</button>
          </div>
        </article>`).join('')}
    </div>`;
  atualizarSetas();
}

function atualizarSetas() {
  const cards = [...document.querySelectorAll('#prodCards .prod-card2')];
  cards.forEach((c, i) => {
    c.querySelector('[data-acao="subir"]').disabled = i === 0;
    c.querySelector('[data-acao="descer"]').disabled = i === cards.length - 1;
  });
}

// ---------- Tela Propriedades ----------
function renderPropriedade() {
  const p = propAtual();
  infoBox.innerHTML = cabecalho('Propriedade selecionada', `
    <a class="btn btn-gray btn-sm" href="producoes.html">${icone('celeiro')} Ver produções</a>`) + `
    <form id="formPropriedade" novalidate>
      <div class="form-msg" id="propMsg"></div>
      <div class="field">
        <label for="eNome">Nome da propriedade: <span class="req">*</span></label>
        <input type="text" id="eNome" name="nome_propriedade" data-persist="nome" maxlength="160">
      </div>
      <div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label for="eLocal">Localização:</label><input type="text" id="eLocal" name="localizacao_propriedade" data-persist="local" placeholder="Cidade / Estado"></div>
        <div class="field"><label for="eArea">Área (hectares):</label><input type="text" inputmode="decimal" id="eArea" name="hectares_propriedade" data-persist="area"></div>
      </div>
      <div class="field"><label for="eCultura">Cultura principal:</label><input type="text" id="eCultura" name="cultura" data-persist="cultura" placeholder="Ex.: Soja, Milho, Café"></div>
      <div class="field"><label for="eObs">Observações:</label><input type="text" id="eObs" name="descricao_propriedade" data-persist="obs"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-danger btn-sm" data-acao="excluir-propriedade">${icone('lixeira')} Excluir propriedade</button>
        <button type="submit" class="btn btn-sm">Salvar alterações</button>
      </div>
    </form>`;
  const f = document.getElementById('formPropriedade');
  f.nome_propriedade.value = p.nome_propriedade || '';
  f.localizacao_propriedade.value = p.localizacao_propriedade || '';
  f.hectares_propriedade.value = p.hectares_propriedade == null ? '' : String(Number(p.hectares_propriedade)).replace('.', ',');
  f.cultura.value = p.cultura || '';
  f.descricao_propriedade.value = p.descricao_propriedade || '';
  persistirCampos(f, 'editar-prop-' + p.id_propriedade);
  f.addEventListener('submit', salvarPropriedade);
}

async function salvarPropriedade(e) {
  e.preventDefault();
  const f = e.target;
  const msg = document.getElementById('propMsg');
  msg.className = 'form-msg';
  const dados = Object.fromEntries([...f.elements].filter((el) => el.name).map((el) => [el.name, el.value.trim()]));
  if (!dados.nome_propriedade) return mostrarMsg(msg, 'O nome da propriedade é obrigatório.');
  dados.hectares_propriedade = dados.hectares_propriedade.replace(/\./g, '').replace(',', '.');
  try {
    await api('/api/propriedades/' + sel.propriedade, { method: 'PUT', body: JSON.stringify(dados) });
    limparCampos(f, 'editar-prop-' + sel.propriedade);
    toast('Propriedade atualizada!');
    await carregarPropriedades();
    renderOrdemPropriedades();
    render();
  } catch (err) {
    mostrarMsg(msg, err.message);
  }
}

// Caixa extra da tela Propriedades: ordem de exibição
function renderOrdemPropriedades() {
  const box = document.getElementById('ordemBox');
  if (!box) return;
  box.innerHTML = `
    <div class="info-head"><h2 class="box-title">Ordem das propriedades</h2>
      <div class="info-acoes">
        <a class="btn btn-sm" href="sistema.html?acao=cadastrar-propriedade">${icone('plus')} Cadastrar propriedade</a>
        ${propriedades.length > 1 ? `<button type="button" class="btn btn-gray btn-sm" id="btnReorgProps">Reorganizar</button>` : ''}
      </div></div>
    ${propriedades.length ? `<div class="open-list" id="propOrdem" style="max-height:none;overflow:visible">
      ${propriedades.map((p) => `
        <div class="open-item" data-id="${p.id_propriedade}">
          <button type="button" class="open-pill" data-escolher="${p.id_propriedade}">
            <span class="op-name">${escapeHtml(p.nome_propriedade)}</span>
            <span class="op-ha">${p.hectares_propriedade != null ? fmtNum(p.hectares_propriedade) + ' ha' : ''}</span>
          </button>
          <div class="open-arrows">
            <button type="button" class="arrow-btn" data-up aria-label="Mover para cima">&#8593;</button>
            <button type="button" class="arrow-btn" data-down aria-label="Mover para baixo">&#8595;</button>
          </div>
        </div>`).join('')}
    </div>` : '<p class="reg-empty">Nenhuma propriedade cadastrada.</p>'}`;

  const lista = document.getElementById('propOrdem');
  if (!lista) return;
  const setas = () => [...lista.children].forEach((it, i, arr) => {
    it.querySelector('[data-up]').disabled = i === 0;
    it.querySelector('[data-down]').disabled = i === arr.length - 1;
  });
  setas();
  lista.addEventListener('click', (e) => {
    const it = e.target.closest('.open-item');
    if (!it) return;
    if (e.target.closest('[data-up]') && it.previousElementSibling) lista.insertBefore(it, it.previousElementSibling);
    else if (e.target.closest('[data-down]') && it.nextElementSibling) lista.insertBefore(it.nextElementSibling, it);
    else if (e.target.closest('[data-escolher]') && !lista.classList.contains('reordering')) {
      sel = { propriedade: Number(it.dataset.id) };
      SelecaoGestao.salvar(sel);
      selPropriedade.value = it.dataset.id;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setas();
  });
  const btn = document.getElementById('btnReorgProps');
  if (btn) btn.addEventListener('click', async () => {
    const ativo = lista.classList.toggle('reordering');
    btn.textContent = ativo ? 'Concluir' : 'Reorganizar';
    btn.classList.toggle('active', ativo);
    if (ativo) return;
    const ids = [...lista.children].map((el) => Number(el.dataset.id));
    try {
      await api('/api/propriedades/ordem', { method: 'PUT', body: JSON.stringify({ ordem: ids }) });
      toast('Ordem salva!');
      await carregarPropriedades();
    } catch (err) { toast(err.message, true); }
  });
}

// ======================================================================
// Ações (cliques dentro da caixa de informações)
// ======================================================================
infoBox.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const acao = b.dataset.acao;
  const card = b.closest('.prod-card2');
  const prodId = card ? Number(card.dataset.id) : sel.producao;
  const item = Number(b.dataset.item) || null;

  switch (acao) {
    case 'nova-producao':
      return FormProducao.abrir(null, { propriedade: sel.propriedade });
    case 'relatorio':
      return baixarArquivo(`/api/producoes/${prodId}/relatorio.pdf`, 'Gerando relatório da produção...');
    case 'historico':
      return baixarArquivo(`/api/producoes/${prodId}/historico.pdf`, 'Gerando histórico bruto da produção...');
    case 'editar-producao':
      return FormProducao.abrir(prodId, { propriedade: sel.propriedade });
    case 'excluir-producao': {
      const x = producoes.find((p) => p.id_producao === prodId);
      if (!(await confirmar(`Excluir a produção "${x.nome_producao}" e todos os seus registros? Essa ação não pode ser desfeita.`,
        { titulo: 'Excluir produção', ok: 'Excluir', perigo: true }))) return;
      try {
        await api('/api/producoes/' + prodId, { method: 'DELETE' });
        if (sel.producao === prodId) { sel.producao = null; SelecaoGestao.salvar(sel); }
        toast('Produção excluída.');
        render();
      } catch (err) { toast(err.message, true); }
      return;
    }
    case 'reorganizar':
      if (reordenando) {
        const ids = [...document.querySelectorAll('#prodCards .prod-card2')].map((el) => Number(el.dataset.id));
        try {
          await api(`/api/propriedades/${sel.propriedade}/producoes/ordem`, { method: 'PUT', body: JSON.stringify({ ordem: ids }) });
          toast('Ordem salva!');
        } catch (err) { toast(err.message, true); }
      }
      reordenando = !reordenando;
      return render();
    case 'subir':
    case 'descer': {
      const lista = card.parentNode;
      if (acao === 'subir' && card.previousElementSibling) lista.insertBefore(card, card.previousElementSibling);
      if (acao === 'descer' && card.nextElementSibling) lista.insertBefore(card.nextElementSibling, card);
      return atualizarSetas();
    }

    case 'salvar-anotacao': {
      const ta = document.getElementById('novaAnotacao');
      const texto = ta.value.trim();
      if (!texto) { toast('Escreva a anotação.', true); return ta.focus(); }
      try {
        await api(`/api/producoes/${sel.producao}/atividades`, { method: 'POST', body: JSON.stringify({ descricao_atividade: texto }) });
        limparCampos(ta.parentNode, 'anot-' + sel.producao);
        toast('Anotação salva!');
        renderAreaRegistros();
      } catch (err) { toast(err.message, true); }
      return;
    }
    case 'cadastrar':
      return abrirFormRegistro(null);
    case 'editar':
      return abrirFormRegistro(item);
    case 'excluir':
      if (!(await confirmar('Excluir este registro? Essa ação não pode ser desfeita.', { titulo: 'Excluir registro', ok: 'Excluir', perigo: true }))) return;
      try {
        await api(`/api/producoes/${sel.producao}/${CFG.api}/${item}`, { method: 'DELETE' });
        toast('Registro excluído.');
        renderAreaRegistros();
      } catch (err) { toast(err.message, true); }
      return;
    case 'pagar':
      try {
        await api(`/api/producoes/${sel.producao}/mao-de-obra/${item}/pago`, { method: 'PUT', body: JSON.stringify({ pago: b.dataset.pago === '1' }) });
        toast(b.dataset.pago === '1' ? 'Pagamento registrado!' : 'Pagamento desmarcado.');
        renderAreaRegistros();
        carregarNotificacoes();
      } catch (err) { toast(err.message, true); }
      return;

    case 'excluir-propriedade': {
      const p = propAtual();
      if (!(await confirmar(`Excluir a propriedade "${p.nome_propriedade}" e todas as suas produções? Essa ação não pode ser desfeita.`,
        { titulo: 'Excluir propriedade', ok: 'Excluir', perigo: true }))) return;
      try {
        await api('/api/propriedades/' + p.id_propriedade, { method: 'DELETE' });
        toast('Propriedade excluída.');
        sel = {};
        SelecaoGestao.salvar(sel);
        await carregarPropriedades();
        renderOrdemPropriedades();
        render();
      } catch (err) { toast(err.message, true); }
    }
  }
});

// ======================================================================
// Janela de cadastro / edição de registro
// ======================================================================
function valorCampo(c, v) {
  if (v == null) return '';
  if (c.tipo === 'number') return String(Number(v)).replace('.', ',');
  if (c.tipo === 'date') return String(v).slice(0, 10);
  return String(v);
}
const grupoRegistro = (prodId, itemId) => `reg-${prodId}-${FUNCAO}` + (itemId ? '-' + itemId : '');

function abrirFormRegistro(itemId) {
  if (!detalhe || !sel.producao) return;
  const registro = itemId ? detalhe[CFG.lista].find((r) => r[CFG.id] === itemId) : null;
  if (itemId && !registro) {
    Rascunho.del('modal');
    return toast('Registro não encontrado.', true);
  }
  regMsg.className = 'form-msg';
  document.getElementById('tModalRegistro').textContent = (registro ? 'Editar ' : 'Cadastrar ') + CFG.singular;
  formRegistro.dataset.item = registro ? itemId : '';

  formRegistro.innerHTML = CFG.campos.map((c) => {
    const id = 'reg-' + c.n;
    const req = c.req ? ' <span class="req">*</span>' : '';
    if (c.tipo === 'checkbox') {
      return `<label class="field-check"><input type="checkbox" id="${id}" name="${c.n}" data-persist="${c.n}"> ${c.rot}</label>`;
    }
    let input;
    if (c.area) {
      input = `<textarea id="${id}" name="${c.n}" data-persist="${c.n}"></textarea>`;
    } else if (c.opcoes) {
      input = `<select id="${id}" name="${c.n}" data-persist="${c.n}">${c.opcoes.map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select>`;
    } else {
      // Números usam campo de texto para aceitar vírgula (ex.: 1.450,50)
      const extra = c.tipo === 'number' ? ` inputmode="${c.step === '1' ? 'numeric' : 'decimal'}" autocomplete="off"` : '';
      input = `<input type="${c.tipo === 'number' ? 'text' : c.tipo || 'text'}" id="${id}" name="${c.n}" data-persist="${c.n}"${extra}
        ${c.ph ? `placeholder="${escapeHtml(c.ph)}"` : ''} ${c.lista ? `list="${id}-lista"` : ''} ${c.hoje ? `value="${isoLocal()}"` : ''}>`;
      if (c.lista) input += `<datalist id="${id}-lista">${c.lista.map((o) => `<option value="${escapeHtml(o)}">`).join('')}</datalist>`;
    }
    return `<div class="field"><label for="${id}">${c.rot}:${req}</label>${input}${c.dica ? `<div class="hint">${c.dica}</div>` : ''}</div>`;
  }).join('') + `
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" data-close>Cancelar</button>
      <button type="submit" class="btn">Salvar</button>
    </div>`;

  if (registro) {
    CFG.campos.forEach((c) => {
      const el = formRegistro.elements[c.n];
      if (c.tipo === 'checkbox') { el.checked = !!registro[c.n]; return; }
      const v = valorCampo(c, registro[c.n]);
      if (el.tagName === 'SELECT' && v && ![...el.options].some((o) => o.value === v)) el.add(new Option(v));
      if (el.tagName !== 'SELECT' || v) el.value = v;
    });
  }
  persistirCampos(formRegistro, grupoRegistro(sel.producao, registro ? itemId : null));

  // Mão de obra: "Pagar até" acompanha a data trabalhada + frequência,
  // a menos que o produtor tenha alterado a data à mão.
  if (FUNCAO === 'mao-de-obra') {
    const f = formRegistro.elements;
    const venc = f.data_vencimento;
    const recalcular = () => { if (!venc.dataset.manual) venc.value = somarPrazo(f.data_trabalhada.value, f.frequencia_pagamento.value); };
    if (venc.value && venc.value !== somarPrazo(f.data_trabalhada.value, f.frequencia_pagamento.value)) venc.dataset.manual = '1';
    venc.addEventListener('input', () => { venc.dataset.manual = '1'; });
    f.data_trabalhada.addEventListener('change', recalcular);
    f.frequencia_pagamento.addEventListener('change', recalcular);
    if (!venc.value) recalcular();
  }
  abrirModal(modalRegistro, { prodId: sel.producao, itemId: registro ? itemId : null });
}

// (A tela Propriedades não tem registros, então não tem essa janela)
if (formRegistro) formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  regMsg.className = 'form-msg';
  const itemId = Number(formRegistro.dataset.item) || null;
  const dados = {};
  for (const c of CFG.campos) {
    const el = formRegistro.elements[c.n];
    if (c.tipo === 'checkbox') { dados[c.n] = el.checked; continue; }
    const v = el.value.trim();
    if (c.req && !v) return mostrarMsg(regMsg, `Preencha o campo "${c.rot}".`);
    dados[c.n] = v;
  }
  if (FUNCAO === 'mao-de-obra' && itemId) {
    // Mantém a data em que foi pago ao editar um registro já pago
    const atual = detalhe.mao_de_obra.find((r) => r.id_mao_de_obra === itemId);
    if (atual && atual.pago && dados.pago) dados.data_pagamento = atual.data_pagamento;
  }
  try {
    const url = `/api/producoes/${sel.producao}/${CFG.api}` + (itemId ? '/' + itemId : '');
    await api(url, { method: itemId ? 'PUT' : 'POST', body: JSON.stringify(dados) });
    limparCampos(formRegistro, grupoRegistro(sel.producao, itemId));
    fecharModal(modalRegistro);
    toast(itemId ? 'Registro atualizado!' : 'Registro cadastrado!');
    renderAreaRegistros();
    if (FUNCAO === 'mao-de-obra') carregarNotificacoes();
  } catch (err) {
    mostrarMsg(regMsg, err.message);
  }
});

// ======================================================================
// Navegação rápida e início
// ======================================================================
document.getElementById('navRapida').innerHTML = GESTAO.map((g) => `
  <a href="${g.href}" class="${g.id === FUNCAO ? 'atual' : ''}"${g.id === FUNCAO ? ' aria-current="page"' : ''}>${icone(g.icone)} ${escapeHtml(g.nome)}</a>`).join('') +
  `<a href="graficos.html">${icone('grafico')} Visão Gráfica</a>`;

if (typeof FormProducao !== 'undefined') {
  FormProducao.aoSalvar((salvo, nova) => {
    if (nova) sel = SelecaoGestao.ler();
    selPropriedade.value = sel.propriedade ? String(sel.propriedade) : '';
    render();
  });
}

(async () => {
  lerParametrosDaUrl();
  await carregarPropriedades();
  if (FUNCAO === 'propriedades') renderOrdemPropriedades();
  await render();
  // Reabre a janela que estava aberta quando o produtor saiu da tela
  const salvo = modalSalvo();
  if (salvo && salvo.id === 'modalRegistro' && salvo.ctx && salvo.ctx.prodId === sel.producao && detalhe) abrirFormRegistro(salvo.ctx.itemId);
  if (typeof FormProducao !== 'undefined') FormProducao.restaurar(sel.propriedade);
})();
