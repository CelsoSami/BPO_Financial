// ============================================================
// C2 Finance - Núcleo da aplicação
// Boot, sessão, roteamento, drawer lateral, org ativa
// ============================================================

const App = {
  view: 'dashboard',
  orgId: null,
  user: null,
  role: 'member',
  _orgName: '—',
  impersonation: null,

  init() {
    this.bindAuth();
    this.bindShell();
    this.boot();
  },

  // ---------- Auth UI ----------
  bindAuth() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = document.getElementById('login-msg');
      box.className = 'msg'; box.textContent = 'Entrando...';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const { error } = await signIn({ email, password });
      if (error) {
        box.className = 'msg err';
        box.textContent = msgOf(error);
      } else { box.textContent = ''; await this.boot(); }
    });
  },

  // ---------- App shell / navegação ----------
  bindShell() {
    const drawer = document.getElementById('drawer');
    document.getElementById('btn-drawer').addEventListener('click', () => drawer.classList.toggle('open'));
    document.getElementById('drawer-scrim').addEventListener('click', () => drawer.classList.remove('open'));

    document.getElementById('btn-theme').addEventListener('click', toggleTheme);

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.go(btn.dataset.view);
        drawer.classList.remove('open');
      });
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      if (this.impersonation) await stopImpersonate().catch(() => {});
      this.impersonation = null;
      this.renderImpersonationBar();
      await signOut();
      this.showAuth();
    });

    document.getElementById('fab').addEventListener('click', () => this.fabAction());

    window.addEventListener('hashchange', () => {
      const hash = location.hash.replace('#/', '');
      if (hash) this.go(hash);
    });
  },

  async fabAction() {
    try {
      const v = this.view;
      if (v === 'transacoes') return await CRUD.txForm(document.getElementById('view'));
      if (v === 'contas') return await CRUD.invForm(document.getElementById('view'));
      if (v === 'clientes') return await CRUD.clienteForm(document.getElementById('view'));
      if (v === 'usuarios') return await USERS.openCreate(document.getElementById('view'));
      if (v === 'organizacoes') return await ORGS.newOrg(document.getElementById('view'));
      this.go('transacoes'); await new Promise(r => setTimeout(r, 60));
      await CRUD.txForm(document.getElementById('view'));
    } catch (err) {
      console.error('FAB:', err);
      toast('Não foi possível abrir o formulário.', 'err');
    }
  },

  async go(view, opts = {}) {
    this.view = view;
    const names = {
      dashboard: 'Dashboard', fluxo: 'Fluxo de Caixa', transacoes: 'Transações',
      contas: 'Contas a Pagar / Receber', clientes: 'Clientes',
      relatorios: 'Relatórios & BI', config: 'Configurações',
      usuarios: 'Usuários', organizacoes: 'Organizações'
    };
    document.getElementById('topbar-title').textContent = names[view] || 'C2 Finance';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    if (location.hash !== '#/' + view) history.replaceState(null, '', '#/' + view);

    const root = document.getElementById('view');
    clear(root);
    root.appendChild(els(`<div class="view-header"><h1>${names[view]}</h1></div><div class="skel" style="min-height:200px"></div>`));

    try {
      const map = {
        dashboard: CRUD.dashboard.bind(CRUD),
        fluxo: CRUD.fluxo.bind(CRUD),
        transacoes: CRUD.transacoes.bind(CRUD),
        contas: CRUD.contas.bind(CRUD),
        clientes: CRUD.clientes.bind(CRUD),
        relatorios: REPORTS.render.bind(REPORTS),
        config: CRUD.config.bind(CRUD),
        usuarios: USERS.render.bind(USERS),
        organizacoes: ORGS.render.bind(ORGS)
      };
      await map[view](root);
      mountIcons(root);
    } catch (e) {
      offerSetup(root, e);
    }
  },

  // ---------- Sessão & boot ----------
  async boot() {
    const { data } = await getSession();
    if (!data.session) return this.showAuth();
    this.user = data.session.user;
    this.showApp();
    const info = await impersonationInfo();
    this.impersonation = (info && info[0]) || null;
    const valid = { dashboard: 1, fluxo: 1, transacoes: 1, contas: 1, clientes: 1, relatorios: 1, config: 1, usuarios: 1, organizacoes: 1 };
    const fromHash = location.hash.replace('#/', '');
    if (valid[fromHash]) this.view = fromHash;
    await this.autoRoot();
    await this.restoreOrg();
    this.role = await myRole().catch(() => 'member');
    this.applyRoleUI();
    this.renderImpersonationBar();
    await this.go(this.view);
    this.loadDrawerMeta();
  },

  // O usuário principal (email definido em ROOT_EMAIL) assume o papel
  // de administrador (Root) automaticamente no primeiro acesso.
  async autoRoot() {
    if (!this.user?.email || !ROOT_EMAIL) return;
    if (this.user.email.toLowerCase() !== ROOT_EMAIL.toLowerCase()) return;
    try {
      const role = await myRole();
      if (role === 'root') { this.role = 'root'; return; }
      // Chamada idempotente: garante que este e-mail seja o Root,
      // transferindo o papel de volta se houver um root diferente.
      await ensureRoot(this.user.email);
      this.role = 'root';
    } catch (e) {
      console.error('[autoRoot]', e);
      this.role = await myRole().catch(() => 'member');
    }
  },

  // Mostra/oculta itens exclusivos de administradores (Root/Master)
  applyRoleUI() {
    const admin = this.role === 'root' || this.role === 'master';
    const hideAdmin = !admin || !!this.impersonation;
    document.querySelectorAll('.admin-only').forEach(n => n.classList.toggle('hidden', hideAdmin));
    if (hideAdmin && (this.view === 'usuarios' || this.view === 'organizacoes')) {
      this.view = 'dashboard'; location.hash = '#/dashboard';
    }
  },

  showAuth() {
    clear(document.getElementById('view'));
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');
  },

  showApp() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
  },

  async restoreOrg() {
    // org salva localmente; se não existir, escolhe a primeira do usuário
    let orgId = null;
    try { orgId = localStorage.getItem(SESSION_LABEL); } catch(e) {}
    try {
      const orgs = await listMyOrgs();
      if (orgId && orgs.some(o => o.id === orgId)) { this.orgId = orgId; }
      else if (orgs.length) { this.orgId = orgs[0].id; try { localStorage.setItem(SESSION_LABEL, this.orgId); } catch(e){} }
      else if (this.impersonation) {
        // "enxergando como" alguém que ainda não tem organização: não cria org
        this.orgId = null;
        this.view = 'dashboard';
        toast('O usuário visualizado ainda não está vinculado a nenhuma organização.', 'info');
      }
      else {
        // sem organização
        this.role = await myRole();
        // Só o usuário definido em ROOT_EMAIL pode se tornar Root.
        const isRootEmail = !!ROOT_EMAIL && !!this.user?.email &&
          this.user.email.toLowerCase() === ROOT_EMAIL.toLowerCase();
        const hasRoot = await rootExists().catch(() => false);
        if (this.role !== 'root' && !hasRoot && isRootEmail) {
          // primeiro acesso do usuário principal: assume o papel de administrador
          try { await ensureRoot(this.user.email); this.role = 'root'; } catch(e) {}
        }
        if (this.role === 'root') {
          // root criando a própria organização inicial
          const name = this.user?.user_metadata?.name ? `${this.user.user_metadata.name}'s Org` : 'Minha Organização';
          try {
            this.orgId = await createOrganization({ name });
            try { localStorage.setItem(SESSION_LABEL, this.orgId); } catch(e){}
            toast('Organização inicial criada. Bem-vindo ao C2 Finance!');
          } catch(e) { offerSetup(document.getElementById('view'), e); }
        } else {
          // usuário ainda sem organização: aguarda ser vinculado por um admin
          this.orgId = null;
          this.view = 'config';
          toast('Você ainda não foi vinculado a nenhuma organização.', 'info');
        }
      }
      this.loadDrawerMeta();
    } catch (e) {
      offerSetup(document.getElementById('view'), e);
    }
  },

  getOrg() { return this.orgId; },

  setOrg(id) {
    this.orgId = id;
    try { localStorage.setItem(SESSION_LABEL, id); } catch(e){}
  },

  updateOrgName(org) {
    if (org) this._orgName = org.name;
  },

  async loadDrawerMeta() {
    if (!this.orgId) return;
    try {
      const orgs = await listMyOrgs();
      const active = orgs.find(o => o.id === this.orgId);
      if (active) this._orgName = active.name;
    } catch(e){}
    document.getElementById('org-name-drawer').textContent = this._orgName;
  },

  async refresh() {
    this.role = await myRole().catch(() => 'member');
    this.applyRoleUI();
    this.loadDrawerMeta();
    await this.go(this.view);
  },

  // ---------- "Enxergar como" (impersonação de auditoria) ----------
  renderImpersonationBar() {
    const bar = document.getElementById('impersonation-bar');
    const fab = document.getElementById('fab');
    if (!bar) return;
    if (!this.impersonation) {
      bar.classList.add('hidden');
      if (fab) fab.classList.remove('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.innerHTML = `
      <span class="imp-eye">${icon('eye', 15)}</span>
      <span class="imp-text">Você está vendo como <strong>${esc(this.impersonation.name || 'usuário')}</strong>${this.impersonation.email ? ` (${esc(this.impersonation.email)})` : ''}</span>
      <button class="btn ghost sm imp-stop" id="imp-stop">${icon('x', 13)} Voltar ao meu usuário</button>
    `;
    mountIcons(bar);
    bar.classList.remove('hidden');
    if (fab) fab.classList.add('hidden');
    bar.querySelector('#imp-stop').addEventListener('click', () => this.endViewAs());
  },

  async beginViewAs(userId) {
    try {
      await startImpersonate(userId);
      const info = await impersonationInfo();
      this.impersonation = (info && info[0]) || { target_id: userId };
      this.orgId = null;
      try { localStorage.removeItem(SESSION_LABEL); } catch(e){}
      this.renderImpersonationBar();
      await this.restoreOrg();
      this.role = await myRole().catch(() => 'member');
      this.applyRoleUI();
      await this.go(this.view);
      this.loadDrawerMeta();
    } catch (e) {
      toast(msgOf(e), 'err');
    }
  },

  async endViewAs() {
    try { await stopImpersonate(); } catch(e) {}
    this.impersonation = null;
    this.orgId = null;
    try { localStorage.removeItem(SESSION_LABEL); } catch(e){}
    this.renderImpersonationBar();
    await this.restoreOrg();
    this.role = await myRole().catch(() => 'member');
    this.applyRoleUI();
    await this.go(this.view);
    this.loadDrawerMeta();
  }
};

// ---------- Ripple em todos os botões ----------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.btn').forEach(ripple);
  mountIcons(document.body);
  App.init();
});