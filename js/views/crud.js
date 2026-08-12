// ============================================================
// C2 Finance - Views de gestão (CRUD)
// Transações · Fluxo · Contas a pagar/receber · Clientes · Config
// ============================================================

const CRUD = {};

// ============ HELPERS GERAIS ============

const offerSetup = (root, err) => {
  clear(root);
  const isSchema = isSetupError(err);
  const detail = isSchema ? '' : `<p class="muted" style="max-width:420px;margin:0 auto 18px;font-size:12.5px">Erro: ${esc(msgOf(err))}</p>`;
  const btn = isSchema
    ? `<button class="btn primary" onclick="location.reload()">${icon('check',18)} Já configurei — verificar</button>`
    : `<button class="btn ghost" onclick="location.reload()">${icon('refresh',18)} Recarregar</button>`;
  root.appendChild(el(`
    <div class="card" style="text-align:center;padding:34px 20px">
      <div style="font-size:40px;margin-bottom:10px">${icon(isSchema ? 'shield' : 'alert', 38)}</div>
      <h2 style="margin-bottom:8px">${isSchema ? 'Banco de dados precisa de configuração' : 'Algo deu errado'}</h2>
      ${isSchema
        ? '<p class="muted" style="max-width:420px;margin:0 auto 18px">Para o C2 Finance funcionar com segurança multi-tenant, execute o arquivo <code style="font-size:12px">supabase/schema.sql</code> no Supabase → SQL Editor. Depois volte aqui.</p>'
        : detail}
      ${btn}
    </div>
  `));
  mountIcons(root);
};

const cardSkeleton = (n = 3) =>
  `<div class="grid" style="grid-template-columns:repeat(${n},1fr)"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
   <div class="skel" style="min-height:190px"></div><div class="skel" style="min-height:160px"></div>`;

// abre sheet genérico
const openSheet = (title, bodyHtml, opts = {}) => {
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  clear(sheet);
  sheet.appendChild(els(`
    <div class="sheet-grip"></div>
    <div class="sheet-head">
      <h3>${title}</h3>
      <button class="icon-btn" id="sheet-close">${icon('x',18)}</button>
    </div>
    ${bodyHtml}
  `));
  mountIcons(sheet);
  sheet.classList.add('open');
  backdrop.classList.add('open');
  const close = () => { sheet.classList.remove('open'); backdrop.classList.remove('open'); };
  sheet.querySelector('#sheet-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  return { sheet, close };
};

const openModal = (title, bodyHtml) => {
  const m = document.getElementById('modal');
  clear(m);
  m.appendChild(el(`
    <div class="modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-size:18px;font-weight:800">${title}</h3>
        <button class="icon-btn" id="modal-close">${icon('x',18)}</button>
      </div>
      ${bodyHtml}
    </div>
  `));
  mountIcons(m);
  m.classList.remove('hidden');
  m.querySelector('#modal-close').addEventListener('click', () => m.classList.add('hidden'));
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  return m;
};

const closeModal = () => document.getElementById('modal').classList.add('hidden');

const dayDiffBadge = (due) => {
  const d = daysBetween(todayISO(), due);
  if (d < 0) return `<span class="chip danger"><i class="dot" style="background:var(--danger)"></i>Vencido há ${Math.abs(d)}d</span>`;
  if (d === 0) return `<span class="chip warn"><i class="dot" style="background:var(--warn)"></i>Vence hoje</span>`;
  if (d <= 7) return `<span class="chip warn"><i class="dot" style="background:var(--warn)"></i>${d}d</span>`;
  return `<span class="chip info"><i class="dot" style="background:var(--accent)"></i>${d}d</span>`;
};

// ============ DASHBOARD ============
CRUD.dashboard = async (root) => {
  const orgId = App.getOrg();
  const months = lastNMonths(6);
  clear(root);
  root.appendChild(els(`
    <div class="view-header">
      <h1>Dashboard</h1>
      <p id="dash-org"></p>
    </div>
    ${cardSkeleton(4)}
  `));

  const bundle = await REPORTS.fetchBundle(orgId, months);
  const k = REPORTS.kpis(bundle, months);
  const org = await dbSelect('organizations', { filters: { id: orgId } });

  root.querySelector('#dash-org').textContent = (org[0] && org[0].name) || 'Painel geral';

  // --- KPIs animadas ---
  const kpis = [
    { t: 'Caixa Disponível', v: k.cash, sub: 'Saldo bancos + resultado', cls: 'hero', icon: 'wallet' },
    { t: 'Receitas (6M)', v: k.totalsIn, sub: `▲ ${k.receitaG.toFixed(1)}% vs mês ant.`, cls: 'up', icon: 'trending_up' },
    { t: 'Despesas (6M)', v: k.totalsOut, sub: `▼ ${Math.abs(k.despesaG).toFixed(1)}% vs mês ant.`, cls: 'down', icon: 'receipt' },
    { t: 'A Receber em aberto', v: k.receivablesTotal, sub: `R$ ${fmtCompact(k.receivablesOverdue)} vencido`, cls: '', icon: 'invoice' }
  ];
  const grid = el(`<div class="grid cols-2" style="margin-top:4px"></div>`);
  kpis.forEach((x, i) => {
    const card = el(`<div class="card ${x.cls}" style="animation-delay:${i * 70}ms">
      <div class="card-title">${icon(x.icon,15)} ${x.t}</div>
      <div class="card-value" id="kpi-${i}">${fmtCompact(0)}</div>
      <div class="card-sub">${x.sub}</div>
    </div>`);
    grid.appendChild(card);
  });
  root.querySelectorAll('.skel').forEach(s => s.remove());
root.insertBefore(grid, root.querySelector('.chart-box') || null);
    mountIcons(root);
    kpis.forEach((x, i) => animateNumber(document.getElementById(`kpi-${i}`), x.v, fmtCompact));

  root.appendChild(els(`
    <div class="chart-box">
      <div class="chart-title">Fluxo de Caixa (6 meses)</div>
      <canvas id="dash-area"></canvas>
    </div>
    <div class="grid cols-2">
      <div class="card"><div class="card-title">${icon('bank',16)} A Pagar em aberto</div>
        <div class="card-value sm" style="color:var(--danger)">${fmtCompact(k.payablesTotal)}</div>
        <div class="card-sub">${fmtCompact(k.payablesOverdue)} vencido</div>
      </div>
      <div class="card"><div class="card-title">${icon('trending_up',16)} Resultado (6M)</div>
        <div class="card-value sm" style="color:var(--ok)">${fmtCompact(k.result)}</div>
        <div class="card-sub">Margem ${k.margin.toFixed(1)}%</div>
      </div>
    </div>
  `));

  setTimeout(() => {
    areaChart('dash-area', { labels: months.map(monthLabel), values: months.map(m => k.saldo[m]), color: cssVar('--accent') });
  }, 80);

  // --- lançamentos recentes ---
  const recent = bundle.transactions
    .filter(t => t.status === 'posted')
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  const cName = new Map(bundle.clients.map(c => [c.id, c.name]));
  const catName = new Map(bundle.categories.map(c => [c.id, c.name]));
  const cxName = new Map(bundle.categories.map(c => [c.id, c.color]));

  root.appendChild(el(`
    <div class="card">
      <div class="card-title" style="justify-content:space-between">Atividade Recente
        <button class="btn ghost sm" data-go="transacoes">Ver todas</button>
      </div>
      <div class="list" style="margin-top:10px" id="dash-recent"></div>
    </div>
  `));
  const list = root.querySelector('#dash-recent');
  if (!recent.length) {
    list.appendChild(el(`<div class="empty"><div class="big">${icon('swap',30)}</div><strong>Nenhuma movimentação ainda</strong><span>Toque no botão + para registrar a primeira transação.</span></div>`));
  } else {
    recent.forEach((t, i) => {
      const color = cxName.get(t.category_id) || cssVar('--accent');
      list.appendChild(el(`
        <div class="row" style="animation-delay:${i * 50}ms">
          <div class="ico" style="color:${color}">${icon(t.kind === 'income' ? 'arrow_up' : 'arrow_down',18)}</div>
          <div class="body"><strong>${esc(t.description)}</strong><span>${catName.get(t.category_id) || (t.kind === 'income' ? 'Receita' : 'Despesa')} · ${(cName.get(t.client_id) || '')}</span></div>
          <div class="right">
            <span class="amount ${t.kind}">${t.kind === 'income' ? '+' : '-'}${fmtCompact(t.amount)}</span><br>
            <span class="muted" style="font-size:11px">${fmtDate(t.date)}</span>
          </div>
        </div>
      `));
    });
  }
  root.querySelector('[data-go="transacoes"]').addEventListener('click', () => App.go('transacoes'));
  mountIcons(list);
};

// ============ FLUXO DE CAIXA ============
CRUD.fluxo = async (root) => {
  const orgId = App.getOrg();
  const months = lastNMonths(6);
  clear(root);
  root.appendChild(els(`
    <div class="view-header"><h1>Fluxo de Caixa</h1><p>Projeção e movimentação real por mês</p></div>
    ${cardSkeleton()}
  `));
  const bundle = await REPORTS.fetchBundle(orgId, months);
  const { income, expense, net, saldo } = REPORTS.monthlySeries(bundle.transactions, months);
  root.querySelectorAll('.skel').forEach(s => s.remove());

  // Cards por mês
  const run = el(`<div class="grid" style="grid-template-columns:2fr 1fr 1fr;margin-top:4px">${
    months.map((m, i) => `
      <div class="card ${i === months.length - 1 ? 'hero' : ''}" style="animation-delay:${i * 60}ms">
        <div class="card-title">${monthLabel(m)}</div>
        <div class="card-value sm">${fmtCompact(saldo[m])}</div>
        <div class="card-sub"><span class="up">+${fmtCompact(income[m])}</span> · <span class="down">-${fmtCompact(expense[m])}</span></div>
      </div>`).join('')}
  </div>`);
  root.appendChild(run);

  root.appendChild(els(`
    <div class="chart-box"><div class="chart-title">Saldo Acumulado</div><canvas id="fluxo-area"></canvas></div>
    <div class="chart-box"><div class="chart-title">Entradas × Saídas</div><canvas id="fluxo-bars"></canvas></div>
  `));
  setTimeout(() => {
    areaChart('fluxo-area', { labels: months.map(monthLabel), values: months.map(m => saldo[m]) });
    barChart('fluxo-bars', {
      labels: months.map(monthLabel),
      values: months.map(m => (income[m] || 0) - (expense[m] || 0)),
      colors: months.map(m => (income[m] - expense[m]) >= 0 ? cssVar('--ok') : cssVar('--danger'))
    });
  }, 80);

  // Próximos vencimentos
  const today = todayISO();
  const upcoming = bundle.invoices
    .filter(i => ['open','overdue'].includes(i.status))
    .sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1).slice(0, 8);
  const cName = new Map(bundle.clients.map(c => [c.id, c.name]));
  root.appendChild(el(`
    <div class="card">
      <div class="card-title">Próximos Vencimentos</div>
      <div class="list" style="margin-top:10px" id="fluxo-list"></div>
    </div>
  `));
  const ll = root.querySelector('#fluxo-list');
  if (!upcoming.length) ll.appendChild(el(`<div class="empty"><div class="big">${icon('receipt',30)}</div><strong>Tudo em dia</strong><span>Não há contas em aberto.</span></div>`));
  else upcoming.forEach((i, idx) => {
    ll.appendChild(el(`
      <div class="row" style="animation-delay:${idx * 50}ms">
        <div class="ico">${icon(i.kind === 'receivable' ? 'trending_up' : 'receipt',18)}</div>
        <div class="body"><strong>${esc(i.description || i.number || 'Conta')}</strong><span>${cName.get(i.client_id) || ''} · ${fmtDate(i.due_date)}</span></div>
        <div class="right"><span class="amount ${i.kind === 'receivable' ? 'income' : 'expense'}">${fmtCompact(i.amount)}</span><br>
          ${i.due_date ? dayDiffBadge(i.due_date) : ''}
        </div>
      </div>
    `));
  });
};

// ============ TRANSAÇÕES (CRUD) ============
let _txFilter = { q: '', kind: '', month: '' };

CRUD.transacoes = async (root) => {
  const orgId = App.getOrg();
  clear(root);
  root.appendChild(els(`
    <div class="view-header"><h1>Transações</h1><p>Lançamentos de receitas e despesas</p>
      <div class="filterbar">
        <input type="search" id="tx-search" placeholder="Buscar..." value="${esc(_txFilter.q)}" style="min-width:120px;flex:1">
        <select id="tx-kind" style="width:auto;flex:none;min-width:110px">
          <option value="">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select id="tx-month" style="width:auto;flex:none;min-width:120px">
          <option value="">Todos os meses</option>
          ${lastNMonths(12).map(m => `<option value="${m}" ${_txFilter.month===m?'selected':''}>${monthLabel(m)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="tx-list"></div>
  `));

  const reload = async () => {
    const box = root.querySelector('#tx-list');
    clear(box);
    box.appendChild(els(cardSkeleton(1)));
    const filters = {};
    if (_txFilter.kind) filters.kind = _txFilter.kind;
    let txs = await dbSelect('transactions', { orgId, filters, order: { col: 'date', asc: false }, limit: 400 });
    if (_txFilter.month) txs = txs.filter(t => t.date.startsWith(_txFilter.month));
    if (_txFilter.q) { const q = _txFilter.q.toLowerCase(); txs = txs.filter(t => t.description.toLowerCase().includes(q) || (t.category_id || '').includes(q)); }
    clear(box);
    if (!txs.length) {
      box.appendChild(el(`<div class="empty"><div class="big">${icon('swap',34)}</div><strong>Nenhum lançamento</strong><span>Toque no botão + para registrar.</span></div>`));
      return;
    }
    const [clients, cats] = await Promise.all([dbSelect('clients', { orgId, limit: 500 }), dbSelect('categories', { orgId })]);
    const cName = new Map(clients.map(c => [c.id, c.name]));
    const catM = new Map(cats.map(c => [c.id, c]));
    const list = el(`<div class="list"></div>`);
    txs.forEach((t, i) => {
      const cat = catM.get(t.category_id);
      const color = cat ? cat.color : cssVar('--accent');
      list.appendChild(el(`
        <div class="row" style="animation-delay:${Math.min(i,8)*40}ms" data-id="${t.id}">
          <div class="ico" style="color:${color}">${icon(cat && cat.icon ? cat.icon : (t.kind==='income'?'arrow_up':'arrow_down'),18)}</div>
          <div class="body">
            <strong>${esc(t.description)}</strong>
            <span>${cat ? esc(cat.name) : (t.kind==='income'?'Receita':'Despesa')}${cName.get(t.client_id) ? ' · ' + esc(cName.get(t.client_id)) : ''}</span>
          </div>
          <div class="right">
            <span class="amount ${t.kind}">${t.kind==='income'?'+':'-'}${fmtCompact(t.amount)}</span><br>
            <span class="muted" style="font-size:11px">${fmtDate(t.date)}</span>
          </div>
        </div>
      `));
    });
    box.appendChild(list);
    mountIcons(box);
    list.querySelectorAll('.row').forEach(r => r.addEventListener('click', () => CRUD.txDetail(root, r.dataset.id)));
  };

  const set = debounce(() => {
    _txFilter.q = root.querySelector('#tx-search').value;
    _txFilter.kind = root.querySelector('#tx-kind').value;
    _txFilter.month = root.querySelector('#tx-month').value;
    reload();
  }, 250);
  root.querySelector('#tx-search').addEventListener('input', set);
  root.querySelector('#tx-kind').addEventListener('change', set);
  root.querySelector('#tx-month').addEventListener('change', set);

  reload();
};

CRUD.txForm = async (root, editId) => {
  const orgId = App.getOrg();
  const [clients, cats, accounts] = await Promise.all([
    dbSelect('clients', { orgId }), dbSelect('categories', { orgId }), dbSelect('bank_accounts', { orgId })
  ]);
  const tx = editId ? (await dbSelect('transactions', { filters: { id: editId } }))[0] : null;

  const opts = (list, val) => list.map(x => `<option value="${x.id}" ${val===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
  const catOptions = (kind) => cats.filter(c => c.kind === kind).map(c => `<option value="${c.id}" ${tx&&tx.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  const { close } = openSheet(editId ? 'Editar Transação' : 'Nova Transação', `
    <div class="seg" id="tx-kind-seg">
      <button data-k="expense" class="${!tx||tx.kind==='expense'?'active':''}">Despesa</button>
      <button data-k="income" class="${tx&&tx.kind==='income'?'active':''}">Receita</button>
    </div>
    <input type="hidden" id="tx-kind-val" value="${tx?tx.kind:'expense'}">
    <label class="field"><span>Descrição</span><input id="tx-desc" value="${esc(tx?tx.description:'')}" placeholder="Ex.: Venda de serviço, compra de insumo..."></label>
    <div class="form-grid">
      <label class="field"><span>Valor (R$)</span><input id="tx-amount" inputmode="decimal" value="${tx?Number(tx.amount).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
      <label class="field"><span>Data</span><input id="tx-date" type="date" value="${tx?tx.date:todayISO()}"></label>
    </div>
    <div class="form-grid">
      <label class="field"><span>Categoria</span><select id="tx-cat">${catOptions(tx?tx.kind:'expense') || '<option value="">—</option>'}</select></label>
      <label class="field"><span>Cliente</span><select id="tx-client"><option value="">—</option>${opts(clients, tx?tx.client_id:null)}</select></label>
    </div>
    <label class="field"><span>Conta</span><select id="tx-account"><option value="">Sem conta</option>${opts(accounts, tx?tx.account_id:null)}</select></label>
    <label class="field"><span>Status</span>
      <select id="tx-status">
        <option value="posted" ${tx&&tx.status==='posted'?'selected':''}>Lançado (efetivado)</option>
        <option value="pending" ${tx&&tx.status==='pending'?'selected':''}>Pendente</option>
        <option value="cancelled" ${tx&&tx.status==='cancelled'?'selected':''}>Cancelado</option>
      </select>
    </label>
    <div class="actions">
      <button class="btn primary" id="tx-save">${icon('check',17)} Salvar</button>
      ${editId ? `<button class="btn danger" id="tx-del">${icon('trash',17)} Excluir</button>` : ''}
    </div>
  `);

  const seg = document.getElementById('tx-kind-seg');
  const catSel = document.getElementById('tx-cat');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('tx-kind-val').value = b.dataset.k;
    catSel.innerHTML = cats.filter(c => c.kind === b.dataset.k).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  });

  document.getElementById('tx-save').addEventListener('click', async () => {
    const kind = document.getElementById('tx-kind-val').value;
    const description = document.getElementById('tx-desc').value.trim();
    const amount = parseFloat((document.getElementById('tx-amount').value.replace(',', '.')).replace(/[^\d.-]/g, ''));
    const date = document.getElementById('tx-date').value;
    if (!description || !amount) { toast('Preencha descrição e valor.', 'err'); return; }
    const data = {
      org_id: orgId, kind, description, amount: Math.abs(amount),
      date, status: document.getElementById('tx-status').value,
      category_id: document.getElementById('tx-cat').value || null,
      client_id: document.getElementById('tx-client').value || null,
      account_id: document.getElementById('tx-account').value || null
    };
    try {
      if (editId) { await dbUpdate('transactions', editId, data); toast('Transação atualizada.'); }
      else { await dbInsert('transactions', data); toast('Transação lançada.'); }
      close(); CRUD.transacoes(root);
    } catch (e) { offerSetup(root, e); toast(msgOf(e), 'err'); }
  });

  const delBtn = document.getElementById('tx-del');
  if (delBtn) delBtn.addEventListener('click', async () => {
    openModal('Excluir transação', `<p class="muted">Deseja excluir definitivamente este lançamento?</p>
      <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn danger" id="md-confirm">Excluir</button></div>`);
    document.getElementById('md-cancel').addEventListener('click', closeModal);
    document.getElementById('md-confirm').addEventListener('click', async () => {
      try { await dbDelete('transactions', editId); toast('Excluída.'); closeModal(); close(); CRUD.transacoes(root); }
      catch (e) { toast(msgOf(e), 'err'); }
    });
  });
  mountIcons(document.getElementById('sheet'));
};

CRUD.txDetail = async (root, id) => {
  const tx = (await dbSelect('transactions', { filters: { id } }))[0];
  if (!tx) return;
  const orgId = App.getOrg();
  const [clients, cats, accounts] = await Promise.all([dbSelect('clients', { orgId }), dbSelect('categories', { orgId }), dbSelect('bank_accounts', { orgId })]);
  const cName = new Map(clients.map(c => [c.id, c.name]));
  const catM = new Map(cats.map(c => [c.id, c]));
  const accM = new Map(accounts.map(a => [a.id, a.name]));
  const cat = catM.get(tx.category_id);
  openSheet('Detalhes da Transação', `
    <div style="text-align:center;padding:10px 0 16px">
      <div style="font-size:34px;font-weight:800;font-family:var(--mono);color:${tx.kind==='income'?'var(--ok)':'var(--danger)'}">${tx.kind==='income'?'+':'-'} ${fmtMoney(tx.amount)}</div>
      <div style="font-weight:600;margin-top:4px">${esc(tx.description)}</div>
      <span class="chip ${tx.status==='posted'?'ok':'warn'}" style="margin-top:8px">${STATUS_LABEL[tx.status]||tx.status}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span>Tipo</span><strong>${KIND_LABEL[tx.kind]}</strong></div>
      <div class="detail-item"><span>Data</span><strong>${fmtDate(tx.date)}</strong></div>
      <div class="detail-item"><span>Categoria</span><strong>${cat?esc(cat.name):'—'}</strong></div>
      <div class="detail-item"><span>Cliente</span><strong>${cName.get(tx.client_id)||'—'}</strong></div>
      <div class="detail-item" style="grid-column:1/-1"><span>Conta</span><strong>${accM.get(tx.account_id)||'—'}</strong></div>
    </div>
    <div class="actions">
      <button class="btn primary" id="tx-edit">${icon('edit',16)} Editar</button>
    </div>
  `);
  document.getElementById('tx-edit').addEventListener('click', () => { closeSheetAll(); CRUD.txForm(root, tx.id); });
};

// ============ CONTAS A PAGAR / RECEBER (CRUD) ============
let _invFilter = 'open';

CRUD.contas = async (root) => {
  const orgId = App.getOrg();
  clear(root);
  root.appendChild(els(`
    <div class="view-header"><h1>Contas</h1><p>Contas a pagar e a receber</p>
      <div class="seg" id="inv-seg">
        <button data-f="open" class="active">Em aberto</button>
        <button data-f="paid">Pago</button>
        <button data-f="all">Todas</button>
      </div>
    </div>
    <div id="inv-list"></div>
  `));
  root.querySelector('#inv-seg').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    root.querySelectorAll('#inv-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    _invFilter = b.dataset.f;
    reload();
  });

  const reload = async () => {
    const box = root.querySelector('#inv-list');
    clear(box); box.appendChild(els(cardSkeleton()));
    let inv = await dbSelect('invoices', { orgId, order: { col: 'due_date', asc: true }, limit: 400 });
    if (_invFilter === 'open') inv = inv.filter(i => !['paid','cancelled'].includes(i.status));
    if (_invFilter === 'paid') inv = inv.filter(i => i.status === 'paid');
    const [clients] = await Promise.all([dbSelect('clients', { orgId })]);
    const cName = new Map(clients.map(c => [c.id, c.name]));
    clear(box);

    const rec = inv.filter(i => i.kind === 'receivable');
    const pay = inv.filter(i => i.kind === 'payable');
    const sum = (arr) => arr.reduce((a, i) => a + Number(i.amount), 0);

    box.appendChild(els(`
      <div class="grid cols-2" style="margin-bottom:4px">
        <div class="card"><div class="card-title">A Receber</div><div class="card-value sm" style="color:var(--ok)">${fmtCompact(sum(rec))}</div><div class="card-sub">${rec.length} títulos</div></div>
        <div class="card"><div class="card-title">A Pagar</div><div class="card-value sm" style="color:var(--danger)">${fmtCompact(sum(pay))}</div><div class="card-sub">${pay.length} títulos</div></div>
      </div>
      <div class="list"></div>
    `));
    const list = box.querySelector('.list');
    if (!inv.length) {
      list.appendChild(el(`<div class="empty"><div class="big">${icon('invoice',32)}</div><strong>Nenhuma conta</strong><span>Toque no botão + para criar uma conta.</span></div>`));
      return;
    }
    const today = todayISO();
    inv.forEach((i, idx) => {
      const overdue = !['paid','cancelled'].includes(i.status) && i.due_date && i.due_date < today;
      list.appendChild(el(`
        <div class="row ${overdue ? 'danger' : ''}" style="animation-delay:${Math.min(idx,8)*40}ms;${overdue?'border-color:color-mix(in srgb,var(--danger) 35%,transparent)':''}" data-id="${i.id}">
          <div class="ico" style="color:${i.kind==='receivable'?'var(--ok)':'var(--danger)'}">${icon(i.kind==='receivable'?'trending_up':'receipt',18)}</div>
          <div class="body">
            <strong>${esc(i.description || (i.number ? 'Nº '+i.number : 'Conta'))}</strong>
            <span>${cName.get(i.client_id) || ''} ${i.number ? '· Nº '+esc(i.number) : ''}</span>
          </div>
          <div class="right">
            <span class="amount ${i.kind==='receivable'?'income':'expense'}">${fmtCompact(i.amount)}</span><br>
            <span class="muted" style="font-size:11px">${i.due_date ? (i.status==='paid' ? 'Pago em '+fmtShort(i.paid_at) : fmtShort(i.due_date)) : ''}</span>
          </div>
        </div>
      `));
    });
    mountIcons(box);
    list.querySelectorAll('.row').forEach(r => r.addEventListener('click', () => CRUD.invDetail(root, r.dataset.id)));
  };

  reload();
};

CRUD.invForm = async (root, editId) => {
  const orgId = App.getOrg();
  const clients = await dbSelect('clients', { orgId });
  const inv = editId ? (await dbSelect('invoices', { filters: { id: editId } }))[0] : null;

  const { close } = openSheet(editId ? 'Editar Conta' : 'Nova Conta', `
    <div class="seg" id="inv-kind-seg">
      <button data-k="receivable" class="${!inv||inv.kind==='receivable'?'active':''}">A receber</button>
      <button data-k="payable" class="${inv&&inv.kind==='payable'?'active':''}">A pagar</button>
    </div>
    <input type="hidden" id="inv-kind-val" value="${inv?inv.kind:'receivable'}">
    <label class="field"><span>Descrição</span><input id="inv-desc" value="${esc(inv?inv.description:'')}" placeholder="Ex.: Fatura de serviços, fornecedor..."></label>
    <div class="form-grid">
      <label class="field"><span>Valor (R$)</span><input id="inv-amount" inputmode="decimal" value="${inv?Number(inv.amount).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
      <label class="field"><span>Nº do título</span><input id="inv-number" value="${esc(inv&&inv.number?inv.number:'')}" placeholder="Opcional"></label>
    </div>
    <div class="form-grid">
      <label class="field"><span>Vencimento</span><input id="inv-due" type="date" value="${inv&&inv.due_date?inv.due_date:todayISO()}"></label>
      <label class="field"><span>Cliente / Fornecedor</span><select id="inv-client"><option value="">—</option>${clients.map(c=>`<option value="${c.id}" ${inv&&inv.client_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Status</span>
      <select id="inv-status">
        <option value="open" ${inv&&inv.status==='open'?'selected':''}>Em aberto</option>
        <option value="paid" ${inv&&inv.status==='paid'?'selected':''}>Pago</option>
        <option value="cancelled" ${inv&&inv.status==='cancelled'?'selected':''}>Cancelado</option>
      </select>
    </label>
    <div class="actions">
      <button class="btn primary" id="inv-save">${icon('check',17)} Salvar</button>
      ${editId ? `<button class="btn danger" id="inv-del">${icon('trash',17)} Excluir</button>` : ''}
    </div>
  `);

  document.getElementById('inv-kind-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.getElementById('inv-kind-seg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('inv-kind-val').value = b.dataset.k;
  });

  document.getElementById('inv-save').addEventListener('click', async () => {
    const kind = document.getElementById('inv-kind-val').value;
    const description = document.getElementById('inv-desc').value.trim();
    const amount = parseFloat((document.getElementById('inv-amount').value.replace(',', '.')).replace(/[^\d.-]/g, ''));
    const due = document.getElementById('inv-due').value;
    if (!description || !amount) { toast('Preencha descrição e valor.', 'err'); return; }
    const status = document.getElementById('inv-status').value;
    const data = {
      org_id: orgId, kind, description, amount: Math.abs(amount),
      due_date: due, number: document.getElementById('inv-number').value.trim() || null,
      client_id: document.getElementById('inv-client').value || null,
      status,
      paid_at: status === 'paid' ? (inv?.paid_at || new Date().toISOString()) : null
    };
    try {
      if (editId) { await dbUpdate('invoices', editId, data); toast('Conta atualizada.'); }
      else { await dbInsert('invoices', data); toast('Conta criada.'); }
      close(); CRUD.contas(root);
    } catch (e) { toast(msgOf(e), 'err'); }
  });

  const delBtn = document.getElementById('inv-del');
  if (delBtn) delBtn.addEventListener('click', async () => {
    openModal('Excluir conta', `<p class="muted">Deseja excluir definitivamente esta conta?</p>
      <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn danger" id="md-confirm">Excluir</button></div>`);
    document.getElementById('md-cancel').addEventListener('click', closeModal);
    document.getElementById('md-confirm').addEventListener('click', async () => {
      try { await dbDelete('invoices', editId); toast('Excluída.'); closeModal(); close(); CRUD.contas(root); }
      catch (e) { toast(msgOf(e), 'err'); }
    });
  });
  mountIcons(document.getElementById('sheet'));
};

CRUD.invDetail = async (root, id) => {
  const inv = (await dbSelect('invoices', { filters: { id } }))[0];
  if (!inv) return;
  const orgId = App.getOrg();
  const clients = await dbSelect('clients', { orgId });
  const cName = new Map(clients.map(c => [c.id, c.name]));
  openSheet('Detalhes da Conta', `
    <div style="text-align:center;padding:10px 0 16px">
      <div style="font-size:34px;font-weight:800;font-family:var(--mono);color:${inv.kind==='receivable'?'var(--ok)':'var(--danger)'}">${fmtMoney(inv.amount)}</div>
      <div style="font-weight:600;margin-top:4px">${esc(inv.description || 'Conta')}</div>
      ${inv.due_date ? dayDiffBadge(inv.due_date) : ''}
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span>Tipo</span><strong>${KIND_LABEL[inv.kind]}</strong></div>
      <div class="detail-item"><span>Status</span><strong>${STATUS_LABEL[inv.status]||inv.status}</strong></div>
      <div class="detail-item"><span>Emissão</span><strong>${fmtDate(inv.issue_date)}</strong></div>
      <div class="detail-item"><span>Vencimento</span><strong>${fmtDate(inv.due_date)}</strong></div>
      <div class="detail-item"><span>Cliente</span><strong>${cName.get(inv.client_id)||'—'}</strong></div>
      <div class="detail-item"><span>Número</span><strong>${inv.number?'Nº '+esc(inv.number):'—'}</strong></div>
    </div>
    <div class="actions">
      <button class="btn primary" id="inv-edit">${icon('edit',16)} Editar</button>
    </div>
  `);
  document.getElementById('inv-edit').addEventListener('click', () => { closeSheetAll(); CRUD.invForm(root, inv.id); });
};

// ============ CLIENTES (CRUD) ============
CRUD.clientes = async (root) => {
  const orgId = App.getOrg();
  clear(root);
  root.appendChild(els(`
    <div class="view-header"><h1>Clientes</h1><p>Clientes, fornecedores e contatos</p></div>
    <div id="cli-list"></div>
  `));
  const box = root.querySelector('#cli-list');
  const reload = async () => {
    clear(box); box.appendChild(els(cardSkeleton()));
    const cli = await dbSelect('clients', { orgId, order: { col: 'name', asc: true } });
    const [txs] = await Promise.all([dbSelect('transactions', { orgId, filters: { status: 'posted' }, limit: 600 })]);
    clear(box);
    if (!cli.length) {
      box.appendChild(el(`<div class="empty"><div class="big">${icon('users',34)}</div><strong>Nenhum cliente cadastrado</strong><span>Toque no botão + para adicionar.</span></div>`));
      return;
    }
    const list = el(`<div class="list"></div>`);
    const sumTx = (id) => txs.filter(t => t.client_id === id).reduce((a, t) => a + (t.kind === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    cli.forEach((c, i) => {
      list.appendChild(el(`
        <div class="row" style="animation-delay:${Math.min(i,8)*40}ms" data-id="${c.id}">
          <div class="ico">${esc(initials(c.name))}</div>
          <div class="body"><strong>${esc(c.name)}</strong><span>${c.email || c.phone || 'Sem contato'}</span></div>
          <div class="right"><span class="amount income">${fmtCompact(sumTx(c.id))}</span><br>
            <span class="chip ${c.kind==='supplier'?'warn':'info'}" style="margin-top:4px">${c.kind==='supplier'?'Fornecedor':c.kind==='both'?'Ambos':'Cliente'}</span>
          </div>
        </div>
      `));
    });
    box.appendChild(list);
    list.querySelectorAll('.row').forEach(r => r.addEventListener('click', () => CRUD.clienteDetail(root, r.dataset.id)));
  };
  reload();
};

CRUD.clienteForm = async (root, editId) => {
  const orgId = App.getOrg();
  const c = editId ? (await dbSelect('clients', { filters: { id: editId } }))[0] : null;
  const { close } = openSheet(editId ? 'Editar Cliente' : 'Novo Cliente', `
    <label class="field"><span>Nome / Razão social</span><input id="cli-name" value="${esc(c?c.name:'')}" placeholder="Ex.: Empresa de Tecnologia LTDA"></label>
    <div class="form-grid">
      <label class="field"><span>E-mail</span><input id="cli-email" type="email" value="${esc(c?c.email:'')}" placeholder="contato@..."></label>
      <label class="field"><span>Telefone</span><input id="cli-phone" value="${esc(c?c.phone:'')}" placeholder="(00) 00000-0000"></label>
    </div>
    <label class="field"><span>Documento (CPF/CNPJ)</span><input id="cli-doc" value="${esc(c?c.document:'')}" placeholder="Opcional"></label>
    <label class="field"><span>Tipo</span>
      <select id="cli-kind">
        <option value="client" ${c&&c.kind==='client'?'selected':''}>Cliente</option>
        <option value="supplier" ${c&&c.kind==='supplier'?'selected':''}>Fornecedor</option>
        <option value="both" ${c&&c.kind==='both'?'selected':''}>Cliente e Fornecedor</option>
      </select></label>
    <div class="actions">
      <button class="btn primary" id="cli-save">${icon('check',17)} Salvar</button>
      ${editId ? `<button class="btn danger" id="cli-del">${icon('trash',17)} Excluir</button>` : ''}
    </div>
  `);
  document.getElementById('cli-save').addEventListener('click', async () => {
    const name = document.getElementById('cli-name').value.trim();
    if (!name) { toast('Informe o nome.', 'err'); return; }
    const data = {
      org_id: orgId, name,
      email: document.getElementById('cli-email').value.trim() || null,
      phone: document.getElementById('cli-phone').value.trim() || null,
      document: document.getElementById('cli-doc').value.trim() || null,
      kind: document.getElementById('cli-kind').value
    };
    try {
      if (editId) { await dbUpdate('clients', editId, data); toast('Cliente atualizado.'); }
      else { await dbInsert('clients', data); toast('Cliente adicionado.'); }
      close(); CRUD.clientes(root);
    } catch (e) { toast(msgOf(e), 'err'); }
  });
  const delBtn = document.getElementById('cli-del');
  if (delBtn) delBtn.addEventListener('click', async () => {
    openModal('Excluir cliente', `<p class="muted">Excluir "${esc(c.name)}"? O histórico de transações será mantido sem vínculo.</p>
      <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn danger" id="md-confirm">Excluir</button></div>`);
    document.getElementById('md-cancel').addEventListener('click', closeModal);
    document.getElementById('md-confirm').addEventListener('click', async () => {
      try { await dbDelete('clients', editId); toast('Excluído.'); closeModal(); close(); CRUD.clientes(root); }
      catch (e) { toast(msgOf(e), 'err'); }
    });
  });
  mountIcons(document.getElementById('sheet'));
};

CRUD.clienteDetail = async (root, id) => {
  const c = (await dbSelect('clients', { filters: { id } }))[0];
  if (!c) return;
  openSheet(esc(c.name), `
    <div class="detail-grid">
      <div class="detail-item"><span>E-mail</span><strong>${esc(c.email||'—')}</strong></div>
      <div class="detail-item"><span>Telefone</span><strong>${esc(c.phone||'—')}</strong></div>
      <div class="detail-item"><span>Documento</span><strong>${esc(c.document||'—')}</strong></div>
      <div class="detail-item"><span>Tipo</span><strong>${c.kind==='supplier'?'Fornecedor':c.kind==='both'?'Ambos':'Cliente'}</strong></div>
    </div>
    <div class="actions">
      <button class="btn primary" id="cli-edit">${icon('edit',16)} Editar</button>
    </div>
  `);
  document.getElementById('cli-edit').addEventListener('click', () => { closeSheetAll(); CRUD.clienteForm(root, c.id); });
};

const closeSheetAll = () => {
  const s = document.getElementById('sheet'); s.classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('open');
};

// ============ CONFIGURAÇÕES ============
CRUD.config = async (root) => {
  clear(root);
  const user = (await sb.auth.getSession()).data.session?.user;
  const profile = user ? (await dbSelect('profiles', { filters: { id: user.id } }))[0] : null;
  const role = await myRole().catch(() => 'member');
  const hasRoot = await rootExists().catch(() => true);
  const isRootRole = role === 'root' || (profile && profile.role === 'root');

  // Bootstrap: usuário sem papel que ainda não tem root no sistema
  const needBootstrap = !isRootRole && !hasRoot;

  root.appendChild(els(`
    <div class="view-header"><h1>Configurações</h1><p>Perfil, equipe e organização</p></div>
    ${needBootstrap ? `
    <div class="card usr-actions">
      <div class="card-title">${icon('shield',15)} Primeiro acesso</div>
      <p class="muted" style="margin-top:8px">Você é o primeiro usuário do sistema e ainda não há um administrador principal (Root). Ao assumir este papel, você poderá criar usuários master, organizações e gerenciar todas as equipes.</p>
      <div class="actions" style="margin-top:12px">
        <button class="btn primary" id="cf-boot-root">${icon('shield',16)} Assumir como administrador principal</button>
      </div>
    </div>` : ''}
    <div class="card">
      <div class="card-title">Minha Conta</div>
      <div class="row" style="margin-top:10px">
        <div class="ico">${esc(initials(profile?.name || user?.email))}</div>
        <div class="body"><strong>${esc(profile?.name || user?.email)}</strong><span>${esc(user?.email)}</span></div>
        <div class="right"><span class="chip role-${role}">${roleLabel(role)}</span></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Organização Ativa</div>
      <div id="cfg-orgs"></div>
    </div>
    <div class="card">
      <div class="card-title">Equipe</div>
      <div id="cfg-members"></div>
      <div class="actions" style="margin-top:12px">
        <button class="btn ghost" id="cfg-invite">${icon('users',16)} Convidar membro</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Dados & Segurança</div>
      <div class="actions" style="margin-top:10px">
        <button class="btn ghost sm" id="cfg-exp-tx">${icon('download',16)} Exportar transações</button>
        <button class="btn ghost sm" id="cfg-exp-inv">${icon('download',16)} Exportar contas</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:12px">Multi-tenant: cada usuário acessa apenas os dados das organizações em que é membro (Row Level Security).</p>
    </div>
  `));

  if (needBootstrap) {
    root.querySelector('#cf-boot-root').addEventListener('click', async () => {
      try {
        await ensureRoot(user?.email || '');
        App.role = 'root';
        toast('Agora você é o administrador principal (Root)!');
        App.refresh();
      } catch (e) { toast(msgOf(e), 'err'); }
    });
  }

  const orgsBox = root.querySelector('#cfg-orgs');
  try {
    const orgs = await listMyOrgs();
    clear(orgsBox);
    orgs.forEach(o => orgsBox.appendChild(el(`
      <div class="org-chip" data-org="${o.id}" style="margin-top:8px">
        <span class="dot"></span>
        <div style="flex:1"><strong>${esc(o.name)}</strong><span>${esc(o.segment || 'Organização')}${o.id===App.getOrg()?' · ativa':''}</span></div>
        ${o.id===App.getOrg()
          ? '<span class="chip ok">Ativa</span>'
          : '<span style="display:flex;gap:6px"><button class="btn ghost sm" data-switch="'+o.id+'">Usar</button><button class="icon-btn danger" data-del="'+o.id+'" aria-label="Remover">'+icon('trash',15)+'</button></span>'}
      </div>
    `)));
    orgsBox.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => {
      App.setOrg(b.dataset.switch); App.refresh(); toast('Organização alterada.');
    }));
    orgsBox.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = b.dataset.del;
      openModal('Remover organização', `
        <p class="muted">Excluir esta organização e todos os seus dados? Esta ação não pode ser desfeita.</p>
        <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn danger" id="md-del-org">${icon('trash',16)} Excluir</button></div>`);
      document.getElementById('md-cancel').addEventListener('click', closeModal);
      document.getElementById('md-del-org').addEventListener('click', async () => {
        try {
          await deleteOrganization(id);
          toast('Organização removida.'); closeModal();
          if (App.getOrg() === id) { App.setOrg(null); try { localStorage.removeItem(SESSION_LABEL); } catch(e){} App.orgId = null; }
          CRUD.config(root);
        } catch (e) { toast(msgOf(e), 'err'); }
      });
    }));
  } catch (e) { orgsBox.appendChild(el(`<div class="muted" style="padding:10px 0;font-size:13px">${esc(msgOf(e))}</div>`)); }

  const addOrgBtn = el(`<button class="btn ghost block" id="cfg-add-org" style="margin-top:10px">${icon('plus',16)} Nova organização</button>`);
  if (isRootRole) orgsBox.appendChild(addOrgBtn);
  addOrgBtn.addEventListener('click', () => {
    openModal('Nova Organização', `
      <label class="field"><span>Nome</span><input id="org-name" placeholder="Ex.: Cliente Alfa LTDA"></label>
      <label class="field"><span>Segmento</span><input id="org-segment" placeholder="Ex.: Varejo, Serviços..."></label>
      <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn primary" id="md-create">${icon('plus',16)} Criar</button></div>`);
    document.getElementById('md-cancel').addEventListener('click', closeModal);
    document.getElementById('md-create').addEventListener('click', async () => {
      const name = document.getElementById('org-name').value.trim();
      if (!name) { toast('Informe o nome.', 'err'); return; }
      try {
        const orgId = await createOrganization({ name, segment: document.getElementById('org-segment').value.trim() });
        App.setOrg(orgId); toast('Organização criada. Comece a lançar!'); closeModal(); App.refresh();
      } catch (e) { toast(msgOf(e), 'err'); offerSetup(root, e); }
    });
  });

  const membersBox = root.querySelector('#cfg-members');
  try {
    const orgId = App.getOrg();
    const [orgSel] = await Promise.all([
      dbSelect('organizations', { filters: { id: orgId } })
    ]);
    clear(membersBox);
    App.updateOrgName(orgSel[0] || null);
  } catch (e) {
    membersBox.appendChild(el(`<div class="muted" style="padding:10px 0;font-size:13px">Membros só podem ser gerenciados quando o schema estiver ativo. ${esc(msgOf(e))}</div>`));
  }

  const redoMembers = async () => {
    const orgId = App.getOrg();
    try {
      const members = await listMembers(orgId);
      const box = document.getElementById('cfg-members');
      clear(box);
      const user = (await sb.auth.getSession()).data.session?.user;
      const labels = { owner: 'Proprietário', admin: 'Admin', viewer: 'Visualizador' };
      members.forEach(m => {
        const isMe = m.user_id === user?.id;
        box.appendChild(el(`
          <div class="row" style="margin-top:8px">
            <div class="ico">${isMe ? 'Você' : '—'}</div>
            <div class="body"><strong>${esc(m.user_id)}</strong><span>${labels[m.role]||m.role}</span></div>
            <div class="right"><span class="chip ${m.role==='owner'?'ok':'info'}">${labels[m.role]||m.role}</span></div>
          </div>
        `));
      });
    } catch(e) {}
  };

  const inviteBtn = root.querySelector('#cfg-invite');
  if (inviteBtn) inviteBtn.addEventListener('click', () => {
    openModal('Convidar Membro', `
      <label class="field"><span>E-mail do usuário</span><input id="inv-email" type="email" placeholder="colaborador@empresa.com"></label>
      <label class="field"><span>Papel</span>
        <select id="inv-role">
          <option value="admin">Admin — gerencia e edita</option>
          <option value="member" selected>Membro — edita</option>
          <option value="viewer">Visualizador — somente leitura</option>
        </select></label>
      <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn primary" id="md-invite">${icon('users',16)} Convidar</button></div>`);
    document.getElementById('md-cancel').addEventListener('click', closeModal);
    document.getElementById('md-invite').addEventListener('click', async () => {
      const email = document.getElementById('inv-email').value.trim();
      if (!email) { toast('Informe o e-mail.', 'err'); return; }
      try {
        await inviteMember({ org: App.getOrg(), email, role: document.getElementById('inv-role').value });
        toast('Membro adicionado (precisa já ter conta).'); closeModal(); redoMembers();
      } catch (e) { toast(msgOf(e), 'err'); }
    });
  });

  root.querySelector('#cfg-exp-tx').addEventListener('click', async () => {
    try {
      const txs = await dbSelect('transactions', { orgId: App.getOrg(), limit: 2000 });
      const [clients, cats] = await Promise.all([dbSelect('clients', { orgId: App.getOrg(), limit: 500 }), dbSelect('categories', { orgId: App.getOrg() })]);
      REPORTS.exportTransactions(txs, clients, cats); toast('CSV de transações exportado.');
    } catch (e) { toast(msgOf(e), 'err'); }
  });
  root.querySelector('#cfg-exp-inv').addEventListener('click', async () => {
    try {
      const inv = await dbSelect('invoices', { orgId: App.getOrg(), limit: 1000 });
      const clients = await dbSelect('clients', { orgId: App.getOrg(), limit: 500 });
      REPORTS.exportInvoices(inv, clients); toast('CSV de contas exportado.');
    } catch (e) { toast(msgOf(e), 'err'); }
  });
  mountIcons(root);
};

// aux: nome da org global
const _orgName = { current: null };