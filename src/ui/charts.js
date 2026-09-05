/**
 * PET CONTROL — SVG chart primitives.
 * Deliberately dependency-free: every chart is a pure string builder so it can
 * be dropped into any template and re-rendered on each state change.
 */

import { esc, nf } from '../util.js';

export const SERIES = ['#22D3EE', '#60A5FA', '#2DD4A7', '#A78BFA', '#F5B02C', '#F0574D', '#94A3B8', '#0EA5E9'];
export const TONE = { ok: '#2DD4A7', warn: '#F5B02C', risk: '#F0574D', info: '#60A5FA', idle: '#64748B', ac: '#22D3EE' };

let gid = 0;
const nid = (p) => `${p}${++gid}`;

const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Catmull-Rom → cubic bezier, for smooth but honest curves. */
function smooth(pts) {
  if (pts.length < 3) return path(pts);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* ============================================================
   AREA / LINE CHART
   ============================================================ */
export function areaChart({
  series, labels = [], h = 190, w = 640, pad = { t: 14, r: 10, b: 22, l: 30 },
  yMin = null, yMax = null, bands = [], curve = true, dots = false, yFmt = (v) => nf(v),
}) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const all = series.flatMap((s) => s.data);
  const lo = yMin ?? Math.min(...all, 0);
  const hi = yMax ?? Math.max(...all, 1);
  const span = hi - lo || 1;
  const n = Math.max(1, series[0]?.data.length ?? 1);
  const X = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = (v) => pad.t + ih - ((v - lo) / span) * ih;

  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (span * i) / ticks;
    const y = Y(v);
    grid += `<line class="grid-l" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="axis-t" x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${esc(yFmt(v))}</text>`;
  }

  let bandSvg = '';
  for (const b of bands) {
    const y1 = Y(Math.min(b.max, hi)), y2 = Y(Math.max(b.min, lo));
    bandSvg += `<rect x="${pad.l}" y="${y1.toFixed(1)}" width="${iw}" height="${Math.max(0, y2 - y1).toFixed(1)}" fill="${b.color}" opacity="${b.opacity ?? .07}"/>`;
    if (b.line != null) {
      const yl = Y(b.line);
      bandSvg += `<line x1="${pad.l}" y1="${yl.toFixed(1)}" x2="${w - pad.r}" y2="${yl.toFixed(1)}" stroke="${b.color}" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>`;
    }
  }

  let body = '';
  series.forEach((s, si) => {
    const color = s.color ?? SERIES[si % SERIES.length];
    const pts = s.data.map((v, i) => [X(i), Y(v)]);
    const d = curve ? smooth(pts) : path(pts);
    const g = nid('grad');
    if (s.fill !== false) {
      body += `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
      body += `<path d="${d} L${X(n - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z" fill="url(#${g})"/>`;
    }
    body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (dots) pts.forEach((p) => { body += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2" fill="${color}"/>`; });
    const last = pts[pts.length - 1];
    if (last) body += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${color}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="6" fill="${color}" opacity=".18"/>`;
  });

  let xs = '';
  const step = Math.max(1, Math.ceil(labels.length / 7));
  labels.forEach((l, i) => {
    if (i % step && i !== labels.length - 1) return;
    xs += `<text class="axis-t" x="${X(i).toFixed(1)}" y="${h - 5}" text-anchor="middle">${esc(l)}</text>`;
  });

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" style="height:${h}px" preserveAspectRatio="none">
    ${bandSvg}${grid}${body}${xs}</svg>`;
}

/* ============================================================
   BAR CHART (stacked or grouped)
   ============================================================ */
export function barChart({ series, labels, h = 190, w = 640, pad = { t: 14, r: 10, b: 22, l: 30 }, stacked = true, radius = 2 }) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const n = labels.length || 1;
  const totals = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.data[i] ?? 0), 0) : Math.max(...series.map((s) => s.data[i] ?? 0))));
  const hi = Math.max(1, ...totals);
  const slot = iw / n;
  const bw = Math.max(2.5, Math.min(stacked ? 22 : 26 / series.length, (slot * 0.82) / (stacked ? 1 : series.length)));

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    grid += `<line class="grid-l" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="axis-t" x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${Math.round((hi * i) / 4)}</text>`;
  }

  let bars = '';
  labels.forEach((l, i) => {
    const cx = pad.l + slot * i + slot / 2;
    let acc = 0;
    series.forEach((s, si) => {
      const v = s.data[i] ?? 0;
      if (v <= 0) return;
      const bh = (v / hi) * ih;
      const color = s.color ?? SERIES[si % SERIES.length];
      const x = stacked ? cx - bw / 2 : cx - (bw * series.length) / 2 + si * bw;
      const y = stacked ? pad.t + ih - acc - bh : pad.t + ih - bh;
      bars += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - (stacked ? 0 : 1.5)).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" rx="${radius}" fill="${color}"><title>${esc(s.name)} — ${esc(l)}: ${v}</title></rect>`;
      acc += bh;
    });
  });

  let xs = '';
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((l, i) => {
    if (i % step && i !== n - 1) return;
    xs += `<text class="axis-t" x="${(pad.l + slot * i + slot / 2).toFixed(1)}" y="${h - 5}" text-anchor="middle">${esc(l)}</text>`;
  });

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" style="height:${h}px" preserveAspectRatio="none">${grid}${bars}${xs}</svg>`;
}

/* ============================================================
   HORIZONTAL BARS (ranking)
   ============================================================ */
export function hBars({ items, max = null, showValue = true }) {
  const hi = max ?? Math.max(1, ...items.map((i) => i.value));
  return `<div class="col g-3">${items.map((it) => `
    <div>
      <div class="row-b" style="margin-bottom:5px">
        <span style="font-size:12px;color:var(--tx)">${esc(it.label)}</span>
        ${showValue ? `<span class="num" style="font-size:12px">${nf(it.value)}${it.suffix ?? ''}</span>` : ''}
      </div>
      <div class="progress"><i style="width:${((it.value / hi) * 100).toFixed(1)}%;background:${it.color ?? 'var(--ac)'}"></i></div>
    </div>`).join('')}</div>`;
}

/* ============================================================
   DONUT
   ============================================================ */
export function donut({ items, size = 148, thickness = 13, centerTop = '', centerBottom = '' }) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let off = 0;
  const arcs = items.map((it, i) => {
    const frac = it.value / total;
    const len = frac * C;
    const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      stroke="${it.color ?? SERIES[i % SERIES.length]}" stroke-width="${thickness}"
      stroke-dasharray="${Math.max(0, len - 1.6).toFixed(2)} ${(C - len + 1.6).toFixed(2)}"
      stroke-dashoffset="${(-off).toFixed(2)}" stroke-linecap="butt"
      transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(it.label)}: ${it.value}</title></circle>`;
    off += len;
    return seg;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex:none">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.045)" stroke-width="${thickness}"/>
    ${arcs}
    ${centerTop ? `<text x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle" fill="#E8EDF4" font-family="var(--f-mono)" font-size="23" font-weight="600">${esc(centerTop)}</text>` : ''}
    ${centerBottom ? `<text x="${size / 2}" y="${size / 2 + 15}" text-anchor="middle" fill="#5A6474" font-size="9.5" letter-spacing="1.4">${esc(centerBottom)}</text>` : ''}
  </svg>`;
}

/* ============================================================
   SPARKLINE
   ============================================================ */
export function spark({ data, w = 108, h = 34, color = '#22D3EE', fill = true }) {
  if (!data.length) return '';
  const lo = Math.min(...data), hi = Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * w, h - 3 - ((v - lo) / span) * (h - 6)]);
  const d = smooth(pts);
  const g = nid('sp');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none">
    ${fill ? `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${w},${h} L0,${h} Z" fill="url(#${g})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

/* ============================================================
   RADIAL GAUGE  (single measurement against its safe band)
   ============================================================ */
export function radial({ value, min, max, safeMin, safeMax, size = 128, tone = '#22D3EE', label = '', unit = '' }) {
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  const A0 = 135, A1 = 405;                       // 270° sweep
  const ang = (v) => A0 + ((v - min) / (max - min || 1)) * (A1 - A0);
  const pt = (a, rr = r) => [cx + rr * Math.cos((a * Math.PI) / 180), cy + rr * Math.sin((a * Math.PI) / 180)];
  const arc = (a0, a1, rr = r) => {
    const [x0, y0] = pt(a0, rr), [x1, y1] = pt(a1, rr);
    return `M${x0.toFixed(1)},${y0.toFixed(1)} A${rr},${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
  };
  const v = Math.max(min, Math.min(max, value));
  const [nx, ny] = pt(ang(v), r - 1);
  const [ix, iy] = pt(ang(v), r - 13);

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <path d="${arc(A0, A1)}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="8" stroke-linecap="round"/>
    <path d="${arc(ang(safeMin), ang(safeMax))}" fill="none" stroke="rgba(45,212,167,.28)" stroke-width="8" stroke-linecap="round"/>
    <path d="${arc(A0, ang(v))}" fill="none" stroke="${tone}" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    <line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${tone}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="${tone}"/>
    <text x="${cx}" y="${cy + 26}" text-anchor="middle" fill="#E8EDF4" font-family="var(--f-mono)" font-size="17" font-weight="600">${esc(String(value))}<tspan font-size="10" fill="#5A6474"> ${esc(unit)}</tspan></text>
    <text x="${cx}" y="${cy + 40}" text-anchor="middle" fill="#414B59" font-size="8.5" letter-spacing="1.2">${esc(label.toUpperCase())}</text>
  </svg>`;
}

/* ============================================================
   LEGEND
   ============================================================ */
export function legend(items) {
  return `<div class="legend">${items.map((i) => `
    <span class="li"><i style="background:${i.color}"></i>${esc(i.label)}${i.value != null ? ` <b>${nf(i.value)}</b>` : ''}</span>`).join('')}</div>`;
}
