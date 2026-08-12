# C2 Finance — BPO Financeiro Multi-tenant

Aplicação web **mobile-first** de gestão e BPO financeiro. Controle contas a pagar/receber, fluxo de caixa, clientes e análises gerenciais com visualização rápida de dados — ideal para profissionais que prestam BPO a múltiplas organizações.

Cada usuário enxerga **apenas os dados das organizações em que é membro** (isolamento via Row Level Security no Supabase).

## Funcionalidades

- 🔐 **Segurança multi-tenant** — dados isolados por organização (RLS)
- 🌙 **Tema dark padrão** — gradiente anil → roxo com lua em contorno branco
- ☀️ **Toggle para tema day** — gradiente verde claro → azul celeste com sol
- 📱 **100% mobile-first** — PWA instalável, menu hambúrguer com menu lateral
- 📊 **Dashboard + Relatórios & BI** — gráficos em canvas animados (sem libs)
- 💸 **Transações** — receitas/despesas com categorias, contas e clientes
- 🧾 **Contas a pagar/receber** — faturas, vencimentos e alertas
- 👥 **Clientes e fornecedores**
- 🏦 **Múltiplas organizações por usuário** — ideal para profissionais de BPO
- 👤 **Equipe** — convite de membros com papéis (owner/admin/viewer)
- 📤 **Exportação CSV** — transações e contas (Excel / Python / Power BI)

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puros (sem frameworks), PWA
- **Backend:** Supabase (Auth + Postgres + Row Level Security)
- **Análise:** scripts em Python para exportação e análise de dados

---

## 1. Configuração do banco de dados (1ª vez)

1. No painel do Supabase: **Authentication → Users**, confirme o usuário criado (ver PDF de confirmação no e-mail) e ajuste a senha se quiser.
2. **SQL Editor → New query** → cole o conteúdo de **`supabase/schema.sql`** → **Run**.
3. O script é idempotente (`if not exists` / `drop policy if exists`). Rode novamente sempre que atualizar o schema.

> ⚠️ O usuário admin já foi criado:
> `celso_scjunior@hotmail.com` — confira o e-mail de confirmação no Hotmail antes de entrar.

## 2. Rodando localmente

Serve a pasta em um servidor estático:

```bash
# com Python + venv (Windows)
..\.venv\Scripts\python.exe -m http.server 8080
# ou
npx serve
```

Abra `http://localhost:8080`.

> O app precisa que o schema esteja ativo para carregar dados. Se vir a tela de "configuração do banco", execute o passo 1 e recarregue.

## 3. Seed de dados de demonstração (opcional)

Gera uma organização com clientes, contas, 6 meses de transações e faturas:

```bash
..\.venv\Scripts\python.exe python\seed_demo.py --email celso_scjunior@hotmail.com --senha "SUA-SENHA"
```

## 4. Exportação e análise com Python (cientista de dados)

```bash
..\.venv\Scripts\python.exe python\export_analise.py --email seu@email.com --senha "SENHA"
```

Gera `export_transacoes.csv`, `export_contas.csv` e `relatorio.json` além de um resumo executivo no terminal (receitas, despesas, resultado, margem, top categorias).

## 5. Publicação no GitHub Pages

```bash
git init
git add .
git commit -m "C2 Finance - BPO Financeiro multi-tenant"
git branch -M main
# crie o repositório no GitHub (ex.: C2_Finance)
git remote add origin https://github.com/CelsoSami/C2_Finance.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → main → / (root)**. Pronto: `https://celsosami.github.io/C2_Finance/`.

### Integração Supabase (opcional, recomenda-se só para manter schema versionado)

```bash
# dentro da pasta do projeto
npx supabase login
npx supabase init
npx supabase link --project-ref sqpmjxtswdheonabubau
npx supabase db push   # aplica supabase/schema.sql
```

## Segurança (como cada usuário vê só o que pertence à sua organização)

- Toda tabela de negócio carrega `org_id`.
- **Row Level Security** via funções `is_member(org_id)` e `current_user_orgs()`.
- Membros são gerenciados por funções `SECURITY DEFINER` (`create_organization`, `invite_member`, `remove_member`) que validam papéis antes de alterar.
- A chave usada no front-end é a **publishable** (pública por design); o acesso real é governado pelas policies do banco.
- Convites exigem que o convidado já possua conta no sistema (o e-mail é o vínculo).

## Estrutura

```
BPO_Financial/
├── index.html            # SPA (login + app)
├── manifest.json         # PWA
├── icons/                # ícones 192/512
├── css/style.css         # temas + animações + mobile
├── js/
│   ├── config.js         # Supabase (chave publishable)
│   ├── utils.js          # moeda, data, ícones, DOM
│   ├── supabaseClient.js # cliente + helpers de dados
│   ├── theme.js          # toggle lua/sol (dark/day)
│   ├── charts.js         # gráficos canvas animados
│   ├── app.js            # boot, sessão, navegação
│   └── views/
│       ├── reports.js    # BI / relatórios / insights
│       └── crud.js       # dashboard, fluxo, transações, contas, clientes, config
├── supabase/schema.sql   # schema completo + RLS (rodar no SQL Editor)
├── python/
│   ├── seed_demo.py      # gera dados de demonstração
│   ├── export_analise.py # exporta CSV + KPIs
│   ├── make_icons.py     # gera ícones PNG do PWA
│   └── requirements.txt
└── README.md
```

## Privacidade

- O repositório é público: **não suba senhas, service role key ou URLs sensíveis**.
- No `js/config.js` está apenas a chave publishable (segura para clientes).
- A senha do usuário é de responsabilidade do dono do projeto. Altere-a em Authentication → Users após o primeiro acesso.