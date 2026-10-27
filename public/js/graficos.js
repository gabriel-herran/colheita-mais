'use strict';

// Visão Gráfica: indicadores e gráficos (SVG desenhado aqui mesmo, sem
// bibliotecas) a partir dos registros das produções, com filtro de período,
// propriedade e produção. Cada gráfico tem dica ao passar o mouse e uma
// versão em tabela para acessibilidade.

const fDe = document.getElementById('fDe');
const fAte = document.getElementById('fAte');
const fProp = document.getElementById('fProp');
const fProd = document.getElementById('fProd');
const chips = document.getElementById('rangeChips');
const tip = document.getElementById('chartTip');

const SERIES = [
  { chave: 'mao', nome: 'Mão de obra', cls: 's1' },
  { chave: 'ins', nome: 'Materiais', cls: 's2' },
  { chave: 'desp', nome: 'Despesas', cls: 's3' },
];
const NS = 'http://www.w3.org/2000/svg';

let filtros = Rascunho.get('filtros', { range: '90', de: '', ate: '', propriedade: '', producao: '' });
let dados = null;

// ======================================================================
// Filtros
// ======================================================================
function aplicarRange(range) {
  filtros.range = range;
  if (range === 'tudo') {
    filtros.de = '';
    filtros.ate = '';
  } else if (range !== 'custom') {
    const hoje = new Date();
    filtros.ate = isoLocal(hoje);
    filtros.de = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - Number(range) + 1));
  }
}

function sincronizarFiltros() {
  chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === filtros.range)));
  fDe.value = filtros.de;
  fAte.value = filtros.ate;
  Rascunho.set('filtros', filtros);
}

chips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-range]');
  if (!b) return;
  aplicarRange(b.dataset.range);
  carregar();
});
[fDe, fAte].forEach((el) => el.addEventListener('change', () => {
  filtros.range = 'custom';
  filtros.de = fDe.value;
  filtros.ate = fAte.value;
  if (filtros.de && filtros.ate && filtros.de > filtros.ate) return toast('A data inicial deve ser antes da final.', true);
  carregar();
}));
fProp.addEventListener('change', () => {
  filtros.propriedade = fProp.value;
  filtros.producao = '';
  carregar();
});
fProd.addEventListener('change', () => {
  filtros.producao = fProd.value;
  carregar();
});

function preencherSelects() {
  const props = new Map();
  dados.producoes.forEach((p) => props.set(p.id_propriedade, p.nome_propriedade));
  fProp.innerHTML = '<option value="">Todas</option>' +
    [...props].map(([id, nome]) => `<option value="${id}">${escapeHtml(nome)}</option>`).join('');
  fProp.value = filtros.propriedade;
  const prods = dados.producoes.filter((p) => !filtros.propriedade || String(p.id_propriedade) === String(filtros.propriedade));
  fProd.innerHTML = '<option value="">Todas</option>' +
    prods.map((p) => `<option value="${p.id_producao}">${escapeHtml(p.nome_producao || p.conteudo_producao || 'Produção')}</option>`).join('');
  fProd.value = filtros.producao;
}

// ======================================================================
// Carregamento e agregação
// ======================================================================
async function carregar() {
  sincronizarFiltros();
  const q = new URLSearchParams();
  if (filtros.de) q.set('de', filtros.de);
  if (filtros.ate) q.set('ate', filtros.ate);
  if (filtros.propriedade) q.set('propriedade', filtros.propriedade);
  if (filtros.producao) q.set('producao', filtros.producao);
  try {
    dados = await api('/api/graficos?' + q);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  preencherSelects();
  desenharTudo();
}

// Agrupa em semanas (períodos curtos) ou meses
function criarBaldes() {
  const todas = [...dados.mao_de_obra, ...dados.insumos, ...dados.despesas, ...dados.atividades, ...dados.transportes]
    .map((r) => r.data).filter(Boolean).sort();
  const de = filtros.de || todas[0];
  const ate = filtros.ate || todas[todas.length - 1];
  if (!de || !ate) return { baldes: [], chaveDe: () => null, porSemana: false };
  const d0 = new Date(de + 'T12:00:00');
  const d1 = new Date(ate + 'T12:00:00');
  const porSemana = (d1 - d0) / 86400000 <= 62;
  const baldes = [];
  if (porSemana) {
    let s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - d0.getDay());
    while (s <= d1) {
      baldes.push({ chave: isoLocal(s), rotulo: s.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) });
      s = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    }
  } else {
    let m = new Date(d0.getFullYear(), d0.getMonth(), 1);
    while (m <= d1) {
      const rot = m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      baldes.push({ chave: isoLocal(m).slice(0, 7), rotulo: `${rot}/${String(m.getFullYear()).slice(2)}` });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
  }
  const chaveDe = (iso) => {
    if (!porSemana) return iso.slice(0, 7);
    const d = new Date(iso + 'T12:00:00');
    return isoLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
  };
  return { baldes, chaveDe, porSemana };
}

const soma = (l, campo = 'valor') => l.reduce((s, r) => s + Number(r[campo] || 0), 0);
const fmtCurto = (v) => (Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : fmtBRL(v).replace(',00', ''));

function desenharTudo() {
  const mao = soma(dados.mao_de_obra);
  const ins = soma(dados.insumos);
  const desp = soma(dados.despesas);
  document.getElementById('kpis').innerHTML = [
    ['Total gasto', fmtBRL(mao + ins + desp)],
    ['Mão de obra', fmtBRL(mao)],
    ['Materiais usados', fmtBRL(ins)],
    ['Despesas e gastos', fmtBRL(desp)],
    ['Atividades anotadas', dados.atividades.length.toLocaleString('pt-BR')],
    ['Qtd. transportada', soma(dados.transportes, 'quantidade').toLocaleString('pt-BR')],
  ].map(([r, v]) => `<div class="kpi"><div class="kpi-label">${r}</div><div class="kpi-value">${v}</div></div>`).join('');

  const { baldes, chaveDe, porSemana } = criarBaldes();
  document.getElementById('subMes').textContent =
    `Mão de obra, materiais e despesas somados por ${porSemana ? 'semana (início no domingo)' : 'mês'}.`;

  // 1) Gastos por período (barras empilhadas)
  const idx = Object.fromEntries(baldes.map((b, i) => [b.chave, i]));
  const linhas = baldes.map((b) => ({ rotulo: b.rotulo, valores: [0, 0, 0] }));
  [[dados.mao_de_obra, 0], [dados.insumos, 1], [dados.despesas, 2]].forEach(([lista, s]) => {
    lista.forEach((r) => {
      const i = idx[chaveDe(r.data)];
      if (i != null) linhas[i].valores[s] += Number(r.valor || 0);
    });
  });
  graficoColunas(document.getElementById('chMes'), linhas, SERIES, fmtCurto, fmtBRL, 260);

  // 2) Gasto por produção (barras horizontais)
  const nomes = Object.fromEntries(dados.producoes.map((p) => [p.id_producao, p.nome_producao || p.conteudo_producao]));
  const porProd = {};
  [...dados.mao_de_obra, ...dados.insumos, ...dados.despesas].forEach((r) => {
    porProd[r.producao_id] = (porProd[r.producao_id] || 0) + Number(r.valor || 0);
  });
  graficoBarrasH(document.getElementById('chProd'),
    Object.entries(porProd).map(([id, v]) => ({ rotulo: nomes[id] || 'Produção', valor: v })), fmtBRL);

  // 3) Despesas por categoria
  const porCat = {};
  dados.despesas.forEach((r) => { const c = r.categoria || 'Outros'; porCat[c] = (porCat[c] || 0) + Number(r.valor || 0); });
  graficoBarrasH(document.getElementById('chCat'), Object.entries(porCat).map(([rotulo, valor]) => ({ rotulo, valor })), fmtBRL);

  // 4) Atividades e 5) Transportes por período (série única)
  const contar = (lista, campo) => baldes.map((b) => ({ rotulo: b.rotulo, valores: [0] })).map((l, i) => {
    lista.forEach((r) => { if (idx[chaveDe(r.data)] === i) l.valores[0] += campo ? Number(r[campo] || 0) : 1; });
    return l;
  });
  const fmtN = (v) => v.toLocaleString('pt-BR');
  graficoColunas(document.getElementById('chAtiv'), contar(dados.atividades), [{ nome: 'Atividades', cls: 'su' }], fmtN, fmtN, 200, true);
  graficoColunas(document.getElementById('chTransp'), contar(dados.transportes, 'quantidade'), [{ nome: 'Quantidade', cls: 'su' }], fmtN, fmtN, 200);
}

// ======================================================================
// Desenho (SVG)
// ======================================================================
function el(tag, attrs = {}, pai) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (pai) pai.appendChild(n);
  return n;
}

// Retângulo com os cantos de cima arredondados (base reta no eixo)
function caminhoBarra(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function caminhoBarraH(x, y, w, h, r) {
  r = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

// Escala "bonita" para o eixo Y
function escala(max, inteiro = false) {
  if (max <= 0) return { topo: 1, passo: inteiro ? 1 : 0.25 };
  const bruto = max / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  let passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto);
  if (inteiro) passo = Math.max(1, Math.ceil(passo));
  return { topo: passo * Math.ceil(max / passo), passo };
}

function mostrarTip(e, html) {
  tip.innerHTML = html;
  tip.style.display = 'block';
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = e.clientX + 14;
  let y = e.clientY - h - 10;
  if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
  if (y < 8) y = e.clientY + 16;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function esconderTip() { tip.style.display = 'none'; }

// Legenda (2+ séries) + botão de ver tabela
function rodape(container, series, linhasTabela, cabecalho) {
  if (series.length > 1) {
    const leg = document.createElement('div');
    leg.className = 'legend';
    leg.innerHTML = series.map((s) => `<span><i class="${s.cls}"></i>${escapeHtml(s.nome)}</span>`).join('');
    container.appendChild(leg);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link-btn table-toggle';
  btn.textContent = 'Ver como tabela';
  const tabela = document.createElement('table');
  tabela.className = 'data-table';
  tabela.hidden = true;
  tabela.innerHTML = `<thead><tr>${cabecalho.map((c, i) => `<th class="${i ? 'num' : ''}">${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhasTabela.map((l) => `<tr>${l.map((c, i) => `<td class="${i ? 'num' : ''}">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  btn.addEventListener('click', () => {
    tabela.hidden = !tabela.hidden;
    btn.textContent = tabela.hidden ? 'Ver como tabela' : 'Ocultar tabela';
  });
  container.append(btn, tabela);
}

// Colunas verticais (empilhadas quando há mais de uma série)
function graficoColunas(container, linhas, series, fmtEixo, fmtTip, altura, inteiro = false) {
  container.innerHTML = '';
  const total = (l) => l.valores.reduce((a, b) => a + b, 0);
  if (!linhas.length || linhas.every((l) => total(l) === 0)) {
    container.innerHTML = '<p class="chart-empty">Nenhum dado no período selecionado.</p>';
    return;
  }
  const largura = Math.max(280, container.clientWidth);
  const m = { t: 12, r: 8, b: 26, l: 64 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const { topo, passo } = escala(Math.max(...linhas.map(total)), inteiro);
  const y = (v) => m.t + h - (v / topo) * h;

  const svg = el('svg', { class: 'chart-svg', viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, role: 'img',
    'aria-label': `Gráfico de colunas: ${series.map((s) => s.nome).join(', ')}` });
  const grade = el('g', { class: 'grid' }, svg);
  for (let v = 0; v <= topo + 1e-9; v += passo) {
    el('line', { x1: m.l, x2: largura - m.r, y1: y(v), y2: y(v) }, grade);
    el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = fmtEixo(v);
  }
  el('line', { class: 'axis-line', x1: m.l, x2: largura - m.r, y1: y(0), y2: y(0) }, svg);

  const banda = w / linhas.length;
  const bw = Math.max(4, Math.min(48, banda * 0.62));
  const mostrarCada = Math.ceil(linhas.length / Math.max(1, Math.floor(w / 58)));
  linhas.forEach((l, i) => {
    const cx = m.l + banda * i + banda / 2;
    let acum = 0;
    const visiveis = l.valores.map((v, s) => ({ v, s })).filter((o) => o.v > 0);
    visiveis.forEach((o, k) => {
      const y0 = y(acum);
      const y1 = y(acum + o.v);
      acum += o.v;
      const gap = k > 0 ? 2 : 0; // espaço de 2px entre segmentos
      const altSeg = Math.max(1, y0 - y1 - gap);
      const ehTopo = k === visiveis.length - 1;
      el('path', { class: series[o.s].cls, d: ehTopo ? caminhoBarra(cx - bw / 2, y1, bw, altSeg, 4) : `M${cx - bw / 2},${y1}h${bw}v${altSeg}h${-bw}Z` }, svg);
    });
    if (i % mostrarCada === 0) {
      el('text', { x: cx, y: altura - 8, 'text-anchor': 'middle' }, svg).textContent = l.rotulo;
    }
    // Área de toque maior que a barra
    const hl = el('rect', { x: cx - banda / 2, y: m.t, width: banda, height: h, class: 'hit' }, svg);
    hl.addEventListener('mousemove', (e) => {
      hl.setAttribute('class', 'hit col-hover');
      mostrarTip(e, `<div class="tt-title">${escapeHtml(l.rotulo)}</div>` +
        series.map((s, k) => `<div class="tt-row"><span><i style="background:var(--${s.cls === 'su' ? 'serie-unica' : 'serie-' + (k + 1)})"></i>${escapeHtml(s.nome)}</span><strong>${escapeHtml(fmtTip(l.valores[k]))}</strong></div>`).join('') +
        (series.length > 1 ? `<div class="tt-row" style="margin-top:4px"><span>Total</span><strong>${escapeHtml(fmtTip(total(l)))}</strong></div>` : ''));
    });
    hl.addEventListener('mouseleave', () => { hl.setAttribute('class', 'hit'); esconderTip(); });
  });

  container.appendChild(svg);
  rodape(container, series,
    linhas.filter((l) => total(l) > 0).map((l) => [l.rotulo, ...l.valores.map(fmtTip), ...(series.length > 1 ? [fmtTip(total(l))] : [])]),
    ['Período', ...series.map((s) => s.nome), ...(series.length > 1 ? ['Total'] : [])]);
}

// Barras horizontais com rótulo direto do valor
function graficoBarrasH(container, itens, fmt) {
  container.innerHTML = '';
  itens = itens.filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor);
  if (!itens.length) {
    container.innerHTML = '<p class="chart-empty">Nenhum dado no período selecionado.</p>';
    return;
  }
  if (itens.length > 8) {
    const resto = itens.slice(7).reduce((s, i) => s + i.valor, 0);
    itens = [...itens.slice(0, 7), { rotulo: 'Outros', valor: resto }];
  }
  const largura = Math.max(280, container.clientWidth);
  const linhaH = 34;
  const altura = itens.length * linhaH + 8;
  const rotW = Math.min(170, largura * 0.36);
  const valW = 96;
  const w = largura - rotW - valW;
  const max = Math.max(...itens.map((i) => i.valor));

  const svg = el('svg', { class: 'chart-svg', viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, role: 'img', 'aria-label': 'Gráfico de barras horizontais' });
  itens.forEach((it, i) => {
    const yy = 4 + i * linhaH;
    const bw = Math.max(2, (it.valor / max) * w);
    const rot = it.rotulo.length > 24 ? it.rotulo.slice(0, 23) + '…' : it.rotulo;
    el('text', { x: rotW - 8, y: yy + 20, 'text-anchor': 'end' }, svg).textContent = rot;
    el('path', { class: 'su', d: caminhoBarraH(rotW, yy + 6, bw, 20, 4) }, svg);
    el('text', { x: rotW + bw + 6, y: yy + 20, class: 'val-label' }, svg).textContent = fmt(it.valor);
    const hit = el('rect', { x: 0, y: yy, width: largura, height: linhaH, class: 'hit' }, svg);
    hit.addEventListener('mousemove', (e) => mostrarTip(e, `<div class="tt-title">${escapeHtml(it.rotulo)}</div><div class="tt-row"><span>Valor</span><strong>${escapeHtml(fmt(it.valor))}</strong></div>`));
    hit.addEventListener('mouseleave', esconderTip);
  });
  container.appendChild(svg);
  rodape(container, [{}], itens.map((i) => [i.rotulo, fmt(i.valor)]), ['Item', 'Valor']);
}

// Redesenha ao mudar o tamanho da janela ou o tema
let tRes;
window.addEventListener('resize', () => {
  clearTimeout(tRes);
  tRes = setTimeout(() => dados && desenharTudo(), 150);
});
document.addEventListener('prefs-alteradas', () => dados && setTimeout(desenharTudo, 50));

if (filtros.range !== 'custom') aplicarRange(filtros.range);
carregar();
