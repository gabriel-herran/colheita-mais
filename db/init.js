'use strict';

// Cria o banco (caso não exista) e aplica o schema.sql.
// Uso:  npm run init-db

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('../config');

const DB_NAME = config.db.database;
const baseConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
};

async function ensureDatabase() {
  // Conecta ao banco "postgres" padrão para poder criar o nosso banco.
  const admin = new Client({ ...baseConfig, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [DB_NAME]
  );
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Banco "${DB_NAME}" criado.`);
  } else {
    console.log(`Banco "${DB_NAME}" já existe.`);
  }
  await admin.end();
}

async function applySchema() {
  const client = new Client({ ...baseConfig, database: DB_NAME });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('Schema aplicado com sucesso (tabelas prontas).');
  await client.end();
}

(async () => {
  try {
    await ensureDatabase();
    await applySchema();
    console.log('Banco de dados pronto para uso. ✅');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao inicializar o banco:', err.message);
    process.exit(1);
  }
})();
