/**
 * PET CONTROL — Visão Operacional (dashboard).
 */

import { esc, nf, hhmm, dur, until, on } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, avatarStack, kpi, panel, petBadge, empty } from '../ui/kit.js';
import { areaChart, donut, spark, legend, hBars, TONE, SERIES } from '../ui/charts.js';
import { state, emp, allow, me } from '../store.js';
import { kpis, petsAtivas, petsValidacao, alertasAbertos, petsInScope, accessInScope, eventsInScope, sensorsInScope, sensorSummary, seriePorDia, porTipo, porArea, petProgress, petHealth, petChecklistDone } from '../selectors.js';
import { PET_STATUS, atividadeById, atividadeNome, areaName, PARAMS, classify, ALERTA_TIPOS, EVENTO, CHECKLIST } from '../data/catalog.js';

const MIN = 60000;

export function render() {
  const k = kpis();
  const ativas = petsAtivas();
  const validacao = petsValidacao();
  const alertas = alertasAbertos();
  const serie = seriePorDia(14, { unidade: state.ui.unidade });
  const u = me();

  return `<div class="page">
    ${header(k)}
    ${kpiRow(k, serie)}

    <div class="grid g-main" style="margin-top:16px">
      <div class="col g-4">
        ${liveActivities(ativas)}
        ${trendPanel(serie)}
      </div>
      <div class="col g-4">
        ${statusPanel()}
        ${validationQueue(validacao)}
        ${sensorPanel()}
      </div>
    </div>

    <div class="grid g-2" style="margin-top:16px;align-items:start">
      ${alertPanel(alertas)}
      ${accessPanel()}
    </div>

    <div class="grid g-2" style="margin-top:16px;align-items:start">
      ${distributionPanel()}
      ${auditPanel()}
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
function header(k) {
  const critico = k.alertasCriticos > 0;
  return `<div class="page-hd">
    <div>
      <div class="crumbs">${icon('dashboard')} Operação ${icon('chevR')} Tempo real</div>
      <h1>Visão operacional</h1>
      <p class="lead">
        Estado consolidado das permissões de entrada de trabalho, pessoas em área,
        condições ambientais e ocorrências — atualizado continuamente.
      </p>
    </div>
    <div class="acts">
      <span class="badge ${critico ? 'b-risk' : 'b-ok'} badge-live"><i class="dot"></i>${critico ? `${k.alertasCriticos} ocorrência(s) crítica(s)` : 'Operação estável'}</span>
      ${allow('pet.create') ? `<a class="btn btn-primary" href="#/pets/nova">${icon('plus')} Nova PET</a>` : ''}
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
function kpiRow(k, serie) {
  const sTotal = serie.map((d) => d.total);
  const sAl = serie.map((d) => d.alertas);
  return `<div class="grid g-kpi stagger">
    ${kpi({
      label: 'PETs ativas', value: nf(k.ativas), ico: 'permit', color: 'var(--ok)',
      foot: `<span class="kpi-delta t-ok">${icon('activity')} ${k.andamento} em execução</span>`,
      spark: spark({ data: sTotal, color: TONE.ok }),
    })}
    ${kpi({
      label: 'Pessoas em área', value: nf(k.pessoas), ico: 'users', color: 'var(--ac)',
      foot: `<span>${k.ativas} frentes de serviço monitoradas</span>`,
    })}
    ${kpi({
      label: 'PETs em validação', value: String(k.validacao).padStart(2, '0'), ico: 'checks', color: 'var(--warn)',
      foot: `<span>${k.liberadas} liberada(s) aguardando início</span>`,
    })}
    ${kpi({
      label: 'Alertas ativos', value: String(k.alertas).padStart(2, '0'), ico: 'alert',
      color: k.alertasCriticos ? 'var(--risk)' : 'var(--warn)',
      foot: `<span class="${k.alertasCriticos ? 't-risk' : ''}">${k.alertasCriticos} crítico(s) · ${k.alertas - k.alertasCriticos} atenção</span>`,
      spark: spark({ data: sAl, color: k.alertasCriticos ? TONE.risk : TONE.warn }),
    })}
    ${kpi({
      label: 'Atividades em andamento', value: String(k.andamento).padStart(2, '0'), ico: 'activity', color: 'var(--info)',
      foot: `<span>${k.suspensas} suspensa(s) por condição de risco</span>`,
    })}
  </div>`;
}

/* ------------------------------------------------------------ */
function liveActivities(ativas) {
  const body = ativas.length ? `<div class="feed">${ativas.slice(0, 8).map((p) => {
    const h = petHealth(p);
    const tone = h === 'risk' ? 'var(--risk)' : h === 'warn' ? 'var(--warn)' : 'var(--ok)';
    const pg = petProgress(p);
    const team = p.equipe.map((m) => emp(m.empId)).filter(Boolean);
    const ativ = atividadeById(p.tipo);
    return `<a class="feed-row" href="#/pets/${esc(p.id)}" style="align-items:center">
      <span class="feed-ico" style="color:${tone};border-color:${tone}33;background:${tone}12">${icon(ativ?.icon ?? 'permit')}</span>
      <div class="feed-bd">
        <div class="row-b g-3">
          <div class="row g-2 wrap">
            <span class="mono" style="font-size:11.5px;color:var(--ac)">${esc(p.codigo)}</span>
            <span class="feed-t">${esc(p.titulo)}</span>
          </div>
          ${petBadge(p.status, true)}
        </div>
        <div class="feed-s row g-3 wrap" style="margin-top:4px">
          <span>${icon('pin', 11)} ${esc(areaName(p.areaId))}</span>
          <span>${icon('clock', 11)} ${p.iniciadaEm ? esc(dur(p.iniciadaEm)) : '—'} em execução</span>
          <span>${icon('shield', 11)} ${esc(until(p.fimPrevisto))}</span>
        </div>
        <div class="progress" style="margin-top:8px"><i style="width:${pg.toFixed(0)}%;background:${tone}"></i></div>
      </div>
      <div class="col g-2" style="align-items:flex-end;flex:none">
        ${avatarStack(team, 3)}
        <span class="mono" style="font-size:10px;color:var(--tx-dim)">${team.length} pessoas</span>
      </div>
    </a>`;
  }).join('')}</div>` : empty('Nenhuma atividade em andamento', 'As PETs liberadas aparecerão aqui ao serem iniciadas.', 'activity');

  return panel({
    title: 'Atividades em tempo real',
    sub: `${ativas.length} permissão(ões) com execução em campo`,
    actions: `<span class="badge b-ok badge-live"><i class="dot"></i>ao vivo</span>
      <a class="btn btn-sm btn-outline" href="#/pets">${icon('ext')} Ver todas</a>`,
    body,
    flush: true,
  });
}

/* ------------------------------------------------------------ */
function trendPanel(serie) {
  const labels = serie.map((d) => new Date(d.ts).getDate().toString().padStart(2, '0'));
  return panel({
    title: 'Volume de permissões · 14 dias',
    sub: 'Emitidas, liberadas e alertas correlacionados',
    actions: legend([
      { color: SERIES[0], label: 'Emitidas' },
      { color: TONE.ok, label: 'Liberadas' },
      { color: TONE.warn, label: 'Alertas' },
    ]),
    body: areaChart({
      h: 196,
      labels,
      series: [
        { name: 'Emitidas', data: serie.map((d) => d.total), color: SERIES[0] },
        { name: 'Liberadas', data: serie.map((d) => d.liberadas), color: TONE.ok, fill: false },
        { name: 'Alertas', data: serie.map((d) => d.alertas), color: TONE.warn, fill: false },
      ],
    }),
  });
}

/* ------------------------------------------------------------ */
function statusPanel() {
  const pets = petsInScope();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const doDia = pets.filter((p) => p.criadaEm >= hoje.getTime());
  const counts = {};
  doDia.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
  const items = Object.entries(PET_STATUS)
    .filter(([k]) => counts[k])
    .map(([k, v]) => ({ label: v.label, value: counts[k], color: v.dot.replace('var(--', '').replace(')', '') }))
    .map((i) => ({ ...i, color: ({ ok: TONE.ok, warn: TONE.warn, risk: TONE.risk, ac: TONE.ac, info: TONE.info, idle: TONE.idle })[i.color] ?? TONE.idle }));

  return panel({
    title: 'Permissões emitidas hoje',
    sub: `${doDia.length} no total`,
    body: `<div class="row g-5" style="justify-content:center;flex-wrap:wrap">
      ${donut({ items, size: 138, thickness: 12, centerTop: String(doDia.length), centerBottom: 'PETS' })}
      <div class="col g-3 grow" style="min-width:150px">
        ${items.map((i) => `<div class="row-b">
          <span class="row g-2" style="font-size:12px;color:var(--tx)"><i style="width:8px;height:8px;border-radius:2px;background:${i.color};display:inline-block"></i>${esc(i.label)}</span>
          <span class="num" style="font-size:13px">${i.value}</span>
        </div>`).join('') || '<span class="t-lo" style="font-size:12px">Sem emissões no período.</span>'}
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------------ */
function validationQueue(fila) {
  const body = fila.length ? `<div class="feed">${fila.slice(0, 4).map((p) => {
    const done = petChecklistDone(p);
    const espera = Date.now() - p.criadaEm;
    return `<a class="feed-row" href="#/validacao/${esc(p.id)}">
      <span class="feed-ico" style="color:var(--warn);border-color:rgba(245,176,44,.28);background:rgba(245,176,44,.08)">${icon('checks')}</span>
      <div class="feed-bd">
        <div class="row g-2 wrap">
          <span class="mono" style="font-size:11px;color:var(--ac)">${esc(p.codigo)}</span>
          <span class="feed-t truncate">${esc(p.titulo)}</span>
        </div>
        <div class="feed-s">${esc(areaName(p.areaId))} · checklist ${done}/${CHECKLIST.length} · aguardando ${esc(dur(p.criadaEm))}</div>
      </div>
      <span class="badge ${espera > 30 * MIN ? 'b-risk' : 'b-warn'}">${espera > 30 * MIN ? 'atrasada' : 'na fila'}</span>
    </a>`;
  }).join('')}</div>` : empty('Fila de validação vazia', 'Nenhuma permissão aguardando aprovação.', 'okCircle');

  return panel({
    title: 'Fila de validação',
    sub: `${fila.length} aguardando aprovação`,
    actions: `<a class="btn btn-sm btn-outline" href="#/validacao">${icon('ext')} Abrir</a>`,
    body, flush: true,
  });
}

/* ------------------------------------------------------------ */
function sensorPanel() {
  const s = sensorsInScope().slice(0, 4);
  const sum = sensorSummary();
  return panel({
    title: 'Condições ambientais',
    sub: `${sum.total} pontos monitorados`,
    actions: `<div class="row g-2">
      <span class="badge b-ok">${sum.ok ?? 0}</span>
      <span class="badge b-warn">${sum.warn ?? 0}</span>
      <span class="badge b-risk">${sum.risk ?? 0}</span>
    </div>`,
    body: `<div class="col g-3">${s.map((x) => {
      const p = PARAMS[x.param];
      const st = classify(x.param, x.ultimo);
      const tone = st === 'risk' ? TONE.risk : st === 'warn' ? TONE.warn : TONE.ok;
      return `<div class="row g-3" style="align-items:center">
        <span style="color:${tone};display:flex;flex:none">${icon(p.icon, 15)}</span>
        <div class="grow" style="min-width:0">
          <div class="row-b">
            <span style="font-size:12px;color:var(--tx-hi)" class="truncate">${esc(p.nome)}</span>
            <span class="num" style="font-size:12.5px">${x.ultimo}<span style="color:var(--tx-dim);font-size:10px"> ${esc(p.unidade)}</span></span>
          </div>
          <div style="font-size:10.5px;color:var(--tx-dim);margin-top:2px">${esc(areaName(x.areaId))}</div>
        </div>
        <div style="flex:none">${spark({ data: x.serie.slice(-24).map((d) => d.v), color: tone, w: 62, h: 26 })}</div>
      </div>`;
    }).join('')}</div>`,
    footer: `<span class="t-lo" style="font-size:11.5px">Leitura contínua dos detectores de área</span>
      <a class="btn btn-sm btn-ghost" href="#/medicoes">Monitoramento ${icon('chevR')}</a>`,
  });
}

/* ------------------------------------------------------------ */
function alertPanel(alertas) {
  const body = alertas.length ? `<div class="feed">${alertas.slice(0, 5).map((a) => {
    const t = ALERTA_TIPOS[a.tipo] ?? ALERTA_TIPOS.SISTEMA;
    const tone = a.sev === 'risk' ? TONE.risk : a.sev === 'warn' ? TONE.warn : TONE.info;
    return `<a class="feed-row" href="#/alertas">
      <span class="feed-ico" style="color:${tone};border-color:${tone}33;background:${tone}12">${icon(t.icon)}</span>
      <div class="feed-bd">
        <div class="feed-t">${esc(a.titulo)}</div>
        <div class="feed-s truncate">${esc(a.descricao)}</div>
        <div class="row g-3 wrap" style="margin-top:5px;font-size:10.5px;color:var(--tx-dim)">
          <span>${icon('pin', 10)} ${esc(areaName(a.areaId))}</span>
          ${a.petId ? `<span class="mono">${esc(state.pets.find((p) => p.id === a.petId)?.codigo ?? '')}</span>` : ''}
        </div>
      </div>
      <span class="feed-time">${esc(hhmm(a.ts))}</span>
    </a>`;
  }).join('')}</div>` : empty('Nenhum alerta em aberto', 'Todas as ocorrências foram tratadas.', 'shieldOk');

  return panel({
    title: 'Central de alertas',
    sub: `${alertas.length} em aberto`,
    actions: `<a class="btn btn-sm btn-outline" href="#/alertas">${icon('ext')} Abrir</a>`,
    body, flush: true,
  });
}

/* ------------------------------------------------------------ */
function accessPanel() {
  const acc = accessInScope().slice(0, 5);
  const body = acc.length ? `<div class="feed">${acc.map((a) => {
    const e = emp(a.empId);
    const ok = a.resultado === 'LIBERADO';
    return `<a class="feed-row" href="#/acessos">
      ${e ? avatar(e, 'av-sm') : `<span class="feed-ico" style="color:var(--risk)">${icon('userX')}</span>`}
      <div class="feed-bd">
        <div class="row-b g-2">
          <span class="feed-t truncate">${esc(e?.nome ?? 'Não identificado')}</span>
          <span class="badge ${ok ? 'b-ok' : 'b-risk'}"><i class="dot"></i>${ok ? 'liberado' : 'bloqueado'}</span>
        </div>
        <div class="feed-s truncate">${esc(areaName(a.areaId))} · ${esc(a.motivo)}</div>
      </div>
      <span class="feed-time">${esc(hhmm(a.ts))}</span>
    </a>`;
  }).join('')}</div>` : empty('Sem movimentações registradas', '', 'scanface');

  return panel({
    title: 'Controle de acesso',
    sub: 'Últimas identificações nas portarias',
    actions: `<a class="btn btn-sm btn-outline" href="#/acessos">${icon('scanface')} Simular</a>`,
    body, flush: true,
  });
}

/* ------------------------------------------------------------ */
function distributionPanel() {
  const pets = petsInScope().filter((p) => Date.now() - p.criadaEm < 30 * 86400000);
  const tipos = porTipo(pets).slice(0, 6);
  const areas = porArea(pets.filter((p) => ['ATIVA', 'LIBERADA', 'EM_VALIDACAO'].includes(p.status))).slice(0, 5);

  return panel({
    title: 'Distribuição por tipo de atividade',
    sub: 'Últimos 30 dias',
    body: `<div class="grid g-2" style="gap:24px">
      <div>${hBars({
        items: tipos.map((t, i) => ({ label: atividadeNome(t.tipo), value: t.n, color: SERIES[i % SERIES.length] })),
      })}</div>
      <div>
        <div class="eyebrow" style="margin-bottom:12px">Áreas com atividade vigente</div>
        ${areas.length ? hBars({
          items: areas.map((a) => ({ label: areaName(a.areaId), value: a.n, color: TONE.ac })),
        }) : '<span class="t-lo" style="font-size:12px">Nenhuma atividade vigente.</span>'}
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------------ */
function auditPanel() {
  const ev = eventsInScope().slice(0, 7);
  return panel({
    title: 'Trilha de auditoria',
    sub: 'Registro imutável das últimas operações',
    actions: `<a class="btn btn-sm btn-outline" href="#/rastreabilidade">${icon('trace')} Rastreabilidade</a>`,
    body: `<ul class="tl">${ev.map((e) => {
      const meta = EVENTO[e.tipo] ?? { label: e.tipo, tone: '' };
      const ator = e.atorId ? emp(e.atorId)?.nome : null;
      return `<li class="tl-item ${meta.tone}">
        <div class="row g-2" style="align-items:baseline">
          <span class="tl-t">${esc(meta.label)}</span>
          <span class="tl-time">${esc(hhmm(e.ts))}</span>
        </div>
        <div class="tl-meta">
          <span>${esc(ator ?? 'Sistema')}</span>
          ${e.areaId ? `<span>${esc(areaName(e.areaId))}</span>` : ''}
          ${e.detalhe ? `<span class="truncate" style="max-width:340px">${esc(e.detalhe)}</span>` : ''}
        </div>
      </li>`;
    }).join('')}</ul>`,
  });
}

/* ------------------------------------------------------------ */
export function mount() {
  /* The operations centre keeps breathing: re-render on the simulation tick.
     The router calls the returned disposer when the user navigates away. */
  const isHere = () => {
    const h = location.hash.replace(/^#\/?/, '');
    return h === '' || h.startsWith('dashboard');
  };
  const t = setInterval(() => {
    if (!isHere() || document.querySelector('.overlay')) return;
    const view = document.querySelector('#view');
    const main = document.querySelector('#main');
    if (!view) return;
    const scroll = main?.scrollTop ?? 0;
    view.innerHTML = render();
    if (main) main.scrollTop = scroll;
  }, 6000);
  return () => clearInterval(t);
}
