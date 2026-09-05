/**
 * PET CONTROL — Central de alertas.
 */

import { esc, dtFull, ago, matches, on, $, debounce, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { panel, kpi, empty, sevBadge, searchBox, selectBox } from '../ui/kit.js';
import { barChart, TONE } from '../ui/charts.js';
import { toast, confirm } from '../ui/overlay.js';
import { state, emp, pet, allow, ackAlert, resolveAlert, me } from '../store.js';
import { alertsInScope, seriePorDia } from '../selectors.js';
import { ALERTA_TIPOS, SEV, areaName, unitName } from '../data/catalog.js';

const f = { q: '', sev: 'TODAS', status: 'ABERTOS', tipo: 'TODOS' };

export function render() {
  const all = alertsInScope();
  const rows = filtered();
  const abertos = all.filter((a) => a.status !== 'RESOLVIDO');
  const serie = seriePorDia(14, { unidade: state.ui.unidade });

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('alert')} Monitoramento ${icon('chevR')} Alertas</div>
        <h1>Central de alertas</h1>
        <p class="lead">Ocorrências geradas automaticamente por acessos negados, medições fora do parâmetro, permissões vencendo e pendências cadastrais.</p>
      </div>
      <div class="acts">
        <button class="btn btn-outline" id="al-export">${icon('download')} Exportar</button>
        ${allow('alert.ack') && abertos.length ? `<button class="btn btn-primary" id="al-all">${icon('checks')} Tratar todos</button>` : ''}
      </div>
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Em aberto', value: String(abertos.length).padStart(2, '0'), ico: 'alert', color: abertos.length ? 'var(--warn)' : 'var(--ok)', foot: '<span>aguardando tratativa</span>' })}
      ${kpi({ label: 'Críticos', value: String(abertos.filter((a) => a.sev === 'risk').length).padStart(2, '0'), ico: 'xCircle', color: 'var(--risk)', foot: '<span>ação imediata</span>' })}
      ${kpi({ label: 'Atenção', value: String(abertos.filter((a) => a.sev === 'warn').length).padStart(2, '0'), ico: 'warnCircle', color: 'var(--warn)', foot: '<span>monitorar condição</span>' })}
      ${kpi({ label: 'Resolvidos (30d)', value: all.filter((a) => a.status === 'RESOLVIDO').length, ico: 'okCircle', color: 'var(--ok)', foot: '<span>tratativas concluídas</span>' })}
    </div>

    <div class="grid g-side" style="align-items:start">
      <section class="panel">
        <div class="toolbar">
          ${searchBox('al-q', 'Buscar por título, descrição, área ou PET…', f.q)}
          ${selectBox('al-status', [{ value: 'ABERTOS', label: 'Em aberto' }, { value: 'TODOS', label: 'Todos' }, { value: 'RESOLVIDO', label: 'Resolvidos' }], f.status)}
          ${selectBox('al-sev', [{ value: 'TODAS', label: 'Todas as severidades' }, { value: 'risk', label: 'Crítico' }, { value: 'warn', label: 'Atenção' }, { value: 'info', label: 'Informativo' }], f.sev)}
          ${selectBox('al-tipo', [{ value: 'TODOS', label: 'Todos os tipos' }, ...Object.entries(ALERTA_TIPOS).map(([k, v]) => ({ value: k, label: v.label }))], f.tipo)}
          <div class="grow"></div>
          <span class="mono" style="font-size:11px;color:var(--tx-dim)">${rows.length}</span>
        </div>
        <div class="col g-2" style="padding:14px">
          ${rows.length ? rows.slice(0, 50).map(cardHTML).join('') : empty('Nenhum alerta', 'Nenhuma ocorrência corresponde aos filtros.', 'shieldOk')}
        </div>
      </section>

      <div class="col g-4">
        ${panel({
          title: 'Ocorrências por dia',
          sub: 'Últimos 14 dias',
          body: barChart({
            h: 168,
            labels: serie.map((d) => new Date(d.ts).getDate().toString().padStart(2, '0')),
            series: [{ name: 'Alertas', data: serie.map((d) => d.alertas), color: TONE.warn }],
          }),
        })}
        ${panel({
          title: 'Distribuição por tipo',
          body: `<div class="col g-3">${Object.entries(ALERTA_TIPOS).map(([k, v]) => {
            const n = all.filter((a) => a.tipo === k).length;
            if (!n) return '';
            const tone = v.sev === 'risk' ? TONE.risk : v.sev === 'warn' ? TONE.warn : TONE.info;
            return `<div>
              <div class="row-b" style="margin-bottom:5px">
                <span class="row g-2" style="font-size:12px;color:var(--tx)">
                  <span style="color:${tone};display:flex">${icon(v.icon, 13)}</span>${esc(v.label)}</span>
                <span class="num" style="font-size:12px">${n}</span>
              </div>
              <div class="progress"><i style="width:${((n / all.length) * 100).toFixed(0)}%;background:${tone}"></i></div>
            </div>`;
          }).join('')}</div>`,
        })}
      </div>
    </div>
  </div>`;
}

function filtered() {
  return alertsInScope().filter((a) => {
    if (f.status === 'ABERTOS' && a.status === 'RESOLVIDO') return false;
    if (f.status === 'RESOLVIDO' && a.status !== 'RESOLVIDO') return false;
    if (f.sev !== 'TODAS' && a.sev !== f.sev) return false;
    if (f.tipo !== 'TODOS' && a.tipo !== f.tipo) return false;
    return matches(f.q, a.titulo, a.descricao, areaName(a.areaId), pet(a.petId)?.codigo ?? '');
  });
}

function cardHTML(a) {
  const t = ALERTA_TIPOS[a.tipo] ?? ALERTA_TIPOS.SISTEMA;
  const tone = a.sev === 'risk' ? 'risk' : a.sev === 'warn' ? 'warn' : 'info';
  const c = `var(--${tone})`;
  const p = pet(a.petId);
  const e = emp(a.empId);
  const resolvido = a.status === 'RESOLVIDO';

  return `<article class="panel panel-flat" style="padding:14px 16px;border-left:2px solid ${resolvido ? 'var(--line-strong)' : c};${resolvido ? 'opacity:.62' : ''}">
    <div class="row-b wrap g-3" style="align-items:flex-start">
      <div class="row g-3" style="align-items:flex-start;min-width:0">
        <span class="feed-ico" style="color:${c};border-color:${c}33;background:${c}12">${icon(t.icon)}</span>
        <div style="min-width:0">
          <div class="row g-2 wrap">
            <span style="font-size:13px;font-weight:600;color:var(--tx-hi)">${esc(a.titulo)}</span>
            ${sevBadge(a.sev)}
            ${a.status === 'EM_TRATATIVA' ? '<span class="badge b-info">em tratativa</span>' : ''}
            ${resolvido ? '<span class="badge b-ok"><i class="dot"></i>resolvido</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--tx-lo);margin-top:5px;line-height:1.55">${esc(a.descricao)}</div>
          <div class="row g-4 wrap" style="margin-top:9px;font-size:11px;color:var(--tx-dim)">
            <span>${icon('clock', 11)} ${esc(dtFull(a.ts))} · ${esc(ago(a.ts))}</span>
            <span>${icon('pin', 11)} ${esc(areaName(a.areaId))} · ${esc(unitName(a.unidade))}</span>
            <span>${icon('layers', 11)} ${esc(t.label)}</span>
            ${p ? `<a href="#/pets/${esc(p.id)}" class="mono" style="color:var(--ac)">${icon('permit', 11)} ${esc(p.codigo)}</a>` : ''}
            ${e ? `<span>${icon('users', 11)} ${esc(e.nome)}</span>` : ''}
          </div>
          ${resolvido && a.resolvidoEm ? `<div style="font-size:11px;color:var(--tx-dim);margin-top:7px">
            Tratado por ${esc(emp(a.resolvidoPorId)?.nome ?? 'Sistema')} em ${esc(dtFull(a.resolvidoEm))}</div>` : ''}
        </div>
      </div>
      ${!resolvido && allow('alert.ack') ? `<div class="row g-2" style="flex:none">
        ${a.status === 'ABERTO' ? `<button class="btn btn-sm btn-outline" data-ack="${esc(a.id)}">${icon('eye')} Assumir</button>` : ''}
        <button class="btn btn-sm btn-ok" data-res="${esc(a.id)}">${icon('check')} Tratar</button>
      </div>` : ''}
    </div>
  </article>`;
}

/* ------------------------------------------------------------ */
export function mount(root) {
  const page = root.querySelector('.page');
  if (!page) return null;

  const repaint = () => {
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = render();
    mount(view);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  $('#al-q', root)?.addEventListener('input', debounce((e) => {
    f.q = e.target.value; repaint();
    const el = $('#al-q'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length);
  }, 240));
  ['status', 'sev', 'tipo'].forEach((k) => {
    $(`#al-${k}`, root)?.addEventListener('change', (e) => { f[k] = e.target.value; repaint(); });
  });

  on(page, 'click', '[data-ack]', (e, t) => {
    ackAlert(t.dataset.ack);
    toast('Alerta assumido', `Tratativa iniciada por ${me()?.nome.split(' ')[0]}.`, 'info');
    repaint();
  });
  on(page, 'click', '[data-res]', (e, t) => {
    resolveAlert(t.dataset.res);
    toast('Alerta tratado', 'A conclusão foi registrada na trilha de auditoria.', 'ok');
    repaint();
  });

  $('#al-all', root)?.addEventListener('click', () => {
    const abertos = alertsInScope().filter((a) => a.status !== 'RESOLVIDO');
    confirm({
      title: 'Tratar todos os alertas',
      confirmLabel: `Tratar ${abertos.length}`,
      message: `${abertos.length} ocorrência(s) serão marcadas como tratadas em seu nome. Cada tratativa é registrada individualmente na auditoria.`,
      onConfirm: () => {
        abertos.forEach((a) => resolveAlert(a.id));
        toast('Alertas tratados', `${abertos.length} ocorrências concluídas.`, 'ok');
        repaint();
      },
    });
  });

  $('#al-export', root)?.addEventListener('click', () => {
    const rows = filtered();
    downloadText(`alertas-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Data/hora', get: (a) => dtFull(a.ts) },
      { label: 'Tipo', get: (a) => ALERTA_TIPOS[a.tipo]?.label ?? a.tipo },
      { label: 'Severidade', get: (a) => SEV[a.sev]?.label ?? a.sev },
      { label: 'Título', get: (a) => a.titulo },
      { label: 'Descrição', get: (a) => a.descricao },
      { label: 'Área', get: (a) => areaName(a.areaId) },
      { label: 'Unidade', get: (a) => unitName(a.unidade) },
      { label: 'PET', get: (a) => pet(a.petId)?.codigo ?? '' },
      { label: 'Status', get: (a) => a.status },
      { label: 'Tratado por', get: (a) => emp(a.resolvidoPorId)?.nome ?? '' },
    ]));
    toast('Exportação concluída', `${rows.length} alertas exportados.`, 'ok');
  });

  return null;
}
