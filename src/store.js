/**
 * PET CONTROL — Application state.
 *
 * A tiny observable store: one state object, explicit actions, and a
 * subscription list. Every mutation that matters operationally also writes
 * an entry to the audit trail (`events`) — that is the product's core promise,
 * so it lives in the store rather than in any single screen.
 */

import { buildSeed } from './data/seed.js';
import { PARAMS, classify, CHECKLIST, atividadeById, areaById, can } from './data/catalog.js';
import { uid, clamp, rnd, pick } from './util.js';

const KEY = 'petcontrol.state.v4';
const MIN = 60000, HOUR = 3600000;

/* ============================================================
   Persistence
   ============================================================ */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.version !== 4) return null;
    /* Data is generated relative to "now"; a stale snapshot would show a
       frozen shift. Rebuild after 8h so the demo is always current. */
    if (Date.now() - s.geradoEm > 8 * HOUR) return null;
    return s;
  } catch { return null; }
}

function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, _saved: Date.now() }));
  } catch { /* private mode / quota — the demo still works in memory */ }
}

/* ============================================================
   Store
   ============================================================ */
const subs = new Set();
export const state = load() ?? buildSeed();

let raf = null;
export function emit(reason = 'change') {
  persist(state);
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    subs.forEach((fn) => fn(state, reason));
  });
}
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function resetDemo() {
  const fresh = buildSeed();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  localStorage.removeItem(KEY);
  emit('reset');
}

/* ============================================================
   Lookups
   ============================================================ */
export const emp     = (id) => state.employees.find((e) => e.id === id) ?? null;
export const empNome = (id) => emp(id)?.nome ?? '—';
export const pet     = (id) => state.pets.find((p) => p.id === id) ?? null;
export const alerta  = (id) => state.alerts.find((a) => a.id === id) ?? null;
export const me      = () => (state.session ? emp(state.session.userId) : null);
export const myLevel = () => me()?.nivel ?? 'OPERADOR';
export const allow   = (cap) => can(myLevel(), cap);

/* ============================================================
   Audit trail
   ============================================================ */
export function log(tipo, payload = {}) {
  const e = {
    id: `EVT-${uid('x')}`,
    ts: Date.now(),
    tipo,
    atorId: state.session?.userId ?? null,
    petId: null, areaId: null, unidade: null, alvoId: null, detalhe: '',
    ...payload,
  };
  state.events.unshift(e);
  if (state.events.length > 4000) state.events.length = 4000;
  return e;
}

export function raiseAlert({ tipo, sev, titulo, descricao, areaId, unidade, petId = null, empId = null }) {
  const a = {
    id: `ALR-${uid('a')}`, ts: Date.now(), tipo, sev, titulo, descricao,
    areaId, unidade: unidade ?? (areaId?.startsWith('A') ? 'UN-A' : 'UN-B'),
    petId, empId, status: 'ABERTO', resolvidoPorId: null, resolvidoEm: null,
  };
  state.alerts.unshift(a);
  log('ALERTA_GERADO', { petId, areaId, unidade: a.unidade, detalhe: titulo });
  return a;
}

/* ============================================================
   Session
   ============================================================ */
export function signIn(empId, confianca) {
  const e = emp(empId);
  if (!e) return null;
  state.session = { userId: empId, iniciadaEm: Date.now(), confianca, metodo: 'FACIAL' };
  e.ultimoAcesso = Date.now();
  log('LOGIN', { areaId: e.areas[0], unidade: e.unidade, detalhe: `Reconhecimento facial · confiança ${confianca}% · nível ${e.nivel}` });
  emit('session');
  return state.session;
}

export function signOut() {
  const e = me();
  if (e) log('LOGOUT', { areaId: e.areas[0], unidade: e.unidade, detalhe: 'Sessão encerrada pelo usuário' });
  state.session = null;
  emit('session');
}

/* ============================================================
   PET lifecycle
   ============================================================ */
function nextCodigo() {
  const nums = state.pets.map((p) => Number(String(p.codigo).split('-')[2] || 0));
  const n = Math.max(0, ...nums) + 1;
  return { codigo: `PET-2026-${String(n).padStart(4, '0')}`, id: `PET-${String(n).padStart(4, '0')}` };
}

export function createPet(draft) {
  const { id, codigo } = nextCodigo();
  const ativ = atividadeById(draft.tipo);
  const now = Date.now();
  const area = areaById(draft.areaId);
  const checklist = {};
  CHECKLIST.forEach((c) => { checklist[c.id] = draft.checklist?.[c.id] ? { ok: true, byId: state.session?.userId, ts: now } : { ok: false }; });

  const p = {
    id, codigo,
    tipo: draft.tipo,
    titulo: draft.titulo,
    unidade: area?.unidade ?? 'UN-A',
    areaId: draft.areaId,
    local: draft.local,
    responsavelId: draft.responsavelId,
    solicitanteId: state.session?.userId ?? draft.responsavelId,
    equipe: draft.equipe ?? [],
    riscos: draft.riscos ?? [],
    medidas: draft.medidas ?? [],
    medicoes: (draft.medicoes ?? []).map((m) => ({ ...m, id: `MED-${uid('m')}`, ts: now, byId: state.session?.userId, status: classify(m.param, m.valor) })),
    epis: draft.epis ?? [],
    equipamentos: draft.equipamentos ?? [],
    ferramentas: draft.ferramentas ?? [],
    checklist,
    status: 'EM_VALIDACAO',
    criadaEm: now,
    criadaPorId: state.session?.userId ?? draft.responsavelId,
    validadaEm: null, validadaPorId: null,
    liberadaEm: null, liberadaPorId: null,
    iniciadaEm: null, encerradaEm: null,
    inicioPrevisto: draft.inicioPrevisto ?? now + 30 * MIN,
    fimPrevisto: draft.fimPrevisto ?? now + (ativ?.validadeH ?? 8) * HOUR,
    observacoes: draft.observacoes ?? '',
    motivoCancelamento: null, suspensaMotivo: null,
  };
  state.pets.unshift(p);

  const A = { petId: p.id, areaId: p.areaId, unidade: p.unidade };
  log('PET_CRIADA', { ...A, detalhe: p.titulo });
  log('EQUIPE_DEFINIDA', { ...A, detalhe: `${p.equipe.length} colaboradores vinculados` });
  log('RISCOS_AVALIADOS', { ...A, detalhe: `${p.riscos.length} riscos · ${p.medidas.length} medidas preventivas` });
  p.medicoes.forEach((m) => log(m.status === 'risk' ? 'MEDICAO_FORA' : 'MEDICAO', { ...A, detalhe: `${PARAMS[m.param].nome}: ${m.valor} ${PARAMS[m.param].unidade}` }));
  log('EQUIP_CONFERIDO', { ...A, detalhe: `${p.epis.length} EPIs · ${p.equipamentos.length} equipamentos` });
  log('ENVIADA_VALIDACAO', { ...A, detalhe: 'Checklist de segurança submetido' });

  raiseAlert({
    tipo: 'PET_AGUARDANDO', sev: 'info',
    titulo: 'Nova PET aguardando validação',
    descricao: `${p.codigo} — ${p.titulo}.`,
    areaId: p.areaId, unidade: p.unidade, petId: p.id,
  });

  emit('pets');
  return p;
}

export function setChecklist(petId, itemId, ok) {
  const p = pet(petId); if (!p) return;
  p.checklist[itemId] = ok ? { ok: true, byId: state.session?.userId, ts: Date.now() } : { ok: false };
  emit('pets');
}

export function validatePet(petId) {
  const p = pet(petId); if (!p) return null;
  const now = Date.now();
  p.status = 'LIBERADA';
  p.validadaEm = now; p.validadaPorId = state.session?.userId;
  p.liberadaEm = now; p.liberadaPorId = state.session?.userId;
  const A = { petId: p.id, areaId: p.areaId, unidade: p.unidade };
  log('PET_VALIDADA', { ...A, detalhe: 'Checklist aprovado integralmente' });
  log('PET_LIBERADA', { ...A, detalhe: 'Permissão liberada para execução' });
  state.alerts.filter((a) => a.petId === p.id && a.tipo === 'PET_AGUARDANDO' && a.status === 'ABERTO')
    .forEach((a) => { a.status = 'RESOLVIDO'; a.resolvidoPorId = state.session?.userId; a.resolvidoEm = now; });
  emit('pets');
  return p;
}

export function startPet(petId) {
  const p = pet(petId); if (!p || p.status !== 'LIBERADA') return null;
  p.status = 'ATIVA'; p.iniciadaEm = Date.now();
  log('ATIV_INICIADA', { petId: p.id, areaId: p.areaId, unidade: p.unidade, detalhe: p.local });
  emit('pets');
  return p;
}

export function suspendPet(petId, motivo) {
  const p = pet(petId); if (!p) return null;
  p.status = 'SUSPENSA'; p.suspensaMotivo = motivo;
  log('ATIV_SUSPENSA', { petId: p.id, areaId: p.areaId, unidade: p.unidade, detalhe: motivo });
  emit('pets');
  return p;
}

export function resumePet(petId) {
  const p = pet(petId); if (!p) return null;
  p.status = 'ATIVA'; p.suspensaMotivo = null;
  log('ATIV_RETOMADA', { petId: p.id, areaId: p.areaId, unidade: p.unidade, detalhe: 'Condições normalizadas' });
  emit('pets');
  return p;
}

export function closePet(petId) {
  const p = pet(petId); if (!p) return null;
  const now = Date.now();
  p.status = 'ENCERRADA'; p.encerradaEm = now;
  const A = { petId: p.id, areaId: p.areaId, unidade: p.unidade };
  log('ATIV_ENCERRADA', { ...A, detalhe: 'Frente de serviço desmobilizada' });
  log('PET_FINALIZADA', { ...A, detalhe: 'Documentação arquivada digitalmente' });
  state.alerts.filter((a) => a.petId === p.id && a.status === 'ABERTO')
    .forEach((a) => { a.status = 'RESOLVIDO'; a.resolvidoPorId = state.session?.userId; a.resolvidoEm = now; });
  emit('pets');
  return p;
}

export function cancelPet(petId, motivo) {
  const p = pet(petId); if (!p) return null;
  p.status = 'CANCELADA'; p.motivoCancelamento = motivo;
  log('PET_CANCELADA', { petId: p.id, areaId: p.areaId, unidade: p.unidade, detalhe: motivo });
  emit('pets');
  return p;
}

/* ============================================================
   Measurements
   ============================================================ */
export function registerMeasurement(petId, param, valor) {
  const p = pet(petId); if (!p) return null;
  const st = classify(param, valor);
  const m = { id: `MED-${uid('m')}`, param, valor, ts: Date.now(), byId: state.session?.userId, status: st };
  p.medicoes.push(m);

  const key = `${p.areaId}:${param}`;
  if (state.sensors[key]) {
    state.sensors[key].serie.push({ ts: m.ts, v: valor });
    state.sensors[key].ultimo = valor;
    if (state.sensors[key].serie.length > 120) state.sensors[key].serie.shift();
  }

  log(st === 'risk' ? 'MEDICAO_FORA' : 'MEDICAO', {
    petId: p.id, areaId: p.areaId, unidade: p.unidade,
    detalhe: `${PARAMS[param].nome}: ${valor} ${PARAMS[param].unidade}`,
  });

  if (st === 'risk') {
    raiseAlert({
      tipo: 'MEDICAO_FORA', sev: 'warn',
      titulo: `${PARAMS[param].nome} fora do parâmetro`,
      descricao: `${p.codigo} — leitura de ${valor} ${PARAMS[param].unidade} (limite ${PARAMS[param].min}–${PARAMS[param].max}).`,
      areaId: p.areaId, unidade: p.unidade, petId: p.id,
    });
  }
  emit('pets');
  return m;
}

/* ============================================================
   Employees
   ============================================================ */
export function createEmployee(data) {
  const n = state.employees.length + 1;
  const e = {
    id: `EMP-${String(n).padStart(3, '0')}-${uid('n').slice(-4)}`,
    nome: data.nome,
    matricula: data.matricula,
    funcao: data.funcao,
    nivel: data.nivel,
    unidade: data.unidade,
    areas: data.areas ?? [],
    status: 'ATIVO',
    face: !!data.face,
    faceQualidade: data.faceQualidade ?? 0,
    restricoes: data.restricoes ?? [],
    treinamentos: data.treinamentos ?? [],
    cadastradoEm: Date.now(),
    ultimoAcesso: null,
    telefone: data.telefone ?? '',
  };
  state.employees.unshift(e);
  log('FUNC_CADASTRADO', { alvoId: e.id, areaId: e.areas[0] ?? null, unidade: e.unidade, detalhe: `${e.nome} · ${e.funcao}` });
  if (e.face) log('FACE_REGISTRADA', { alvoId: e.id, areaId: e.areas[0] ?? null, unidade: e.unidade, detalhe: `Qualidade do template: ${e.faceQualidade}%` });
  emit('employees');
  return e;
}

export function registerFace(empId, qualidade) {
  const e = emp(empId); if (!e) return;
  e.face = true; e.faceQualidade = qualidade;
  log('FACE_REGISTRADA', { alvoId: e.id, areaId: e.areas[0] ?? null, unidade: e.unidade, detalhe: `Qualidade do template: ${qualidade}%` });
  emit('employees');
}

export function setEmployeeStatus(empId, status) {
  const e = emp(empId); if (!e) return;
  e.status = status;
  emit('employees');
}

/* ============================================================
   Access control — the authorization decision, in one place
   ============================================================ */
export function evaluateAccess(empId, areaId) {
  const e = emp(empId);
  const now = Date.now();
  if (!e) return { ok: false, motivo: 'Biometria não corresponde a nenhum cadastro ativo', petId: null };
  if (!e.face) return { ok: false, motivo: 'Colaborador sem registro facial ativo', petId: null };
  if (e.status === 'AFASTADO') return { ok: false, motivo: 'Colaborador afastado', petId: null };
  if (e.status === 'PENDENTE') return { ok: false, motivo: 'Cadastro pendente de regularização', petId: null };

  const vencido = (e.treinamentos ?? []).find((t) => t.validade < now);
  if (vencido) return { ok: false, motivo: `Treinamento vencido — ${vencido.nome}`, petId: null };

  if (!e.areas.includes(areaId)) return { ok: false, motivo: 'Colaborador fora da área autorizada', petId: null };

  const p = state.pets.find((x) =>
    ['LIBERADA', 'ATIVA'].includes(x.status) &&
    x.areaId === areaId &&
    x.equipe.some((m) => m.empId === empId));

  if (!p) return { ok: false, motivo: 'Nenhuma PET vigente vincula o colaborador à área', petId: null };
  if (p.fimPrevisto < now) return { ok: false, motivo: `Permissão ${p.codigo} vencida`, petId: p.id };

  return { ok: true, motivo: `Autorizado pela ${p.codigo}`, petId: p.id };
}

export function registerAccess(empId, areaId, direcao = 'ENTRADA') {
  const v = evaluateAccess(empId, areaId);
  const e = emp(empId);
  const confianca = Number(rnd(93.5, 99.4).toFixed(1));
  const unidade = areaId.startsWith('A') ? 'UN-A' : 'UN-B';
  const rec = {
    id: `ACC-${uid('c')}`, ts: Date.now(), empId, petId: v.petId, areaId, unidade,
    resultado: v.ok ? 'LIBERADO' : 'BLOQUEADO', motivo: v.motivo,
    confianca, metodo: 'FACIAL', direcao,
  };
  state.access.unshift(rec);
  if (e) e.ultimoAcesso = rec.ts;

  log(v.ok ? 'ACESSO_LIBERADO' : 'ACESSO_BLOQUEADO', {
    atorId: empId, petId: v.petId, areaId, unidade,
    detalhe: `${direcao === 'SAIDA' ? 'Saída' : 'Entrada'} · reconhecimento facial ${confianca}% · ${v.motivo}`,
  });

  if (!v.ok) {
    raiseAlert({
      tipo: 'ACESSO_NEGADO', sev: 'risk',
      titulo: 'Tentativa de acesso não autorizado',
      descricao: `${e?.nome ?? 'Não identificado'} — ${v.motivo}.`,
      areaId, unidade, empId,
    });
  }
  emit('access');
  return rec;
}

/* ============================================================
   Alerts
   ============================================================ */
export function ackAlert(id) {
  const a = alerta(id); if (!a) return;
  a.status = 'EM_TRATATIVA';
  emit('alerts');
}
export function resolveAlert(id) {
  const a = alerta(id); if (!a) return;
  a.status = 'RESOLVIDO';
  a.resolvidoPorId = state.session?.userId;
  a.resolvidoEm = Date.now();
  log('ALERTA_TRATADO', { petId: a.petId, areaId: a.areaId, unidade: a.unidade, detalhe: `Tratativa concluída — ${a.titulo}` });
  emit('alerts');
}

/* ============================================================
   UI preferences
   ============================================================ */
export function setUI(patch) { Object.assign(state.ui, patch); emit('ui'); }

/* ============================================================
   LIVE SIMULATION
   Sensors drift, activities age and events appear — the operations
   centre feel. Purely client-side; disabled from Configurações.
   ============================================================ */
let timer = null;

function driftSensors() {
  const now = Date.now();
  let mudou = false;
  for (const s of Object.values(state.sensors)) {
    const p = PARAMS[s.param];
    let v = s.ultimo + rnd(-p.drift, p.drift) + (p.ideal - s.ultimo) * 0.05;
    v = clamp(v, p.scaleMin, p.scaleMax);
    const val = Number(v.toFixed(p.dec));
    const before = classify(s.param, s.ultimo);
    const after = classify(s.param, val);
    s.ultimo = val;
    s.serie.push({ ts: now, v: val });
    if (s.serie.length > 120) s.serie.shift();
    mudou = true;

    if (before !== 'risk' && after === 'risk') {
      const alvo = state.pets.find((x) => x.areaId === s.areaId && x.status === 'ATIVA');
      raiseAlert({
        tipo: 'MEDICAO_FORA', sev: 'warn',
        titulo: `${p.nome} fora do parâmetro`,
        descricao: `Leitura de ${val} ${p.unidade} em ${areaById(s.areaId)?.nome ?? s.areaId} — limite ${p.min}–${p.max} ${p.unidade}.`,
        areaId: s.areaId, petId: alvo?.id ?? null,
      });
    }
  }
  return mudou;
}

function ageActivities() {
  const now = Date.now();
  for (const p of state.pets) {
    if (p.status !== 'ATIVA') continue;
    const restante = p.fimPrevisto - now;
    if (restante < 45 * MIN && restante > 0 && !p._avisoVenc) {
      p._avisoVenc = true;
      raiseAlert({
        tipo: 'PET_VENCENDO', sev: 'warn',
        titulo: 'PET próxima do vencimento',
        descricao: `${p.codigo} — ${p.titulo}. Validade encerra em menos de 45 minutos.`,
        areaId: p.areaId, unidade: p.unidade, petId: p.id,
      });
    }
    if (restante <= 0 && !p._vencida) {
      p._vencida = true;
      raiseAlert({
        tipo: 'PET_VENCIDA', sev: 'risk',
        titulo: 'PET vencida com atividade em andamento',
        descricao: `${p.codigo} — renovar a permissão ou encerrar a atividade imediatamente.`,
        areaId: p.areaId, unidade: p.unidade, petId: p.id,
      });
    }
  }
}

/** Occasional access attempt at a turnstile, so the feed keeps moving. */
function randomAccess() {
  const ativas = state.pets.filter((p) => p.status === 'ATIVA');
  if (!ativas.length) return;
  const p = pick(ativas);
  const membro = pick(p.equipe);
  if (!membro) return;
  const seq = state.access.filter((a) => a.empId === membro.empId && a.petId === p.id);
  registerAccess(membro.empId, p.areaId, seq.length % 2 === 0 ? 'SAIDA' : 'ENTRADA');
}

export function startSimulation() {
  if (timer) return;
  let tick = 0;
  timer = setInterval(() => {
    if (!state.ui.simulacao || !state.session) return;
    tick++;
    driftSensors();
    if (tick % 4 === 0) ageActivities();
    if (tick % 9 === 0 && Math.random() < 0.55) randomAccess();
    emit('tick');
  }, 5000);
}
export function stopSimulation() { clearInterval(timer); timer = null; }

/* Expose for console-level demo control. */
if (typeof window !== 'undefined') window.PETCONTROL = { state, resetDemo, registerAccess, raiseAlert };
