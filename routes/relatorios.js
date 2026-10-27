'use strict';

// Geração dos PDFs de uma produção:
//  - Relatório da produção: resumo genérico dos últimos 30 dias.
//  - Histórico bruto: tudo o que aconteceu durante TODO o período, em detalhe.

const path = require('path');
const express = require('express');
const PDFDocument = require('pdfkit');
const { requireAuth, idParam, producaoDoUsuario, rota } = require('./util');
const { registrosDaProducao } = require('./producoes');

const router = express.Router();

const FONTES = path.join(__dirname, '..', 'public', 'assets', 'fonts');
const LOGO = path.join(__dirname, '..', 'public', 'assets', 'img', 'logo.png');
const VERDE = '#3c7a2c';
const CINZA = '#555555';
const DIAS_RELATORIO = 30;

// ---------- Formatação ----------
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR'));
const txt = (v) => (v == null || v === '' ? '—' : String(v));
function dataBR(d) {
  if (!d) return '—';
  const [a, m, dia] = String(d).slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
}
function dataHoraBR(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
// Data (AAAA-MM-DD) de um timestamp no fuso de Brasília
function diaDe(ts) {
  return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
function hojeMenos(dias) {
  const d = new Date(Date.now() - dias * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
const soma = (lista, campo) => lista.reduce((s, r) => s + Number(r[campo] || 0), 0);

// ---------- Helpers de desenho ----------
function novoDocumento(res, nomeArquivo) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  doc.registerFont('regular', path.join(FONTES, 'Exo2-Regular.ttf'));
  doc.registerFont('negrito', path.join(FONTES, 'Exo2-SemiBold.ttf'));
  doc.registerFont('titulo', path.join(FONTES, 'Exo2-Bold.ttf'));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  doc.pipe(res);
  return doc;
}

function cabecalho(doc, titulo, prod) {
  try { doc.image(LOGO, 50, 40, { height: 34 }); } catch (_) {}
  doc.font('regular').fontSize(9).fillColor(CINZA)
    .text(`Gerado em ${dataHoraBR(new Date())}`, 50, 52, { align: 'right' });
  doc.moveDown(2.2);
  doc.font('titulo').fontSize(20).fillColor(VERDE).text(titulo, 50);
  doc.font('regular').fontSize(12).fillColor('#222')
    .text(`${prod.nome_producao || 'Produção'} — Propriedade: ${prod.nome_propriedade}`);
  linha(doc);
}

function linha(doc) {
  doc.moveDown(0.4);
  const y = doc.y;
  doc.moveTo(50, y).lineTo(545, y).lineWidth(1).strokeColor('#9a9a9a').stroke();
  doc.moveDown(0.6);
}

function secao(doc, titulo) {
  garantirEspaco(doc, 60);
  doc.moveDown(0.5);
  doc.font('titulo').fontSize(14).fillColor(VERDE).text(titulo, 50);
  doc.moveDown(0.3);
}

function garantirEspaco(doc, altura) {
  if (doc.y + altura > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

// Pares "rótulo: valor" em duas colunas
function campos(doc, pares) {
  doc.fontSize(10.5);
  for (const [rotulo, valor] of pares) {
    garantirEspaco(doc, 18);
    const y = doc.y;
    doc.font('negrito').fillColor('#333').text(rotulo + ':', 50, y, { width: 170 });
    const yRot = doc.y;
    doc.font('regular').fillColor('#111').text(valor, 225, y, { width: 320 });
    doc.y = Math.max(doc.y, yRot) + 2;
  }
  doc.x = 50;
}

// Tabela simples com quebra de página e cabeçalho repetido
function tabela(doc, colunas, linhas, vazio = 'Nenhum registro.') {
  if (!linhas.length) {
    doc.font('regular').fontSize(10).fillColor(CINZA).text(vazio, 50);
    doc.moveDown(0.3);
    return;
  }
  const total = colunas.reduce((s, c) => s + c.w, 0);
  const escala = 495 / total;
  const cols = colunas.map((c) => ({ ...c, w: c.w * escala }));

  const desenharCabecalho = () => {
    const y = doc.y;
    doc.rect(50, y, 495, 18).fill('#e3ebdd');
    let x = 50;
    doc.font('negrito').fontSize(9).fillColor('#2e6023');
    cols.forEach((c) => {
      doc.text(c.t, x + 4, y + 5, { width: c.w - 8, align: c.a || 'left' });
      x += c.w;
    });
    doc.y = y + 20;
  };

  garantirEspaco(doc, 40);
  desenharCabecalho();
  linhas.forEach((l, i) => {
    doc.font('regular').fontSize(9);
    const altura = Math.max(...l.map((v, j) => doc.heightOfString(String(v), { width: cols[j].w - 8 }))) + 6;
    if (doc.y + altura > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      desenharCabecalho();
    }
    const y = doc.y;
    if (i % 2) doc.rect(50, y, 495, altura).fill('#f5f5f5');
    let x = 50;
    doc.fillColor('#1d1d1d');
    l.forEach((v, j) => {
      doc.text(String(v), x + 4, y + 3, { width: cols[j].w - 8, align: cols[j].a || 'left' });
      x += cols[j].w;
    });
    doc.y = y + altura;
  });
  doc.x = 50;
  doc.moveDown(0.5);
}

function numerarPaginas(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    // Escrever abaixo da margem inferior faria o PDFKit criar uma página nova;
    // zera a margem só para desenhar o rodapé.
    const margem = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor(CINZA)
      .text(`Colheita+  •  Página ${i + 1} de ${count}`, 50, doc.page.height - 35, { width: 495, align: 'center', lineBreak: false });
    doc.page.margins.bottom = margem;
  }
}

function dadosDaProducao(doc, p) {
  campos(doc, [
    ['Produção', txt(p.nome_producao)],
    ['O que é produzido', txt(p.conteudo_producao)],
    ['Propriedade', txt(p.nome_propriedade)],
    ['Área plantada', p.area_plantada != null ? num(p.area_plantada) + ' ha' : '—'],
    ['Quantidade de ruas', num(p.quantidade_ruas)],
    ['Mão de obra prevista', p.quantidade_mao_de_obra != null ? num(p.quantidade_mao_de_obra) + ' trabalhador(es)' : '—'],
    ['Ferramentas', txt(p.ferramentas_producao)],
    ['Início', dataBR(p.data_inicio)],
    ['Término previsto', dataBR(p.data_fim_prevista)],
    ['Descrição', txt(p.descricao_producao)],
  ]);
}

// Linhas das tabelas de cada tipo de registro
const situacaoPagamento = (m) => (m.pago ? `Pago em ${dataBR(m.data_pagamento)}` : m.data_vencimento ? `A pagar até ${dataBR(m.data_vencimento)}` : 'A pagar');
const linhasMao = (l) => l.map((m) => [dataBR(m.data_trabalhada), txt(m.descricao_mao_de_obra), num(m.quantidade_mao_de_obra), brl(m.gasto_total),
  `${txt(m.metodo_pagamento)} · ${txt(m.frequencia_pagamento)}`, situacaoPagamento(m)]);
const colsMao = [{ t: 'Data', w: 62 }, { t: 'Função / serviço', w: 130 }, { t: 'Pessoas', w: 50, a: 'right' }, { t: 'Gasto', w: 70, a: 'right' },
  { t: 'Pagamento', w: 100 }, { t: 'Situação', w: 90 }];
const linhasIns = (l) => l.map((i) => [dataBR(i.data_uso), txt(i.nome_insumo), txt(i.tipo_insumo), `${num(i.quantidade_insumo)} ${i.unidade_insumo || ''}`.trim(), brl(i.custo_insumo)]);
const colsIns = [{ t: 'Data', w: 70 }, { t: 'Material', w: 160 }, { t: 'Tipo', w: 90 }, { t: 'Quantidade', w: 80, a: 'right' }, { t: 'Custo', w: 80, a: 'right' }];
const linhasDesp = (l) => l.map((d) => [dataBR(d.data_despesa), txt(d.descricao_despesa), txt(d.categoria_despesa), brl(d.valor_despesa)]);
const colsDesp = [{ t: 'Data', w: 70 }, { t: 'Descrição', w: 210 }, { t: 'Categoria', w: 110 }, { t: 'Valor', w: 80, a: 'right' }];
const linhasTransp = (l) => l.map((t) => [dataBR(t.data), txt(t.tipo_transporte), txt(t.destino_transporte), num(t.quantidade_producao), txt(t.contato_emergencia)]);
const colsTransp = [{ t: 'Data', w: 70 }, { t: 'Tipo', w: 110 }, { t: 'Destino', w: 130 }, { t: 'Qtd. transportada', w: 90, a: 'right' }, { t: 'Contato', w: 90 }];
const linhasAtiv = (l) => l.map((a) => [dataHoraBR(a.criado_em), txt(a.descricao_atividade)]);
const colsAtiv = [{ t: 'Data e hora', w: 100 }, { t: 'Atividade', w: 380 }];

function resumoFinanceiro(doc, r) {
  const mao = soma(r.mao_de_obra, 'gasto_total');
  const ins = soma(r.insumos, 'custo_insumo');
  const desp = soma(r.despesas, 'valor_despesa');
  campos(doc, [
    ['Mão de obra', `${brl(mao)}  (${r.mao_de_obra.length} registro(s), ${num(soma(r.mao_de_obra, 'quantidade_mao_de_obra'))} diária(s))`],
    ['Materiais usados', `${brl(ins)}  (${r.insumos.length} registro(s))`],
    ['Despesas e gastos', `${brl(desp)}  (${r.despesas.length} registro(s))`],
    ['Total gasto', brl(mao + ins + desp)],
    ['Atividades anotadas', String(r.atividades.length)],
    ['Transportes', `${r.transportes.length} (total transportado: ${num(soma(r.transportes, 'quantidade_producao'))})`],
  ]);
}

// Filtra os registros de uma produção a partir de uma data (AAAA-MM-DD)
function filtrarDesde(r, desde) {
  return {
    atividades: r.atividades.filter((a) => diaDe(a.criado_em) >= desde),
    mao_de_obra: r.mao_de_obra.filter((m) => (m.data_trabalhada || '') >= desde),
    insumos: r.insumos.filter((i) => (i.data_uso || diaDe(i.criado_em)) >= desde),
    despesas: r.despesas.filter((d) => d.data_despesa >= desde),
    transportes: r.transportes.filter((t) => (t.data || '') >= desde),
  };
}

async function carregar(req, res) {
  const id = idParam(req.params.id);
  const prod = id && (await producaoDoUsuario(id, req.session.userId));
  if (!prod) {
    res.status(404).json({ erro: 'Produção não encontrada.' });
    return null;
  }
  return { prod, reg: await registrosDaProducao(id) };
}

function nomeArquivo(prefixo, prod) {
  const base = String(prod.nome_producao || 'producao')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${prefixo}-${base || 'producao'}-${hojeMenos(0)}.pdf`;
}

// ---------- Relatório da produção (dias recentes) ----------
router.get('/api/producoes/:id/relatorio.pdf', requireAuth, rota('relatório PDF', async (req, res) => {
  const dados = await carregar(req, res);
  if (!dados) return;
  const { prod, reg } = dados;
  const desde = hojeMenos(DIAS_RELATORIO);
  const rec = filtrarDesde(reg, desde);

  const doc = novoDocumento(res, nomeArquivo('relatorio', prod));
  cabecalho(doc, 'Relatório da Produção', prod);

  secao(doc, 'Dados da produção');
  dadosDaProducao(doc, prod);

  secao(doc, `Resumo dos últimos ${DIAS_RELATORIO} dias (${dataBR(desde)} a ${dataBR(hojeMenos(0))})`);
  resumoFinanceiro(doc, rec);

  secao(doc, 'Totais desde o início da produção');
  resumoFinanceiro(doc, reg);

  // Despesas do período agrupadas por categoria
  const porCat = {};
  rec.despesas.forEach((d) => {
    const c = d.categoria_despesa || 'Outros';
    porCat[c] = (porCat[c] || 0) + Number(d.valor_despesa || 0);
  });
  secao(doc, 'Despesas do período por categoria');
  tabela(doc, [{ t: 'Categoria', w: 300 }, { t: 'Total', w: 150, a: 'right' }],
    Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, brl(v)]),
    'Nenhuma despesa no período.');

  secao(doc, 'Atividades recentes');
  tabela(doc, colsAtiv, linhasAtiv(rec.atividades.slice(0, 15)), 'Nenhuma atividade anotada no período.');

  secao(doc, 'Transportes recentes');
  tabela(doc, colsTransp, linhasTransp(rec.transportes.slice(0, 10)), 'Nenhum transporte no período.');

  numerarPaginas(doc);
  doc.end();
}));

// ---------- Histórico bruto (todo o período, em detalhe) ----------
router.get('/api/producoes/:id/historico.pdf', requireAuth, rota('histórico PDF', async (req, res) => {
  const dados = await carregar(req, res);
  if (!dados) return;
  const { prod, reg } = dados;

  const doc = novoDocumento(res, nomeArquivo('historico', prod));
  cabecalho(doc, 'Histórico Bruto da Produção', prod);

  secao(doc, 'Dados completos da produção');
  dadosDaProducao(doc, prod);
  campos(doc, [['Cadastrada em', dataHoraBR(prod.criado_em)]]);

  secao(doc, 'Totais de todo o período');
  resumoFinanceiro(doc, reg);

  // Linha do tempo: todos os registros em ordem cronológica
  const eventos = [
    { quando: prod.criado_em, dia: diaDe(prod.criado_em), tipo: 'Produção', desc: `Produção "${prod.nome_producao}" cadastrada.` },
    ...reg.atividades.map((a) => ({ quando: a.criado_em, dia: diaDe(a.criado_em), tipo: 'Atividade', desc: a.descricao_atividade })),
    ...reg.mao_de_obra.map((m) => ({
      quando: m.criado_em, dia: m.data_trabalhada, tipo: 'Mão de obra',
      desc: `${txt(m.descricao_mao_de_obra)} — ${num(m.quantidade_mao_de_obra)} trabalhador(es), gasto de ${brl(m.gasto_total)}. `
        + `Pagamento: ${txt(m.metodo_pagamento)}, ${txt(m.frequencia_pagamento)}; ${situacaoPagamento(m)}.`,
    })),
    ...reg.insumos.map((i) => ({
      quando: i.criado_em, dia: i.data_uso || diaDe(i.criado_em), tipo: 'Material',
      desc: `${txt(i.nome_insumo)} (${txt(i.tipo_insumo)}) — ${num(i.quantidade_insumo)} ${i.unidade_insumo || ''}, custo de ${brl(i.custo_insumo)}.`,
    })),
    ...reg.despesas.map((d) => ({
      quando: d.criado_em, dia: d.data_despesa, tipo: 'Despesa',
      desc: `${txt(d.descricao_despesa)} [${txt(d.categoria_despesa)}] — ${brl(d.valor_despesa)}.`,
    })),
    ...reg.transportes.map((t) => ({
      quando: t.criado_em, dia: t.data, tipo: 'Transporte',
      desc: `${txt(t.tipo_transporte)} para ${txt(t.destino_transporte)} — quantidade ${num(t.quantidade_producao)}, contato ${txt(t.contato_emergencia)}.`,
    })),
  ].sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || new Date(a.quando) - new Date(b.quando));

  secao(doc, `Linha do tempo completa (${eventos.length} registros)`);
  tabela(doc, [{ t: 'Data', w: 70 }, { t: 'Registrado em', w: 95 }, { t: 'Tipo', w: 80 }, { t: 'Detalhes', w: 250 }],
    eventos.map((e) => [dataBR(e.dia), dataHoraBR(e.quando), e.tipo, e.desc]));

  secao(doc, 'Atividades feitas (todas)');
  tabela(doc, colsAtiv, linhasAtiv([...reg.atividades].reverse()));
  secao(doc, 'Mão de obra (todos os registros)');
  tabela(doc, colsMao, linhasMao([...reg.mao_de_obra].reverse()));
  secao(doc, 'Materiais usados (todos os registros)');
  tabela(doc, colsIns, linhasIns([...reg.insumos].reverse()));
  secao(doc, 'Despesas e gastos (todos os registros)');
  tabela(doc, colsDesp, linhasDesp([...reg.despesas].reverse()));
  secao(doc, 'Transportes (todos os registros)');
  tabela(doc, colsTransp, linhasTransp([...reg.transportes].reverse()));

  numerarPaginas(doc);
  doc.end();
}));

module.exports = router;
