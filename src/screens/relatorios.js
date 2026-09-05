/**
 * PET CONTROL — Relatórios.
 * The payoff of digitalisation: numbers that were impossible to obtain from a
 * paper archive, available with filters and export in one screen.
 */

import { esc, nf, dtFull, ddmmyy, on, $, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { panel, kpi, empty, petBadge, selectBox } from '../ui/kit.js';
import { barChart, donut, hBars, legend, TONE, SERIES } from '../ui/charts.js';
import { toast } from '../ui/overlay.js';
import { state, emp, allow } from '../store.js';
import { reportData, seriePorDia, porTipo, porArea } from '../selectors.js';
import { UNITS, ALL_AREAS, ATIVIDADES, atividadeNome, areaName, unitName, PET_STATUS } from '../data/catalog.js';

const DAY = 86400000;
const f = { dias: 30, unidade: 'TODAS', areaId: 'TODAS', tipo: 'TODAS', empId: 'TODOS', status: 'TODOS' };

export function render() {
  const filtro = {
    de: Date.now() - f.dias * DAY, ate: Date.now(),
    unidade: f.unidade, areaId: f.areaId, tipo: f.tipo, empId: f.empId, status: f.status,
  };
  const r = reportData(filtro);
  const serie = seriePorDia(Math.min(f.dias, 30), { unidade: f.unidade });
  const tipos = porTipo(r.pets);
  const areas = porArea(r.pets).slice(0, 7);

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('report')} Gestão ${icon('chevR')} Relatórios</div>
        <h1>Relatórios operacionais</h1>
        <p class="lead">Indicadores consolidados do processo de permissão de trabalho — antes dispersos em arquivos físicos, agora consultáveis em segundos.</p>
      </div>
      <div class="acts">
        ${allow('report.export') ? `<button class="btn btn-outline" id="rp-csv">${icon('download')} CSV</button>
        <button class="btn btn-primary" id="rp-print">${icon('print')} Gerar relatório</button>` : '<span class="badge b-idle">Exportação exige nível Gestor</span>'}
      </div>
    </div>

    <section class="panel" style="margin-bottom:16px">
      <div class="toolbar">
        <span class="eyebrow" style="margin-right:4px">${icon('filter', 12)} Filtros</span>
        ${selectBox('rp-dias', [{ value: 7, label: 'Últimos 7 dias' }, { value: 15, label: 'Últimos 15 dias' },
          { value: 30, label: 'Últimos 30 dias' }, { value: 45, label: 'Últimos 45 dias' }], f.dias)}
        ${selectBox('rp-unidade', [{ value: 'TODAS', label: 'Todas as unidades' }, ...UNITS.map((u) => ({ value: u.id, label: u.nome }))], f.unidade)}
        ${selectBox('rp-area', [{ value: 'TODAS', label: 'Todas as áreas' }, ...ALL_AREAS.map((a) => ({ value: a.id, label: a.nome }))], f.areaId)}
        ${selectBox('rp-tipo', [{ value: 'TODAS', label: 'Todas as atividades' }, ...ATIVIDADES.map((a) => ({ value: a.id, label: a.nome }))], f.tipo)}
        ${selectBox('rp-emp', [{ value: 'TODOS', label: 'Todos os funcionários' },
          ...state.employees.slice(0, 45).map((e) => ({ value: e.id, label: e.nome }))], f.empId)}
        ${selectBox('rp-status', [{ value: 'TODOS', label: 'Todos os status' },
          ...Object.entries(PET_STATUS).map(([k, v]) => ({ value: k, label: v.label }))], f.status)}
        <div class="grow"></div>
        <button class="btn btn-sm btn-ghost" id="rp-clear">${icon('refresh')} Limpar</button>
      </div>
      <div class="panel-bd" style="padding:14px 20px;border-top:1px solid var(--line-soft)">
        <span style="font-size:11.5px;color:var(--tx-lo)">
          Período de <strong style="color:var(--tx-hi)">${esc(ddmmyy(r.periodo[0]))}</strong> a
          <strong style="color:var(--tx-hi)">${esc(ddmmyy(r.periodo[1]))}</strong> ·
          <strong style="color:var(--tx-hi)">${r.total}</strong> permissões no escopo selecionado
        </span>
      </div>
    </section>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Total de PETs', value: nf(r.total), ico: 'permit', color: 'var(--ac)', foot: `<span>${nf(r.ativas)} ativas no período</span>` })}
      ${kpi({ label: 'Aprovadas', value: nf(r.aprovadas), ico: 'shieldOk', color: 'var(--ok)', foot: `<span>${((r.aprovadas / (r.total || 1)) * 100).toFixed(0)}% de aprovação</span>` })}
      ${kpi({ label: 'Encerradas', value: nf(r.encerradas), ico: 'okCircle', color: 'var(--info)', foot: '<span>ciclo completo</span>' })}
      ${kpi({ label: 'Canceladas', value: nf(r.canceladas), ico: 'xCircle', color: 'var(--risk)', foot: `<span>${((r.canceladas / (r.total || 1)) * 100).toFixed(1)}% do total</span>` })}
      ${kpi({ label: 'Tempo médio de aprovação', value: r.tempoMedio.toFixed(0), unit: 'min', ico: 'clock', color: 'var(--warn)', foot: '<span>da emissão à liberação</span>' })}
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Alertas gerados', value: nf(r.alertas), ico: 'alert', color: 'var(--warn)', foot: `<span>${r.alertasCriticos} crítico(s)</span>` })}
      ${kpi({ label: 'Acessos registrados', value: nf(r.acessos), ico: 'scanface', color: 'var(--ac)', foot: '<span>identificações nas portarias</span>' })}
      ${kpi({ label: 'Acessos bloqueados', value: nf(r.bloqueios), ico: 'userX', color: 'var(--risk)', foot: `<span>${r.taxaBloqueio.toFixed(1)}% das tentativas</span>` })}
      ${kpi({ label: 'Duração média', value: r.duracaoMedia.toFixed(1), unit: 'h', ico: 'activity', color: 'var(--info)', foot: '<span>por atividade encerrada</span>' })}
      ${kpi({ label: 'Homem-hora', value: nf(r.horasHomem, 0), unit: 'h', ico: 'users', color: 'var(--ok)', foot: '<span>exposição controlada</span>' })}
    </div>

    <div class="grid g-main" style="margin-bottom:16px;align-items:start">
      ${panel({
        title: 'Emissão e liberação ao longo do período',
        actions: legend([{ color: SERIES[0], label: 'Emitidas' }, { color: TONE.ok, label: 'Liberadas' }, { color: TONE.risk, label: 'Canceladas' }]),
        body: barChart({
          h: 230, stacked: false,
          labels: serie.map((d) => new Date(d.ts).getDate().toString().padStart(2, '0')),
          series: [
            { name: 'Emitidas', data: serie.map((d) => d.total), color: SERIES[0] },
            { name: 'Liberadas', data: serie.map((d) => d.liberadas), color: TONE.ok },
            { name: 'Canceladas', data: serie.map((d) => d.canceladas), color: TONE.risk },
          ],
        }),
      })}
      ${panel({
        title: 'Composição por status',
        body: (() => {
          const counts = {};
          r.pets.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
          const items = Object.entries(counts).map(([k, v]) => ({
            label: PET_STATUS[k]?.label ?? k, value: v,
            color: { ATIVA: TONE.ok, EM_VALIDACAO: TONE.warn, LIBERADA: TONE.ac, SUSPENSA: TONE.risk, ENCERRADA: TONE.info, CANCELADA: TONE.idle, RASCUNHO: TONE.idle }[k] ?? TONE.idle,
          })).sort((a, b) => b.value - a.value);
          return `<div class="col g-4" style="align-items:center">
            ${donut({ items, size: 156, thickness: 14, centerTop: String(r.total), centerBottom: 'PERMISSÕES' })}
            <div style="width:100%">${items.map((i) => `<div class="row-b" style="padding:5px 0">
              <span class="row g-2" style="font-size:12px"><i style="width:8px;height:8px;border-radius:2px;background:${i.color};display:inline-block"></i>${esc(i.label)}</span>
              <span class="num" style="font-size:12.5px">${i.value}</span></div>`).join('')}</div>
          </div>`;
        })(),
      })}
    </div>

    <div class="grid g-2" style="margin-bottom:16px;align-items:start">
      ${panel({
        title: 'Permissões por tipo de atividade',
        body: tipos.length ? hBars({ items: tipos.map((t, i) => ({ label: atividadeNome(t.tipo), value: t.n, color: SERIES[i % SERIES.length] })) })
          : '<span class="t-lo" style="font-size:12px">Sem dados no período.</span>',
      })}
      ${panel({
        title: 'Áreas com maior volume',
        body: areas.length ? hBars({ items: areas.map((a) => ({ label: areaName(a.areaId), value: a.n, color: TONE.ac })) })
          : '<span class="t-lo" style="font-size:12px">Sem dados no período.</span>',
      })}
    </div>

    <section class="panel">
      <header class="panel-hd">
        <div><h3>Detalhamento das permissões</h3><div class="sub">${r.total} registros no filtro atual</div></div>
      </header>
      <div class="tbl-wrap">
        ${r.pets.length ? `<table class="tbl">
          <thead><tr><th>Código</th><th>Atividade</th><th>Área</th><th>Responsável</th><th>Equipe</th>
            <th>Aprovação</th><th>Duração</th><th class="right">Status</th></tr></thead>
          <tbody>${r.pets.slice(0, 60).map((p) => `<tr class="clickable" data-pet="${esc(p.id)}">
            <td class="mono" style="color:var(--ac);font-size:11.5px">${esc(p.codigo)}</td>
            <td>${esc(atividadeNome(p.tipo))}</td>
            <td>${esc(areaName(p.areaId))}</td>
            <td class="nowrap">${esc(emp(p.responsavelId)?.nome.split(' ').slice(0, 2).join(' ') ?? '—')}</td>
            <td class="num">${p.equipe.length}</td>
            <td class="mono" style="font-size:11.5px">${p.validadaEm ? `${Math.round((p.validadaEm - p.criadaEm) / 60000)} min` : '—'}</td>
            <td class="mono" style="font-size:11.5px">${p.iniciadaEm && p.encerradaEm ? `${((p.encerradaEm - p.iniciadaEm) / 3600000).toFixed(1)} h` : '—'}</td>
            <td class="right">${petBadge(p.status)}</td>
          </tr>`).join('')}</tbody>
        </table>` : empty('Nenhuma permissão no filtro', 'Amplie o período ou remova filtros.', 'report')}
      </div>
    </section>
  </div>`;
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

  const bind = (id, key, num = false) => $(id, root)?.addEventListener('change', (e) => {
    f[key] = num ? Number(e.target.value) : e.target.value;
    if (key === 'unidade') f.areaId = 'TODAS';
    repaint();
  });
  bind('#rp-dias', 'dias', true);
  bind('#rp-unidade', 'unidade');
  bind('#rp-area', 'areaId');
  bind('#rp-tipo', 'tipo');
  bind('#rp-emp', 'empId');
  bind('#rp-status', 'status');

  $('#rp-clear', root)?.addEventListener('click', () => {
    Object.assign(f, { dias: 30, unidade: 'TODAS', areaId: 'TODAS', tipo: 'TODAS', empId: 'TODOS', status: 'TODOS' });
    repaint();
    toast('Filtros limpos', 'Exibindo os últimos 30 dias de todas as unidades.', 'info', 2400);
  });

  on(page, 'click', '[data-pet]', (e, t) => { location.hash = `#/pets/${t.dataset.pet}`; });

  $('#rp-csv', root)?.addEventListener('click', () => {
    const r = reportData({ de: Date.now() - f.dias * DAY, ate: Date.now(), unidade: f.unidade, areaId: f.areaId, tipo: f.tipo, empId: f.empId, status: f.status });
    downloadText(`relatorio-pets-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(r.pets, [
      { label: 'Código', get: (p) => p.codigo },
      { label: 'Título', get: (p) => p.titulo },
      { label: 'Atividade', get: (p) => atividadeNome(p.tipo) },
      { label: 'Unidade', get: (p) => unitName(p.unidade) },
      { label: 'Área', get: (p) => areaName(p.areaId) },
      { label: 'Responsável', get: (p) => emp(p.responsavelId)?.nome ?? '' },
      { label: 'Equipe', get: (p) => p.equipe.length },
      { label: 'Status', get: (p) => PET_STATUS[p.status]?.label ?? p.status },
      { label: 'Criada em', get: (p) => dtFull(p.criadaEm) },
      { label: 'Aprovação (min)', get: (p) => (p.validadaEm ? Math.round((p.validadaEm - p.criadaEm) / 60000) : '') },
      { label: 'Duração (h)', get: (p) => (p.iniciadaEm && p.encerradaEm ? ((p.encerradaEm - p.iniciadaEm) / 3600000).toFixed(1) : '') },
    ]));
    toast('Relatório exportado', `${r.pets.length} permissões em CSV.`, 'ok');
  });

  $('#rp-print', root)?.addEventListener('click', () => {
    toast('Preparando impressão', 'O relatório será enviado ao diálogo de impressão.', 'info', 2000);
    setTimeout(() => window.print(), 400);
  });

  return null;
}
