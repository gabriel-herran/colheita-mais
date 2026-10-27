'use strict';

// Dados para a tela "Visão Gráfica" e o resumo da tela principal.

const express = require('express');
const pool = require('../db/pool');
const { requireAuth, idParam, data, rota } = require('./util');

const router = express.Router();
router.use(['/api/graficos', '/api/resumo'], requireAuth);

// Registros das produções do usuário filtrados por período/propriedade/produção.
// ?de=AAAA-MM-DD &ate=AAAA-MM-DD &propriedade=ID &producao=ID
router.get('/api/graficos', rota('dados dos gráficos', async (req, res) => {
  const de = data(req.query.de) || '1900-01-01';
  const ate = data(req.query.ate) || '2999-12-31';
  const propId = idParam(req.query.propriedade);
  const prodId = idParam(req.query.producao);

  // Produções visíveis para o filtro escolhido
  const { rows: producoes } = await pool.query(
    `SELECT pr.id_producao, pr.nome_producao, pr.conteudo_producao, p.id_propriedade, p.nome_propriedade
       FROM producao pr
       JOIN producao_propriedade pp ON pp.producao_id = pr.id_producao
       JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
      WHERE p.usuario_id = $1
      ORDER BY p.posicao NULLS LAST, pr.posicao NULLS LAST`,
    [req.session.userId]
  );
  const ids = producoes
    .filter((p) => (!propId || p.id_propriedade === propId) && (!prodId || p.id_producao === prodId))
    .map((p) => p.id_producao);

  const vazio = { producoes, mao_de_obra: [], insumos: [], despesas: [], atividades: [], transportes: [] };
  if (!ids.length) return res.json(vazio);

  const [mao, insumos, despesas, atividades, transportes] = await Promise.all([
    pool.query(
      `SELECT producao_id, data_trabalhada AS data, gasto_total AS valor, quantidade_mao_de_obra AS quantidade
         FROM mao_de_obra WHERE producao_id = ANY($1) AND data_trabalhada BETWEEN $2 AND $3`,
      [ids, de, ate]
    ),
    pool.query(
      `SELECT producao_id, COALESCE(data_uso, criado_em::date) AS data, custo_insumo AS valor, tipo_insumo AS categoria
         FROM insumos WHERE producao_id = ANY($1) AND COALESCE(data_uso, criado_em::date) BETWEEN $2 AND $3`,
      [ids, de, ate]
    ),
    pool.query(
      `SELECT producao_id, data_despesa AS data, valor_despesa AS valor, categoria_despesa AS categoria
         FROM despesas WHERE producao_id = ANY($1) AND data_despesa BETWEEN $2 AND $3`,
      [ids, de, ate]
    ),
    pool.query(
      `SELECT producao_id, (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS data
         FROM atividades WHERE producao_id = ANY($1)
          AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2 AND $3`,
      [ids, de, ate]
    ),
    pool.query(
      `SELECT producao_id, data, quantidade_producao AS quantidade
         FROM producao_transporte WHERE producao_id = ANY($1) AND data BETWEEN $2 AND $3`,
      [ids, de, ate]
    ),
  ]);

  res.json({
    ...vazio,
    mao_de_obra: mao.rows,
    insumos: insumos.rows,
    despesas: despesas.rows,
    atividades: atividades.rows,
    transportes: transportes.rows,
  });
}));

// Números do "Resumo Geral" da tela principal
router.get('/api/resumo', rota('resumo', async (req, res) => {
  const uid = req.session.userId;
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM propriedades WHERE usuario_id = $1) AS propriedades,
       (SELECT COUNT(*)::int FROM producao_propriedade pp
          JOIN propriedades p ON p.id_propriedade = pp.propriedade_id WHERE p.usuario_id = $1) AS producoes,
       (SELECT COUNT(*)::int FROM eventos_calendario
          WHERE usuario_id = $1 AND data_evento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS eventos_semana,
       (SELECT COALESCE(SUM(v), 0) FROM (
          SELECT d.valor_despesa AS v FROM despesas d
            JOIN producao_propriedade pp ON pp.producao_id = d.producao_id
            JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
           WHERE p.usuario_id = $1 AND d.data_despesa >= date_trunc('month', CURRENT_DATE)
          UNION ALL
          SELECT m.gasto_total FROM mao_de_obra m
            JOIN producao_propriedade pp ON pp.producao_id = m.producao_id
            JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
           WHERE p.usuario_id = $1 AND m.data_trabalhada >= date_trunc('month', CURRENT_DATE)
          UNION ALL
          SELECT i.custo_insumo FROM insumos i
            JOIN producao_propriedade pp ON pp.producao_id = i.producao_id
            JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
           WHERE p.usuario_id = $1 AND COALESCE(i.data_uso, i.criado_em::date) >= date_trunc('month', CURRENT_DATE)
        ) g) AS gastos_mes`,
    [uid]
  );
  res.json(rows[0]);
}));

module.exports = router;
