'use strict';

// Configurações do Colheita+.
//
// No seu computador: os dados do PostgreSQL ficam em config.local.js
// (esse arquivo NÃO vai para o GitHub, para a senha não ficar pública).
// Na hospedagem (Render): tudo vem das variáveis de ambiente
// DATABASE_URL, SESSION_SECRET e PORT.

let local = {};
try {
  local = require('./config.local');
} catch (_) {
  // Sem config.local.js (ex.: no Render): usa só as variáveis de ambiente.
}

const env = process.env;

module.exports = {
  // Endereço completo do banco (usado na hospedagem)
  databaseUrl: env.DATABASE_URL || null,

  // Conexão com o PostgreSQL local (usado no seu computador)
  db: local.db || {
    host: env.PGHOST || 'localhost',
    port: Number(env.PGPORT) || 5432,
    user: env.PGUSER || 'postgres',
    password: env.PGPASSWORD || '',
    database: env.PGDATABASE || 'colheita',
  },

  // Porta do site (o Render define a porta sozinho)
  port: Number(env.PORT) || local.port || 3000,

  // Segredo que assina os cookies de login
  sessionSecret: env.SESSION_SECRET || local.sessionSecret || 'colheita-mais-dev-secret',

  // true quando roda na hospedagem
  producao: env.NODE_ENV === 'production',
};
