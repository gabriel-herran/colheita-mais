'use strict';

// Copia TODOS os dados do banco do seu computador para o banco do Render.
//
// Uso: dê dois cliques em scripts\migrar-para-render.bat
//      (ou:  node scripts/migrar-para-render.js)
//
// O programa pede a "External Database URL" do banco colheita-db no Render.
// Ela fica só no seu computador: não é salva em arquivo nem enviada a ninguém.
//
// ATENÇÃO: o que já existir no banco do Render é APAGADO e substituído pelos
// dados do computador (o programa mostra o que vai apagar e pede confirmação).

const readline = require('readline');
const { Client, types } = require('pg');
const config = require('../config');

// Datas (DATE) e horários sem fuso são copiados exatamente como estão.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1114, (v) => v);

// Ordem respeitando as ligações entre tabelas (pai antes do filho).
const ORDEM = [
  'usuarios', 'propriedades', 'producao', 'producao_propriedade', 'transporte',
  'producao_transporte', 'mao_de_obra', 'insumos', 'atividades', 'despesas',
  'eventos_calendario', 'forum_discussoes', 'forum_comentarios', 'notificacoes',
];
// Sessões de login não são copiadas (cada site tem as suas).
const IGNORAR = ['session'];

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r.trim()); }));
}

async function tabelas(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return rows.map((r) => r.table_name).filter((t) => !IGNORAR.includes(t));
}

async function colunas(client, tabela) {
  const { rows } = await client.query(
    `SELECT column_name, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tabela]
  );
  return rows;
}

async function contar(client, lista) {
  const r = {};
  for (const t of lista) r[t] = (await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)).rows[0].n;
  return r;
}

async function main() {
  console.log('\n=== Colheita+: copiar dados do computador para o Render ===\n');

  let url = process.argv[2] || process.env.RENDER_DATABASE_URL;
  if (!url) {
    console.log('No Render, abra o banco "colheita-db", clique em "Connect" e copie a');
    console.log('"External Database URL" (começa com postgresql://).\n');
    url = await perguntar('Cole aqui a External Database URL e aperte Enter:\n> ');
  }
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('Endereço inválido: ele deve começar com postgresql://');

  const local = new Client(config.db);
  const remoto = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });
  await local.connect();
  console.log('\nConectando ao banco do Render...');
  await remoto.connect();
  console.log('Conectado!\n');

  const tabsLocal = await tabelas(local);
  const tabsRemoto = await tabelas(remoto);
  const faltando = tabsLocal.filter((t) => !tabsRemoto.includes(t));
  if (faltando.length) {
    throw new Error(`O banco do Render ainda não tem as tabelas: ${faltando.join(', ')}.\n` +
      'Abra o site no Render uma vez (ele cria as tabelas ao iniciar) e rode de novo.');
  }
  const lista = [...ORDEM.filter((t) => tabsLocal.includes(t)), ...tabsLocal.filter((t) => !ORDEM.includes(t))];

  const qtdLocal = await contar(local, lista);
  const qtdRemoto = await contar(remoto, lista);
  console.log('Tabela'.padEnd(24) + 'Computador'.padStart(12) + 'Render hoje'.padStart(14));
  for (const t of lista) console.log(t.padEnd(24) + String(qtdLocal[t]).padStart(12) + String(qtdRemoto[t]).padStart(14));

  const temNoRender = Object.values(qtdRemoto).some((n) => n > 0);
  console.log(temNoRender
    ? '\nATENÇÃO: o que está no Render (coluna da direita) será APAGADO e trocado pelos dados do computador.'
    : '\nO banco do Render está vazio.');
  const ok = process.env.MIGRAR_SEM_PERGUNTAR === '1' ? 'SIM' : await perguntar('Digite SIM para copiar tudo: ');
  if (ok.toUpperCase() !== 'SIM') {
    console.log('Cancelado. Nada foi alterado.');
    await local.end();
    await remoto.end();
    return;
  }

  try {
    await remoto.query('BEGIN');
    await remoto.query(`TRUNCATE ${lista.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

    for (const t of lista) {
      const colsLocal = await colunas(local, t);
      const colsRemoto = (await colunas(remoto, t)).map((c) => c.column_name);
      const cols = colsLocal.map((c) => c.column_name).filter((c) => colsRemoto.includes(c));
      const { rows } = await local.query(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${t}"`);

      // Insere em blocos de 200 linhas
      for (let i = 0; i < rows.length; i += 200) {
        const bloco = rows.slice(i, i + 200);
        const valores = [];
        const marcas = bloco.map((r) => `(${cols.map((c) => { valores.push(r[c]); return '$' + valores.length; }).join(', ')})`);
        await remoto.query(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${marcas.join(', ')}`, valores);
      }

      // Ajusta o contador de IDs para os próximos cadastros não repetirem número
      for (const c of colsLocal.filter((x) => /nextval/.test(x.column_default || ''))) {
        await remoto.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX("${c.column_name}") FROM "${t}"), 0) + 1, false)`,
          [t, c.column_name]
        );
      }
      console.log(`  ✓ ${t}: ${rows.length} registro(s)`);
    }
    await remoto.query('COMMIT');
  } catch (err) {
    await remoto.query('ROLLBACK').catch(() => {});
    throw err;
  }

  // Confere se tudo chegou
  const depois = await contar(remoto, lista);
  const diferentes = lista.filter((t) => depois[t] !== qtdLocal[t]);
  await local.end();
  await remoto.end();
  if (diferentes.length) throw new Error('Algumas tabelas ficaram diferentes: ' + diferentes.join(', '));
  console.log('\nPronto! Todos os dados foram copiados para o Render. As contas entram com as mesmas senhas de antes.\n');
}

main()
  .catch((err) => {
    console.error('\nERRO: ' + err.message + '\nNada foi alterado no Render se o erro aconteceu durante a cópia.\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.argv[2] && process.stdin.isTTY && process.env.MIGRAR_SEM_PERGUNTAR !== '1') {
      await perguntar('Aperte Enter para fechar.');
    }
  });
