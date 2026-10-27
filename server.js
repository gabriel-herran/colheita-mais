'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const PgSession = require('connect-pg-simple')(session);
const pool = require('./db/pool');
const config = require('./config');

const app = express();
const PORT = config.port || 3000;

// Na hospedagem (Render) o site fica atrás de um proxy HTTPS.
if (config.producao) app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(
  session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: config.sessionSecret || 'colheita-mais-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
      sameSite: 'lax',
      secure: config.producao, // só envia o cookie por HTTPS na hospedagem
    },
  })
);

// ---------- Helpers ----------
const { requireAuth } = require('./routes/util');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ================= AUTENTICAÇÃO =================

// Cadastro
app.post('/api/register', async (req, res) => {
  try {
    let { nome, email, senha, confirmarSenha } = req.body;
    nome = (nome || '').trim();
    email = (email || '').trim().toLowerCase();

    if (!nome || !email || !senha || !confirmarSenha) {
      return res.status(400).json({ erro: 'Preencha todos os campos.' });
    }
    if (!emailRegex.test(email)) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
    }
    if (senha !== confirmarSenha) {
      return res.status(400).json({ erro: 'As senhas não coincidem.' });
    }

    const existe = await pool.query('SELECT 1 FROM usuarios WHERE login_usuario = $1', [email]);
    if (existe.rowCount > 0) {
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome_usuario, login_usuario, senha_usuario) VALUES ($1, $2, $3) RETURNING id_usuario, nome_usuario, login_usuario',
      [nome, email, senhaHash]
    );

    const user = rows[0];
    req.session.userId = user.id_usuario;
    req.session.userNome = user.nome_usuario;
    return res.status(201).json({ id_usuario: user.id_usuario, nome_usuario: user.nome_usuario, login_usuario: user.login_usuario });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar.' });
  }
});

// Login (aceita nome OU e-mail)
app.post('/api/login', async (req, res) => {
  try {
    let { login, senha, confirmarSenha } = req.body;
    login = (login || '').trim();
    if (!login || !senha) {
      return res.status(400).json({ erro: 'Informe nome/e-mail e senha.' });
    }
    if (!confirmarSenha) {
      return res.status(400).json({ erro: 'Confirme sua senha.' });
    }
    if (confirmarSenha !== senha) {
      return res.status(400).json({ erro: 'As senhas não coincidem.' });
    }

    const { rows } = await pool.query(
      'SELECT id_usuario, nome_usuario, login_usuario, senha_usuario FROM usuarios WHERE login_usuario = $1 OR nome_usuario = $2 LIMIT 1',
      [login.toLowerCase(), login]
    );
    if (rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.senha_usuario);
    if (!ok) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    req.session.userId = user.id_usuario;
    req.session.userNome = user.nome_usuario;
    return res.json({ id_usuario: user.id_usuario, nome_usuario: user.nome_usuario, login_usuario: user.login_usuario });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno ao entrar.' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// Usuário atual
app.get('/api/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
  try {
    const { rows } = await pool.query(
      // O ID não é enviado: é uma informação interna da conta.
      'SELECT nome_usuario, login_usuario, foto_usuario, criado_em FROM usuarios WHERE id_usuario = $1',
      [req.session.userId]
    );
    if (rows.length === 0) return res.status(401).json({ erro: 'Não autenticado.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro no /api/me:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Alterar nome do usuário logado (o nome também serve para entrar, então não pode repetir)
app.put('/api/me/nome', requireAuth, async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim().slice(0, 120);
    if (!nome) {
      return res.status(400).json({ erro: 'Informe o novo nome.' });
    }
    const existe = await pool.query(
      'SELECT 1 FROM usuarios WHERE nome_usuario = $1 AND id_usuario <> $2',
      [nome, req.session.userId]
    );
    if (existe.rowCount > 0) {
      return res.status(409).json({ erro: 'Este nome já está em uso.' });
    }
    const { rows } = await pool.query(
      'UPDATE usuarios SET nome_usuario = $1 WHERE id_usuario = $2 RETURNING nome_usuario, login_usuario',
      [nome, req.session.userId]
    );
    req.session.userNome = rows[0].nome_usuario;
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao alterar nome:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Alterar e-mail (login) do usuário logado
app.put('/api/me/email', requireAuth, async (req, res) => {
  try {
    let { email } = req.body;
    email = (email || '').trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    const existe = await pool.query(
      'SELECT 1 FROM usuarios WHERE login_usuario = $1 AND id_usuario <> $2',
      [email, req.session.userId]
    );
    if (existe.rowCount > 0) {
      return res.status(409).json({ erro: 'Este e-mail já está em uso.' });
    }
    const { rows } = await pool.query(
      'UPDATE usuarios SET login_usuario = $1 WHERE id_usuario = $2 RETURNING id_usuario, nome_usuario, login_usuario',
      [email, req.session.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao alterar e-mail:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Alterar senha do usuário logado
app.put('/api/me/senha', requireAuth, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Preencha a senha atual e a nova senha.' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
    }
    const { rows } = await pool.query(
      'SELECT senha_usuario FROM usuarios WHERE id_usuario = $1',
      [req.session.userId]
    );
    if (rows.length === 0) return res.status(401).json({ erro: 'Não autenticado.' });

    const ok = await bcrypt.compare(senhaAtual, rows[0].senha_usuario);
    if (!ok) return res.status(400).json({ erro: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(novaSenha, 10);
    await pool.query('UPDATE usuarios SET senha_usuario = $1 WHERE id_usuario = $2', [hash, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Alterar foto de perfil do usuário logado
app.put('/api/me/foto', requireAuth, async (req, res) => {
  try {
    const { foto } = req.body;
    if (typeof foto !== 'string' || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(foto)) {
      return res.status(400).json({ erro: 'Imagem inválida.' });
    }
    if (foto.length > 4 * 1024 * 1024) {
      return res.status(413).json({ erro: 'Imagem muito grande.' });
    }
    await pool.query('UPDATE usuarios SET foto_usuario = $1 WHERE id_usuario = $2', [foto, req.session.userId]);
    res.json({ ok: true, foto_usuario: foto });
  } catch (err) {
    console.error('Erro ao alterar foto:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ================= PROPRIEDADES =================

// Listar
app.get('/api/propriedades', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM propriedades
        WHERE usuario_id = $1
        ORDER BY posicao ASC NULLS LAST, criado_em DESC`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar propriedades:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Consultar uma propriedade
app.get('/api/propriedades/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
    const { rows } = await pool.query(
      'SELECT * FROM propriedades WHERE id_propriedade = $1 AND usuario_id = $2',
      [id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Propriedade não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao consultar propriedade:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Criar
app.post('/api/propriedades', requireAuth, async (req, res) => {
  try {
    let { nome_propriedade, localizacao_propriedade, hectares_propriedade, cultura, descricao_propriedade } = req.body;
    nome_propriedade = (nome_propriedade || '').trim();
    if (!nome_propriedade) return res.status(400).json({ erro: 'O nome da propriedade é obrigatório.' });

    const area = hectares_propriedade === '' || hectares_propriedade == null ? null : Number(hectares_propriedade);
    if (area != null && (Number.isNaN(area) || area < 0)) {
      return res.status(400).json({ erro: 'Área inválida.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO propriedades (usuario_id, nome_propriedade, localizacao_propriedade, hectares_propriedade, cultura, descricao_propriedade, posicao)
       VALUES ($1, $2, $3, $4, $5, $6,
               (SELECT COALESCE(MAX(posicao), -1) + 1 FROM propriedades WHERE usuario_id = $1))
       RETURNING *`,
      [req.session.userId, nome_propriedade, localizacao_propriedade || null, area, cultura || null, descricao_propriedade || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar propriedade:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Reordenar (salva a nova ordem definida no "Reorganizar")
app.put('/api/propriedades/ordem', requireAuth, async (req, res) => {
  const { ordem } = req.body;
  if (!Array.isArray(ordem)) {
    return res.status(400).json({ erro: 'Ordem inválida.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ordem.length; i++) {
      const id = Number(ordem[i]);
      if (!Number.isInteger(id)) continue;
      await client.query(
        'UPDATE propriedades SET posicao = $1 WHERE id_propriedade = $2 AND usuario_id = $3',
        [i, id, req.session.userId]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao reordenar propriedades:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  } finally {
    client.release();
  }
});

// Atualizar
app.put('/api/propriedades/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    let { nome_propriedade, localizacao_propriedade, hectares_propriedade, cultura, descricao_propriedade } = req.body;
    nome_propriedade = (nome_propriedade || '').trim();
    if (!nome_propriedade) return res.status(400).json({ erro: 'O nome da propriedade é obrigatório.' });
    const area = hectares_propriedade === '' || hectares_propriedade == null ? null : Number(hectares_propriedade);

    const { rows } = await pool.query(
      `UPDATE propriedades
         SET nome_propriedade = $1, localizacao_propriedade = $2, hectares_propriedade = $3, cultura = $4, descricao_propriedade = $5
       WHERE id_propriedade = $6 AND usuario_id = $7 RETURNING *`,
      [nome_propriedade, localizacao_propriedade || null, area, cultura || null, descricao_propriedade || null, id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Propriedade não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar propriedade:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// Excluir
app.delete('/api/propriedades/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Remove antes as produções da propriedade (e seus transportes), que não
    // estão ligadas diretamente à tabela de propriedades.
    await pool.query(
      `DELETE FROM transporte WHERE id_transporte IN (
         SELECT pt.transporte_id FROM producao_transporte pt
           JOIN producao_propriedade pp ON pp.producao_id = pt.producao_id
           JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
          WHERE pp.propriedade_id = $1 AND p.usuario_id = $2)`,
      [id, req.session.userId]
    );
    await pool.query(
      `DELETE FROM producao WHERE id_producao IN (
         SELECT pp.producao_id FROM producao_propriedade pp
           JOIN propriedades p ON p.id_propriedade = pp.propriedade_id
          WHERE pp.propriedade_id = $1 AND p.usuario_id = $2)`,
      [id, req.session.userId]
    );
    const { rowCount } = await pool.query(
      'DELETE FROM propriedades WHERE id_propriedade = $1 AND usuario_id = $2',
      [id, req.session.userId]
    );
    if (rowCount === 0) return res.status(404).json({ erro: 'Propriedade não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir propriedade:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ================= PRODUÇÕES, CALENDÁRIO, FÓRUM, GRÁFICOS, PDFs =================
app.use(require('./routes/producoes'));
app.use(require('./routes/relatorios'));
app.use(require('./routes/calendario'));
app.use(require('./routes/forum'));
app.use(require('./routes/graficos'));

// ================= PÁGINAS =================

// Protege as páginas internas: sem sessão volta para o login.
// Precisa vir ANTES do express.static para interceptar o arquivo.
function pageGuard(req, res, next) {
  if (req.session && req.session.userId) {
    return res.sendFile(path.join(__dirname, 'public', path.basename(req.path)));
  }
  return res.redirect('/login.html');
}
app.get([
  '/home.html', '/sistema.html', '/propriedade.html', '/forum.html', '/discussao.html',
  '/calculadora.html', '/calendario.html', '/graficos.html', '/clima.html',
  // Telas de gestão (uma por função)
  '/producoes.html', '/anotacoes.html', '/mao-de-obra.html', '/transporte.html',
  '/despesas.html', '/materiais.html', '/propriedades.html',
], pageGuard);

app.use(express.static(path.join(__dirname, 'public')));

// Aplica o schema (idempotente) antes de subir, para que bancos antigos
// recebam as tabelas/colunas novas sem precisar rodar "npm run init-db".
async function iniciar() {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));
  } catch (err) {
    console.error('Aviso: não foi possível aplicar o schema.sql:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Colheita+ rodando em http://localhost:${PORT}`);
  });
}
iniciar();
