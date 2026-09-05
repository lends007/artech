/**
 * PET CONTROL — Shared render helpers.
 * Small pure functions returning HTML so every screen renders identical
 * avatars, badges and status chips.
 */

import { esc, initials, hueOf, ago, hhmm, dtFull } from '../util.js';
import { icon } from './icons.js';
import { PET_STATUS, NIVEIS, STATUS_MEDICAO, SEV, areaName, unitName, atividadeNome, PARAMS, classify } from '../data/catalog.js';

/* ---------------- Avatar ---------------- */
export function avatar(person, size = '', extra = '') {
  if (!person) return `<div class="av ${size}" style="background:var(--bg-panel-2);color:var(--tx-dim)">?</div>`;
  const h = hueOf(person.id ?? person.nome ?? '');
  const style = `background:linear-gradient(140deg, hsl(${h} 62% 62%), hsl(${(h + 42) % 360} 58% 40%))`;
  const face = person.face ? 'av-face' : '';
  return `<div class="av ${size} ${face} ${extra}" style="${style}" title="${esc(person.nome ?? '')}">${esc(initials(person.nome ?? '?'))}</div>`;
}

export function avatarStack(people, max = 4) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return `<div class="av-stack">${shown.map((p) => avatar(p, 'av-sm')).join('')}${
    rest > 0 ? `<div class="av av-sm av-more">+${rest}</div>` : ''}</div>`;
}

/* ---------------- Status chips ---------------- */
export function petBadge(status, live = false) {
  const s = PET_STATUS[status] ?? { label: status, badge: 'b-idle' };
  const pulsing = live && (status === 'ATIVA' || status === 'EM_VALIDACAO');
  return `<span class="badge ${s.badge} ${pulsing ? 'badge-live' : ''}"><i class="dot"></i>${esc(s.label)}</span>`;
}

export function levelTag(nivel) {
  return `<span class="lvl lvl-${esc(nivel)}">${esc(NIVEIS[nivel]?.label ?? nivel)}</span>`;
}

export function empStatusBadge(status) {
  const map = {
    ATIVO:    ['b-ok', 'Ativo'],
    PENDENTE: ['b-warn', 'Pendente'],
    AFASTADO: ['b-idle', 'Afastado'],
    INATIVO:  ['b-idle', 'Inativo'],
  };
  const [cls, label] = map[status] ?? ['b-idle', status];
  return `<span class="badge ${cls}"><i class="dot"></i>${esc(label)}</span>`;
}

export function medBadge(st) {
  const s = STATUS_MEDICAO[st] ?? STATUS_MEDICAO.idle;
  return `<span class="badge ${s.cls}"><i class="dot"></i>${esc(s.label)}</span>`;
}

export function sevBadge(sev) {
  const s = SEV[sev] ?? SEV.info;
  return `<span class="badge ${s.badge}"><i class="dot"></i>${esc(s.label)}</span>`;
}

export function accessBadge(res) {
  return res === 'LIBERADO'
    ? `<span class="badge b-ok"><i class="dot"></i>Acesso liberado</span>`
    : `<span class="badge b-risk"><i class="dot"></i>Acesso bloqueado</span>`;
}

/* ---------------- Layout helpers ---------------- */
export function panel({ title, sub, actions = '', body, footer = '', cls = '', flush = false }) {
  return `<section class="panel ${cls}">
    ${title ? `<header class="panel-hd">
      <div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      ${actions ? `<div class="row g-2">${actions}</div>` : ''}
    </header>` : ''}
    <div class="panel-bd ${flush ? 'panel-bd-flush' : ''}">${body}</div>
    ${footer ? `<footer class="panel-ft">${footer}</footer>` : ''}
  </section>`;
}

export function kpi({ label, value, unit = '', ico, color = 'var(--ac)', foot = '', spark = '' }) {
  return `<article class="kpi" style="--kpi-c:${color}">
    <div class="kpi-top">
      <span class="kpi-lbl">${esc(label)}</span>
      <span class="kpi-ico">${icon(ico)}</span>
    </div>
    <div class="kpi-val">${esc(String(value))}${unit ? `<span class="kpi-unit">${esc(unit)}</span>` : ''}</div>
    ${foot ? `<div class="kpi-ft">${foot}</div>` : ''}
    ${spark ? `<div class="spark">${spark}</div>` : ''}
  </article>`;
}

export function empty(text, sub = '', ico = 'folder') {
  return `<div class="empty">${icon(ico)}<div class="t">${esc(text)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
}

export function statLine(value, label) {
  return `<div class="stat-line"><span class="v">${esc(String(value))}</span><span class="l">${esc(label)}</span></div>`;
}

/* ---------------- Domain summaries ---------------- */
export function petLine(p) {
  return `${esc(p.codigo)} · ${esc(atividadeNome(p.tipo))}`;
}

export function localLine(p) {
  return `${esc(unitName(p.unidade))} · ${esc(areaName(p.areaId))}`;
}

/** Measurement gauge card used by the PET form and the monitoring screen. */
export function gaugeCard(paramId, valor, { ts = null, live = false, compact = false } = {}) {
  const p = PARAMS[paramId];
  const st = classify(paramId, valor);
  const pct = ((valor - p.scaleMin) / (p.scaleMax - p.scaleMin)) * 100;
  const bandL = ((p.min - p.scaleMin) / (p.scaleMax - p.scaleMin)) * 100;
  const bandW = ((p.max - p.min) / (p.scaleMax - p.scaleMin)) * 100;
  const tone = st === 'risk' ? 'var(--risk)' : st === 'warn' ? 'var(--warn)' : 'var(--ok)';

  return `<div class="gauge-card st-${st}">
    <div class="row-b" style="margin-bottom:9px">
      <div class="row g-2">
        <span style="color:${tone};display:flex">${icon(p.icon, 14)}</span>
        <span class="g-lbl">${esc(p.nome)}</span>
      </div>
      ${live ? `<span class="badge b-ac badge-live" style="height:18px;font-size:9px"><i class="dot"></i>ao vivo</span>` : ''}
    </div>
    <div class="row-b" style="align-items:flex-end">
      <div class="g-val">${esc(String(valor))} <span class="g-unit">${esc(p.unidade)}</span></div>
      ${medBadge(st)}
    </div>
    ${compact ? '' : `
    <div class="meter" style="margin-top:12px">
      <div class="band" style="left:${bandL.toFixed(1)}%;width:${bandW.toFixed(1)}%"></div>
      <div class="needle" style="left:calc(${Math.max(0, Math.min(100, pct)).toFixed(1)}% - 1px);color:${tone};background:${tone}"></div>
    </div>
    <div class="row-b" style="margin-top:6px">
      <span class="mono" style="font-size:9.5px;color:var(--tx-dim)">${p.min} – ${p.max} ${esc(p.unidade)}</span>
      ${ts ? `<span class="mono" style="font-size:9.5px;color:var(--tx-dim)">${esc(hhmm(ts))}</span>` : ''}
    </div>`}
  </div>`;
}

/* ---------------- Timeline ---------------- */
export function timelineItem(ev, { EVENTO, nomeAtor, area }) {
  const meta = EVENTO[ev.tipo] ?? { label: ev.tipo, icon: 'info', tone: '' };
  return `<li class="tl-item ${meta.tone}">
    <div class="row g-2" style="align-items:center">
      <span class="tl-t">${esc(meta.label)}</span>
      <span class="tl-time">${esc(hhmm(ev.ts))}</span>
    </div>
    ${ev.detalhe ? `<div style="font-size:12px;color:var(--tx);margin-top:3px">${esc(ev.detalhe)}</div>` : ''}
    <div class="tl-meta">
      ${nomeAtor ? `<span>${icon('userCheck', 11)} ${esc(nomeAtor)}</span>` : `<span>${icon('cpu', 11)} Sistema</span>`}
      ${area ? `<span>${icon('pin', 11)} ${esc(area)}</span>` : ''}
      <span>${icon('clock', 11)} ${esc(dtFull(ev.ts))}</span>
    </div>
  </li>`;
}

/* ---------------- Misc ---------------- */
export const relTime = (t) => `<span class="mono" style="font-size:11px;color:var(--tx-dim)">${esc(ago(t))}</span>`;

export function toolbar(inner) { return `<div class="toolbar">${inner}</div>`; }

export function searchBox(id, placeholder = 'Buscar…', value = '') {
  return `<div class="search">${icon('search')}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"></div>`;
}

export function selectBox(id, options, value, { cls = 'sel', label = '' } = {}) {
  return `${label ? `<span class="eyebrow" style="margin-right:2px">${esc(label)}</span>` : ''}
    <select id="${id}" class="${cls}">${options.map((o) =>
      `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
}
