// ============================================================
// C2 Finance - Relatórios & BI
// Módulo de análise de dados: agregações, KPIs, período, export
// ============================================================

const REPORTS = {};

// ---- Agrega todos os dados de uma org no período ----
REPORTS.fetchBundle = async (orgId, months) => {
  const from = months[0] + '-01';
  const to = new Date(months[months.length - 1] + '-01');
  to.setMonth(to.getMonth() + 1);
  const toISO = to.toISOString().slice(0, 10);

  const [transactions, invoices, clients, accounts, categories] = await Promise.all([
    dbSelect('transactions', { orgId, filters: { status: 'posted' } }),
    dbSelect('invoices', { orgId }),
    dbSelect('clients', { orgId }),
    dbSelect('bank_accounts', { orgId }),
    dbSelect('categories', { orgId })
  ]);

  const bundle = {
    transactions: transactions.filter(t => t.date >= from && t.date < toISO),
    invoices,
    clients,
    accounts,
    categories,
    from, to: months[months.length - 1] + '-28'
  };
  return bundle;
};

// ---- Séries mensais (receita / despesa / saldo cumulativo) ----
REPORTS.monthlySeries = (transactions, months) => {
  const income = {}, expense = {}, net = {};
  const saldo = {};
  months.forEach(m => { income[m] = 0; expense[m] = 0; net[m] = 0; saldo[m] = 0; });
  transactions.forEach(t => {
    const m = monthKey(t.date);
    if (!(m in income)) return;
    if (t.kind === 'income') income[m] += Number(t.amount);
    else expense[m] += Number(t.amount);
  });
  let acc = 0;
  months.forEach(m => {
    net[m] = (income[m] || 0) - (expense[m] || 0);
    acc += net[m];
    saldo[m] = acc;
  });
  return { income, expense, net, saldo, labels: months.map(monthLabel) };
};

// ---- KPIs agregados ----
REPORTS.kpis = (bundle, months) => {
  const { income, expense, net, saldo } = REPORTS.monthlySeries(bundle.transactions, months);
  const totals = months.reduce((a, m) => ({ in: a.in + income[m], out: a.out + expense[m] }), { in: 0, out: 0 });
  const allTx = bundle.transactions;
  const last = months[months.length - 1];
  const prev = months[months.length - 2];

  const receivables = bundle.invoices.filter(i => i.kind === 'receivable' && i.status !== 'paid' && i.status !== 'cancelled');
  const payables = bundle.invoices.filter(i => i.kind === 'payable' && i.status !== 'paid' && i.status !== 'cancelled');
  const today = todayISO();

  let receivablesTotal = 0, payablesTotal = 0, receivablesOverdue = 0, payablesOverdue = 0;
  receivables.forEach(i => { receivablesTotal += Number(i.amount); if (i.due_date && i.due_date < today) receivablesOverdue += Number(i.amount); });
  payables.forEach(i => { payablesTotal += Number(i.amount); if (i.due_date && i.due_date < today) payablesOverdue += Number(i.amount); });

  // saldo bancário
  const bankBalance = bundle.accounts.reduce((a, b) => a + Number(b.opening_balance || 0), 0);
  const closed = allTx.filter(t => t.status === 'posted');
  const closedNet = closed.reduce((a, t) => a + (t.kind === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  const cash = bankBalance + closedNet;

  const catIncome = {}, catExpense = {};
  bundle.categories.forEach(c => { catIncome[c.id] = { name: c.name, color: c.color, total: 0, kind: 'income' }; catExpense[c.id] = { name: c.name, color: c.color, total: 0, kind: 'expense' }; });
  allTx.forEach(t => {
    const map = t.kind === 'income' ? catIncome : catExpense;
    if (t.category_id && map[t.category_id]) map[t.category_id].total += Number(t.amount);
  });

  const pct = (a, b) => b > 0 ? ((a - b) / b) * 100 : 0;
  const receitaG = pct(income[last], income[prev]);
  const despesaG = pct(expense[last], expense[prev]);

  return {
    income, expense, net, saldo,
    totalsIn: totals.in, totalsOut: totals.out,
    result: totals.in - totals.out,
    margin: totals.in > 0 ? ((totals.in - totals.out) / totals.in) * 100 : 0,
    cash,
    receivablesTotal, payablesTotal, receivablesOverdue, payablesOverdue,
    receitaG, despesaG,
    catIncome, catExpense
  };
};

// ---- Top clientes (faturamento) ----
REPORTS.topClients = (bundle, limit = 5) => {
  const byClient = {};
  const sales = bundle.transactions.filter(t => t.kind === 'income' && t.client_id);
  sales.forEach(t => { byClient[t.client_id] = (byClient[t.client_id] || 0) + Number(t.amount); });
  const names = new Map((bundle.clients || []).map(c => [c.id, c.name]));
  return Object.entries(byClient)
    .map(([id, total]) => ({ id, name: names.get(id) || 'Sem cliente', total }))
    .sort((a, b) => b.total - a.total).slice(0, limit);
};

// ---- Ranking de categorias (relevantes para corte) ----
REPORTS.categoryRanking = (catMap) =>
  Object.values(catMap).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

// ---- Exportar CSV ----
REPORTS.exportTransactions = (transactions, clients, categories) => {
  const cName = new Map((clients || []).map(c => [c.id, c.name]));
  const catName = new Map((categories || []).map(c => [c.id, c.name]));
  const rows = transactions.map(t => [
    t.date, t.kind === 'income' ? 'Receita' : 'Despesa',
    (catName.get(t.category_id) || ''), (cName.get(t.client_id) || ''),
    t.description, Number(t.amount).toFixed(2).replace('.', ','),
    t.status
  ]);
  const csv = toCSV(['Data', 'Tipo', 'Categoria', 'Cliente', 'Descrição', 'Valor', 'Status'], rows);
  fileDownload(`c2finance-transacoes-${todayISO()}.csv`, csv);
};

REPORTS.exportInvoices = (invoices, clients) => {
  const cName = new Map((clients || []).map(c => [c.id, c.name]));
  const rows = invoices.map(i => [
    i.issue_date, i.due_date, i.kind === 'receivable' ? 'A receber' : 'A pagar',
    i.number || '', i.description, (cName.get(i.client_id) || ''),
    Number(i.amount).toFixed(2).replace('.', ','), i.status, i.paid_at || ''
  ]);
  const csv = toCSV(['Emissão', 'Vencimento', 'Tipo', 'Nº', 'Descrição', 'Cliente', 'Valor', 'Status', 'Pago em'], rows);
  fileDownload(`c2finance-contas-${todayISO()}.csv`, csv);
};

// ============================================================
// VIEW: Relatórios & BI
// ============================================================
let _biMonths = 6;

REPORTS.render = async (root) => {
  const orgId = App.getOrg();
  const months = lastNMonths(_biMonths);
  clear(root);
  root.appendChild(els(`
    <div class="view-header">
      <h1>Relatórios & BI</h1>
      <p>Análise gerencial rápida do período selecionado</p>
    </div>
    <div class="seg" id="bi-range">
      <button data-m="3">3M</button>
      <button data-m="6" class="active">6M</button>
      <button data-m="12">12M</button>
    </div>
  `));

  root.querySelector('#bi-range').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    root.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    _biMonths = Number(b.dataset.m);
    REPORTS.render(root);
  });

  const wrap = el(`<div id="bi-body"></div>`);
  root.appendChild(wrap);

  try {
    const bundle = await REPORTS.fetchBundle(orgId, months);
    const k = REPORTS.kpis(bundle, months);

    // --- KPIs resumidas ---
    const kpiCard = (title, value, sub, cls = '') => `
      <div class="card ${cls}">
        <div class="card-title">${title}</div>
        <div class="card-value ${/up|down/.test(cls) ? cls.split(' ')[0] : ''}">${value}</div>
        <div class="card-sub">${sub}</div>
      </div>`;
    const trend = (pct) => pct >= 0
      ? `<span class="trend-chip up">▲ ${Math.abs(pct).toFixed(1)}%</span>`
      : `<span class="trend-chip down">▼ ${Math.abs(pct).toFixed(1)}%</span>`;

    wrap.appendChild(el(`
      <div class="grid cols-2">
        ${kpiCard('Receitas', fmtCompact(k.totalsIn), `vs mês anterior ${trend(k.receitaG)}`, 'hero')}
        ${kpiCard('Despesas', fmtCompact(k.totalsOut), `vs mês anterior ${trend(k.despesaG)}`)}
        ${kpiCard('Resultado', fmtCompact(k.result), `Margem ${k.margin.toFixed(1)}%`, k.result >= 0 ? 'up' : 'down')}
        ${kpiCard('Caixa Total', fmtCompact(k.cash), 'Saldo bancos + movimentação')}
      </div>
    `));

    // --- Gráfico de fluxo ---
    wrap.appendChild(els(`
      <div class="chart-box">
        <div class="chart-title">Fluxo de Caixa Mensal</div>
        <canvas id="bi-area"></canvas>
      </div>
      <div class="chart-box">
        <div class="chart-title">Receitas × Despesas</div>
        <canvas id="bi-bars"></canvas>
      </div>
    `));
    setTimeout(() => {
      areaChart('bi-area', { labels: k.saldo ? months.map(monthLabel) : [], values: months.map(m => k.saldo[m]), color: cssVar('--accent') });
      barChart('bi-bars', {
        labels: months.map(monthLabel),
        values: months.map(m => (k.income[m] || 0) - (k.expense[m] || 0)),
        colors: months.map(m => (k.income[m] - k.expense[m]) >= 0 ? cssVar('--ok') : cssVar('--danger'))
      });
    }, 60);

    // --- Categorias (donut) + top despesas (10 para corte) ---
    const topCat = REPORTS.categoryRanking(k.catExpense).slice(0, 6);
    const incCat = REPORTS.categoryRanking(k.catIncome).slice(0, 5);
    wrap.appendChild(el(`
      <div class="chart-box">
        <div class="chart-title">Despesas por Categoria</div>
        <canvas id="bi-exp-donut"></canvas>
        <div class="chart-legend" id="bi-exp-legend"></div>
      </div>
    `));

    setTimeout(() => {
      donutChart('bi-exp-donut', {
        labels: topCat.map(c => c.name), values: topCat.map(c => c.total), colors: topCat.map(c => c.color)
      });
      const legend = document.getElementById('bi-exp-legend');
      topCat.forEach(c => legend.appendChild(el(
        `<div class="legend-item"><span class="legend-dot" style="background:${c.color}"></span>${esc(c.name)} · <strong style="color:var(--text-dim)">${fmtCompact(c.total)}</strong></div>`
      )));
    }, 90);

    // --- Top clientes + ações de export ---
    const topClients = REPORTS.topClients(bundle, 5);
    wrap.appendChild(els(`
      <div class="card">
        <div class="card-title">Top Clientes (receita)</div>
        <div class="list" style="margin-top:10px" id="bi-clients"></div>
      </div>
      <div class="card">
        <div class="card-title">Exportar Dados</div>
        <p class="muted" style="margin:8px 0 14px;font-size:13px">Baixe o extrato analítico em CSV para análise externa (Excel, Python, Power BI).</p>
        <div class="actions">
          <button class="btn ghost sm" id="bi-exp-tx">${icon('download',16)} Transações</button>
          <button class="btn ghost sm" id="bi-exp-inv">${icon('download',16)} Contas</button>
        </div>
      </div>
    `));
    mountIcons(wrap);

    const cl = document.getElementById('bi-clients');
    if (topClients.length === 0) {
      cl.appendChild(el(`<div class="empty"><div class="big">${icon('users', 30)}</div><strong>Sem dados ainda</strong><span>Cadastre transações para ver o ranking.</span></div>`));
    } else {
      const max = topClients[0].total || 1;
      topClients.forEach((c, i) => {
        cl.appendChild(el(`
          <div class="row">
            <div class="ico">${i + 1}</div>
            <div class="body"><strong>${esc(c.name)}</strong><span>barra de participação</span>
              <div style="height:5px;background:var(--card-strong);border-radius:3px;margin-top:6px;overflow:hidden">
                <div style="height:100%;width:${(c.total / max) * 100}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:3px"></div>
              </div>
            </div>
            <div class="right"><span class="amount income">${fmtCompact(c.total)}</span></div>
          </div>
        `));
      });
    }

    document.getElementById('bi-exp-tx').addEventListener('click', () => REPORTS.exportTransactions(bundle.transactions, bundle.clients, bundle.categories));
    document.getElementById('bi-exp-inv').addEventListener('click', () => REPORTS.exportInvoices(bundle.invoices, bundle.clients));

    // insights rápidos (tradução de dados p/ decisão)
    const insights = [];
    if (k.payablesOverdue > 0) insights.push(`<span class="chip danger">!</span> R$${fmtCompact(k.payablesOverdue)} em contas a pagar vencidas.`);
    if (k.receivablesOverdue > 0) insights.push(`<span class="chip warn">!</span> R$${fmtCompact(k.receivablesOverdue)} a receber vencidos. Acione a cobrança.`);
    if (k.margin < 15) insights.push(`<span class="chip warn">!</span> Margem de ${k.margin.toFixed(1)}%. Avalie cortes de custo.`);
    else if (k.margin >= 25) insights.push(`<span class="chip ok">✓</span> Margem saudável de ${k.margin.toFixed(1)}%.`);
    if (incCat.length) insights.push(`<span class="chip info">i</span> Maior fonte de receita: <strong>${esc(incCat[0].name)}</strong> (${fmtCompact(incCat[0].total)}).`);
    if (topCat.length) insights.push(`<span class="chip info">i</span> Maior despesa: <strong>${esc(topCat[0].name)}</strong> (${fmtCompact(topCat[0].total)}).`);
    if (insights.length) {
      wrap.appendChild(el(`
        <div class="card">
          <div class="card-title">Insights Automáticos</div>
          <div class="list" style="margin-top:10px">${insights.map(i => `<div class="row"><div class="ico">${icon('spark',18)}</div><div class="body">${i}</div></div>`).join('')}</div>
        </div>
      `));
      mountIcons(wrap);
    }

  } catch (e) {
    offerSetup(wrap, e);
  }
};