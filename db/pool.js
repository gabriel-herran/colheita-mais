'use strict';

const { Pool, types } = require('pg');
const config = require('../config');

// Colunas DATE voltam como texto 'AAAA-MM-DD' (sem conversão de fuso horário).
types.setTypeParser(1082, (v) => v);

// Na hospedagem o banco vem por DATABASE_URL (com SSL); no computador, por config.db.
const opcoes = config.databaseUrl
  ? {
      connectionString: config.databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
    }
  : config.db;

// Pool de conexões reutilizado por toda a aplicação.
const pool = new Pool(opcoes);

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = pool;
