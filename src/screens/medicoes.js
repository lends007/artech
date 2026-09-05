/**
 * PET CONTROL — Monitoramento de medições.
 * Continuous readings from the area detectors, with the acceptable band always
 * visible so "out of parameter" is obvious at a glance.
 */

import { esc, hhmm, dtFull, on, $, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { panel, kpi, empty, gaugeCard, medBadge, selectBox } from '../ui/kit.js';
import { areaChart, radial, TONE, legend } from '../ui/charts.js';
import { toast } from '../ui/overlay.js';
import { state, emp, pet } from '../store.js';
import { sensorsInScope, sensorSummary, petsInScope } from '../selectors.js';
import { PARAMS, classify, STATUS_MEDICAO, areaName, ALL_AREAS } from '../data/catalog.js';

const f = { area: 'TODAS', param: 'TODOS', foco: null };

export function render() {
  const sensores = sensorsInScope().filter((s) =>
    (f.area === 'TODAS' || s.areaId === f.area) && (f.param === 'TODOS' || s.param === f.param));
  const sum = sensorSummary();
  const foco = f.foco ? state.sensors[f.foco] : sensores[0];

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('gauge')} Monitoramento ${icon('chevR')} Medições</div>
        <h1>Monitoramento de medições</h1>
        <p class="lead">Leituras contínuas dos detectores instalados nas áreas, correlacionadas às permissões vigentes. Valores fora da faixa geram alerta automático.</p>
      </div>
      <div class="acts">
        <span class="badge ${sum.risk ? 'b-risk' : sum.warn ? 'b-warn' : 'b-ok'} badge-live"><i class="dot"></i>
          ${sum.risk ? `${sum.risk} fora do parâmetro` : sum.warn ? `${sum.warn} em atenção` : 'todas normais'}</span>
        <button class="btn btn-outline" id="md-export">${icon('download')} Exportar leituras</button>
      </div>
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Pontos monitorados', value: sum.total, ico: 'radio', color: 'var(--ac)', foot: '<span>detectores ativos</span>' })}
      ${kpi({ label: 'Dentro do parâmetro', value: sum.ok ?? 0, ico: 'okCircle', color: 'var(--ok)', foot: `<span>${(((sum.ok ?? 0) / (sum.total || 1)) * 100).toFixed(0)}% da malha</span>` })}
      ${kpi({ label: 'Em atenção', value: String(sum.warn ?? 0).padStart(2, '0'), ico: 'warnCircle', color: 'var(--warn)', foot: '<span>próximo do limite</span>' })}
      ${kpi({ label: 'Fora do parâmetro', value: String(sum.risk ?? 0).padStart(2, '0'), ico: 'alert', color: sum.risk ? 'var(--risk)' : 'var(--idle)', foot: `<span class="${sum.risk ? 't-risk' : ''}">ação imediata requerida</span>` })}
    </div>

    <section class="panel" style="margin-bottom:16px">
      <div class="toolbar">
        ${selectBox('md-area', [{ value: 'TODAS', label: 'Todas as áreas' }, ...ALL_AREAS.map((a) => ({ value: a.id, label: `${a.unidade} · ${a.nome}` }))], f.area)}
        ${selectBox('md-param', [{ value: 'TODOS', label: 'Todos os parâmetros' }, ...Object.values(PARAMS).map((p) => ({ value: p.id, label: p.nome }))], f.param)}
        <div class="grow"></div>
        <span class="mono" style="font-size:11px;color:var(--tx-dim)">${sensores.length} pontos · leitura a cada 5s</span>
      </div>
      <div class="panel-bd">
        ${sensores.length ? `<div class="grid g-auto">${sensores.map((s) => `
          <button data-focus="${esc(s.key)}" style="text-align:left;width:100%">
            ${gaugeCard(s.param, s.ultimo, { ts: s.serie[s.serie.length - 1]?.ts, live: true })}
            <div style="font-size:10.5px;color:var(--tx-dim);margin-top:6px;padding-left:2px">${icon('pin', 10)} ${esc(areaName(s.areaId))}</div>
          </button>`).join('')}</div>`
          : empty('Nenhum ponto monitorado', 'Ajuste os filtros de área ou parâmetro.', 'radio')}
      </div>
    </section>

    ${foco ? focoHTML(foco) : ''}

    ${historicoHTML()}
  </div>`;
}

/* ------------------------------------------------------------ */
function focoHTML(s) {
  const P = PARAMS[s.param];
  const st = classify(s.param, s.ultimo);
  const tone = st === 'risk' ? TONE.risk : st === 'warn' ? TONE.warn : TONE.ok;
  const data = s.serie.slice(-48);
  const petAtiva = petsInScope().find((p) => p.areaId === s.areaId && p.status === 'ATIVA');
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);

  return panel({
    title: `${P.nome} · ${areaName(s.areaId)}`,
    sub: `Série das últimas ${data.length} leituras · faixa aceitável ${P.min}–${P.max} ${P.unidade}`,
    actions: legend([
      { color: tone, label: 'Leitura' },
      { color: 'rgba(45,212,167,.35)', label: 'Faixa aceitável' },
    ]),
    cls: 'panel-rail',
    body: `<div class="grid g-focus" style="gap:20px">
      <div>
        ${areaChart({
          h: 210,
          series: [{ name: P.nome, data: vals, color: tone }],
          labels: data.map((d) => hhmm(d.ts)),
          yMin: Math.min(P.scaleMin, min - 1),
          yMax: Math.max(P.max + (P.max - P.min) * 0.15, max + 1),
          bands: [{ min: P.min, max: P.max, color: '#2DD4A7', opacity: .07, line: P.max }],
          yFmt: (v) => v.toFixed(P.dec),
        })}
      </div>
      <div class="col g-4" style="align-items:center">
        ${radial({ value: s.ultimo, min: P.scaleMin, max: P.scaleMax, safeMin: P.min, safeMax: P.max, tone, unit: P.unidade, label: P.nome })}
        <div style="width:100%">
          <div class="row-b" style="font-size:11.5px;padding:5px 0;border-bottom:1px solid var(--line-soft)">
            <span class="t-lo">Mínima</span><span class="num">${min.toFixed(P.dec)}</span></div>
          <div class="row-b" style="font-size:11.5px;padding:5px 0;border-bottom:1px solid var(--line-soft)">
            <span class="t-lo">Média</span><span class="num">${avg.toFixed(P.dec)}</span></div>
          <div class="row-b" style="font-size:11.5px;padding:5px 0">
            <span class="t-lo">Máxima</span><span class="num">${max.toFixed(P.dec)}</span></div>
        </div>
        ${petAtiva ? `<a class="btn btn-sm btn-outline btn-block" href="#/pets/${esc(petAtiva.id)}">${icon('permit')} ${esc(petAtiva.codigo)}</a>` : ''}
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------------ */
function historicoHTML() {
  const registros = state.pets.flatMap((p) => p.medicoes.map((m) => ({ ...m, p })))
    .sort((a, b) => b.ts - a.ts).slice(0, 40);

  return `<section class="panel" style="margin-top:16px">
    <header class="panel-hd"><div><h3>Histórico de medições registradas</h3>
      <div class="sub">Leituras vinculadas a permissões, com responsável identificado</div></div></header>
    <div class="tbl-wrap">
      ${registros.length ? `<table class="tbl">
        <thead><tr><th>Parâmetro</th><th>Valor</th><th>Faixa</th><th>Situação</th><th>PET</th><th>Área</th><th>Responsável</th><th class="right">Registro</th></tr></thead>
        <tbody>${registros.map((m) => {
          const P = PARAMS[m.param];
          const st = classify(m.param, m.valor);
          return `<tr class="clickable" data-pet="${esc(m.p.id)}">
            <td class="cell-hi"><span class="row g-2">${icon(P.icon, 13)} ${esc(P.nome)}</span></td>
            <td class="num">${m.valor}<span style="color:var(--tx-dim);font-size:10.5px"> ${esc(P.unidade)}</span></td>
            <td class="mono" style="font-size:11px;color:var(--tx-lo)">${P.min}–${P.max}</td>
            <td>${medBadge(st)}</td>
            <td class="mono" style="font-size:11.5px;color:var(--ac)">${esc(m.p.codigo)}</td>
            <td>${esc(areaName(m.p.areaId))}</td>
            <td>${esc(emp(m.byId)?.nome.split(' ').slice(0, 2).join(' ') ?? 'Sistema')}</td>
            <td class="right mono" style="font-size:11.5px">${esc(dtFull(m.ts))}</td>
          </tr>`;
        }).join('')}</tbody></table>` : empty('Nenhuma medição registrada', '', 'gauge')}
    </div>
  </section>`;
}

/* ------------------------------------------------------------ */
export function mount(root) {
  const page = root.querySelector('.page');
  if (!page) return null;

  const repaint = () => {
    if (document.querySelector('.overlay')) return;
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = render();
    mount(view);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  $('#md-area', root)?.addEventListener('change', (e) => { f.area = e.target.value; f.foco = null; repaint(); });
  $('#md-param', root)?.addEventListener('change', (e) => { f.param = e.target.value; f.foco = null; repaint(); });
  on(page, 'click', '[data-focus]', (e, t) => { f.foco = t.dataset.focus; repaint(); });
  on(page, 'click', '[data-pet]', (e, t) => { location.hash = `#/pets/${t.dataset.pet}`; });

  $('#md-export', root)?.addEventListener('click', () => {
    const rows = Object.values(state.sensors).flatMap((s) => s.serie.slice(-30).map((d) => ({ s, d })));
    downloadText(`medicoes-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Data/hora', get: (r) => dtFull(r.d.ts) },
      { label: 'Área', get: (r) => areaName(r.s.areaId) },
      { label: 'Parâmetro', get: (r) => PARAMS[r.s.param].nome },
      { label: 'Valor', get: (r) => String(r.d.v).replace('.', ',') },
      { label: 'Unidade', get: (r) => PARAMS[r.s.param].unidade },
      { label: 'Limite mín.', get: (r) => PARAMS[r.s.param].min },
      { label: 'Limite máx.', get: (r) => PARAMS[r.s.param].max },
      { label: 'Situação', get: (r) => STATUS_MEDICAO[classify(r.s.param, r.d.v)].label },
    ])).then((ok) => {
      if (ok) toast('Exportação concluída', `${rows.length} leituras exportadas.`, 'ok');
    });
  });

  const t = setInterval(() => {
    if (!location.hash.includes('medicoes')) return;
    repaint();
  }, 6000);
  return () => clearInterval(t);
}
