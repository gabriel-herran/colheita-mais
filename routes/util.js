'use strict';

// Funções auxiliares compartilhadas pelas rotas da API.

const pool = require('../db/pool');

// Bloqueia a rota para quem não está logado.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ erro: 'Não autenticado.' });
}

// Converte o parâmetro :id da URL em inteiro (ou null se inválido).
function idParam(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Texto opcional: '' vira null e o resto é aparado.
function texto(value, max = 1000) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

// Número opcional no formato brasileiro ("1.450,50") ou com ponto ("1450.50").
// Retorna undefined se inválido.
function numero(value) {
  if (value === '' || value == null) return null;
  let s = String(value).trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Data no formato AAAA-MM-DD (opcional). Retorna undefined se inválida.
function data(value) {
  if (value === '' || value == null) return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return undefined;
  return s;
}

// Garante que a produção pertence ao usuário logado. Devolve a linha ou null.
async function producaoDoUsuario(producaoId, userId) {
  const { rows } = await pool.query(
    `SELECT pr.*, p.id_propriedade, p.nome_propriedade, pp.ferramentas_producao
       FROM producao pr
       JOIN producao_propriedade pp ON pp.producao_id = pr.id_producao
       JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
      WHERE pr.id_producao = $1 AND p.usuario_id = $2
      LIMIT 1`,
    [producaoId, userId]
  );
  return rows[0] || null;
}

// Envolve um handler async e responde 500 em caso de erro inesperado.
function rota(nome, fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`Erro em ${nome}:`, err);
      if (!res.headersSent) res.status(500).json({ erro: 'Erro interno.' });
    }
  };
}

module.exports = { requireAuth, idParam, texto, numero, data, producaoDoUsuario, rota };
