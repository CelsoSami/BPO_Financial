// ============================================================
// C2 Finance - View de Usuários (Root / Master)
// root  = administrador principal (vê todas as orgs/usuários,
//         cria master usários e novas organizações)
// master= gerencia os usuários das suas organizações
//         (cria membros que já nascem vinculados à sua org)
// ============================================================

const USERS = {};

const roleLabel = (r) => ({ root: 'Root', master: 'Master', member: 'Membro' }[r] || r);

const roleChip = (r) =>
  `<span class="chip role-${r}">${roleLabel(r)}</span>`;

USERS.render = async (root) => {
  clear(root);
  const role = App.role;
  const isRoot = role === 'root';
  const isMaster = role === 'master';
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
      <h1>Usuários ${roleChip(role)}</h1>
      <p>${isRoot ? 'Todos os usuários e organizações do sistema' : 'Usuários das suas organizações'}</p>
    </div>
    <div class="card usr-actions">
      <div class="card-title">${icon('shield',15)} Ações de equipe</div>
      <div class="actions" style="margin-top:12px">
        ${isRoot
          ? `<button class="btn primary" id="usr-new-master">${icon('shield',16)} Novo usuário master</button>
             <button class="btn ghost" id="usr-new-org">${icon('briefcase',16)} Nova organização</button>`
          : `<button class="btn primary" id="usr-new">${icon('users',16)} Novo usuário</button>`}
      </div>
      <p class="muted" id="usr-hint" style="font-size:12px;margin-top:10px"></p>
    </div>
    <div id="usr-orgs"></div>
  `));

  const hint = root.querySelector('#usr-hint');
  hint.textContent = isRoot
    ? 'Você também pode criar novas organizações. As organizações novas começam com categorias-padrão prontas.'
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
      orgsBox.appendChild(el(`<div class="empty"><strong>Nenhuma organização</strong><span>Use a opção acima para criar uma.</span></div>`));
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
        const isMe = m.user_id === App.user?.id;
        listBox.appendChild(USERS.userRow({ org: o, membership: m, profile: p, isMe, isRoot, isMaster }));
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
          listBox.appendChild(USERS.userRow({ profile: p, isRoot, orphan: true }));
        });
        orgsBox.appendChild(card);
      }
    }

    const nm = root.querySelector('#usr-new-master');
    if (nm) nm.addEventListener('click', () => USERS.openCreate(root, true));
    const nu = root.querySelector('#usr-new');
    if (nu) nu.addEventListener('click', () => USERS.openCreate(root, false));
    const no = root.querySelector('#usr-new-org');
    if (no) no.addEventListener('click', () => USERS.newOrg(root));
  } catch (e) {
    orgsBox.appendChild(el(`<div class="card"><div class="muted" style="padding:10px 0;font-size:13px">${esc(msgOf(e))}</div></div>`));
  }
  mountIcons(root);
};

USERS.userRow = ({ org, membership, profile, isMe, isRoot, isMaster, orphan }) => {
  const userRole = profile.role || 'member'; // nível global (root/master/member)
  const mRole = membership?.role || '';       // nível na org (owner/admin/member/viewer)
  const actions = [];

  if (isRoot && !orphan) {
    // root pode vincular o usuário a outras orgs, promover/rebaixar, remover
    if (userRole === 'member') {
      actions.push(`<button class="btn ghost sm" data-act="promote" data-user="${profile.id}" data-org="${org.id}">${icon('shield',14)} Master</button>`);
    } else if (userRole === 'master' && !isMe) {
      actions.push(`<button class="btn ghost sm" data-act="demote" data-user="${profile.id}">${icon('shield',14)} Rebaixar</button>`);
    }
    if (!isMe) {
      actions.push(`<button class="btn ghost sm danger" data-act="rm" data-user="${profile.id}" data-org="${org.id}" data-orgname="${esc(org.name)}">${icon('trash',14)} Remover</button>`);
    }
  } else if (isMaster && !isRoot && !isMe && membership) {
    // master só remove usuários comuns (não root/admin/outros masters)
    if (mRole === 'member' && userRole !== 'root' && userRole !== 'master') {
      actions.push(`<button class="btn ghost sm danger" data-act="rm" data-user="${profile.id}" data-org="${org.id}" data-orgname="${esc(org.name)}">${icon('trash',14)} Remover</button>`);
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
        ${roleChip(userRole)}<br>
        <span style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">${actions.join('')}</span>
      </div>
    </div>
  `);
};

USERS.openCreate = async (root, asMaster) => {
  let orgSelect = '';
  if (asMaster) {
    const orgs = await dbSelect('organizations');
    const options = orgs.map(o => `<option value="${o.id}" ${o.id===App.getOrg()?'selected':''}>${esc(o.name)}</option>`).join('');
    orgSelect = `<label class="field"><span>Organização a vincular</span><select id="nu-org">${options}</select></label>`;
  }
  const { close } = openSheet(asMaster ? 'Criar usuário master' : 'Novo usuário', `
    <label class="field"><span>Nome</span><input id="nu-name" placeholder="Nome completo"></label>
    <label class="field"><span>E-mail</span><input id="nu-email" type="email" placeholder="usuario@empresa.com.br"></label>
    <label class="field"><span>Senha inicial</span><input id="nu-pass" type="password" placeholder="Mínimo 8 caracteres"></label>
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
      const orgId = asMaster ? document.getElementById('nu-org').value : App.getOrg();
      if (asMaster) await promoteMaster({ org: orgId, user: u.id });
      else await addUserToOrg({ org: orgId, user: u.id });
      toast(asMaster ? 'Usuário master criado e vinculado!' : 'Usuário criado e vinculado à organização!');
      if (!u.confirmed) toast(`O usuário precisa confirmar o e-mail (${esc(email)}) para fazer login.`, 'info');
      close(); USERS.render(root);
    } catch (e) { toast(msgOf(e), 'err'); }
  });
};

USERS.newOrg = (root) => {
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
      App.setOrg(orgId); toast('Organização criada!'); closeModal(); USERS.render(root);
    } catch (e) { toast(msgOf(e), 'err'); }
  });
};

// eventos delegados das linhas de usuário (promover/rebaixar/remover)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const uid = btn.dataset.user;
  const orgId = btn.dataset.org;
  try {
    if (act === 'promote') await promoteMaster({ org: orgId, user: uid });
    else if (act === 'demote') await demoteMaster(uid);
    else if (act === 'rm') {
      openModal('Remover usuário', `
        <p class="muted">Remover este usuário da organização "${btn.dataset.orgname}"? Ele manterá a conta, mas perderá o acesso a esta organização.</p>
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
    toast('Feito!'); App.refresh();
  } catch (err) {
    toast(msgOf(err), 'err');
  }
});

function splitPart(s, chr) { return String(s || '').split(chr)[0] || s; }