# Colheita+ — Sistema de Gestão de Produção Agrícola

Site em JavaScript (Node.js + Express) com banco de dados **PostgreSQL**.

## Telas
1. **Página inicial** (`index.html`) — logo no topo, os botões **É novo?** → cadastro e
   **Comece já!** → login; abaixo, apresentação do sistema, recursos, texto sobre a produção
   rural e os passos para começar.
2. **Cadastro** (`cadastro.html`) — Área de cadastro.
3. **Login** (`login.html`) — Área de Login.
4. **Tela Inicial do Sistema** (`home.html`) — pós-login, botão **Iniciar o Sistema** no topo.
5. **Propriedades e Produções** (`sistema.html`) — Resumo Geral (propriedades, produções,
   clima atual, gastos do mês, anotações da semana), três botões principais
   (**Cadastrar Propriedade**, **Gerenciar Produções** e **Cadastrar Produção** — com lista
   obrigatória de propriedades) e Acesso rápido. "Gerenciar Produções" abre uma janela com as
   funções de gestão; cada uma abre uma tela própria.
6. **Telas de gestão** — uma página por função: **Produções** (`producoes.html`: editar,
   excluir, reorganizar e gerar PDFs), **Anotações escritas** (`anotacoes.html`),
   **Mão de obra** (`mao-de-obra.html`), **Transporte** (`transporte.html`),
   **Despesas e gastos** (`despesas.html`), **Materiais usados** (`materiais.html`) e
   **Propriedades** (`propriedades.html`: editar, excluir e reorganizar). Todas têm, em caixas:
   a lista para escolher a propriedade (e depois a produção), a caixa de informações e a
   navegação rápida para as outras funções. A escolha é lembrada entre as telas.
   Na **Mão de obra** há método (Pix, dinheiro físico...), frequência (semanal, quinzenal,
   mensal...), prazo para pagar e "já está pago"; passou do prazo sem pagar, chega uma notificação.
   (`propriedade.html` antiga apenas redireciona para `producoes.html`.)
7. **Fórum** (`forum.html` / `discussao.html`) — busca, filtros, tags, comentários,
   editar/trancar/excluir (somente o criador). Cada um pode editar ou excluir o próprio comentário.
8. **Calculadora** (`calculadora.html`), **Calendário** (`calendario.html`),
   **Visão Gráfica** (`graficos.html`) e **Clima** (`clima.html`, dados da Open-Meteo).

### Cabeçalho e menu lateral
- **Engrenagem** → janela de Configurações (tema claro/escuro/automático, zoom da tela com barra deslizante,
  negrito, alto contraste, espaçamento, destaque de foco, reduzir animações e leitura em voz alta).
  As preferências ficam salvas no navegador (`js/prefs.js`).
- **Sino** → notificações, com contador vermelho. Avisos do calendário (7 dias, 3 dias, 1 dia e
  no dia do evento), comentários nas suas discussões do fórum e pagamentos de mão de obra
  vencidos ou atrasados.
- **Ícone do usuário** → abre direto o Perfil do Usuário (o ID não é mais exibido), onde é
  possível alterar foto, nome, e-mail e senha, e **Encerrar Sessão**.
- **Menu lateral (gaveta)** no canto esquerdo, da cor do fundo e separado por um contorno escuro:
  ao clicar (ou passar o mouse) em uma opção aparecem subopções com atalhos — ex.: em
  "Propriedades e Produções" as telas de gestão; no "Fórum", iniciar discussão, minhas discussões e
  as discussões em que você comentou. Embaixo, **Encerrar Sessão**.

### Rascunhos
O que o produtor estiver digitando (formulários, anotações, comentários), a janela aberta e a
produção expandida ficam salvos no navegador; ao sair e voltar para a tela, tudo continua lá.
Os rascunhos são apagados ao encerrar a sessão.

A fonte usada é a **Exo 2**.

## Pré-requisitos
- [Node.js](https://nodejs.org) 18 ou superior
- [PostgreSQL](https://www.postgresql.org/download/) instalado e rodando

## Passo a passo

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o banco abrindo o arquivo `config.js` e ajustando usuário/senha do
   PostgreSQL (e, se quiser, a porta do site e o segredo da sessão).

3. Crie o banco e as tabelas automaticamente (o servidor também aplica o
   `schema.sql` sozinho ao iniciar, então bancos antigos são atualizados sem perder dados):
   ```bash
   npm run init-db
   ```
   > Isso cria o banco `colheita` (se não existir) e aplica o `db/schema.sql`.
   > Alternativa manual: `psql -U postgres -d colheita -f db/schema.sql`

4. Inicie o servidor:
   ```bash
   npm start
   ```

5. Acesse no navegador: <http://localhost:3000>

## Estrutura
```
server.js            → servidor Express + API (auth e propriedades)
routes/
  producoes.js       → produções e seus registros (atividades, mão de obra, insumos, despesas, transporte)
  relatorios.js      → PDFs: relatório da produção e histórico bruto (pdfkit)
  calendario.js      → anotações do calendário e notificações
  forum.js           → discussões e comentários do fórum
  graficos.js        → dados da Visão Gráfica e do Resumo Geral
  util.js            → funções auxiliares (autenticação, validação)
config.js            → configurações (banco, porta, segredo da sessão)
db/
  pool.js            → conexão com o PostgreSQL
  init.js            → cria o banco e aplica o schema (npm run init-db)
  schema.sql         → tabelas do diagrama de classes (usuarios, propriedades,
                        producao, mao_de_obra, insumos, transporte,
                        producao_propriedade, producao_transporte, session)
public/
  index.html         → página inicial
  cadastro.html      → cadastro
  login.html         → login
  home.html          → início (protegida)
  sistema.html       → propriedades e resumo (protegida)
  producoes.html, anotacoes.html, mao-de-obra.html, transporte.html,
  despesas.html, materiais.html, propriedades.html → telas de gestão (protegidas)
  js/gestao.js       → lógica comum das telas de gestão
  js/producao-form.js → janela de cadastro/edição de produção
  forum.html, discussao.html, calculadora.html, calendario.html,
  graficos.html, clima.html → novas telas (protegidas)
  css/style.css      → estilos (Exo 2, tema claro/escuro, acessibilidade)
  js/common.js       → cabeçalho, menu lateral, notificações, configurações, rascunhos
  js/prefs.js        → aplica as preferências de aparência antes da página desenhar
  js/clima-api.js    → cidades e previsão do tempo (Open-Meteo)
  js/                → scripts das páginas
  assets/img/engrenagem.png  → ícone de configurações do cabeçalho
  assets/img/notificacao.png → ícone de notificações do cabeçalho
  assets/            → imagens, logos e fontes Exo 2
```

## Segurança
- Senhas são armazenadas com **hash bcrypt** (nunca em texto puro).
- Sessão de login via cookie assinado (`express-session` + `connect-pg-simple`),
  guardada no próprio PostgreSQL.
- Todas as telas internas exigem login; sem sessão, o usuário é redirecionado
  para a tela de login.
- Cada produção, registro, anotação e notificação só é acessível pelo próprio dono.
  No fórum, somente o criador pode trancar ou excluir a discussão.
- O ID do usuário não é exibido nem enviado pela API `/api/me`.
