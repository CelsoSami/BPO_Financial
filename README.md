# C2 Finance — BPO Financeiro Multi-tenant

Aplicação web de **gestão e BPO financeiro** para profissionais que atendem **múltiplas organizações**. Controle de contas a pagar/receber, fluxo de caixa, clientes, equipe e análises gerenciais com visualização rápida de dados e gráficos animados.

- **Isolamento por organização**: cada usuário enxerga apenas os dados das organizações em que é membro (Row Level Security).
- **Pronto para vender**: modelos de negócio por organização, convite de membros e papéis de acesso.

## Funcionalidades

- 🔐 **Multi-tenant seguro** — dados isolados por organização via RLS
- 🌙 **Tema dark estilo Dracula** — gradiente anil → roxo, lua em contorno branco
- ☀️ **Toggle de tema deslizante** — troca para o tema dia (verde → azul) com sol
- 🖥️ **Desktop-first** — sidebar fixa, modais centralizados; adaptado para mobile
- 📊 **Dashboard + Relatórios & BI** — gráficos em canvas animados (sem libs externas)
- 💸 **Transações** — receitas/despesas com categorias, contas e clientes
- 🧾 **Contas a pagar/receber** — faturas, vencimentos e alertas de atraso
- 👥 **Clientes e fornecedores**
- 🏦 **Múltiplas organizações por usuário** — ideal para BPO
- 👤 **Equipe** — convite de membros com papéis (owner / admin / member / viewer)
- 📤 **Exportação CSV** — transações e contas (Excel, Python, Power BI)
- 💡 **Insights automáticos** — alertas de margem, vencidos e principais fontes

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puros (sem frameworks) · PWA
- **Backend:** Supabase — Auth + Postgres + Row Level Security
- **Análise:** scripts Python (padrão) para seed e exportação/KPIs

---

## 1. Pré-requisitos

- Uma conta no [Supabase](https://supabase.com) com um projeto criado.
- Python 3.10+ (opcional, apenas para as ferramentas de dados).
- Qualquer servidor estático (Python, `npx serve`, GitHub Pages, Netlify, Vercel…).

## 2. Configuração (1ª vez)

### 2.1. Banco de dados

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute **Run**.
3. O script é idempotente (`if not exists` / `drop policy if exists`). Reexecute sempre que atualizar o schema.

Crie os usuários das organizações em **Authentication → Users** (ou pelo cadastro na tela de login do app).

### 2.2. Credenciais do front-end

O app lê a configuração de `js/config.local.js` (arquivo **não versionado**). Copie o modelo e preencha com os dados do seu projeto:

```
copy js/config.local.example.js js/config.local.js
```

```js
window.__C2__ = {
  supabaseUrl: 'https://SEU-PROJECT.supabase.co',
  supabaseAnonKey: 'sb_publishable_SUA_CHAVE_ANONIMA'
};
```

> `supabaseUrl` e a chave aparecem em **Settings → API** do seu projeto. A chave anônima/publishable é pública por design — a segurança real dos dados vem das policies RLS do banco. Nunca cole a **service_role key** no front-end.

## 3. Rodando localmente

Serve a pasta em um servidor estático:

```bash
python -m http.server 8080
# ou
npx serve
```

Abra `http://localhost:8080`.

> Se o app abrir a tela de "configuração do banco", verifique o passo 2.1 e recarregue com **Ctrl+Shift+R**.

## 4. Ferramentas de dados (Python)

As credenciais são lidas de **variáveis de ambiente** (nunca versionadas):

```bash
set SUPABASE_URL=https://SEU-PROJECT.supabase.co
set SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE_ANONIMA
```

### 4.1. Dados de demonstração (opcional)

Cria uma organização com clientes, contas, 6 meses de transações e faturas:

```bash
python python\seed_demo.py --email seu@email.com --senha "sua-senha"
```

### 4.2. Exportação e análise

Baixa transações e contas de uma organização e gera `export_transacoes.csv`, `export_contas.csv` e `relatorio.json`, além de um resumo executivo no terminal (receitas, despesas, resultado, margem e top categorias):

```bash
python python\export_analise.py --email seu@email.com --senha "sua-senha" [--org-id <uuid>]
```

## 5. Publicação

O app é estático e pode ir para GitHub Pages, Netlify, Vercel, etc.

Exemplo com GitHub Pages:

```bash
git init
git add .
git commit -m "C2 Finance - BPO Financeiro multi-tenant"
git branch -M main
git remote add origin <URL-DO-SEU-REPOSITORIO>
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.

## Segurança (como cada usuário vê só o que é da sua organização)

- Toda tabela de negócio carrega `org_id`.
- **Row Level Security** via function `is_member(org_id)`.
- Membros são gerenciados por funcões `SECURITY DEFINER` (`create_organization`, `invite_member`, `remove_member`) que validam papéis antes de qualquer alteração.
- O front-end usa apenas a chave **publishable** (pública por design).
- A exclusão de uma organização só é permitida ao `owner`.

### Boas práticas ao publicar o repositório

- **Nunca** suba `js/config.local.js`, `.env` ou qualquer arquivo com credenciais reais
- **Nunca** inclua a **service_role key** ou a string de conexão do banco em código público
- Se algum segredo vazar, **rotacione a chave** no painel do Supabase imediatamente

## Estrutura

```
BPO_Financial/
├── index.html              # SPA (login + app)
├── manifest.json           # PWA
├── icons/                  # ícones 192/512
├── css/style.css           # temas (Dracula/dia) + animações + desktop/mobile
├── js/
│   ├── config.local.example.js # modelo de credenciais (não versionado)
│   ├── config.local.js      # credenciais reais — NUNCA versionar
│   ├── config.js           # configuração (lê js/config.local.js)
│   ├── utils.js            # moeda, data, ícones, DOM
│   ├── supabaseClient.js   # cliente + helpers de dados
│   ├── theme.js            # toggle lua/sol (dark/day)
│   ├── charts.js           # gráficos canvas animados
│   ├── app.js              # boot, sessão, navegação
│   └── views/
│       ├── reports.js      # BI / relatórios / insights
│       └── crud.js         # dashboard, fluxo, transações, contas, clientes, config
├── supabase/schema.sql     # schema completo + RLS (rodar no SQL Editor)
├── python/
│   ├── seed_demo.py        # dados de demonstração
│   ├── export_analise.py   # exporta CSV + KPIs
│   ├── make_icons.py       # gera ícones PNG do PWA
│   └── requirements.txt
├── .gitignore              # protege credenciais e arquivos locais
└── README.md
```