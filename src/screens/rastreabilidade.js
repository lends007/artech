/**
 * PET CONTROL — Rastreabilidade.
 *
 * The differentiator: every operational fact is recorded as
 * QUEM + O QUÊ + QUANDO + ONDE + STATUS, and can be replayed as a timeline
 * for a single permit or queried across the whole operation.
 */

import { esc, hhmm, dtFull, dur, ago, matches, on, $, debounce, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, panel, empty, petBadge, searchBox, selectBox } from '../ui/kit.js';
import { toast } from '../ui/overlay.js';
import { state, emp, pet } from '../store.js';
import { petsInScope, eventsInScope, timelineOf } from '../selectors.js';
import { EVENTO, eventoLabel, areaName, unitName, atividadeNome } from '../data/catalog.js';

const f = { pet: null, q: '', tipo: 'TODOS', ator: 'TODOS' };

export function render(params = []) {
  const pets = petsInScope().sort((a, b) => b.criadaEm - a.criadaEm);
  /* Default to the permit with the richest history, so the timeline opens
     on a full lifecycle rather than an arbitrary record. */
  const alvoId = params[0] ?? f.pet ?? maisCompleta(pets)?.id ?? pets[0]?.id;
  const alvo = pet(alvoId) ?? pets[0] ?? null;
  f.pet = alvo?.id ?? null;

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('trace')} Monitoramento ${icon('chevR')} Rastreabilidade</div>
        <h1>Rastreabilidade</h1>
        <p class="lead">
          Cada ação sobre uma permissão gera um registro com autor, natureza, momento, local e situação.
          O histórico completo substitui o arquivo físico e sustenta a auditoria.
        </p>
      </div>
      <div class="acts">
        <span class="badge b-ac">${icon('db', 11)} ${state.events.length.toLocaleString('pt-BR')} eventos registrados</span>
        <button class="btn btn-outline" id="rt-export">${icon('download')} Exportar trilha</button>
      </div>
    </div>

    <div class="grid g-split">
      <aside class="panel">
        <header class="panel-hd"><h3>Permissões</h3></header>
        <div class="toolbar" style="padding:10px 12px">
          ${searchBox('rt-pq', 'Buscar PET…', '')}
        </div>
        <div class="feed" id="rt-list" style="max-height:620px;overflow-y:auto">
          ${petList(pets, alvo)}
        </div>
      </aside>

      <div class="col g-4" id="rt-detail">
        ${alvo ? timelineHTML(alvo) : empty('Selecione uma permissão', 'Escolha uma PET à esquerda para ver o histórico.', 'trace')}
        ${globalHTML()}
      </div>
    </div>
  </div>`;
}

/** The permit whose audit trail tells the most complete story. */
function maisCompleta(pets) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const candidatas = pets.filter((p) => p.criadaEm >= hoje.getTime());
  const pool = candidatas.length ? candidatas : pets;
  return pool.slice().sort((a, b) => timelineOf(b.id).length - timelineOf(a.id).length)[0] ?? null;
}

function petList(pets, alvo, q = '') {
  const rows = pets.filter((p) => matches(q, p.codigo, p.titulo, areaName(p.areaId))).slice(0, 60);
  if (!rows.length) return empty('Nada encontrado', '', 'permit');
  return rows.map((p) => `<button class="feed-row" data-pet="${esc(p.id)}" style="text-align:left;width:100%;${
    alvo && p.id === alvo.id ? 'background:var(--bg-active);box-shadow:inset 2px 0 0 var(--ac)' : ''}">
    <div class="feed-bd">
      <div class="row-b g-2">
        <span class="mono" style="font-size:11.5px;color:var(--ac)">${esc(p.codigo)}</span>
        ${petBadge(p.status)}
      </div>
      <div class="feed-t truncate" style="margin-top:3px">${esc(p.titulo)}</div>
      <div class="feed-s">${esc(areaName(p.areaId))} · ${timelineOf(p.id).length} eventos</div>
    </div>
  </button>`).join('');
}

/* ------------------------------------------------------------ */
function timelineHTML(p) {
  const ev = timelineOf(p.id);
  const inicio = ev[0]?.ts ?? p.criadaEm;
  const fim = ev[ev.length - 1]?.ts ?? Date.now();
  const atores = new Set(ev.map((e) => e.atorId).filter(Boolean));

  return `<section class="panel panel-rail">
    <header class="panel-hd">
      <div>
        <h3>Histórico completo · ${esc(p.codigo)}</h3>
        <div class="sub">${esc(p.titulo)} — ${esc(atividadeNome(p.tipo))}</div>
      </div>
      <div class="row g-2">
        ${petBadge(p.status, true)}
        <a class="btn btn-sm btn-outline" href="#/pets/${esc(p.id)}">${icon('ext')} Abrir PET</a>
      </div>
    </header>

    <div class="panel-bd" style="padding-bottom:8px">
      <div class="grid g-4c" style="gap:1px;background:var(--line-soft);border:1px solid var(--line-soft);border-radius:8px;overflow:hidden;margin-bottom:22px">
        ${[['Eventos', ev.length, 'registros na trilha'],
           ['Ciclo total', dur(inicio, fim), 'da criação ao encerramento'],
           ['Pessoas envolvidas', atores.size, 'autores identificados'],
           ['Área', areaName(p.areaId), unitName(p.unidade)]]
          .map(([l, v, s]) => `<div style="background:var(--bg-inset);padding:13px 15px">
            <div class="eyebrow">${esc(l)}</div>
            <div style="font-family:var(--f-mono);font-size:17px;color:var(--tx-hi);margin-top:5px;font-weight:600">${esc(String(v))}</div>
            <div style="font-size:10.5px;color:var(--tx-dim);margin-top:2px">${esc(s)}</div>
          </div>`).join('')}
      </div>

      <ul class="tl">${ev.map((e, i) => {
        const meta = EVENTO[e.tipo] ?? { label: e.tipo, icon: 'info', tone: '' };
        const ator = e.atorId ? emp(e.atorId) : null;
        const ultimo = i === ev.length - 1;
        return `<li class="tl-item ${meta.tone || (ultimo ? 'on' : '')}">
          <div class="row-b wrap g-3">
            <div class="row g-2" style="align-items:baseline">
              <span style="color:var(--tx-mid);display:inline-flex;margin-right:2px">${icon(meta.icon, 13)}</span>
              <span class="tl-t">${esc(meta.label)}</span>
              <span class="tl-time">${esc(hhmm(e.ts))}</span>
            </div>
            <span class="mono" style="font-size:10px;color:var(--tx-dim)">${esc(e.id)}</span>
          </div>
          ${e.detalhe ? `<div style="font-size:12.5px;color:var(--tx);margin-top:4px">${esc(e.detalhe)}</div>` : ''}
          <div class="tl-meta">
            <span title="Quem">${icon('userCheck', 11)} ${esc(ator?.nome ?? 'Sistema automatizado')}</span>
            <span title="Onde">${icon('pin', 11)} ${esc(areaName(e.areaId))}</span>
            <span title="Quando">${icon('clock', 11)} ${esc(dtFull(e.ts))}</span>
            <span title="Status">${icon('shield', 11)} registro selado</span>
          </div>
        </li>`;
      }).join('')}</ul>
    </div>

    <footer class="panel-ft">
      <span class="row g-2" style="font-size:11.5px;color:var(--tx-lo)">
        ${icon('lock', 12)} Registros somente-leitura — não podem ser editados nem excluídos pela operação.
      </span>
      <span class="mono" style="font-size:10.5px;color:var(--tx-dim)">
        Selo de integridade ${esc(hashOf(p.id + ev.length))}
      </span>
    </footer>
  </section>`;
}

/** Cosmetic integrity seal — communicates immutability in the demo. */
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase().replace(/(.{4})/, '$1·');
}

/* ------------------------------------------------------------ */
function globalHTML() {
  const rows = globalRows();
  const atores = [...new Set(state.events.map((e) => e.atorId).filter(Boolean))]
    .map(emp).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 40);

  return `<section class="panel">
    <header class="panel-hd">
      <div><h3>Trilha de auditoria global</h3><div class="sub">Todos os eventos da operação, filtráveis e exportáveis</div></div>
    </header>
    <div class="toolbar">
      ${searchBox('rt-q', 'Buscar por detalhe, autor, PET ou área…', f.q)}
      ${selectBox('rt-tipo', [{ value: 'TODOS', label: 'Todos os eventos' },
        ...Object.entries(EVENTO).map(([k, v]) => ({ value: k, label: v.label }))], f.tipo)}
      ${selectBox('rt-ator', [{ value: 'TODOS', label: 'Todos os autores' }, { value: 'SISTEMA', label: 'Sistema automatizado' },
        ...atores.map((e) => ({ value: e.id, label: e.nome }))], f.ator)}
      <div class="grow"></div>
      <span class="mono" style="font-size:11px;color:var(--tx-dim)">${rows.length} eventos</span>
    </div>
    <div class="tbl-wrap">
      ${rows.length ? `<table class="tbl">
        <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th><th>Onde</th><th>PET</th><th class="right">Registro</th></tr></thead>
        <tbody>${rows.slice(0, 60).map((e) => {
          const ator = e.atorId ? emp(e.atorId) : null;
          const meta = EVENTO[e.tipo] ?? { label: e.tipo, icon: 'info', tone: '' };
          const p = pet(e.petId);
          const tone = meta.tone === 'risk' ? 'var(--risk)' : meta.tone === 'warn' ? 'var(--warn)' : meta.tone === 'ok' ? 'var(--ok)' : 'var(--tx-mid)';
          return `<tr>
            <td class="mono nowrap" style="font-size:11.5px">${esc(dtFull(e.ts))}
              <div style="font-size:10px;color:var(--tx-dim)">${esc(ago(e.ts))}</div></td>
            <td>${ator ? `<div class="row g-2">${avatar(ator, 'av-sm')}<span class="truncate" style="max-width:120px">${esc(ator.nome)}</span></div>`
              : `<span class="row g-2" style="color:var(--tx-lo)">${icon('cpu', 13)} Sistema</span>`}</td>
            <td class="nowrap"><span class="row g-2" style="color:${tone}">${icon(meta.icon, 13)} <span style="color:var(--tx-hi)">${esc(meta.label)}</span></span></td>
            <td class="truncate" style="max-width:280px;font-size:11.5px;color:var(--tx-lo)">${esc(e.detalhe || '—')}</td>
            <td class="nowrap">${esc(areaName(e.areaId))}</td>
            <td class="mono" style="font-size:11px;color:${p ? 'var(--ac)' : 'var(--tx-dim)'}">${esc(p?.codigo ?? '—')}</td>
            <td class="right mono" style="font-size:10px;color:var(--tx-dim)">${esc(e.id)}</td>
          </tr>`;
        }).join('')}</tbody></table>` : empty('Nenhum evento', 'Ajuste os filtros da trilha.', 'trace')}
    </div>
  </section>`;
}

function globalRows() {
  return eventsInScope().filter((e) => {
    if (f.tipo !== 'TODOS' && e.tipo !== f.tipo) return false;
    if (f.ator === 'SISTEMA' && e.atorId) return false;
    if (f.ator !== 'TODOS' && f.ator !== 'SISTEMA' && e.atorId !== f.ator) return false;
    return matches(f.q, e.detalhe ?? '', emp(e.atorId)?.nome ?? '', eventoLabel(e.tipo), areaName(e.areaId), pet(e.petId)?.codigo ?? '');
  });
}

/* ------------------------------------------------------------ */
export function mount(root, params = []) {
  const page = root.querySelector('.page');
  if (!page) return null;

  const repaint = () => {
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = render(f.pet ? [f.pet] : []);
    mount(view, f.pet ? [f.pet] : []);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  on(page, 'click', '[data-pet]', (e, t) => { f.pet = t.dataset.pet; repaint(); });

  $('#rt-pq', root)?.addEventListener('input', debounce((e) => {
    const q = e.target.value;
    const pets = petsInScope().sort((a, b) => b.criadaEm - a.criadaEm);
    $('#rt-list').innerHTML = petList(pets, pet(f.pet), q);
  }, 200));

  $('#rt-q', root)?.addEventListener('input', debounce((e) => {
    f.q = e.target.value; repaint();
    const el = $('#rt-q'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length);
  }, 250));
  $('#rt-tipo', root)?.addEventListener('change', (e) => { f.tipo = e.target.value; repaint(); });
  $('#rt-ator', root)?.addEventListener('change', (e) => { f.ator = e.target.value; repaint(); });

  $('#rt-export', root)?.addEventListener('click', () => {
    const rows = globalRows();
    downloadText(`trilha-auditoria-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Registro', get: (e) => e.id },
      { label: 'Quando', get: (e) => dtFull(e.ts) },
      { label: 'Quem', get: (e) => emp(e.atorId)?.nome ?? 'Sistema automatizado' },
      { label: 'O quê', get: (e) => eventoLabel(e.tipo) },
      { label: 'Detalhe', get: (e) => e.detalhe ?? '' },
      { label: 'Onde', get: (e) => areaName(e.areaId) },
      { label: 'Unidade', get: (e) => unitName(e.unidade) },
      { label: 'PET', get: (e) => pet(e.petId)?.codigo ?? '' },
    ])).then((ok) => {
      if (ok) toast('Trilha exportada', `${rows.length} eventos exportados para auditoria.`, 'ok');
    });
  });

  return null;
}
