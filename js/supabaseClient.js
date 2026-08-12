// ============================================================
// C2 Finance - Cliente Supabase
// Camada única de acesso a dados. Toda consulta já filtra por
// org_id — a segurança real é garantida pelas policies RLS
// do schema.sql (cada usuário só enxerga sua organização).
// ============================================================

const sb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

// ---------- Helpers de erro ----------
const isSetupError = (err) =>
  /relation .+ does not exist|42P01|PGRST205|PGRST204|405|404|Fail to fetch|Failed to fetch/i
    .test(String(err && (err.message || err.details || '')));

const isAuthError = (err) =>
  /invalid login credentials|email not confirmed|invalid api key|token has expired|auth session missing/i
    .test(String(err && (err.message || '')));

const msgOf = (err) => {
  const m = err && (err.message || err.details || '');
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (/Failed to fetch|Network/i.test(m)) return 'Sem conexão com o servidor. Tente novamente.';
  if (/relation .+ does not exist/i.test(m)) return 'Banco ainda não configurado. Rode o schema.sql.';
  return m || 'Erro inesperado.';
};

// ---------- Auth ----------
const signUp = async ({ email, password, name }) => {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { name }, emailRedirectTo: window.location.origin }
  });
  return { data, error };
};

const signIn = async ({ email, password }) => {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
};

const signOut = async () => {
  const { error } = await sb.auth.signOut();
  return { error };
};

const getSession = () => sb?.auth.getSession();

const onAuthChange = (cb) => sb.auth.onAuthStateChange(cb);

const currentUserId = () => sb.auth.getSession().then(({data}) => data.session?.user?.id || null);

// ---------- DB (todas as operações são escopadas por org via RLS) ----------
const dbSelect = async (table, { orgId, filters = {}, order, limit, range } = {}) => {
  let q = sb.from(table).select('*');
  if (orgId) q = q.eq('org_id', orgId);
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q = q.eq(k, v); });
  if (order) q = q.order(order.col, { ascending: order.asc !== false });
  if (limit) q = q.limit(limit);
  if (range) q = q.range(range.from, range.to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

const dbInsert = async (table, row) => {
  const { data, error } = await sb.from(table).insert(row).select();
  if (error) throw error;
  return (data && data[0]) || row;
};

const dbUpdate = async (table, id, patch) => {
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select();
  if (error) throw error;
  return (data && data[0]) || patch;
};

const dbDelete = async (table, id) => {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
};

const dbUpsert = async (table, rows, onConflict) => {
  const { data, error } = await sb.from(table).upsert(rows, { onConflict }).select();
  if (error) throw error;
  return data || rows;
};

// ---------- RPC (funções seguras do banco) ----------
const rpc = async (fn, params = {}) => {
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw error;
  return data;
};

// ---------------- Organizações ----------------
const createOrganization = async ({ name, document, segment }) =>
  rpc('create_organization', { _name: name, _document: document || null, _segment: segment || null });

const inviteMember = async ({ org, email, role }) =>
  rpc('invite_member', { _org: org, _email: email, _role: role || 'member' });

const removeMember = async ({ org, user }) =>
  rpc('remove_member', { _org: org, _user: user });

const listMyOrgs = async () => {
  const { data, error } = await sb.from('organizations')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
};

const listMembers = async (orgId) => {
  const { data, error } = await sb.from('memberships')
    .select('user_id, role, created_at')
    .eq('org_id', orgId);
  if (error) throw error;
  return data || [];
};

// ---------------- Índice global (verificação de setup) ----------------
const checkSchema = async () => {
  try {
    const { data, error } = await sb.from('organizations').select('id').limit(1);
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e };
  }
};