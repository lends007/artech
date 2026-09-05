/**
 * PET CONTROL — shared utilities (formatting, ids, dom, math).
 */

/* ---------------- DOM ---------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Escape untrusted text before interpolating into templates. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Event delegation helper. */
export function on(root, evt, sel, fn) {
  root.addEventListener(evt, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- IDs & random ---------------- */
let _seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const rnd = (min, max) => min + Math.random() * (max - min);
export const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- Numbers ---------------- */
export const pad2 = (n) => String(n).padStart(2, '0');
export const pad3 = (n) => String(n).padStart(3, '0');

export function nf(v, dec = 0) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ---------------- Dates ---------------- */
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const D = (t) => (t instanceof Date ? t : new Date(t));

export const hhmm = (t) => { const d = D(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const hhmmss = (t) => { const d = D(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
export const ddmm = (t) => { const d = D(t); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; };
export const ddmmyy = (t) => { const d = D(t); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const dtFull = (t) => `${ddmmyy(t)} ${hhmm(t)}`;
export const dayLabel = (t) => {
  const d = D(t);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

/** Human-friendly elapsed time, pt-BR. */
export function ago(t) {
  const s = Math.max(0, (Date.now() - D(t).getTime()) / 1000);
  if (s < 45) return 'agora';
  if (s < 90) return 'há 1 min';
  const m = s / 60;
  if (m < 60) return `há ${Math.round(m)} min`;
  const h = m / 60;
  if (h < 24) return `há ${Math.round(h)}h`;
  const dd = h / 24;
  if (dd < 30) return `há ${Math.round(dd)}d`;
  return ddmmyy(t);
}

/** Duration between two instants → "3h 24min". */
export function dur(a, b = Date.now()) {
  let s = Math.max(0, (D(b).getTime() - D(a).getTime()) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  if (h === 0 && m === 0) return '< 1min';
  return h ? `${h}h ${pad2(m)}min` : `${m}min`;
}

/** Signed countdown → "em 2h 10min" / "vencida há 12min". */
export function until(t) {
  const diff = D(t).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = h ? `${h}h ${pad2(m)}min` : `${m}min`;
  return diff >= 0 ? `em ${s}` : `vencida há ${s}`;
}

/* ---------------- Strings ---------------- */
export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter((p) => p.length > 2);
  const src = parts.length ? parts : String(name).trim().split(/\s+/);
  const a = src[0]?.[0] ?? '?';
  const b = src.length > 1 ? src[src.length - 1][0] : '';
  return (a + b).toUpperCase();
}

/** Deterministic hue from a string — stable avatar colors across renders. */
export function hueOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Case/accent-insensitive substring match across several fields. */
export function matches(q, ...fields) {
  const n = norm(q).trim();
  if (!n) return true;
  const hay = fields.map(norm).join(' ');
  return n.split(/\s+/).every((tok) => hay.includes(tok));
}

/* ---------------- Collections ---------------- */
export function groupBy(arr, fn) {
  return arr.reduce((acc, x) => {
    const k = fn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + fn(x), 0);
export const byDesc = (fn) => (a, b) => fn(b) - fn(a);
export const byAsc = (fn) => (a, b) => fn(a) - fn(b);

/* ---------------- Misc ---------------- */
export function debounce(fn, ms = 220) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/**
 * Entrega um arquivo ao usuário.
 *
 * Hospedado como página publicada, o visualizador não permite download por
 * link comum — nesse caso usamos a capability `downloads`, que pede
 * confirmação. Rodando localmente (servidor ou duplo clique), cai no
 * método tradicional. Resolve `true` só quando o arquivo realmente saiu.
 *
 * @returns {Promise<boolean>}
 */
let _saveApi;   // undefined = ainda não consultado · null = indisponível
async function saveApi() {
  if (_saveApi !== undefined) return _saveApi;
  try {
    _saveApi = (typeof window !== 'undefined' && window.claude?.use)
      ? await window.claude.use('downloads')
      : null;
  } catch { _saveApi = null; }
  return _saveApi;
}

export async function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const data = '\ufeff' + text;   // BOM: o Excel abre o CSV em UTF-8

  const api = await saveApi();
  if (api) {
    try {
      await api.save({ filename, data });
      return true;
    } catch (err) {
      /* O usuário recusou ou o formato foi barrado: nada foi salvo. */
      if (['declined', 'rejected_extension', 'extension_not_enabled', 'rate_limited', 'too_large'].includes(err?.code)) return false;
      /* Qualquer outra falha: tenta o método local abaixo. */
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch { return false; }
}

export function toCSV(rows, headers) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = headers.map((h) => q(h.label)).join(';');
  const body = rows.map((r) => headers.map((h) => q(h.get(r))).join(';')).join('\n');
  return `${head}\n${body}`;
}
