/**
 * PET CONTROL — Toasts, modals and drawers.
 * Feedback for every consequential action is a product requirement here:
 * approving a permit or blocking an access must never happen silently.
 */

import { el, esc, $ } from '../util.js';
import { icon } from './icons.js';

/* ============================================================
   TOASTS
   ============================================================ */
const TONES = {
  ok:   { c: 'var(--ok)',   i: 'okCircle' },
  warn: { c: 'var(--warn)', i: 'warnCircle' },
  risk: { c: 'var(--risk)', i: 'xCircle' },
  info: { c: 'var(--ac)',   i: 'info' },
};

function host() {
  let h = $('#toasts');
  if (!h) { h = el('<div id="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(h); }
  return h;
}

export function toast(title, sub = '', tone = 'info', ms = 4200) {
  const t = TONES[tone] ?? TONES.info;
  const node = el(`<div class="toast" style="--tc:${t.c}">
    <span class="ti">${icon(t.i)}</span>
    <div class="grow"><div class="tt">${esc(title)}</div>${sub ? `<div class="ts">${esc(sub)}</div>` : ''}</div>
    <button class="tx" aria-label="Fechar">${icon('x')}</button>
  </div>`);
  const close = () => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 220);
  };
  node.querySelector('.tx').addEventListener('click', close);
  host().appendChild(node);
  if (ms) setTimeout(close, ms);
  return close;
}

/* ============================================================
   MODAL
   ============================================================ */
let openLayer = null;

function mount(node) {
  close();
  openLayer = node;
  document.body.appendChild(node);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  node._onKey = onKey;
  const focusable = node.querySelector('input, select, textarea, button.btn-primary, button');
  setTimeout(() => focusable?.focus(), 60);
}

export function close() {
  if (!openLayer) return;
  document.removeEventListener('keydown', openLayer._onKey);
  const n = openLayer; openLayer = null;
  n.style.animation = 'fade-in .16s ease reverse forwards';
  setTimeout(() => n.remove(), 170);
}

/**
 * @param {{title:string, sub?:string, body:string, footer?:string, width?:number,
 *          onMount?:(root:HTMLElement)=>void}} o
 */
export function modal(o) {
  const node = el(`<div class="overlay" role="dialog" aria-modal="true">
    <div class="modal" style="--mw:${o.width ?? 620}px">
      <header class="modal-hd">
        <div><h3>${esc(o.title)}</h3>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>
        <button class="top-btn" data-close aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="modal-bd">${o.body}</div>
      ${o.footer ? `<footer class="modal-ft">${o.footer}</footer>` : ''}
    </div>
  </div>`);
  node.addEventListener('click', (e) => { if (e.target === node || e.target.closest('[data-close]')) close(); });
  mount(node);
  o.onMount?.(node);
  return node;
}

export function drawer(o) {
  const node = el(`<div class="overlay" role="dialog" aria-modal="true">
    <aside class="drawer" style="--dw:${o.width ?? 560}px">
      <header class="modal-hd">
        <div><h3>${esc(o.title)}</h3>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>
        <button class="top-btn" data-close aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="modal-bd grow">${o.body}</div>
      ${o.footer ? `<footer class="modal-ft">${o.footer}</footer>` : ''}
    </aside>
  </div>`);
  node.addEventListener('click', (e) => { if (e.target === node || e.target.closest('[data-close]')) close(); });
  mount(node);
  o.onMount?.(node);
  return node;
}

/** Confirmation dialog — used before irreversible operational decisions. */
export function confirm({ title, message, confirmLabel = 'Confirmar', tone = 'primary', requireReason = false, onConfirm }) {
  modal({
    title,
    width: 480,
    body: `<p style="font-size:13px;line-height:1.6;color:var(--tx)">${esc(message)}</p>
      ${requireReason ? `<div class="field" style="margin-top:16px">
        <label for="cf-reason">Justificativa</label>
        <textarea id="cf-reason" class="ta" placeholder="Descreva o motivo — o registro será mantido na trilha de auditoria."></textarea>
      </div>` : ''}`,
    footer: `<button class="btn" data-close>Cancelar</button>
      <button class="btn btn-${tone}" id="cf-ok">${esc(confirmLabel)}</button>`,
    onMount(root) {
      root.querySelector('#cf-ok').addEventListener('click', () => {
        const reason = root.querySelector('#cf-reason')?.value.trim() ?? '';
        if (requireReason && reason.length < 5) {
          const f = root.querySelector('#cf-reason');
          f.classList.add('inp');
          f.style.borderColor = 'rgba(240,87,77,.6)';
          f.focus();
          return;
        }
        close();
        onConfirm(reason);
      });
    },
  });
}
