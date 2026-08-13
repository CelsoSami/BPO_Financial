// ============================================================
// C2 Finance - Views de Usuários e Organizações (Root / Master)
// root   = proprietário (celso): cria/apaga orgs e qualquer usuário
// master_1 = criado pelo root e vinculado a uma org: cria/apaga master_2 e membros
// master_2 = criado por master_1 (ou root): cria/apaga membros
// ============================================================

const USERS = {};
const ORGS = {};

const roleLabel = (r, level) => {
  if (r === 'root') return 'Root';
  if (r === 'master') return level === 1 ? 'Master 1' : level === 2 ? 'Master 2' : 'Master';
  return 'Membro';
};

const roleChip = (r, level) =>
  `<span class="chip role-${r}">${roleLabel(r, level)}</span>`;

// Papel + nível de master do usuário logado
const myScope = async () => ({
  role: App.role,
  level: (await myMasterLevel().catch(() => 0)) || 0
});

// Papéis permitidos na criação de um usuário, conforme o chamador
const createRoleOptions = (scope) => {
  const opts = [['member', 'Membro']];
  if (scope.role === 'root') { opts.push(['master_1', 'Master 1']); opts.push(['master_2', 'Master 2']); }
  else if (scope.role === 'master' && scope.level === 1) opts.push(['master_2', 'Master 2']);
  return opts;
};

// ============ VIEW DE USUÁRIOS ============
USERS.render = async (root) => {
  clear(root);
  const scope = await myScope();
  const isRoot = scope.role === 'root';
  const isMaster = scope.role === 'master';
  if (!isRoot && !isMaster) {
    root.appendChild(el(`
      <div class="empty" style="padding-top:80px">
        <div class="big">${icon('users',34)}</div>
        <strong>Sem acesso</strong>
        <span>Este recurso é exclusivo de administradores.</span>
      </div>
    `));
    mountIcons(root);
    return;
  }

  root.appendChild(els(`
    <div class="view-header">
      <h1>Usuários ${roleChip(scope.role, scope.level)}</h1>
      <p>${isRoot ? 'Todos os usuários do sistema' : 'Usuários das suas organizações'}</p>
    </div>
    <div class="card usr-actions">
      <div class="card-title">${icon('shield',15)} Ações de equipe</div>
      <div class="actions" style="margin-top:12px">
        <button class="btn primary" id="usr-new">${icon('users',16)} Novo usuário</button>
      </div>
      <p class="muted" id="usr-hint" style="font-size:12px;margin-top:10px"></p>
    </div>
    <div id="usr-orgs"></div>
  `));

  const hint = root.querySelector('#usr-hint');
  hint.textContent = isRoot
    ? 'Crie usuários (Membro, Master 1 ou Master 2) e vincule-os às organizações.'
    : `Usuários criados aqui entram automaticamente na organização ativa: ${esc(App._orgName || '—')}.`;

  const orgsBox = root.querySelector('#usr-orgs');
  try {
    const [orgs, members, profiles] = await Promise.all([
      dbSelect('organizations'),
      dbSelect('memberships'),
      dbSelect('profiles')
    ]);
    const profById = new Map(profiles.map(p => [p.id, p]));
    const byOrg = new Map(orgs.map(o => [o.id, []]));
    members.forEach(m => { if (byOrg.has(m.org_id)) byOrg.get(m.org_id).push(m); });

    clear(orgsBox);
    if (!orgs.length) {
      orgsBox.appendChild(el(`<div class="empty"><strong>Nenhuma organização</strong><span>Use a aba Organizações para criar uma.</span></div>`));
    }

    orgs.forEach((o) => {
      const list = (byOrg.get(o.id) || []).sort((a, b) => (a.role === 'owner' ? -1 : 1));
      const card = el(`
        <div class="card" style="margin-top:4px">
          <div class="row" style="background:none;border:none;padding:0 0 2px">
            <div class="ico">${esc(initials(o.name))}</div>
            <div class="body"><strong>${esc(o.name)}</strong>
              <span>${esc(o.segment || 'Organização')} · ${list.length} usuário(s)</span></div>
            <div class="right"><span class="chip ghost">${o.id===App.getOrg()?'Ativa':'Não ativa'}</span></div>
          </div>
          <div class="list" style="margin-top:4px"></div>
        </div>
      `);
      const listBox = card.querySelector('.list');
      list.forEach((m) => {
        const p = profById.get(m.user_id);
        if (!p) return;
        listBox.appendChild(USERS.userRow({ org: o, membership: m, profile: p, scope }));
      });
      orgsBox.appendChild(card);
    });

    // Root: usuários sem organização (ainda não vinculados)
    if (isRoot) {
      const assigned = new Set(members.map(m => m.user_id));
      const orphans = profiles.filter(p => !assigned.has(p.id));
      if (orphans.length) {
        const card = el(`<div class="card" style="margin-top:4px">
          <div class="card-title">${icon('users',15)} Sem organização</div>
          <p class="muted" style="font-size:12px;margin-top:6px">Usuários com conta ainda não vinculados a nenhuma organização.</p>
          <div class="list" style="margin-top:10px"></div>
        </div>`);
        const listBox = card.querySelector('.list');
        orphans.forEach((p) => {
          listBox.appendChild(USERS.userRow({ profile: p, scope, orphan: true }));
        });
        orgsBox.appendChild(card);
      }
    }

    root.querySelector('#usr-new').addEventListener('click', () => USERS.openCreate(root));
  } catch (e) {
    orgsBox.appendChild(el(`<div class="card"><div class="muted" style="padding:10px 0;font-size:13px">${esc(msgOf(e))}</div></div>`));
  }
  mountIcons(root);
};

USERS.userRow = ({ org, membership, profile, scope, orphan }) => {
  const isMe = profile.id === App.user?.id;
  const userRole = profile.role || 'member';
  const userLevel = profile.master_level || 0;
  const mRole = membership?.role || '';
  const canViewAs = !isMe && !App.impersonation && (
    scope.role === 'root'
    || (scope.role === 'master' && scope.level === 1 && !!membership && userRole === 'member')
  );
  const actions = [];

  if (canViewAs) {
    actions.push(`<button class="btn ghost sm" data-act="viewas" data-user="${profile.id}" data-name="${esc(profile.name || profile.email || 'usuário')}">${icon('eye',14)} Enxergar como</button>`);
  }

  if (scope.role === 'root' && !isMe) {
    // Root promove/rebaixa/exclui qualquer usuário
    if (userRole === 'member' && membership) {
      actions.push(`<button class="btn ghost sm" data-act="promote" data-user="${profile.id}" data-org="${org.id}">${icon('shield',14)} Promover</button>`);
    } else if (userRole === 'master') {
      actions.push(`<button class="btn ghost sm" data-act="demote" data-user="${profile.id}">${icon('shield',14)} Rebaixar</button>`);
    }
    if (membership) {
      actions.push(`<button class="btn ghost sm danger" data-act="rm" data-user="${profile.id}" data-org="${org.id}" data-orgname="${esc(org.name)}">${icon('trash',14)} Remover da org</button>`);
    }
    actions.push(`<button class="btn ghost sm danger" data-act="del" data-user="${profile.id}" data-name="${esc(profile.name||profile.email||'usuário')}">${icon('x',14)} Excluir conta</button>`);
  } else if (scope.role === 'master' && !isMe && membership) {
    if (scope.level === 1) {
      // master_1 promove membros a master_2 e rebaixa/exclui master_2
      if (userRole === 'member') {
        actions.push(`<button class="btn ghost sm" data-act="promote2" data-user="${profile.id}" data-org="${org.id}">${icon('shield',14)} Promover</button>`);
      } else if (userRole === 'master' && userLevel === 2) {
        actions.push(`<button class="btn ghost sm" data-act="demote" data-user="${profile.id}">${icon('shield',14)} Rebaixar</button>`);
        actions.push(`<button class="btn ghost sm danger" data-act="del" data-user="${profile.id}" data-name="${esc(profile.name||profile.email||'usuário')}">${icon('x',14)} Excluir</button>`);
      }
    }
    if (userRole === 'member') {
      actions.push(`<button class="btn ghost sm danger" data-act="rm" data-user="${profile.id}" data-org="${org.id}" data-orgname="${esc(org.name)}">${icon('trash',14)} Remover da org</button>`);
    }
  }

  const name = profile.name || profile.email || 'Usuário';
  const subRole = mRole && mRole !== 'owner' && mRole !== 'admin' ? ` · ${mRole}` : '';
  return el(`
    <div class="row" style="margin-top:8px">
      <div class="ico">${esc(initials(name))}</div>
      <div class="body">
        <strong>${esc(name)}${isMe ? ' (você)' : ''}</strong>
        <span>${esc(profile.email || '—')}${subRole}</span>
      </div>
      <div class="right">
        ${roleChip(userRole, userLevel)}<br>
        <span style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap">${actions.join('')}</span>
      </div>
    </div>
  `);
};

// Formulário de criação de usuário (o papel e a org dependem do chamador)
USERS.openCreate = async (root) => {
  const scope = await myScope();
  const roles = createRoleOptions(scope);
  let orgSelect = '';
  if (scope.role === 'root') {
    const orgs = await dbSelect('organizations');
    const options = orgs.map(o => `<option value="${o.id}" ${o.id===App.getOrg()?'selected':''}>${esc(o.name)}</option>`).join('');
    orgSelect = `<label class="field"><span>Organização a vincular</span><select id="nu-org">${options}</select></label>`;
  }
  const roleOptions = roles.map(([v, l]) => `<option value="${v}" ${v==='member'?'selected':''}>${l}</option>`).join('');
  const { close } = openSheet('Novo usuário', `
    <label class="field"><span>Nome</span><input id="nu-name" placeholder="Nome completo"></label>
    <label class="field"><span>E-mail</span><input id="nu-email" type="email" placeholder="usuario@empresa.com.br"></label>
    <label class="field"><span>Senha inicial</span><input id="nu-pass" type="password" placeholder="Mínimo 8 caracteres"></label>
    <label class="field"><span>Papel</span><select id="nu-role">${roleOptions}</select></label>
    ${orgSelect}
    <div class="actions">
      <button class="btn primary" id="nu-create">${icon('check',17)} Criar usuário</button>
    </div>
  `);
  mountIcons(document.getElementById('sheet'));

  document.getElementById('nu-create').addEventListener('click', async () => {
    const name = document.getElementById('nu-name').value.trim();
    const email = document.getElementById('nu-email').value.trim();
    const password = document.getElementById('nu-pass').value;
    if (!email || email.length < 5 || password.length < 8) {
      toast('Preencha e-mail e senha (mínimo 8 caracteres).', 'err');
      return;
    }
    try {
      const u = await adminCreateUser({ email, password, name: name || splitPart(email, '@') });
      const chosen = document.getElementById('nu-role').value;
      const orgId = scope.role === 'root' ? document.getElementById('nu-org').value : App.getOrg();
      if (chosen === 'master_1') await promoteMaster({ org: orgId, user: u.id, level: 1 });
      else if (chosen === 'master_2') await promoteMaster({ org: orgId, user: u.id, level: 2 });
      else await addUserToOrg({ org: orgId, user: u.id });
      toast('Usuário criado e vinculado!');
      if (!u.confirmed) toast(`O usuário precisa confirmar o e-mail (${esc(email)}) para fazer login.`, 'info');
      close(); USERS.render(root);
    } catch (e) { toast(msgOf(e), 'err'); }
  });
};

// Sheet para o Root escolher o nível ao promover um usuário
USERS.promoteSheet = (uid, orgId) => {
  const { close } = openSheet('Promover usuário', `
    <label class="field"><span>Nível de master</span>
      <select id="pm-level">
        <option value="1">Master 1 — gerencia uma organização</option>
        <option value="2">Master 2 — gerencia membros (criado por Master 1)</option>
      </select></label>
    <div class="actions">
      <button class="btn primary" id="pm-go">${icon('shield',16)} Promover</button>
    </div>
  `);
  mountIcons(document.getElementById('sheet'));
  document.getElementById('pm-go').addEventListener('click', async () => {
    const level = Number(document.getElementById('pm-level').value);
    try {
      await promoteMaster({ org: orgId, user: uid, level });
      toast('Usuário promovido!'); close(); await App.refresh();
    } catch (e) { toast(msgOf(e), 'err'); }
  });
};

// ============ VIEW DE ORGANIZAÇÕES ============
ORGS.render = async (root) => {
  clear(root);
  const scope = await myScope();
  const isRoot = scope.role === 'root';
  if (!isRoot) {
    root.appendChild(el(`
      <div class="empty" style="padding-top:80px">
        <div class="big">${icon('briefcase',34)}</div>
        <strong>Sem acesso</strong>
        <span>Este recurso é exclusivo do login proprietário.</span>
      </div>
    `));
    mountIcons(root);
    return;
  }

  root.appendChild(els(`
    <div class="view-header">
      <h1>Organizações ${roleChip(scope.role, scope.level)}</h1>
      <p>Gerencie as organizações do sistema e seus status de acesso</p>
    </div>
    <div class="card usr-actions">
      <div class="card-title">${icon('briefcase',15)} Organizações</div>
      <p class="muted" id="org-hint" style="font-size:12px;margin-top:6px">
        Use o interruptor para ativar/desativar. Quando desativada, nenhum login da organização acessa o aplicativo até ser reativada.
      </p>
      <div class="actions" style="margin-top:12px"><button class="btn primary" id="org-new">${icon('briefcase',16)} Nova organização</button></div>
    </div>
    <div id="org-list"></div>
  `));

  const box = root.querySelector('#org-list');
  try {
    const [orgs, members] = await Promise.all([
      dbSelect('organizations'),
      dbSelect('memberships')
    ]);
    const counts = {};
    members.forEach(m => { counts[m.org_id] = (counts[m.org_id] || 0) + 1; });

    clear(box);
    if (!orgs.length) {
      box.appendChild(el(`<div class="empty"><strong>Nenhuma organização</strong><span>Use a opção acima para criar uma.</span></div>`));
    }
    orgs.forEach((o) => {
      const isSel = o.id === App.getOrg();
      const isOn = o.active !== false;
      const actions = `
        <span class="org-actions">
          ${isSel ? `<span class="chip ghost">Org ativa</span>` : `<button class="btn ghost sm" data-switch="${o.id}">${icon('swap',14)} Usar</button>`}
          ${o.name === 'Minha Organização'
            ? `<span class="chip ghost" title="Organização principal — não pode ser excluída">${icon('shield',14)} Protegida</span>`
            : `<button class="btn ghost sm danger" data-del="${o.id}" data-name="${esc(o.name)}">${icon('trash',14)} Excluir</button>`}
        </span>`;
      box.appendChild(el(`
        <div class="card" style="margin-top:4px">
          <div class="org-grid">
            <div class="col-info">
              <div class="row" style="background:none;border:none;padding:0 0 2px">
                <div class="ico">${esc(initials(o.name))}</div>
                <div class="body"><strong>${esc(o.name)}</strong>
                  <span>${esc(o.segment || 'Organização')} · ${counts[o.id] || 0} usuário(s)</span></div>
              </div>
              ${actions}
            </div>
            <div class="col-toggle">
              <label class="switch" title="${isOn ? 'Ativar/desativar organização' : 'Reativar organização'}">
                <input type="checkbox" data-tgl="${o.id}" ${isOn ? 'checked' : ''}>
                <span class="track"></span>
              </label>
              <span class="chip ${isOn ? 'ok' : 'danger'}">${isOn ? 'Ativa' : 'Desativada'}</span>
            </div>
          </div>
        </div>
      `));
    });

    box.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => {
      App.setOrg(b.dataset.switch); App.refresh(); toast('Organização alterada.');
    }));
    box.querySelectorAll('[data-tgl]').forEach(t => t.addEventListener('change', async () => {
      const id = t.dataset.tgl;
      const on = t.checked;
      const name = t.closest('.card')?.querySelector('.body strong')?.textContent || 'organização';
      try {
        await toggleOrgActive({ org: id, active: on });
        toast(on ? `"${name}" ativada.` : `"${name}" desativada.`);
        if (!on && App.getOrg() === id) {
          App.setOrg(null); try { localStorage.removeItem(SESSION_LABEL); } catch(e){} App.orgId = null;
        }
        App.refresh();
      } catch (e) {
        t.checked = !on;
        toast(msgOf(e), 'err');
      }
    }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.del;
      openModal('Excluir organização', `
        <p class="muted">Excluir a organização "${esc(b.dataset.name)}" e todos os seus dados? Esta ação não pode ser desfeita.</p>
        <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button><button class="btn danger" id="md-del-org">${icon('trash',16)} Excluir</button></div>`);
      document.getElementById('md-cancel').addEventListener('click', closeModal);
      document.getElementById('md-del-org').addEventListener('click', async () => {
        try {
          await deleteOrganization(id);
          toast('Organização excluída.'); closeModal();
          if (App.getOrg() === id) { App.setOrg(null); try { localStorage.removeItem(SESSION_LABEL); } catch(e){} App.orgId = null; }
          App.refresh();
        } catch (e) { toast(msgOf(e), 'err'); }
      });
    }));

    const no = root.querySelector('#org-new');
    if (no) no.addEventListener('click', () => ORGS.newOrg(root));
  } catch (e) {
    box.appendChild(el(`<div class="card"><div class="muted" style="padding:10px 0;font-size:13px">${esc(msgOf(e))}</div></div>`));
  }
  mountIcons(root);
};

ORGS.newOrg = (root) => {
  openModal('Nova Organização', `
    <label class="field"><span>Nome</span><input id="org-name" placeholder="Ex.: Cliente Alfa LTDA"></label>
    <label class="field"><span>Segmento</span><input id="org-segment" placeholder="Ex.: Varejo, Serviços..."></label>
    <div class="actions">
      <button class="btn ghost" id="md-cancel">Cancelar</button>
      <button class="btn primary" id="md-create">${icon('plus',16)} Criar</button>
    </div>`);
  document.getElementById('md-cancel').addEventListener('click', closeModal);
  document.getElementById('md-create').addEventListener('click', async () => {
    const name = document.getElementById('org-name').value.trim();
    if (!name) { toast('Informe o nome.', 'err'); return; }
    try {
      const orgId = await createOrganization({ name, segment: document.getElementById('org-segment').value.trim() });
      App.setOrg(orgId); toast('Organização criada!'); closeModal(); App.refresh();
    } catch (e) { toast(msgOf(e), 'err'); }
  });
};

// ---------- eventos delegados das linhas de usuário ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const uid = btn.dataset.user;
  const orgId = btn.dataset.org;
  try {
    if (act === 'promote') { USERS.promoteSheet(uid, orgId); return; }
    if (act === 'promote2') {
      await promoteMaster({ org: orgId, user: uid, level: 2 });
      toast('Usuário promovido a Master 2!'); await App.refresh(); return;
    }
    if (act === 'demote') {
      await demoteMaster(uid);
      toast('Usuário rebaixado.'); await App.refresh(); return;
    }
    if (act === 'viewas') {
      openModal('Enxergar como', `
        <p class="muted">Ver o painel como <strong>${esc(btn.dataset.name)}</strong> para validar o que este usuário enxerga.<br><br>Ao terminar, use o botão "Voltar ao meu usuário".</p>
        <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button>
        <button class="btn primary" id="md-confirm">${icon('eye',16)} Enxergar como</button></div>`);
      document.getElementById('md-cancel').addEventListener('click', closeModal);
      document.getElementById('md-confirm').addEventListener('click', async () => {
        closeModal();
        await App.beginViewAs(uid);
      });
      return;
    }
    if (act === 'rm') {
      openModal('Remover da organização', `
        <p class="muted">Remover este usuário da organização "${esc(btn.dataset.orgname)}"? Ele manterá a conta, mas perderá o acesso a esta organização.</p>
        <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button>
        <button class="btn danger" id="md-confirm">${icon('trash',16)} Remover</button></div>`);
      document.getElementById('md-cancel').addEventListener('click', closeModal);
      document.getElementById('md-confirm').addEventListener('click', async () => {
        try {
          await removeUserFromOrg({ org: orgId, user: uid });
          toast('Usuário removido da organização.'); closeModal();
          await App.refresh();
        } catch (err) { toast(msgOf(err), 'err'); }
      });
      return;
    }
    if (act === 'del') {
      openModal('Excluir usuário', `
        <p class="muted">Excluir ${esc(btn.dataset.name)} do sistema? Ele perderá o acesso a todas as organizações.</p>
        <div class="actions"><button class="btn ghost" id="md-cancel">Cancelar</button>
        <button class="btn danger" id="md-confirm">${icon('trash',16)} Excluir</button></div>`);
      document.getElementById('md-cancel').addEventListener('click', closeModal);
      document.getElementById('md-confirm').addEventListener('click', async () => {
        try {
          await deleteUser(uid);
          toast('Usuário excluído do sistema.'); closeModal();
          await App.refresh();
        } catch (err) { toast(msgOf(err), 'err'); }
      });
      return;
    }
  } catch (err) {
    toast(msgOf(err), 'err');
  }
});

function splitPart(s, chr) { return String(s || '').split(chr)[0] || s; }
