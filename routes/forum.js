'use strict';

// Fórum: discussões entre produtores e seus comentários.

const express = require('express');
const pool = require('../db/pool');
const { requireAuth, idParam, texto, rota } = require('./util');

const router = express.Router();
router.use('/api/forum', requireAuth);

// Tags disponíveis para classificar as discussões.
const TAGS = [
  'Dica', 'Dúvida', 'Pragas e Doenças', 'Irrigação', 'Solo e Adubação', 'Sementes',
  'Plantio', 'Colheita', 'Clima', 'Máquinas e Equipamentos', 'Mercado e Preços',
  'Gestão e Finanças', 'Mão de Obra', 'Transporte e Logística', 'Pecuária',
  'Orgânicos', 'Sustentabilidade', 'Legislação', 'Tecnologia no Campo', 'Experiência',
];

router.get('/api/forum/tags', (req, res) => res.json(TAGS));

// Discussões em que o usuário comentou (atalhos do menu lateral)
router.get('/api/forum/participando', rota('discussões comentadas', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id_discussao, d.titulo, d.trancada, MAX(c.criado_em) AS ultimo_comentario
       FROM forum_comentarios c JOIN forum_discussoes d ON d.id_discussao = c.discussao_id
      WHERE c.usuario_id = $1
      GROUP BY d.id_discussao
      ORDER BY ultimo_comentario DESC
      LIMIT 6`,
    [req.session.userId]
  );
  res.json(rows);
}));

// Listar discussões com busca e filtros:
// ?q=texto &tags=Dica,Dúvida &status=abertas|trancadas &minhas=1 &ordem=recentes|antigas|comentadas
router.get('/api/forum', rota('listar discussões', async (req, res) => {
  const cond = [];
  const vals = [req.session.userId];
  const q = texto(req.query.q, 200);
  if (q) {
    vals.push('%' + q.replace(/[%_\\]/g, '\\$&') + '%');
    cond.push(`(d.titulo ILIKE $${vals.length} OR d.descricao ILIKE $${vals.length})`);
  }
  const tags = String(req.query.tags || '').split(',').map((t) => t.trim()).filter((t) => TAGS.includes(t));
  if (tags.length) {
    vals.push(tags);
    cond.push(`d.tags && $${vals.length}::text[]`);
  }
  if (req.query.status === 'abertas') cond.push('NOT d.trancada');
  if (req.query.status === 'trancadas') cond.push('d.trancada');
  if (req.query.minhas === '1') cond.push('d.usuario_id = $1');

  const ordem = {
    antigas: 'd.criado_em ASC',
    comentadas: 'comentarios DESC, d.criado_em DESC',
  }[req.query.ordem] || 'd.criado_em DESC';

  const { rows } = await pool.query(
    `SELECT d.id_discussao, d.titulo, LEFT(d.descricao, 280) AS resumo, d.tags, d.trancada, d.criado_em,
            u.nome_usuario AS autor, (d.usuario_id = $1) AS sou_dono,
            (SELECT COUNT(*)::int FROM forum_comentarios c WHERE c.discussao_id = d.id_discussao) AS comentarios
       FROM forum_discussoes d JOIN usuarios u ON u.id_usuario = d.usuario_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY ${ordem}
      LIMIT 200`,
    vals
  );
  res.json(rows);
}));

// Título, descrição e ao menos uma tag são obrigatórios.
function lerDiscussao(b) {
  const titulo = texto(b.titulo, 160);
  const descricao = texto(b.descricao, 10000);
  const tags = Array.isArray(b.tags) ? [...new Set(b.tags.filter((t) => TAGS.includes(t)))] : [];
  if (!titulo) return { erro: 'O título é obrigatório.' };
  if (!descricao) return { erro: 'A descrição é obrigatória.' };
  if (!tags.length) return { erro: 'Escolha ao menos uma tag.' };
  return { titulo, descricao, tags: tags.slice(0, 5) };
}

// Iniciar uma discussão
router.post('/api/forum', rota('criar discussão', async (req, res) => {
  const { erro, titulo, descricao, tags } = lerDiscussao(req.body);
  if (erro) return res.status(400).json({ erro });
  const { rows } = await pool.query(
    'INSERT INTO forum_discussoes (usuario_id, titulo, descricao, tags) VALUES ($1, $2, $3, $4) RETURNING id_discussao',
    [req.session.userId, titulo, descricao, tags]
  );
  res.status(201).json(rows[0]);
}));

// Editar discussão (somente o dono)
router.put('/api/forum/:id', rota('editar discussão', async (req, res) => {
  const { erro, titulo, descricao, tags } = lerDiscussao(req.body);
  if (erro) return res.status(400).json({ erro });
  const { rows } = await pool.query(
    `UPDATE forum_discussoes SET titulo = $1, descricao = $2, tags = $3
      WHERE id_discussao = $4 AND usuario_id = $5 RETURNING id_discussao`,
    [titulo, descricao, tags, idParam(req.params.id), req.session.userId]
  );
  if (!rows.length) return res.status(403).json({ erro: 'Somente o criador pode editar esta discussão.' });
  res.json(rows[0]);
}));

// Ver uma discussão completa com os comentários
router.get('/api/forum/:id', rota('ver discussão', async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await pool.query(
    `SELECT d.id_discussao, d.titulo, d.descricao, d.tags, d.trancada, d.criado_em,
            u.nome_usuario AS autor, u.foto_usuario AS autor_foto, (d.usuario_id = $2) AS sou_dono
       FROM forum_discussoes d JOIN usuarios u ON u.id_usuario = d.usuario_id
      WHERE d.id_discussao = $1`,
    [id, req.session.userId]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Discussão não encontrada.' });
  const coments = await pool.query(
    `SELECT c.id_comentario, c.texto, c.criado_em, u.nome_usuario AS autor, u.foto_usuario AS autor_foto,
            (c.usuario_id = $2) AS sou_autor
       FROM forum_comentarios c JOIN usuarios u ON u.id_usuario = c.usuario_id
      WHERE c.discussao_id = $1 ORDER BY c.criado_em ASC`,
    [id, req.session.userId]
  );
  res.json({ ...rows[0], comentarios: coments.rows });
}));

// Comentar (bloqueado se a discussão estiver trancada)
router.post('/api/forum/:id/comentarios', rota('comentar', async (req, res) => {
  const id = idParam(req.params.id);
  const txt = texto(req.body.texto, 5000);
  if (!txt) return res.status(400).json({ erro: 'Escreva um comentário.' });
  const { rows } = await pool.query(
    'SELECT usuario_id, titulo, trancada FROM forum_discussoes WHERE id_discussao = $1',
    [id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Discussão não encontrada.' });
  const disc = rows[0];
  if (disc.trancada) return res.status(403).json({ erro: 'Esta discussão está trancada.' });

  const novo = await pool.query(
    'INSERT INTO forum_comentarios (discussao_id, usuario_id, texto) VALUES ($1, $2, $3) RETURNING id_comentario',
    [id, req.session.userId, txt]
  );

  // Notifica o dono da discussão (se não for ele mesmo comentando)
  if (disc.usuario_id !== req.session.userId) {
    const titulo = disc.titulo.length > 80 ? disc.titulo.slice(0, 77) + '...' : disc.titulo;
    await pool.query(
      'INSERT INTO notificacoes (usuario_id, mensagem, link, discussao_id) VALUES ($1, $2, $3, $4)',
      [disc.usuario_id, `${req.session.userNome || 'Um produtor'} comentou na sua discussão "${titulo}"`,
       `discussao.html?id=${id}`, id]
    );
  }
  res.status(201).json(novo.rows[0]);
}));

// Editar o próprio comentário (não é possível se a discussão estiver trancada)
router.put('/api/forum/comentarios/:id', rota('editar comentário', async (req, res) => {
  const txt = texto(req.body.texto, 5000);
  if (!txt) return res.status(400).json({ erro: 'Escreva um comentário.' });
  const { rows } = await pool.query(
    `SELECT d.trancada FROM forum_comentarios c JOIN forum_discussoes d ON d.id_discussao = c.discussao_id
      WHERE c.id_comentario = $1 AND c.usuario_id = $2`,
    [idParam(req.params.id), req.session.userId]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Comentário não encontrado.' });
  if (rows[0].trancada) return res.status(403).json({ erro: 'Esta discussão está trancada.' });
  await pool.query('UPDATE forum_comentarios SET texto = $1 WHERE id_comentario = $2', [txt, idParam(req.params.id)]);
  res.json({ ok: true });
}));

// Excluir o próprio comentário
router.delete('/api/forum/comentarios/:id', rota('excluir comentário', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM forum_comentarios WHERE id_comentario = $1 AND usuario_id = $2',
    [idParam(req.params.id), req.session.userId]
  );
  if (!rowCount) return res.status(404).json({ erro: 'Comentário não encontrado.' });
  res.json({ ok: true });
}));

// Trancar / destrancar (somente o dono)
router.put('/api/forum/:id/trancar', rota('trancar discussão', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE forum_discussoes SET trancada = $1 WHERE id_discussao = $2 AND usuario_id = $3 RETURNING trancada',
    [!!req.body.trancada, idParam(req.params.id), req.session.userId]
  );
  if (!rows.length) return res.status(403).json({ erro: 'Somente o criador pode trancar esta discussão.' });
  res.json(rows[0]);
}));

// Excluir discussão (somente o dono)
router.delete('/api/forum/:id', rota('excluir discussão', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM forum_discussoes WHERE id_discussao = $1 AND usuario_id = $2',
    [idParam(req.params.id), req.session.userId]
  );
  if (!rowCount) return res.status(403).json({ erro: 'Somente o criador pode excluir esta discussão.' });
  res.json({ ok: true });
}));

module.exports = router;
