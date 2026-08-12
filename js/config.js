// ============================================================
// C2 Finance - Configuração
// Credenciais PUBLISHABLE (seguras para o cliente) vêm de
// js/config.local.js (NÃO versionado). Sem esse arquivo o app
// exibe a tela de configuração.
//
// Segurança real é garantida por RLS no banco: cada usuário
// enxerga apenas as organizações em que é membro.
// ============================================================

const __C2_ENV = (typeof window !== 'undefined' && window.__C2__) || {};

const SUPABASE_URL = __C2_ENV.supabaseUrl || '';
const SUPABASE_KY = __C2_ENV.supabaseAnonKey || '';

const APP_NAME = 'C2 Finance';
const CURRENCY = 'BRL';
const LOCALE = 'pt-BR';
const SESSION_LABEL = 'c2finance.org';   // chave para org ativa
const SESSION_THEME = 'c2finance.theme'; // chave para tema

const CATEGORY_COLORS = [
  { color: '#22c55e', label: 'Verde' },
  { color: '#10b981', label: 'Esmeralda' },
  { color: '#0ea5e9', label: 'Azul' },
  { color: '#6366f1', label: 'Índigo' },
  { color: '#8b5cf6', label: 'Violeta' },
  { color: '#ec4899', label: 'Rosa' },
  { color: '#f43f5e', label: 'Rubi' },
  { color: '#f97316', label: 'Laranja' },
  { color: '#eab308', label: 'Âmbar' },
  { color: '#64748b', label: 'Cinza' }
];

const STATUS_LABEL = {
  posted: 'Lançado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  open: 'Em aberto',
  paid: 'Pago',
  overdue: 'Vencido'
};

const KIND_LABEL = {
  income: 'Receita',
  expense: 'Despesa',
  receivable: 'A receber',
  payable: 'A pagar'
};

const ACCOUNT_KIND = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  credit: 'Crédito',
  cash: 'Caixa',
  investment: 'Investimento'
};

const DOC_EMPTY = null;