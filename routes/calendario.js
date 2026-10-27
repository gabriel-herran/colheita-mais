'use strict';

// Calendário (anotações por dia) e notificações do usuário.

const express = require('express');
const pool = require('../db/pool');
const { requireAuth, idParam, texto, data, rota } = require('./util');

const router = express.Router();
router.use(['/api/eventos', '/api/notificacoes'], requireAuth);

// Quantos dias antes do evento o aviso começa a aparecer.
const DIAS_AVISO = 7;

// ================= EVENTOS DO CALENDÁRIO =================

// Listar eventos (opcionalmente entre ?de=AAAA-MM-DD&ate=AAAA-MM-DD)
router.get('/api/eventos', rota('listar eventos', async (req, res) => {
  const de = data(req.query.de) || '1900-01-01';
  const ate = data(req.query.ate) || '2999-12-31';
  const { rows } = await pool.query(
    `SELECT * FROM eventos_calendario
      WHERE usuario_id = $1 AND data_evento BETWEEN $2 AND $3
      ORDER BY data_evento, criado_em`,
    [req.session.userId, de, ate]
  );
  res.json(rows);
}));

// Próximos eventos (hoje em diante) — usado no resumo da tela principal
router.get('/api/eventos/proximos', rota('próximos eventos', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM eventos_calendario
      WHERE usuario_id = $1 AND data_evento >= CURRENT_DATE
      ORDER BY data_evento, criado_em LIMIT 5`,
    [req.session.userId]
  );
  res.json(rows);
}));

router.post('/api/eventos', rota('criar evento', async (req, res) => {
  const data_evento = data(req.body.data_evento);
  const titulo_evento = texto(req.body.titulo_evento, 120);
  const descricao_evento = texto(req.body.descricao_evento, 2000);
  if (!data_evento) return res.status(400).json({ erro: 'Data inválida.' });
  if (!descricao_evento) return res.status(400).json({ erro: 'A descrição é obrigatória.' });
  const { rows } = await pool.query(
    `INSERT INTO eventos_calendario (usuario_id, data_evento, titulo_evento, descricao_evento)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.session.userId, data_evento, titulo_evento, descricao_evento]
  );
  res.status(201).json(rows[0]);
}));

router.put('/api/eventos/:id', rota('editar evento', async (req, res) => {
  const id = idParam(req.params.id);
  const data_evento = data(req.body.data_evento);
  const titulo_evento = texto(req.body.titulo_evento, 120);
  const descricao_evento = texto(req.body.descricao_evento, 2000);
  if (!data_evento) return res.status(400).json({ erro: 'Data inválida.' });
  if (!descricao_evento) return res.status(400).json({ erro: 'A descrição é obrigatória.' });
  const { rows } = await pool.query(
    `UPDATE eventos_calendario SET data_evento = $1, titulo_evento = $2, descricao_evento = $3
      WHERE id_evento = $4 AND usuario_id = $5 RETURNING *`,
    [data_evento, titulo_evento, descricao_evento, id, req.session.userId]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Anotação não encontrada.' });
  // Os avisos antigos podem ter data/nome desatualizados: são gerados de novo.
  await pool.query('DELETE FROM notificacoes WHERE evento_id = $1', [id]);
  res.json(rows[0]);
}));

router.delete('/api/eventos/:id', rota('excluir evento', async (req, res) => {
  const id = idParam(req.params.id);
  const { rowCount } = await pool.query(
    'DELETE FROM eventos_calendario WHERE id_evento = $1 AND usuario_id = $2',
    [id, req.session.userId]
  );
  if (!rowCount) return res.status(404).json({ erro: 'Anotação não encontrada.' });
  res.json({ ok: true });
}));

// ================= NOTIFICAÇÕES =================

function nomeDoEvento(ev) {
  if (ev.titulo_evento) return ev.titulo_evento;
  const d = ev.descricao_evento;
  return d.length > 60 ? d.slice(0, 57) + '...' : d;
}

// Gera (uma única vez por etapa) os avisos de eventos próximos:
// 7 dias, 3 dias, amanhã e no dia. A "chave" impede duplicados.
async function gerarAvisosCalendario(userId) {
  const { rows } = await pool.query(
    `SELECT id_evento, titulo_evento, descricao_evento, (data_evento - CURRENT_DATE) AS dias
       FROM eventos_calendario
      WHERE usuario_id = $1 AND data_evento BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int`,
    [userId, DIAS_AVISO]
  );
  for (const ev of rows) {
    const dias = Number(ev.dias);
    const etapa = dias === 0 ? 'hoje' : dias === 1 ? '1' : dias <= 3 ? '3' : '7';
    const nome = nomeDoEvento(ev);
    const mensagem =
      dias === 0 ? `Hoje é o dia de "${nome}"`
      : dias === 1 ? `Falta 1 dia para "${nome}"`
      : `Faltam ${dias} dias para "${nome}"`;
    await pool.query(
      `INSERT INTO notificacoes (usuario_id, mensagem, link, chave, evento_id)
       SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, $5::int
        WHERE NOT EXISTS (SELECT 1 FROM notificacoes WHERE usuario_id = $1::int AND chave = $4::varchar)
       ON CONFLICT (usuario_id, chave) DO NOTHING`,
      [userId, mensagem.slice(0, 300), 'calendario.html', `evento:${ev.id_evento}:${etapa}`, ev.id_evento]
    );
  }
}

// Avisa sobre mão de obra não paga: no dia do vencimento e quando passar do prazo.
async function gerarAvisosPagamento(userId) {
  const { rows } = await pool.query(
    `SELECT m.id_mao_de_obra, m.descricao_mao_de_obra, m.gasto_total, m.data_vencimento,
            (m.data_vencimento - CURRENT_DATE) AS dias, pr.id_producao, pr.nome_producao, p.id_propriedade
       FROM mao_de_obra m
       JOIN producao pr ON pr.id_producao = m.producao_id
       JOIN producao_propriedade pp ON pp.producao_id = pr.id_producao
       JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
      WHERE p.usuario_id = $1 AND NOT m.pago AND m.data_vencimento IS NOT NULL
        AND m.data_vencimento <= CURRENT_DATE`,
    [userId]
  );
  for (const m of rows) {
    const atrasado = Number(m.dias) < 0;
    const valor = Number(m.gasto_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const [a, mes, d] = String(m.data_vencimento).split('-');
    const mensagem = atrasado
      ? `Pagamento atrasado: "${m.descricao_mao_de_obra}" (${valor}) da produção "${m.nome_producao}" venceu em ${d}/${mes}/${a}`
      : `Hoje vence o pagamento de "${m.descricao_mao_de_obra}" (${valor}) da produção "${m.nome_producao}"`;
    await pool.query(
      `INSERT INTO notificacoes (usuario_id, mensagem, link, chave, mao_de_obra_id)
       SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, $5::int
        WHERE NOT EXISTS (SELECT 1 FROM notificacoes WHERE usuario_id = $1::int AND chave = $4::varchar)
       ON CONFLICT (usuario_id, chave) DO NOTHING`,
      [userId, mensagem.slice(0, 300), `mao-de-obra.html?propriedade=${m.id_propriedade}&producao=${m.id_producao}`,
       `pagamento:${m.id_mao_de_obra}:${atrasado ? 'atrasado' : 'hoje'}`, m.id_mao_de_obra]
    );
  }
}

router.get('/api/notificacoes', rota('listar notificações', async (req, res) => {
  await gerarAvisosCalendario(req.session.userId);
  await gerarAvisosPagamento(req.session.userId);
  const { rows } = await pool.query(
    `SELECT id_notificacao, mensagem, link, lida, criado_em FROM notificacoes
      WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 40`,
    [req.session.userId]
  );
  const naoLidas = await pool.query(
    'SELECT COUNT(*)::int AS n FROM notificacoes WHERE usuario_id = $1 AND NOT lida',
    [req.session.userId]
  );
  res.json({ nao_lidas: naoLidas.rows[0].n, notificacoes: rows });
}));

// Marcar todas como lidas
router.put('/api/notificacoes/lidas', rota('marcar notificações', async (req, res) => {
  await pool.query('UPDATE notificacoes SET lida = true WHERE usuario_id = $1', [req.session.userId]);
  res.json({ ok: true });
}));

router.put('/api/notificacoes/:id/lida', rota('marcar notificação', async (req, res) => {
  await pool.query(
    'UPDATE notificacoes SET lida = true WHERE id_notificacao = $1 AND usuario_id = $2',
    [idParam(req.params.id), req.session.userId]
  );
  res.json({ ok: true });
}));

router.delete('/api/notificacoes/:id', rota('excluir notificação', async (req, res) => {
  await pool.query(
    'DELETE FROM notificacoes WHERE id_notificacao = $1 AND usuario_id = $2',
    [idParam(req.params.id), req.session.userId]
  );
  res.json({ ok: true });
}));

module.exports = router;
