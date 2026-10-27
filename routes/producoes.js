'use strict';

// Produções de uma propriedade e seus registros:
// atividades feitas, mão de obra, materiais usados (insumos), despesas e transporte.

const express = require('express');
const pool = require('../db/pool');
const { requireAuth, idParam, texto, numero, data, producaoDoUsuario, rota } = require('./util');

const router = express.Router();
router.use(['/api/propriedades/:id/producoes', '/api/producoes'], requireAuth);

async function propriedadeDoUsuario(id, userId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM propriedades WHERE id_propriedade = $1 AND usuario_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

// Lê e valida os campos do formulário de produção.
function lerProducao(body) {
  const campos = {
    nome_producao: texto(body.nome_producao, 160),
    conteudo_producao: texto(body.conteudo_producao, 200),
    area_plantada: numero(body.area_plantada),
    quantidade_ruas: numero(body.quantidade_ruas),
    quantidade_mao_de_obra: numero(body.quantidade_mao_de_obra),
    data_inicio: data(body.data_inicio),
    data_fim_prevista: data(body.data_fim_prevista),
    descricao_producao: texto(body.descricao_producao, 2000),
    ferramentas_producao: texto(body.ferramentas_producao, 200),
  };
  if (!campos.nome_producao) return { erro: 'O nome da produção é obrigatório.' };
  if (!campos.conteudo_producao) return { erro: 'Informe o que é produzido (cultura).' };
  for (const k of ['area_plantada', 'quantidade_ruas', 'quantidade_mao_de_obra']) {
    if (campos[k] === undefined) return { erro: 'Há um número inválido no formulário.' };
  }
  if (campos.data_inicio === undefined || campos.data_fim_prevista === undefined) {
    return { erro: 'Data inválida.' };
  }
  campos.quantidade_ruas = campos.quantidade_ruas == null ? null : Math.round(campos.quantidade_ruas);
  campos.quantidade_mao_de_obra = campos.quantidade_mao_de_obra == null ? null : Math.round(campos.quantidade_mao_de_obra);
  return { campos };
}

// ---------- Produções ----------

// Listar produções de uma propriedade
router.get('/api/propriedades/:id/producoes', rota('listar produções', async (req, res) => {
  const propId = idParam(req.params.id);
  if (!propId || !(await propriedadeDoUsuario(propId, req.session.userId))) {
    return res.status(404).json({ erro: 'Propriedade não encontrada.' });
  }
  const { rows } = await pool.query(
    `SELECT pr.*, pp.ferramentas_producao,
            (SELECT COALESCE(SUM(gasto_total), 0) FROM mao_de_obra m WHERE m.producao_id = pr.id_producao) AS total_mao_de_obra,
            (SELECT COALESCE(SUM(custo_insumo), 0) FROM insumos i WHERE i.producao_id = pr.id_producao) AS total_insumos,
            (SELECT COALESCE(SUM(valor_despesa), 0) FROM despesas d WHERE d.producao_id = pr.id_producao) AS total_despesas,
            (SELECT COUNT(*)::int FROM atividades a WHERE a.producao_id = pr.id_producao) AS qtd_atividades,
            (SELECT COUNT(*)::int FROM producao_transporte t WHERE t.producao_id = pr.id_producao) AS qtd_transportes
       FROM producao pr
       JOIN producao_propriedade pp ON pp.producao_id = pr.id_producao
      WHERE pp.propriedade_id = $1
      ORDER BY pr.posicao ASC NULLS LAST, pr.criado_em DESC`,
    [propId]
  );
  res.json(rows);
}));

// Cadastrar produção em uma propriedade
router.post('/api/propriedades/:id/producoes', rota('criar produção', async (req, res) => {
  const propId = idParam(req.params.id);
  if (!propId || !(await propriedadeDoUsuario(propId, req.session.userId))) {
    return res.status(404).json({ erro: 'Propriedade não encontrada.' });
  }
  const { erro, campos: c } = lerProducao(req.body);
  if (erro) return res.status(400).json({ erro });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO producao (nome_producao, conteudo_producao, area_plantada, quantidade_ruas,
                             quantidade_mao_de_obra, data_inicio, data_fim_prevista, descricao_producao, posicao)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8,
               (SELECT COALESCE(MAX(pr.posicao), -1) + 1
                  FROM producao pr JOIN producao_propriedade pp ON pp.producao_id = pr.id_producao
                 WHERE pp.propriedade_id = $9))
       RETURNING *`,
      [c.nome_producao, c.conteudo_producao, c.area_plantada, c.quantidade_ruas,
       c.quantidade_mao_de_obra, c.data_inicio,
       c.data_fim_prevista, c.descricao_producao, propId]
    );
    await client.query(
      'INSERT INTO producao_propriedade (producao_id, propriedade_id, ferramentas_producao) VALUES ($1, $2, $3)',
      [rows[0].id_producao, propId, c.ferramentas_producao]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], ferramentas_producao: c.ferramentas_producao });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// Reordenar produções de uma propriedade
router.put('/api/propriedades/:id/producoes/ordem', rota('reordenar produções', async (req, res) => {
  const propId = idParam(req.params.id);
  const { ordem } = req.body;
  if (!propId || !Array.isArray(ordem)) return res.status(400).json({ erro: 'Ordem inválida.' });
  if (!(await propriedadeDoUsuario(propId, req.session.userId))) {
    return res.status(404).json({ erro: 'Propriedade não encontrada.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ordem.length; i++) {
      const id = idParam(ordem[i]);
      if (!id) continue;
      await client.query(
        `UPDATE producao SET posicao = $1
          WHERE id_producao = $2
            AND id_producao IN (SELECT producao_id FROM producao_propriedade WHERE propriedade_id = $3)`,
        [i, id, propId]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// Consultar produção com todos os seus registros
router.get('/api/producoes/:id', rota('consultar produção', async (req, res) => {
  const id = idParam(req.params.id);
  const prod = id && (await producaoDoUsuario(id, req.session.userId));
  if (!prod) return res.status(404).json({ erro: 'Produção não encontrada.' });
  res.json({ ...prod, ...(await registrosDaProducao(id)) });
}));

// Atualizar produção
router.put('/api/producoes/:id', rota('atualizar produção', async (req, res) => {
  const id = idParam(req.params.id);
  if (!id || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Produção não encontrada.' });
  }
  const { erro, campos: c } = lerProducao(req.body);
  if (erro) return res.status(400).json({ erro });
  const { rows } = await pool.query(
    `UPDATE producao SET nome_producao = $1, conteudo_producao = $2, area_plantada = $3, quantidade_ruas = $4,
            quantidade_mao_de_obra = $5, data_inicio = COALESCE($6, data_inicio), data_fim_prevista = $7, descricao_producao = $8
      WHERE id_producao = $9 RETURNING *`,
    [c.nome_producao, c.conteudo_producao, c.area_plantada, c.quantidade_ruas,
     c.quantidade_mao_de_obra, c.data_inicio, c.data_fim_prevista, c.descricao_producao, id]
  );
  await pool.query('UPDATE producao_propriedade SET ferramentas_producao = $1 WHERE producao_id = $2',
    [c.ferramentas_producao, id]);
  res.json({ ...rows[0], ferramentas_producao: c.ferramentas_producao });
}));

// Excluir produção (os registros filhos saem junto por ON DELETE CASCADE)
router.delete('/api/producoes/:id', rota('excluir produção', async (req, res) => {
  const id = idParam(req.params.id);
  if (!id || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Produção não encontrada.' });
  }
  // Transportes só usados por esta produção também são removidos.
  await pool.query(
    `DELETE FROM transporte WHERE id_transporte IN (
       SELECT transporte_id FROM producao_transporte WHERE producao_id = $1)`,
    [id]
  );
  await pool.query('DELETE FROM producao WHERE id_producao = $1', [id]);
  res.json({ ok: true });
}));

// Busca todos os registros de uma produção (usado também pelos relatórios).
async function registrosDaProducao(id) {
  const [atividades, mao, insumos, despesas, transportes] = await Promise.all([
    pool.query('SELECT * FROM atividades WHERE producao_id = $1 ORDER BY criado_em DESC', [id]),
    pool.query('SELECT * FROM mao_de_obra WHERE producao_id = $1 ORDER BY data_trabalhada DESC NULLS LAST, id_mao_de_obra DESC', [id]),
    pool.query('SELECT * FROM insumos WHERE producao_id = $1 ORDER BY data_uso DESC NULLS LAST, id_insumo DESC', [id]),
    pool.query('SELECT * FROM despesas WHERE producao_id = $1 ORDER BY data_despesa DESC, id_despesa DESC', [id]),
    pool.query(
      `SELECT pt.id_producao_transporte, pt.data, pt.quantidade_producao, pt.criado_em,
              t.id_transporte, t.tipo_transporte, t.contato_emergencia, t.destino_transporte
         FROM producao_transporte pt JOIN transporte t ON t.id_transporte = pt.transporte_id
        WHERE pt.producao_id = $1 ORDER BY pt.data DESC NULLS LAST, pt.id_producao_transporte DESC`,
      [id]
    ),
  ]);
  return {
    atividades: atividades.rows,
    mao_de_obra: mao.rows,
    insumos: insumos.rows,
    despesas: despesas.rows,
    transportes: transportes.rows,
  };
}

// ---------- Pagamento da mão de obra ----------
// Frequência -> prazo para pagar, contado a partir da data trabalhada.
const FREQUENCIAS = {
  'Pagamento único': { dias: 0 },
  'Diário': { dias: 1 },
  'Semanal (1 semana)': { dias: 7 },
  'Quinzenal (2 semanas)': { dias: 14 },
  'Mensal (1 mês)': { meses: 1 },
  'Trimestral (3 meses)': { meses: 3 },
};

function hojeISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function somarPrazo(iso, frequencia) {
  const f = FREQUENCIAS[frequencia] || { dias: 0 };
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1 + (f.meses || 0), d + (f.dias || 0)));
  return dt.toISOString().slice(0, 10);
}

// ---------- Registros simples (cadastrar / excluir) ----------
// Cada tipo descreve sua tabela e como validar os campos recebidos.
const TIPOS = {
  atividades: {
    tabela: 'atividades', pk: 'id_atividade',
    ler(b) {
      const descricao_atividade = texto(b.descricao_atividade, 4000);
      if (!descricao_atividade) return { erro: 'Escreva a atividade feita.' };
      return { campos: { descricao_atividade } };
    },
  },
  'mao-de-obra': {
    tabela: 'mao_de_obra', pk: 'id_mao_de_obra',
    ler(b) {
      const c = {
        descricao_mao_de_obra: texto(b.descricao_mao_de_obra, 200),
        quantidade_mao_de_obra: numero(b.quantidade_mao_de_obra),
        gasto_total: numero(b.gasto_total),
        data_trabalhada: data(b.data_trabalhada),
        metodo_pagamento: texto(b.metodo_pagamento, 40),
        frequencia_pagamento: texto(b.frequencia_pagamento, 40),
        data_vencimento: data(b.data_vencimento),
        pago: b.pago === true || b.pago === 'true' || b.pago === 'on' || b.pago === '1',
      };
      if (!c.descricao_mao_de_obra) return { erro: 'Informe a função/serviço realizado.' };
      if (!c.quantidade_mao_de_obra) return { erro: 'Informe a quantidade de trabalhadores.' };
      if (c.gasto_total === undefined) return { erro: 'Valor gasto inválido.' };
      if (!c.data_trabalhada) return { erro: 'Informe a data trabalhada.' };
      if (c.data_vencimento === undefined) return { erro: 'Data de vencimento inválida.' };
      if (c.frequencia_pagamento && !(c.frequencia_pagamento in FREQUENCIAS)) return { erro: 'Frequência de pagamento inválida.' };
      c.quantidade_mao_de_obra = Math.round(c.quantidade_mao_de_obra);
      // Sem vencimento informado: calcula a partir da data trabalhada + frequência
      if (!c.data_vencimento) c.data_vencimento = somarPrazo(c.data_trabalhada, c.frequencia_pagamento);
      c.data_pagamento = c.pago ? (data(b.data_pagamento) || hojeISO()) : null;
      return { campos: c };
    },
  },
  insumos: {
    tabela: 'insumos', pk: 'id_insumo',
    ler(b) {
      const c = {
        nome_insumo: texto(b.nome_insumo, 160),
        tipo_insumo: texto(b.tipo_insumo, 120),
        quantidade_insumo: numero(b.quantidade_insumo),
        unidade_insumo: texto(b.unidade_insumo, 30),
        custo_insumo: numero(b.custo_insumo),
        data_uso: data(b.data_uso),
      };
      if (!c.nome_insumo) return { erro: 'Informe o nome do material.' };
      if (c.quantidade_insumo == null) return { erro: 'Informe a quantidade usada.' };
      if (c.quantidade_insumo === undefined || c.custo_insumo === undefined) return { erro: 'Há um número inválido no formulário.' };
      if (!c.data_uso) return { erro: 'Informe a data de uso.' };
      return { campos: c };
    },
  },
  despesas: {
    tabela: 'despesas', pk: 'id_despesa',
    ler(b) {
      const c = {
        descricao_despesa: texto(b.descricao_despesa, 200),
        categoria_despesa: texto(b.categoria_despesa, 60),
        valor_despesa: numero(b.valor_despesa),
        data_despesa: data(b.data_despesa),
      };
      if (!c.descricao_despesa) return { erro: 'Descreva a despesa.' };
      if (c.valor_despesa == null || c.valor_despesa === undefined) return { erro: 'Informe um valor válido.' };
      if (!c.data_despesa) return { erro: 'Informe a data da despesa.' };
      return { campos: c };
    },
  },
};

router.post('/api/producoes/:id/:tipo(atividades|mao-de-obra|insumos|despesas)', rota('cadastrar registro', async (req, res) => {
  const tipo = TIPOS[req.params.tipo];
  if (!tipo) return res.status(404).json({ erro: 'Tipo inválido.' });
  const id = idParam(req.params.id);
  if (!id || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Produção não encontrada.' });
  }
  const { erro, campos } = tipo.ler(req.body);
  if (erro) return res.status(400).json({ erro });
  const cols = Object.keys(campos);
  const { rows } = await pool.query(
    `INSERT INTO ${tipo.tabela} (producao_id, ${cols.join(', ')})
     VALUES ($1, ${cols.map((_, i) => '$' + (i + 2)).join(', ')}) RETURNING *`,
    [id, ...cols.map((k) => campos[k])]
  );
  res.status(201).json(rows[0]);
}));

router.put('/api/producoes/:id/:tipo(atividades|mao-de-obra|insumos|despesas)/:itemId', rota('editar registro', async (req, res) => {
  const tipo = TIPOS[req.params.tipo];
  if (!tipo) return res.status(404).json({ erro: 'Tipo inválido.' });
  const id = idParam(req.params.id);
  const itemId = idParam(req.params.itemId);
  if (!id || !itemId || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  const { erro, campos } = tipo.ler(req.body);
  if (erro) return res.status(400).json({ erro });
  const cols = Object.keys(campos);
  const { rows } = await pool.query(
    `UPDATE ${tipo.tabela} SET ${cols.map((k, i) => `${k} = $${i + 3}`).join(', ')}
      WHERE ${tipo.pk} = $1 AND producao_id = $2 RETURNING *`,
    [itemId, id, ...cols.map((k) => campos[k])]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Registro não encontrado.' });
  res.json(rows[0]);
}));

// Marcar mão de obra como paga / não paga
router.put('/api/producoes/:id/mao-de-obra/:itemId/pago', rota('marcar pagamento', async (req, res) => {
  const id = idParam(req.params.id);
  const itemId = idParam(req.params.itemId);
  if (!id || !itemId || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  const pago = !!req.body.pago;
  const { rows } = await pool.query(
    `UPDATE mao_de_obra SET pago = $1, data_pagamento = $2
      WHERE id_mao_de_obra = $3 AND producao_id = $4 RETURNING *`,
    [pago, pago ? hojeISO() : null, itemId, id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Registro não encontrado.' });
  // Pagou: o aviso de atraso deixa de fazer sentido
  if (pago) await pool.query('DELETE FROM notificacoes WHERE mao_de_obra_id = $1', [itemId]);
  res.json(rows[0]);
}));

router.delete('/api/producoes/:id/:tipo(atividades|mao-de-obra|insumos|despesas)/:itemId', rota('excluir registro', async (req, res) => {
  const tipo = TIPOS[req.params.tipo];
  if (!tipo) return res.status(404).json({ erro: 'Tipo inválido.' });
  const id = idParam(req.params.id);
  const itemId = idParam(req.params.itemId);
  if (!id || !itemId || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  const { rowCount } = await pool.query(
    `DELETE FROM ${tipo.tabela} WHERE ${tipo.pk} = $1 AND producao_id = $2`,
    [itemId, id]
  );
  if (!rowCount) return res.status(404).json({ erro: 'Registro não encontrado.' });
  res.json({ ok: true });
}));

// ---------- Transporte (tabela transporte + associação producao_transporte) ----------

function lerTransporte(b) {
  const c = {
    tipo_transporte: texto(b.tipo_transporte, 120),
    destino_transporte: texto(b.destino_transporte, 160),
    contato_emergencia: texto(b.contato_emergencia, 40),
    data: data(b.data),
    quantidade_producao: numero(b.quantidade_producao),
  };
  if (!c.tipo_transporte) return { erro: 'Informe o tipo de transporte.' };
  if (!c.data) return { erro: 'Informe a data do transporte.' };
  if (c.quantidade_producao === undefined) return { erro: 'Quantidade inválida.' };
  return { campos: c };
}

router.post('/api/producoes/:id/transportes', rota('cadastrar transporte', async (req, res) => {
  const id = idParam(req.params.id);
  if (!id || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Produção não encontrada.' });
  }
  const { erro, campos: c } = lerTransporte(req.body);
  if (erro) return res.status(400).json({ erro });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(
      'INSERT INTO transporte (tipo_transporte, contato_emergencia, destino_transporte) VALUES ($1, $2, $3) RETURNING *',
      [c.tipo_transporte, c.contato_emergencia, c.destino_transporte]
    );
    const pt = await client.query(
      'INSERT INTO producao_transporte (producao_id, transporte_id, data, quantidade_producao) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, t.rows[0].id_transporte, c.data, c.quantidade_producao]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...t.rows[0], ...pt.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.put('/api/producoes/:id/transportes/:itemId', rota('editar transporte', async (req, res) => {
  const id = idParam(req.params.id);
  const itemId = idParam(req.params.itemId);
  if (!id || !itemId || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  const { erro, campos: c } = lerTransporte(req.body);
  if (erro) return res.status(400).json({ erro });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pt = await client.query(
      `UPDATE producao_transporte SET data = $1, quantidade_producao = $2
        WHERE id_producao_transporte = $3 AND producao_id = $4 RETURNING *`,
      [c.data, c.quantidade_producao, itemId, id]
    );
    if (!pt.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Registro não encontrado.' });
    }
    const t = await client.query(
      `UPDATE transporte SET tipo_transporte = $1, contato_emergencia = $2, destino_transporte = $3
        WHERE id_transporte = $4 RETURNING *`,
      [c.tipo_transporte, c.contato_emergencia, c.destino_transporte, pt.rows[0].transporte_id]
    );
    await client.query('COMMIT');
    res.json({ ...t.rows[0], ...pt.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.delete('/api/producoes/:id/transportes/:itemId', rota('excluir transporte', async (req, res) => {
  const id = idParam(req.params.id);
  const itemId = idParam(req.params.itemId);
  if (!id || !itemId || !(await producaoDoUsuario(id, req.session.userId))) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  const { rows } = await pool.query(
    'DELETE FROM producao_transporte WHERE id_producao_transporte = $1 AND producao_id = $2 RETURNING transporte_id',
    [itemId, id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Registro não encontrado.' });
  await pool.query('DELETE FROM transporte WHERE id_transporte = $1', [rows[0].transporte_id]);
  res.json({ ok: true });
}));

module.exports = router;
module.exports.registrosDaProducao = registrosDaProducao;
