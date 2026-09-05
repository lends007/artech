/**
 * PET CONTROL — Permissões de Entrada de Trabalho: listagem e detalhe.
 */

import { esc, ago, hhmm, dtFull, dur, until, matches, on, $, $$, debounce, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, avatarStack, panel, petBadge, empty, gaugeCard, medBadge, levelTag, empStatusBadge, searchBox, selectBox } from '../ui/kit.js';
import { toast, modal, confirm, close as closeOverlay } from '../ui/overlay.js';
import { emp, pet, allow, startPet, closePet, cancelPet, suspendPet, resumePet, registerMeasurement } from '../store.js';
import { petsInScope, petProgress, petHealth, petReadings, petChecklistDone, timelineOf } from '../selectors.js';
import { PET_STATUS, ATIVIDADES, atividadeById, atividadeNome, areaName, unitName, PARAMS, classify, RISCOS, riscoNome, epiNome, CHECKLIST, EVENTO, UNITS } from '../data/catalog.js';
import * as form from './pet-form.js';

/* ============================================================
   ROUTER ENTRY
   ============================================================ */
export function render(params = []) {
  const [sub] = params;
  if (sub === 'nova') return form.render();
  if (sub) return detail(sub);
  return list();
}

export function mount(root, params = []) {
  const [sub] = params;
  if (sub === 'nova') return form.mount(root);
  if (sub) return mountDetail(root, sub);
  return mountList(root);
}

/* ============================================================
   LIST
   ============================================================ */
const filtro = { q: '', status: 'TODOS', tipo: 'TODAS', area: 'TODAS' };

function filtered() {
  return petsInScope().filter((p) => {
    if (filtro.status !== 'TODOS' && p.status !== filtro.status) return false;
    if (filtro.tipo !== 'TODAS' && p.tipo !== filtro.tipo) return false;
    if (filtro.area !== 'TODAS' && p.areaId !== filtro.area) return false;
    return matches(filtro.q, p.codigo, p.titulo, areaName(p.areaId), atividadeNome(p.tipo), emp(p.responsavelId)?.nome ?? '');
  }).sort((a, b) => {
    const rank = { ATIVA: 0, EM_VALIDACAO: 1, LIBERADA: 2, SUSPENSA: 3, RASCUNHO: 4, ENCERRADA: 5, CANCELADA: 6 };
    return (rank[a.status] - rank[b.status]) || (b.criadaEm - a.criadaEm);
  });
}

function list() {
  const all = petsInScope();
  const rows = filtered();
  const c = (s) => all.filter((p) => p.status === s).length;

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('permit')} Operação ${icon('chevR')} Permissões</div>
        <h1>Permissões de Entrada de Trabalho</h1>
        <p class="lead">Emissão, acompanhamento e encerramento das PETs — substituindo o formulário físico por um registro digital rastreável.</p>
      </div>
      <div class="acts">
        <button class="btn btn-outline" id="pt-export">${icon('download')} Exportar CSV</button>
        ${allow('pet.create') ? `<a class="btn btn-primary" href="#/pets/nova">${icon('plus')} Nova PET</a>` : ''}
      </div>
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${[['ATIVA', 'Ativas', 'var(--ok)'], ['EM_VALIDACAO', 'Em validação', 'var(--warn)'], ['LIBERADA', 'Liberadas', 'var(--ac)'],
         ['SUSPENSA', 'Suspensas', 'var(--risk)'], ['ENCERRADA', 'Encerradas', 'var(--info)']]
        .map(([k, label, color]) => `<button class="kpi" style="--kpi-c:${color};text-align:left" data-fstatus="${k}">
          <div class="kpi-top"><span class="kpi-lbl">${label}</span>
          <span class="kpi-ico">${icon(PET_STATUS[k] ? 'permit' : 'permit')}</span></div>
          <div class="kpi-val">${String(c(k)).padStart(2, '0')}</div>
          <div class="kpi-ft"><span>clique para filtrar</span></div>
        </button>`).join('')}
    </div>

    <section class="panel">
      <div class="toolbar">
        ${searchBox('pt-q', 'Buscar por código, título, área ou responsável…', filtro.q)}
        ${selectBox('pt-status', [{ value: 'TODOS', label: 'Todos os status' },
          ...Object.entries(PET_STATUS).map(([k, v]) => ({ value: k, label: v.label }))], filtro.status)}
        ${selectBox('pt-tipo', [{ value: 'TODAS', label: 'Todas as atividades' },
          ...ATIVIDADES.map((a) => ({ value: a.id, label: a.nome }))], filtro.tipo)}
        ${selectBox('pt-area', [{ value: 'TODAS', label: 'Todas as áreas' },
          ...UNITS.flatMap((u) => u.areas.map((a) => ({ value: a.id, label: `${u.sigla} · ${a.nome}` })))], filtro.area)}
        <div class="grow"></div>
        <span class="mono" style="font-size:11px;color:var(--tx-dim)">${rows.length} de ${all.length}</span>
      </div>

      <div class="tbl-wrap">
        ${rows.length ? `<table class="tbl">
          <thead><tr>
            <th>Permissão</th><th>Atividade</th><th>Local</th><th>Equipe</th>
            <th>Responsável</th><th>Condição</th><th>Status</th><th class="right">Validade</th>
          </tr></thead>
          <tbody>${rows.slice(0, 120).map(rowHTML).join('')}</tbody>
        </table>` : empty('Nenhuma permissão encontrada', 'Ajuste os filtros ou emita uma nova PET.', 'permit')}
      </div>
    </section>
  </div>`;
}

function rowHTML(p) {
  const team = p.equipe.map((m) => emp(m.empId)).filter(Boolean);
  const h = petHealth(p);
  const ativ = atividadeById(p.tipo);
  const resp = emp(p.responsavelId);
  const tone = h === 'risk' ? 'risk' : h === 'warn' ? 'warn' : 'ok';
  const vencida = p.fimPrevisto < Date.now() && ['ATIVA', 'LIBERADA'].includes(p.status);

  return `<tr class="clickable" data-pet="${esc(p.id)}">
    <td>
      <div class="mono cell-hi" style="font-size:12px;color:var(--ac)">${esc(p.codigo)}</div>
      <div class="truncate" style="max-width:250px;font-size:11.5px;color:var(--tx-lo);margin-top:2px">${esc(p.titulo)}</div>
    </td>
    <td><span class="row g-2" style="white-space:nowrap">${icon(ativ?.icon ?? 'permit', 13)} ${esc(atividadeNome(p.tipo))}</span></td>
    <td><div class="cell-hi">${esc(areaName(p.areaId))}</div><div style="font-size:11px;color:var(--tx-lo)">${esc(unitName(p.unidade))}</div></td>
    <td>${avatarStack(team, 3)}</td>
    <td class="nowrap">${esc(resp?.nome.split(' ').slice(0, 2).join(' ') ?? '—')}</td>
    <td><span class="badge b-${tone}"><i class="dot"></i>${tone === 'ok' ? 'normal' : tone === 'warn' ? 'atenção' : 'risco'}</span></td>
    <td>${petBadge(p.status, true)}</td>
    <td class="right nowrap">
      <span class="mono" style="font-size:11.5px;color:${vencida ? 'var(--risk)' : 'var(--tx-mid)'}">${esc(until(p.fimPrevisto))}</span>
    </td>
  </tr>`;
}

function mountList(root) {
  const page = root.querySelector('.page');
  if (!page) return null;
  const rerender = () => {
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = list();
    mountList(view);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  const q = $('#pt-q', root);
  q?.addEventListener('input', debounce((e) => { filtro.q = e.target.value; rerender(); $('#pt-q')?.focus(); }, 240));
  $('#pt-status', root)?.addEventListener('change', (e) => { filtro.status = e.target.value; rerender(); });
  $('#pt-tipo', root)?.addEventListener('change', (e) => { filtro.tipo = e.target.value; rerender(); });
  $('#pt-area', root)?.addEventListener('change', (e) => { filtro.area = e.target.value; rerender(); });

  on(page, 'click', '[data-fstatus]', (e, t) => {
    filtro.status = filtro.status === t.dataset.fstatus ? 'TODOS' : t.dataset.fstatus;
    rerender();
  });
  on(page, 'click', '[data-pet]', (e, t) => { location.hash = `#/pets/${t.dataset.pet}`; });

  $('#pt-export', root)?.addEventListener('click', () => {
    const rows = filtered();
    downloadText(`pets-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Código', get: (p) => p.codigo },
      { label: 'Título', get: (p) => p.titulo },
      { label: 'Atividade', get: (p) => atividadeNome(p.tipo) },
      { label: 'Unidade', get: (p) => unitName(p.unidade) },
      { label: 'Área', get: (p) => areaName(p.areaId) },
      { label: 'Local', get: (p) => p.local },
      { label: 'Responsável', get: (p) => emp(p.responsavelId)?.nome ?? '' },
      { label: 'Equipe', get: (p) => p.equipe.length },
      { label: 'Status', get: (p) => PET_STATUS[p.status]?.label ?? p.status },
      { label: 'Criada em', get: (p) => dtFull(p.criadaEm) },
      { label: 'Validada em', get: (p) => (p.validadaEm ? dtFull(p.validadaEm) : '') },
      { label: 'Encerrada em', get: (p) => (p.encerradaEm ? dtFull(p.encerradaEm) : '') },
    ])).then((ok) => {
      if (ok) toast('Exportação concluída', `${rows.length} permissões exportadas em CSV.`, 'ok');
    });
  });
  return null;
}

/* ============================================================
   DETAIL
   ============================================================ */
let tab = 'resumo';

function detail(id) {
  const p = pet(id);
  if (!p) return `<div class="page">${empty('Permissão não encontrada', 'O código informado não existe nesta base.', 'permit')}</div>`;

  const ativ = atividadeById(p.tipo);
  const resp = emp(p.responsavelId);
  const h = petHealth(p);
  const done = petChecklistDone(p);
  const readings = petReadings(p);
  const fora = readings.filter((r) => classify(r.param, r.valor) === 'risk');

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">
          <a href="#/pets" style="color:var(--tx-dim)">Permissões</a> ${icon('chevR')} ${esc(p.codigo)}
        </div>
        <div class="row g-3 wrap" style="margin-top:4px">
          <h1>${esc(p.titulo)}</h1>
          ${petBadge(p.status, true)}
        </div>
        <p class="lead">
          ${icon('pin', 12)} ${esc(unitName(p.unidade))} · ${esc(areaName(p.areaId))} · ${esc(p.local)}
          &nbsp;·&nbsp; ${icon(ativ?.icon ?? 'permit', 12)} ${esc(atividadeNome(p.tipo))}
        </p>
      </div>
      <div class="acts">${actionsFor(p)}</div>
    </div>

    ${p.status === 'SUSPENSA' ? banner('risk', 'Atividade suspensa', p.suspensaMotivo ?? 'Condição de risco identificada em campo.') : ''}
    ${p.status === 'CANCELADA' ? banner('idle', 'Permissão cancelada', p.motivoCancelamento ?? '—') : ''}
    ${fora.length ? banner('warn', `${fora.length} medição(ões) fora do parâmetro`, fora.map((r) => `${PARAMS[r.param].nome}: ${r.valor} ${PARAMS[r.param].unidade}`).join(' · ')) : ''}
    ${p.fimPrevisto < Date.now() && ['ATIVA', 'LIBERADA'].includes(p.status) ? banner('risk', 'Permissão vencida', 'A validade expirou. Renove a PET ou encerre a atividade.') : ''}

    <div class="grid g-side" style="margin-top:4px">
      <div class="col g-4">
        <section class="panel">
          <div class="tabs" id="pd-tabs">
            ${[['resumo', 'Resumo'], ['equipe', `Equipe`, p.equipe.length], ['riscos', 'Riscos e medidas', p.riscos.length],
               ['medicoes', 'Medições', readings.length], ['recursos', 'Equipamentos'], ['checklist', `Checklist`, `${done}/${CHECKLIST.length}`],
               ['trilha', 'Rastreabilidade']]
              .map(([k, label, cnt]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${esc(label)}${cnt != null ? `<span class="cnt">${esc(String(cnt))}</span>` : ''}</button>`).join('')}
          </div>
          <div class="panel-bd" id="pd-pane">${paneFor(p, tab)}</div>
        </section>
      </div>

      <div class="col g-4">
        ${panel({
          title: 'Ficha da permissão',
          body: `<dl class="kv">
            <dt>Código</dt><dd class="mono" style="color:var(--ac)">${esc(p.codigo)}</dd>
            <dt>Atividade</dt><dd>${esc(atividadeNome(p.tipo))}</dd>
            <dt>Severidade</dt><dd>${ativ?.severidade === 'ALTA' ? '<span class="badge b-risk">Alta</span>' : '<span class="badge b-warn">Média</span>'}</dd>
            <dt>Responsável</dt><dd>${esc(resp?.nome ?? '—')}</dd>
            <dt>Solicitante</dt><dd>${esc(emp(p.solicitanteId)?.nome ?? '—')}</dd>
            <dt>Criada em</dt><dd class="mono">${esc(dtFull(p.criadaEm))}</dd>
            <dt>Validada em</dt><dd class="mono">${p.validadaEm ? esc(dtFull(p.validadaEm)) : '—'}</dd>
            <dt>Liberada em</dt><dd class="mono">${p.liberadaEm ? esc(dtFull(p.liberadaEm)) : '—'}</dd>
            <dt>Iniciada em</dt><dd class="mono">${p.iniciadaEm ? esc(dtFull(p.iniciadaEm)) : '—'}</dd>
            <dt>Validade</dt><dd class="mono">${esc(dtFull(p.fimPrevisto))}</dd>
            <dt>Encerrada em</dt><dd class="mono">${p.encerradaEm ? esc(dtFull(p.encerradaEm)) : '—'}</dd>
          </dl>`,
        })}

        ${p.status === 'ATIVA' ? panel({
          title: 'Execução',
          body: `<div class="row-b" style="margin-bottom:10px">
              <span class="eyebrow">Progresso da janela</span>
              <span class="num" style="font-size:13px">${petProgress(p).toFixed(0)}%</span>
            </div>
            <div class="progress"><i style="width:${petProgress(p).toFixed(0)}%;background:${h === 'risk' ? 'var(--risk)' : h === 'warn' ? 'var(--warn)' : 'var(--ok)'}"></i></div>
            <div class="row-b" style="margin-top:12px">
              <span style="font-size:11.5px;color:var(--tx-lo)">Em execução há</span>
              <span class="mono" style="font-size:12px;color:var(--tx-hi)">${esc(dur(p.iniciadaEm))}</span>
            </div>
            <div class="row-b" style="margin-top:6px">
              <span style="font-size:11.5px;color:var(--tx-lo)">Vencimento</span>
              <span class="mono" style="font-size:12px;color:${p.fimPrevisto < Date.now() ? 'var(--risk)' : 'var(--tx-hi)'}">${esc(until(p.fimPrevisto))}</span>
            </div>`,
        }) : ''}

        ${panel({
          title: 'Condição atual',
          body: readings.length ? `<div class="col g-3">${readings.map((r) =>
            gaugeCard(r.param, r.valor, { ts: r.ts, live: r.live, compact: true })).join('')}</div>`
            : '<span class="t-lo" style="font-size:12px">Nenhuma medição registrada.</span>',
        })}
      </div>
    </div>
  </div>`;
}

function banner(tone, title, text) {
  const c = { risk: 'var(--risk)', warn: 'var(--warn)', idle: 'var(--idle)', ok: 'var(--ok)' }[tone];
  return `<div class="panel" style="border-color:${c}44;background:linear-gradient(90deg, ${c}12, transparent 60%);margin-bottom:16px">
    <div class="panel-bd" style="padding:13px 18px">
      <div class="row g-3">
        <span style="color:${c};display:flex;flex:none">${icon(tone === 'ok' ? 'okCircle' : 'warnCircle', 17)}</span>
        <div>
          <div style="font-size:12.5px;font-weight:600;color:var(--tx-hi)">${esc(title)}</div>
          <div style="font-size:11.5px;color:var(--tx-lo);margin-top:2px">${esc(text)}</div>
        </div>
      </div>
    </div></div>`;
}

function actionsFor(p) {
  const a = [];
  if (p.status === 'EM_VALIDACAO') a.push(`<a class="btn btn-primary" href="#/validacao/${esc(p.id)}">${icon('checks')} Abrir validação</a>`);
  if (p.status === 'LIBERADA' && allow('pet.edit')) a.push(`<button class="btn btn-ok" data-act="start">${icon('play')} Iniciar atividade</button>`);
  if (p.status === 'ATIVA') {
    if (allow('med.register')) a.push(`<button class="btn btn-outline" data-act="med">${icon('gauge')} Registrar medição</button>`);
    if (allow('pet.edit')) a.push(`<button class="btn btn-warn" data-act="suspend">${icon('pause')} Suspender</button>`);
    if (allow('pet.close')) a.push(`<button class="btn btn-primary" data-act="close">${icon('stop')} Encerrar</button>`);
  }
  if (p.status === 'SUSPENSA' && allow('pet.edit')) a.push(`<button class="btn btn-ok" data-act="resume">${icon('play')} Retomar</button>`);
  if (['EM_VALIDACAO', 'LIBERADA', 'RASCUNHO'].includes(p.status) && allow('pet.cancel')) a.push(`<button class="btn btn-risk" data-act="cancel">${icon('xCircle')} Cancelar</button>`);
  a.push(`<button class="btn btn-outline" data-act="print">${icon('print')} Ficha</button>`);
  return a.join('');
}

/* ---------- tab panes ---------- */
function paneFor(p, key) {
  switch (key) {
    case 'equipe':   return paneEquipe(p);
    case 'riscos':   return paneRiscos(p);
    case 'medicoes': return paneMedicoes(p);
    case 'recursos': return paneRecursos(p);
    case 'checklist':return paneChecklist(p);
    case 'trilha':   return paneTrilha(p);
    default:         return paneResumo(p);
  }
}

function paneResumo(p) {
  const ativ = atividadeById(p.tipo);
  const team = p.equipe.map((m) => emp(m.empId)).filter(Boolean);
  const readings = petReadings(p);
  return `<div class="col g-5">
    <div class="grid g-4c" style="gap:1px;background:var(--line-soft);border:1px solid var(--line-soft);border-radius:8px;overflow:hidden">
      ${[['Equipe', `${p.equipe.length}`, 'pessoas'], ['Riscos', `${p.riscos.length}`, 'identificados'],
         ['Medidas', `${p.medidas.length}`, 'preventivas'], ['Medições', `${readings.length}`, 'parâmetros']]
        .map(([l, v, s]) => `<div style="background:var(--bg-inset);padding:14px 16px">
          <div class="eyebrow">${l}</div>
          <div class="num" style="font-size:22px;margin-top:5px">${v}</div>
          <div style="font-size:10.5px;color:var(--tx-dim)">${s}</div>
        </div>`).join('')}
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:10px">Escopo da atividade</div>
      <p style="font-size:13px;line-height:1.65;color:var(--tx)">
        ${esc(p.titulo)} — execução em <strong style="color:var(--tx-hi)">${esc(p.local)}</strong>,
        ${esc(areaName(p.areaId))} (${esc(unitName(p.unidade))}).
        Atividade classificada como <strong style="color:var(--tx-hi)">${esc(atividadeNome(p.tipo))}</strong>,
        severidade ${esc(ativ?.severidade ?? '—').toLowerCase()}, com validade de ${ativ?.validadeH ?? 8} horas a partir da liberação.
      </p>
      ${p.observacoes ? `<p style="font-size:12.5px;color:var(--tx-lo);margin-top:10px;padding-left:12px;border-left:2px solid var(--line-strong)">${esc(p.observacoes)}</p>` : ''}
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:10px">Equipe autorizada</div>
      <div class="row g-3 wrap">${team.map((e) => `<div class="chip" style="height:auto;padding:6px 10px">
        ${avatar(e, 'av-sm')}
        <span><span style="display:block;font-size:11.5px;color:var(--tx-hi)">${esc(e.nome)}</span>
        <span style="display:block;font-size:10px;color:var(--tx-dim)">${esc(p.equipe.find((m) => m.empId === e.id)?.papel ?? e.funcao)}</span></span>
      </div>`).join('')}</div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:10px">Condições monitoradas</div>
      <div class="grid g-auto">${readings.map((r) => gaugeCard(r.param, r.valor, { ts: r.ts, live: r.live })).join('') || '<span class="t-lo">—</span>'}</div>
    </div>
  </div>`;
}

function paneEquipe(p) {
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Colaborador</th><th>Papel na atividade</th><th>Função</th><th>Nível</th><th>Situação</th><th class="right">Último acesso</th></tr></thead>
    <tbody>${p.equipe.map((m) => {
      const e = emp(m.empId);
      if (!e) return '';
      return `<tr>
        <td><div class="row g-3">${avatar(e, 'av-sm')}<div><div class="cell-hi">${esc(e.nome)}</div>
          <div class="mono" style="font-size:10.5px;color:var(--tx-dim)">${esc(e.matricula)}</div></div></div></td>
        <td>${esc(m.papel)}</td>
        <td>${esc(e.funcao)}</td>
        <td>${levelTag(e.nivel)}</td>
        <td>${empStatusBadge(e.status)}</td>
        <td class="right mono" style="font-size:11.5px">${e.ultimoAcesso ? esc(ago(e.ultimoAcesso)) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function paneRiscos(p) {
  return `<div class="col g-5">
    <div>
      <div class="eyebrow" style="margin-bottom:10px">Riscos identificados</div>
      <div class="col g-2">${p.riscos.map((r) => {
        const R = RISCOS[r];
        const tone = R?.grau === 'ALTO' ? 'risk' : 'warn';
        return `<div class="panel panel-inset" style="padding:12px 14px">
          <div class="row-b">
            <span class="row g-2"><span style="color:var(--${tone});display:flex">${icon('alert', 14)}</span>
            <span style="font-size:12.5px;color:var(--tx-hi)">${esc(riscoNome(r))}</span></span>
            <span class="badge b-${tone}">${esc(R?.grau ?? '—')}</span>
          </div>
        </div>`;
      }).join('') || '<span class="t-lo">Nenhum risco registrado.</span>'}</div>
    </div>
    <div>
      <div class="eyebrow" style="margin-bottom:10px">Medidas preventivas definidas</div>
      <ul class="col g-2">${p.medidas.map((m) => `<li class="row g-2" style="font-size:12.5px;color:var(--tx);align-items:flex-start">
        <span style="color:var(--ok);display:flex;margin-top:2px">${icon('check', 13)}</span>${esc(m)}</li>`).join('') || '<span class="t-lo">—</span>'}</ul>
    </div>
  </div>`;
}

function paneMedicoes(p) {
  const hist = [...p.medicoes].sort((a, b) => b.ts - a.ts);
  const readings = petReadings(p);
  return `<div class="col g-5">
    <div>
      <div class="row-b" style="margin-bottom:12px">
        <div class="eyebrow">Leitura atual dos parâmetros</div>
        ${allow('med.register') && p.status === 'ATIVA' ? `<button class="btn btn-sm btn-outline" data-act="med">${icon('plus')} Nova medição</button>` : ''}
      </div>
      <div class="grid g-auto">${readings.map((r) => gaugeCard(r.param, r.valor, { ts: r.ts, live: r.live })).join('')}</div>
    </div>
    <div>
      <div class="eyebrow" style="margin-bottom:10px">Histórico de registros</div>
      <div class="tbl-wrap panel panel-inset"><table class="tbl">
        <thead><tr><th>Parâmetro</th><th>Valor</th><th>Faixa aceitável</th><th>Situação</th><th>Responsável</th><th class="right">Registro</th></tr></thead>
        <tbody>${hist.map((m) => {
          const P = PARAMS[m.param];
          const st = classify(m.param, m.valor);
          return `<tr>
            <td class="cell-hi"><span class="row g-2">${icon(P.icon, 13)} ${esc(P.nome)}</span></td>
            <td class="num">${m.valor} <span style="color:var(--tx-dim);font-size:10.5px">${esc(P.unidade)}</span></td>
            <td class="mono" style="font-size:11.5px;color:var(--tx-lo)">${P.min} – ${P.max} ${esc(P.unidade)}</td>
            <td>${medBadge(st)}</td>
            <td>${esc(emp(m.byId)?.nome ?? 'Sistema')}</td>
            <td class="right mono" style="font-size:11.5px">${esc(dtFull(m.ts))}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </div>
  </div>`;
}

function paneRecursos(p) {
  const block = (title, items, ico) => `<div>
    <div class="eyebrow" style="margin-bottom:10px">${title}</div>
    <div class="row g-2 wrap">${items.map((i) => `<span class="chip">${icon(ico, 12)} ${esc(i)}</span>`).join('') || '<span class="t-lo">—</span>'}</div>
  </div>`;
  return `<div class="col g-5">
    ${block('EPIs obrigatórios', p.epis.map(epiNome), 'helmet')}
    ${block('Equipamentos', p.equipamentos, 'cpu')}
    ${block('Ferramentas', p.ferramentas, 'sliders')}
  </div>`;
}

function paneChecklist(p) {
  return `<div class="col g-2">${CHECKLIST.map((c) => {
    const s = p.checklist?.[c.id];
    return `<div class="panel panel-inset" style="padding:12px 14px">
      <div class="row-b">
        <div class="row g-3">
          <span style="color:${s?.ok ? 'var(--ok)' : 'var(--tx-dim)'};display:flex">${icon(s?.ok ? 'okCircle' : 'xCircle', 16)}</span>
          <div>
            <div style="font-size:12.5px;color:var(--tx-hi)">${esc(c.label)}</div>
            <div style="font-size:10.5px;color:var(--tx-dim);margin-top:2px">${esc(c.grupo)}</div>
          </div>
        </div>
        <div style="text-align:right">
          ${s?.ok ? `<span class="badge b-ok">conferido</span>
            <div class="mono" style="font-size:10px;color:var(--tx-dim);margin-top:4px">${esc(emp(s.byId)?.nome.split(' ')[0] ?? '')} · ${esc(hhmm(s.ts))}</div>`
            : '<span class="badge b-idle">pendente</span>'}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function paneTrilha(p) {
  const ev = timelineOf(p.id);
  if (!ev.length) return empty('Sem eventos registrados', '', 'trace');
  return `<ul class="tl">${ev.map((e) => {
    const meta = EVENTO[e.tipo] ?? { label: e.tipo, tone: '' };
    return `<li class="tl-item ${meta.tone}">
      <div class="row g-2" style="align-items:baseline"><span class="tl-t">${esc(meta.label)}</span>
      <span class="tl-time">${esc(dtFull(e.ts))}</span></div>
      ${e.detalhe ? `<div style="font-size:12px;color:var(--tx);margin-top:3px">${esc(e.detalhe)}</div>` : ''}
      <div class="tl-meta"><span>${icon('userCheck', 11)} ${esc(e.atorId ? emp(e.atorId)?.nome ?? '—' : 'Sistema')}</span>
      <span>${icon('pin', 11)} ${esc(areaName(e.areaId))}</span></div>
    </li>`;
  }).join('')}</ul>`;
}

/* ---------- detail behaviour ---------- */
function mountDetail(root, id) {
  const p = pet(id);
  if (!p) return null;
  const page = root.querySelector('.page');
  if (!page) return null;

  const refresh = () => {
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = detail(id);
    mountDetail(view, id);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  on(page, 'click', '[data-tab]', (e, t) => {
    tab = t.dataset.tab;
    $$('#pd-tabs button', root).forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#pd-pane', root).innerHTML = paneFor(pet(id), tab);
  });

  on(page, 'click', '[data-act]', (e, t) => {
    const act = t.dataset.act;
    const cur = pet(id);
    if (act === 'start') {
      startPet(id);
      toast('Atividade iniciada', `${cur.codigo} — execução liberada em campo e registrada na trilha.`, 'ok');
      refresh();
    }
    if (act === 'suspend') {
      confirm({
        title: 'Suspender atividade', tone: 'warn', confirmLabel: 'Suspender', requireReason: true,
        message: `A execução de ${cur.codigo} será interrompida e a equipe deverá deixar a área. Informe o motivo.`,
        onConfirm: (motivo) => { suspendPet(id, motivo); toast('Atividade suspensa', 'A equipe deve ser evacuada da área.', 'warn'); refresh(); },
      });
    }
    if (act === 'resume') {
      confirm({
        title: 'Retomar atividade', confirmLabel: 'Retomar',
        message: 'Confirme que as condições foram normalizadas e as medições estão dentro dos parâmetros.',
        onConfirm: () => { resumePet(id); toast('Atividade retomada', 'Execução liberada novamente.', 'ok'); refresh(); },
      });
    }
    if (act === 'close') {
      confirm({
        title: 'Encerrar permissão', confirmLabel: 'Encerrar PET',
        message: `${cur.codigo} será encerrada, a área desmobilizada e o histórico arquivado digitalmente.`,
        onConfirm: () => { closePet(id); toast('PET encerrada', 'Documentação arquivada e disponível em Rastreabilidade.', 'ok'); refresh(); },
      });
    }
    if (act === 'cancel') {
      confirm({
        title: 'Cancelar permissão', tone: 'risk', confirmLabel: 'Cancelar PET', requireReason: true,
        message: `${cur.codigo} será cancelada. O motivo fica registrado na auditoria.`,
        onConfirm: (motivo) => { cancelPet(id, motivo); toast('PET cancelada', 'Registro mantido para auditoria.', 'warn'); refresh(); },
      });
    }
    if (act === 'med') openMeasureModal(cur, refresh);
    if (act === 'print') openFicha(cur);
  });

  return null;
}

/* ---------- measurement modal ---------- */
function openMeasureModal(p, done) {
  const ativ = atividadeById(p.tipo);
  const params = ativ?.params ?? Object.keys(PARAMS).slice(0, 4);
  modal({
    title: 'Registrar medição',
    sub: `${p.codigo} · ${areaName(p.areaId)}`,
    width: 560,
    body: `<div class="col g-4">
      <div class="field">
        <label for="md-p">Parâmetro</label>
        <select id="md-p" class="sel">${params.map((x) =>
          `<option value="${x}">${esc(PARAMS[x].nome)} (${esc(PARAMS[x].unidade)})</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="md-v">Valor lido</label>
        <input id="md-v" class="inp" type="number" step="0.1" placeholder="0,0">
        <span class="hint" id="md-hint"></span>
      </div>
      <div id="md-prev"></div>
    </div>`,
    footer: `<button class="btn" data-close>Cancelar</button>
      <button class="btn btn-primary" id="md-ok">${icon('check')} Registrar</button>`,
    onMount(root) {
      const sel = root.querySelector('#md-p');
      const inp = root.querySelector('#md-v');
      const hint = root.querySelector('#md-hint');
      const prev = root.querySelector('#md-prev');
      const sync = () => {
        const P = PARAMS[sel.value];
        hint.textContent = `Faixa aceitável: ${P.min} a ${P.max} ${P.unidade}`;
        if (!inp.value) { inp.value = P.ideal; }
        prev.innerHTML = gaugeCard(sel.value, Number(inp.value), {});
      };
      sel.addEventListener('change', () => { inp.value = PARAMS[sel.value].ideal; sync(); });
      inp.addEventListener('input', sync);
      sync();

      root.querySelector('#md-ok').addEventListener('click', () => {
        const v = Number(inp.value);
        if (Number.isNaN(v)) { inp.focus(); return; }
        const m = registerMeasurement(p.id, sel.value, v);
        closeOverlay();
        const st = classify(sel.value, v);
        toast(
          st === 'risk' ? 'Medição fora do parâmetro' : 'Medição registrada',
          st === 'risk' ? 'Alerta gerado automaticamente na central.' : `${PARAMS[sel.value].nome}: ${v} ${PARAMS[sel.value].unidade}.`,
          st === 'risk' ? 'risk' : 'ok');
        done?.();
      });
    },
  });
}

/* ---------- printable summary ---------- */
function openFicha(p) {
  const team = p.equipe.map((m) => emp(m.empId)).filter(Boolean);
  modal({
    title: `Ficha da permissão ${p.codigo}`,
    sub: 'Documento digital equivalente à via física',
    width: 720,
    body: `<div class="col g-4">
      ${['Identificação', 'Equipe', 'Riscos e medidas', 'Medições', 'Recursos', 'Validação'].map((sec, i) => {
        let inner = '';
        if (i === 0) inner = `<dl class="kv">
          <dt>Atividade</dt><dd>${esc(atividadeNome(p.tipo))}</dd>
          <dt>Local</dt><dd>${esc(p.local)} — ${esc(areaName(p.areaId))}, ${esc(unitName(p.unidade))}</dd>
          <dt>Responsável</dt><dd>${esc(emp(p.responsavelId)?.nome ?? '—')}</dd>
          <dt>Validade</dt><dd class="mono">${esc(dtFull(p.inicioPrevisto))} → ${esc(dtFull(p.fimPrevisto))}</dd></dl>`;
        if (i === 1) inner = team.map((e) => `<div class="row-b" style="padding:5px 0;border-bottom:1px solid var(--line-soft)">
          <span style="font-size:12.5px;color:var(--tx-hi)">${esc(e.nome)}</span>
          <span style="font-size:11.5px;color:var(--tx-lo)">${esc(e.funcao)} · ${esc(e.matricula)}</span></div>`).join('');
        if (i === 2) inner = `<div style="font-size:12.5px;line-height:1.7;color:var(--tx)">
          <strong style="color:var(--tx-hi)">Riscos:</strong> ${p.riscos.map(riscoNome).map(esc).join('; ')}<br>
          <strong style="color:var(--tx-hi)">Medidas:</strong> ${p.medidas.map(esc).join('; ')}</div>`;
        if (i === 3) inner = petReadings(p).map((r) => `<div class="row-b" style="padding:5px 0;border-bottom:1px solid var(--line-soft)">
          <span style="font-size:12.5px">${esc(PARAMS[r.param].nome)}</span>
          <span class="mono">${r.valor} ${esc(PARAMS[r.param].unidade)} ${medBadge(classify(r.param, r.valor))}</span></div>`).join('');
        if (i === 4) inner = `<div class="row g-2 wrap">${[...p.epis.map(epiNome), ...p.equipamentos].map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>`;
        if (i === 5) inner = `<dl class="kv">
          <dt>Validada por</dt><dd>${esc(emp(p.validadaPorId)?.nome ?? '—')}</dd>
          <dt>Data/hora</dt><dd class="mono">${p.validadaEm ? esc(dtFull(p.validadaEm)) : '—'}</dd>
          <dt>Checklist</dt><dd>${petChecklistDone(p)}/${CHECKLIST.length} itens conferidos</dd>
          <dt>Status atual</dt><dd>${petBadge(p.status)}</dd></dl>`;
        return `<div class="review-sec"><div class="rs-hd"><span class="t">0${i + 1} — ${esc(sec)}</span></div>
          <div class="rs-bd">${inner || '<span class="t-lo">—</span>'}</div></div>`;
      }).join('')}
    </div>`,
    footer: `<button class="btn" data-close>Fechar</button>
      <button class="btn btn-primary" onclick="window.print()">${icon('print')} Imprimir</button>`,
  });
}
