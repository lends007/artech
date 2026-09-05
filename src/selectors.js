/**
 * PET CONTROL — Derived views over the state.
 * Keeping the arithmetic here is what makes the dashboard, the reports and
 * the sidebar counters agree with each other.
 */

import { state } from './store.js';
import { classify, CHECKLIST, areaById } from './data/catalog.js';

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/* ---------- unit scope (top-bar selector) ---------- */
export function scope() { return state.ui.unidade; }
export function inScope(x) {
  const u = state.ui.unidade;
  return u === 'TODAS' || x?.unidade === u;
}

export const petsInScope    = () => state.pets.filter(inScope);
export const alertsInScope  = () => state.alerts.filter(inScope);
export const accessInScope  = () => state.access.filter(inScope);
export const eventsInScope  = () => state.events.filter((e) => !e.unidade || inScope(e));
export const empsInScope    = () => state.employees.filter((e) => state.ui.unidade === 'TODAS' || e.unidade === state.ui.unidade);

/* ---------- headline operational numbers ---------- */
export function kpis() {
  const pets = petsInScope();
  const ativas = pets.filter((p) => p.status === 'ATIVA');
  const validacao = pets.filter((p) => p.status === 'EM_VALIDACAO');
  const liberadas = pets.filter((p) => p.status === 'LIBERADA');
  const suspensas = pets.filter((p) => p.status === 'SUSPENSA');

  /* People currently inside: last movement per person on an active PET */
  const dentro = new Set();
  const ordenado = [...accessInScope()].sort((a, b) => a.ts - b.ts);
  for (const a of ordenado) {
    if (a.resultado !== 'LIBERADO') continue;
    if (a.direcao === 'ENTRADA') dentro.add(a.empId); else dentro.delete(a.empId);
  }
  /* Team members of active PETs count as allocated to the area */
  ativas.forEach((p) => p.equipe.forEach((m) => dentro.add(m.empId)));

  const abertos = alertsInScope().filter((a) => a.status !== 'RESOLVIDO');

  return {
    ativas: ativas.length,
    pessoas: dentro.size,
    validacao: validacao.length,
    liberadas: liberadas.length,
    suspensas: suspensas.length,
    alertas: abertos.length,
    alertasCriticos: abertos.filter((a) => a.sev === 'risk').length,
    andamento: ativas.filter((p) => p.iniciadaEm).length,
    pessoasIds: [...dentro],
  };
}

/* ---------- PET helpers ---------- */
export function petProgress(p) {
  if (!p.iniciadaEm) return 0;
  const total = p.fimPrevisto - p.iniciadaEm;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, ((Date.now() - p.iniciadaEm) / total) * 100));
}

export function petChecklistDone(p) {
  return CHECKLIST.filter((c) => p.checklist?.[c.id]?.ok).length;
}

export function petHealth(p) {
  const fora = p.medicoes.filter((m) => classify(m.param, m.valor) === 'risk').length;
  if (p.status === 'SUSPENSA' || fora) return 'risk';
  const restante = p.fimPrevisto - Date.now();
  if (p.status === 'ATIVA' && restante < 45 * MIN) return 'warn';
  const aten = p.medicoes.filter((m) => classify(m.param, m.valor) === 'warn').length;
  return aten ? 'warn' : 'ok';
}

/** Latest reading per parameter for a PET (falls back to the area sensor). */
export function petReadings(p) {
  const out = new Map();
  for (const m of p.medicoes) out.set(m.param, m);
  for (const [pid, m] of out) {
    const s = state.sensors[`${p.areaId}:${pid}`];
    if (s && s.serie.length) out.set(pid, { ...m, valor: s.ultimo, ts: s.serie[s.serie.length - 1].ts, status: classify(pid, s.ultimo), live: true });
  }
  return [...out.values()];
}

export const petsAtivas     = () => petsInScope().filter((p) => p.status === 'ATIVA').sort((a, b) => (b.iniciadaEm ?? 0) - (a.iniciadaEm ?? 0));
export const petsValidacao  = () => petsInScope().filter((p) => p.status === 'EM_VALIDACAO').sort((a, b) => a.criadaEm - b.criadaEm);
export const alertasAbertos = () => alertsInScope().filter((a) => a.status !== 'RESOLVIDO').sort((a, b) => b.ts - a.ts);

/* ---------- sensors ---------- */
export function sensorsInScope() {
  return Object.values(state.sensors)
    .filter((s) => state.ui.unidade === 'TODAS' || areaById(s.areaId)?.unidade === state.ui.unidade)
    .sort((a, b) => {
      const rank = { risk: 0, warn: 1, ok: 2, idle: 3 };
      return rank[classify(a.param, a.ultimo)] - rank[classify(b.param, b.ultimo)];
    });
}

export function sensorSummary() {
  const s = sensorsInScope();
  const c = { ok: 0, warn: 0, risk: 0 };
  s.forEach((x) => { c[classify(x.param, x.ultimo)] = (c[classify(x.param, x.ultimo)] ?? 0) + 1; });
  return { total: s.length, ...c };
}

/* ---------- traceability ---------- */
export function timelineOf(petId) {
  return state.events.filter((e) => e.petId === petId).sort((a, b) => a.ts - b.ts);
}

/* ---------- reports ---------- */
export function reportData(filtro = {}) {
  const { de, ate, unidade = 'TODAS', areaId = 'TODAS', tipo = 'TODAS', empId = 'TODOS', status = 'TODOS' } = filtro;
  const d0 = de ?? Date.now() - 30 * DAY;
  const d1 = ate ?? Date.now();

  const pets = state.pets.filter((p) => {
    if (p.criadaEm < d0 || p.criadaEm > d1) return false;
    if (unidade !== 'TODAS' && p.unidade !== unidade) return false;
    if (areaId !== 'TODAS' && p.areaId !== areaId) return false;
    if (tipo !== 'TODAS' && p.tipo !== tipo) return false;
    if (status !== 'TODOS' && p.status !== status) return false;
    if (empId !== 'TODOS' && !p.equipe.some((m) => m.empId === empId) && p.responsavelId !== empId) return false;
    return true;
  });

  const aprovadas = pets.filter((p) => p.validadaEm);
  const encerradas = pets.filter((p) => p.status === 'ENCERRADA');
  const canceladas = pets.filter((p) => p.status === 'CANCELADA');

  const tempos = aprovadas.filter((p) => p.validadaEm && p.criadaEm).map((p) => (p.validadaEm - p.criadaEm) / MIN);
  const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

  const duracoes = encerradas.filter((p) => p.iniciadaEm && p.encerradaEm).map((p) => (p.encerradaEm - p.iniciadaEm) / HOUR);
  const duracaoMedia = duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0;

  const ids = new Set(pets.map((p) => p.id));
  const alerts = state.alerts.filter((a) => a.ts >= d0 && a.ts <= d1 && (unidade === 'TODAS' || a.unidade === unidade));
  const acessos = state.access.filter((a) => a.ts >= d0 && a.ts <= d1 && (unidade === 'TODAS' || a.unidade === unidade));
  const bloqueios = acessos.filter((a) => a.resultado === 'BLOQUEADO');

  return {
    periodo: [d0, d1],
    pets,
    total: pets.length,
    aprovadas: aprovadas.length,
    encerradas: encerradas.length,
    canceladas: canceladas.length,
    ativas: pets.filter((p) => p.status === 'ATIVA').length,
    validacao: pets.filter((p) => p.status === 'EM_VALIDACAO').length,
    tempoMedio,
    duracaoMedia,
    alertas: alerts.length,
    alertasCriticos: alerts.filter((a) => a.sev === 'risk').length,
    acessos: acessos.length,
    bloqueios: bloqueios.length,
    taxaBloqueio: acessos.length ? (bloqueios.length / acessos.length) * 100 : 0,
    horasHomem: encerradas.reduce((a, p) => a + (p.iniciadaEm && p.encerradaEm ? ((p.encerradaEm - p.iniciadaEm) / HOUR) * p.equipe.length : 0), 0),
    petsIds: ids,
  };
}

/** Daily buckets for the trend chart. */
export function seriePorDia(dias = 14, filtro = {}) {
  const out = [];
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  for (let i = dias - 1; i >= 0; i--) {
    const d0 = hoje.getTime() - i * DAY;
    const d1 = d0 + DAY;
    const pets = state.pets.filter((p) => p.criadaEm >= d0 && p.criadaEm < d1 && (filtro.unidade === 'TODAS' || !filtro.unidade || p.unidade === filtro.unidade));
    out.push({
      ts: d0,
      total: pets.length,
      liberadas: pets.filter((p) => p.validadaEm).length,
      canceladas: pets.filter((p) => p.status === 'CANCELADA').length,
      alertas: state.alerts.filter((a) => a.ts >= d0 && a.ts < d1).length,
    });
  }
  return out;
}

/** Distribution of PETs across activity types. */
export function porTipo(pets) {
  const m = new Map();
  pets.forEach((p) => m.set(p.tipo, (m.get(p.tipo) ?? 0) + 1));
  return [...m.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n);
}

/** Distribution across areas — for the risk heat list. */
export function porArea(pets) {
  const m = new Map();
  pets.forEach((p) => m.set(p.areaId, (m.get(p.areaId) ?? 0) + 1));
  return [...m.entries()].map(([areaId, n]) => ({ areaId, n })).sort((a, b) => b.n - a.n);
}
