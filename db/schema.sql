-- Banco de dados: Colheita+
-- Execute com:  psql -U postgres -d colheita -f db/schema.sql
-- (ou use  npm run init-db  para criar tudo automaticamente)
--
-- Nomes de tabelas e colunas seguem o diagrama de classes do sistema
-- (snake_case dos atributos do diagrama). Tipos do diagrama:
--   int -> INTEGER | string -> VARCHAR | double -> NUMERIC | date -> DATE

-- ============================================================
-- Usuário (Produtor)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario    SERIAL PRIMARY KEY,        -- idUsuario
    nome_usuario  VARCHAR(120) NOT NULL,     -- nomeUsuario
    login_usuario VARCHAR(160) NOT NULL UNIQUE, -- loginUsuario (usado como e-mail de acesso)
    senha_usuario VARCHAR(255) NOT NULL,     -- senhaUsuario (guardada como hash bcrypt)
    foto_usuario  TEXT,                      -- foto de perfil (data URL base64)
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Propriedade
-- ============================================================
CREATE TABLE IF NOT EXISTS propriedades (
    id_propriedade         SERIAL PRIMARY KEY,   -- idPropriedade
    usuario_id             INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE, -- relação "Possui"
    nome_propriedade       VARCHAR(160) NOT NULL, -- nomePropriedade
    hectares_propriedade   NUMERIC(12,2),         -- hectaresPropriedade
    localizacao_propriedade VARCHAR(200),         -- localizacaoPropriedade
    descricao_propriedade  TEXT,                  -- descricaoPropriedade
    cultura                VARCHAR(160),          -- (extra, não consta no diagrama; mantido do sistema atual)
    posicao                INTEGER,               -- ordem de exibição (usada no "Reorganizar")
    criado_em              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propriedades_usuario ON propriedades(usuario_id);

-- ============================================================
-- Produção
-- ============================================================
CREATE TABLE IF NOT EXISTS producao (
    id_producao       SERIAL PRIMARY KEY,   -- idProdução
    conteudo_producao VARCHAR(200),         -- conteúdoProdução
    area_plantada     NUMERIC(12,2),        -- areaPlantada
    quantidade_ruas   INTEGER               -- quantidadeRuas
);

-- ============================================================
-- Mão de Obra  (Produção 1 --Possui--> MãoDeObra 0..*)
-- ============================================================
CREATE TABLE IF NOT EXISTS mao_de_obra (
    id_mao_de_obra        SERIAL PRIMARY KEY, -- idMaoDeObra
    producao_id           INTEGER REFERENCES producao(id_producao) ON DELETE CASCADE,
    quantidade_mao_de_obra INTEGER,           -- quantidadeMaoDeObra
    gasto_total           NUMERIC(12,2),      -- gastoTotal
    data_trabalhada       DATE                -- dataTrabalhada
);

-- ============================================================
-- Insumos  (Produção 1 --Utiliza--> Insumos 1..*)
-- ============================================================
CREATE TABLE IF NOT EXISTS insumos (
    id_insumo         SERIAL PRIMARY KEY,   -- idInsumo
    producao_id       INTEGER REFERENCES producao(id_producao) ON DELETE CASCADE,
    nome_insumo       VARCHAR(160),         -- nomeInsumo
    tipo_insumo       VARCHAR(120),         -- tipoInsumo
    quantidade_insumo INTEGER,              -- quantidadeInsumo
    custo_insumo      NUMERIC(12,2)         -- custoInsumo
);

-- ============================================================
-- Transporte
-- ============================================================
CREATE TABLE IF NOT EXISTS transporte (
    id_transporte      SERIAL PRIMARY KEY,  -- idTransporte
    tipo_transporte    VARCHAR(120),        -- tipoTransporte
    contato_emergencia INTEGER              -- contatoEmergencia (diagrama: int)
);

-- ============================================================
-- Produção x Propriedade  (classe de associação ProducaoPropriedade)
-- ============================================================
CREATE TABLE IF NOT EXISTS producao_propriedade (
    id_producao_propriedade SERIAL PRIMARY KEY, -- idProducaoPropriedade
    producao_id             INTEGER NOT NULL REFERENCES producao(id_producao) ON DELETE CASCADE,
    propriedade_id          INTEGER NOT NULL REFERENCES propriedades(id_propriedade) ON DELETE CASCADE,
    ferramentas_producao    VARCHAR(200)        -- ferramentasProducao
);

-- ============================================================
-- Produção x Transporte  (classe de associação ProducaoTransporte)
-- ============================================================
CREATE TABLE IF NOT EXISTS producao_transporte (
    id_producao_transporte SERIAL PRIMARY KEY,
    producao_id            INTEGER NOT NULL REFERENCES producao(id_producao) ON DELETE CASCADE,
    transporte_id          INTEGER NOT NULL REFERENCES transporte(id_transporte) ON DELETE CASCADE,
    data                   DATE,               -- data
    quantidade_producao    NUMERIC(12,2)       -- quantidadeProducao
);

-- ============================================================
-- Atualizações v1.1 (produções, fórum, calendário, notificações)
-- Os ALTER TABLE ... IF NOT EXISTS permitem atualizar um banco já
-- existente sem perder dados. O servidor aplica este arquivo ao iniciar.
-- ============================================================

-- Produção: dados extras de cadastro e ordem de exibição
ALTER TABLE producao ADD COLUMN IF NOT EXISTS nome_producao          VARCHAR(160);
ALTER TABLE producao ADD COLUMN IF NOT EXISTS quantidade_mao_de_obra INTEGER;
ALTER TABLE producao ADD COLUMN IF NOT EXISTS data_inicio            DATE;
ALTER TABLE producao ADD COLUMN IF NOT EXISTS data_fim_prevista      DATE;
ALTER TABLE producao ADD COLUMN IF NOT EXISTS descricao_producao     TEXT;
ALTER TABLE producao ADD COLUMN IF NOT EXISTS posicao                INTEGER;
ALTER TABLE producao ADD COLUMN IF NOT EXISTS criado_em              TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_prod_prop_propriedade ON producao_propriedade(propriedade_id);

-- Mão de obra: função/descrição do trabalho
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS descricao_mao_de_obra VARCHAR(200);
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Insumos (materiais usados): quantidades fracionadas, unidade e data de uso
ALTER TABLE insumos ALTER COLUMN quantidade_insumo TYPE NUMERIC(12,2);
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS unidade_insumo VARCHAR(30);
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS data_uso DATE;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Transporte: telefone não cabe em INTEGER (ex.: 17 91234-5678), vira texto
ALTER TABLE transporte ALTER COLUMN contato_emergencia TYPE VARCHAR(40);
ALTER TABLE transporte ADD COLUMN IF NOT EXISTS destino_transporte VARCHAR(160);
ALTER TABLE producao_transporte ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Atividades feitas (anotações com data e hora)
CREATE TABLE IF NOT EXISTS atividades (
    id_atividade        SERIAL PRIMARY KEY,
    producao_id         INTEGER NOT NULL REFERENCES producao(id_producao) ON DELETE CASCADE,
    descricao_atividade TEXT NOT NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atividades_producao ON atividades(producao_id);

-- Despesas e gastos
CREATE TABLE IF NOT EXISTS despesas (
    id_despesa        SERIAL PRIMARY KEY,
    producao_id       INTEGER NOT NULL REFERENCES producao(id_producao) ON DELETE CASCADE,
    descricao_despesa VARCHAR(200) NOT NULL,
    categoria_despesa VARCHAR(60),
    valor_despesa     NUMERIC(12,2) NOT NULL,
    data_despesa      DATE NOT NULL,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_despesas_producao ON despesas(producao_id);

-- Calendário: anotações do produtor em um dia
CREATE TABLE IF NOT EXISTS eventos_calendario (
    id_evento        SERIAL PRIMARY KEY,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_evento      DATE NOT NULL,
    titulo_evento    VARCHAR(120),
    descricao_evento TEXT NOT NULL,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_usuario_data ON eventos_calendario(usuario_id, data_evento);

-- Fórum: discussões e comentários
CREATE TABLE IF NOT EXISTS forum_discussoes (
    id_discussao SERIAL PRIMARY KEY,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo       VARCHAR(160) NOT NULL,
    descricao    TEXT NOT NULL,
    tags         TEXT[] NOT NULL DEFAULT '{}',
    trancada     BOOLEAN NOT NULL DEFAULT false,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_comentarios (
    id_comentario SERIAL PRIMARY KEY,
    discussao_id  INTEGER NOT NULL REFERENCES forum_discussoes(id_discussao) ON DELETE CASCADE,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    texto         TEXT NOT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comentarios_discussao ON forum_comentarios(discussao_id);

-- Notificações (comentários no fórum e avisos do calendário)
-- "chave" evita gerar o mesmo aviso do calendário duas vezes.
CREATE TABLE IF NOT EXISTS notificacoes (
    id_notificacao SERIAL PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    mensagem       VARCHAR(300) NOT NULL,
    link           VARCHAR(200),
    lida           BOOLEAN NOT NULL DEFAULT false,
    chave          VARCHAR(120),
    evento_id      INTEGER REFERENCES eventos_calendario(id_evento) ON DELETE CASCADE,
    discussao_id   INTEGER REFERENCES forum_discussoes(id_discussao) ON DELETE CASCADE,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacoes_chave ON notificacoes(usuario_id, chave);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida);

-- ============================================================
-- Atualizações v1.2: pagamento da mão de obra
-- ============================================================
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS metodo_pagamento     VARCHAR(40);  -- Pix, dinheiro (físico)...
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS frequencia_pagamento VARCHAR(40);  -- Semanal, quinzenal, mensal...
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS data_vencimento      DATE;         -- prazo para pagar
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS pago                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mao_de_obra ADD COLUMN IF NOT EXISTS data_pagamento       DATE;

-- Aviso de pagamento atrasado aponta para o registro de mão de obra
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS mao_de_obra_id INTEGER REFERENCES mao_de_obra(id_mao_de_obra) ON DELETE CASCADE;

-- Tabela usada pelo connect-pg-simple para guardar as sessões de login
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    varchar NOT NULL COLLATE "default",
    "sess"   json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
