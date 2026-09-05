/**
 * PET CONTROL — Controle de acessos.
 *
 * The turnstile decision, made visible: a face is matched, the platform checks
 * whether a valid PET authorises that person in that area, and grants or blocks
 * — generating an alert automatically when it blocks.
 */

import { esc, hhmm, dtFull, ago, matches, on, $, sleep, debounce, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, panel, kpi, empty, accessBadge, searchBox, selectBox } from '../ui/kit.js';
import { toast } from '../ui/overlay.js';
import { state, emp, pet, registerAccess, evaluateAccess } from '../store.js';
import { accessInScope, kpis, petsInScope } from '../selectors.js';
import { UNITS, ALL_AREAS, areaName, unitName } from '../data/catalog.js';

const f = { q: '', resultado: 'TODOS', area: 'TODAS' };
let sim = { empId: '', areaId: '', estado: 'idle', rec: null };

export function render() {
  const acc = accessInScope();
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const hoje = acc.filter((a) => a.ts >= hoje0.getTime());
  const bloq = hoje.filter((a) => a.resultado === 'BLOQUEADO');
  const k = kpis();

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('scanface')} Operação ${icon('chevR')} Controle de acessos</div>
        <h1>Controle de acessos</h1>
        <p class="lead">Identificação facial nas portarias, validação automática contra as permissões vigentes e registro de cada entrada e saída.</p>
      </div>
      <div class="acts">
        <button class="btn btn-outline" id="ac-export">${icon('download')} Exportar</button>
      </div>
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Acessos hoje', value: hoje.length, ico: 'scanface', color: 'var(--ac)', foot: '<span>identificações nas portarias</span>' })}
      ${kpi({ label: 'Liberados', value: hoje.length - bloq.length, ico: 'userCheck', color: 'var(--ok)', foot: '<span>com PET vigente</span>' })}
      ${kpi({ label: 'Bloqueados', value: String(bloq.length).padStart(2, '0'), ico: 'userX', color: 'var(--risk)', foot: `<span class="${bloq.length ? 't-risk' : ''}">alerta gerado automaticamente</span>` })}
      ${kpi({ label: 'Pessoas em área', value: k.pessoas, ico: 'users', color: 'var(--info)', foot: `<span>${k.ativas} frentes ativas</span>` })}
    </div>

    <div class="grid g-side" style="align-items:start">
      <div class="col g-4">
        ${simuladorHTML()}
        ${logHTML()}
      </div>
      <div class="col g-4">
        ${presencaHTML()}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   Gate simulator
   ------------------------------------------------------------ */
function simuladorHTML() {
  const pessoas = state.employees.slice(0, 60);
  const cls = sim.estado === 'scan' ? 'scanning' : sim.estado === 'ok' ? 'ok' : sim.estado === 'bad' ? 'bad' : '';
  const rec = sim.rec;
  const e = rec ? emp(rec.empId) : null;
  const p = rec?.petId ? pet(rec.petId) : null;

  return `<section class="panel">
    <header class="panel-hd">
      <div><h3>Portaria eletrônica</h3><div class="sub">Simulação de identificação facial no ponto de acesso</div></div>
      <span class="badge b-ac badge-live"><i class="dot"></i>CAM-01 online</span>
    </header>
    <div class="panel-bd">
      <div class="grid g-2" style="gap:20px;align-items:start">
        <div class="gate ${cls}" id="ac-gate">
          <div class="gate-ring">
            ${icon(sim.estado === 'ok' ? 'userCheck' : sim.estado === 'bad' ? 'userX' : 'scanface')}
          </div>
          <div class="gate-verdict">
            <div class="v">${sim.estado === 'ok' ? 'Acesso liberado' : sim.estado === 'bad' ? 'Acesso bloqueado' : sim.estado === 'scan' ? 'Identificando…' : 'Aguardando'}</div>
            <div class="r">${esc(rec ? rec.motivo : sim.estado === 'scan' ? 'Comparando template biométrico com a base cadastral' : 'Selecione um colaborador e uma área para simular a leitura')}</div>
          </div>
          ${rec ? `<div class="gate-facts">
            <div><div class="l">Colaborador</div><div class="v">${esc(e?.nome ?? 'Não identificado')}</div></div>
            <div><div class="l">PET vinculada</div><div class="v mono">${esc(p?.codigo ?? '—')}</div></div>
            <div><div class="l">Área</div><div class="v">${esc(areaName(rec.areaId))}</div></div>
            <div><div class="l">Confiança</div><div class="v mono">${rec.confianca}%</div></div>
          </div>` : ''}
        </div>

        <div class="col g-4">
          <div class="field">
            <label for="ac-emp">Colaborador identificado</label>
            <select id="ac-emp" class="sel">
              <option value="">Selecione…</option>
              ${pessoas.map((x) => `<option value="${x.id}" ${sim.empId === x.id ? 'selected' : ''}>${esc(x.nome)} — ${esc(x.funcao)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="ac-area">Ponto de acesso</label>
            <select id="ac-area" class="sel">
              <option value="">Selecione…</option>
              ${UNITS.map((u) => `<optgroup label="${esc(u.nome)}">${u.areas.map((a) =>
                `<option value="${a.id}" ${sim.areaId === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</optgroup>`).join('')}
            </select>
          </div>

          ${previaHTML()}

          <div class="row g-2">
            <button class="btn btn-primary grow" id="ac-run" ${sim.estado === 'scan' ? 'disabled' : ''}>${icon('scanface')} Simular entrada</button>
            <button class="btn btn-outline" id="ac-exit" ${sim.estado === 'scan' ? 'disabled' : ''}>${icon('logout')} Saída</button>
          </div>
          <div class="row g-2">
            <button class="btn btn-sm btn-ghost grow" id="ac-lucky-ok">${icon('userCheck')} Caso autorizado</button>
            <button class="btn btn-sm btn-ghost grow" id="ac-lucky-bad">${icon('userX')} Caso bloqueado</button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/** Live preview of the authorization decision before running it. */
function previaHTML() {
  if (!sim.empId || !sim.areaId) {
    return `<div class="panel panel-inset" style="padding:12px 14px;font-size:11.5px;color:var(--tx-dim)">
      A decisão é calculada a partir do cadastro do colaborador, dos treinamentos válidos,
      das áreas autorizadas e das PETs vigentes para a área.</div>`;
  }
  const v = evaluateAccess(sim.empId, sim.areaId);
  const e = emp(sim.empId);
  return `<div class="panel panel-inset" style="padding:12px 14px">
    <div class="row-b" style="margin-bottom:9px">
      <span class="eyebrow">Prévia da decisão</span>
      <span class="badge ${v.ok ? 'b-ok' : 'b-risk'}"><i class="dot"></i>${v.ok ? 'autorizado' : 'negado'}</span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-lo);line-height:1.6">${esc(v.motivo)}</div>
    <div class="row g-3 wrap" style="margin-top:9px">
      <span class="chip">${icon('shield', 12)} ${esc(e?.status ?? '')}</span>
      <span class="chip">${icon('scanface', 12)} ${e?.face ? 'face registrada' : 'sem face'}</span>
      <span class="chip">${icon('pin', 12)} ${e?.areas.includes(sim.areaId) ? 'área autorizada' : 'fora da área'}</span>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
function filtered() {
  return accessInScope().filter((a) => {
    if (f.resultado !== 'TODOS' && a.resultado !== f.resultado) return false;
    if (f.area !== 'TODAS' && a.areaId !== f.area) return false;
    return matches(f.q, emp(a.empId)?.nome ?? '', areaName(a.areaId), a.motivo, pet(a.petId)?.codigo ?? '');
  });
}

function logHTML() {
  const rows = filtered();
  return `<section class="panel">
    <header class="panel-hd"><div><h3>Registro de acessos</h3><div class="sub">Histórico completo de identificações</div></div></header>
    <div class="toolbar">
      ${searchBox('ac-q', 'Buscar por colaborador, área, PET ou motivo…', f.q)}
      ${selectBox('ac-res', [{ value: 'TODOS', label: 'Todos os resultados' }, { value: 'LIBERADO', label: 'Liberados' }, { value: 'BLOQUEADO', label: 'Bloqueados' }], f.resultado)}
      ${selectBox('ac-farea', [{ value: 'TODAS', label: 'Todas as áreas' }, ...ALL_AREAS.map((a) => ({ value: a.id, label: a.nome }))], f.area)}
      <div class="grow"></div>
      <span class="mono" style="font-size:11px;color:var(--tx-dim)">${rows.length} registros</span>
    </div>
    <div class="tbl-wrap">
      ${rows.length ? `<table class="tbl">
        <thead><tr><th>Colaborador</th><th>Reconhecimento</th><th>Área</th><th>PET</th><th>Motivo</th><th>Sentido</th><th>Status</th><th class="right">Horário</th></tr></thead>
        <tbody>${rows.slice(0, 80).map((a) => {
          const e = emp(a.empId);
          const p = pet(a.petId);
          return `<tr>
            <td><div class="row g-3">${e ? avatar(e, 'av-sm') : `<span class="av av-sm" style="background:rgba(240,87,77,.15);color:var(--risk)">?</span>`}
              <div><div class="cell-hi nowrap">${esc(e?.nome ?? 'Não identificado')}</div>
              <div class="mono" style="font-size:10.5px;color:var(--tx-dim)">${esc(e?.matricula ?? '—')}</div></div></div></td>
            <td><span class="row g-2">${icon('scanface', 13)}<span class="mono" style="font-size:11.5px">${a.confianca}%</span></span></td>
            <td class="nowrap">${esc(areaName(a.areaId))}</td>
            <td class="mono nowrap" style="font-size:11.5px;color:${p ? 'var(--ac)' : 'var(--tx-dim)'}">${esc(p?.codigo ?? '—')}</td>
            <td class="truncate" style="max-width:260px;font-size:11.5px;color:var(--tx-lo)">${esc(a.motivo)}</td>
            <td><span class="badge b-idle">${a.direcao === 'SAIDA' ? 'saída' : 'entrada'}</span></td>
            <td>${accessBadge(a.resultado)}</td>
            <td class="right mono" style="font-size:11.5px">${esc(hhmm(a.ts))}<div style="font-size:10px;color:var(--tx-dim)">${esc(ago(a.ts))}</div></td>
          </tr>`;
        }).join('')}</tbody></table>` : empty('Nenhum acesso registrado', 'Ajuste os filtros ou simule uma identificação.', 'scanface')}
    </div>
  </section>`;
}

/* ------------------------------------------------------------ */
function presencaHTML() {
  const k = kpis();
  const dentro = k.pessoasIds.map(emp).filter(Boolean);
  const porArea = new Map();
  petsInScope().filter((p) => p.status === 'ATIVA').forEach((p) => {
    p.equipe.forEach((m) => {
      if (!porArea.has(p.areaId)) porArea.set(p.areaId, []);
      porArea.get(p.areaId).push({ e: emp(m.empId), p });
    });
  });

  return panel({
    title: 'Pessoas em área',
    sub: `${dentro.length} colaboradores dentro do perímetro`,
    body: `<div class="col g-4">${[...porArea.entries()].map(([areaId, list]) => `
      <div>
        <div class="row-b" style="margin-bottom:9px">
          <span class="row g-2" style="font-size:12px;color:var(--tx-hi)">${icon('pin', 13)} ${esc(areaName(areaId))}</span>
          <span class="badge b-ac">${list.length}</span>
        </div>
        <div class="col g-2">${list.slice(0, 6).map(({ e, p }) => e ? `
          <div class="row-b">
            <div class="row g-2" style="min-width:0">
              ${avatar(e, 'av-sm')}
              <div style="min-width:0">
                <div class="truncate" style="font-size:12px;color:var(--tx)">${esc(e.nome)}</div>
                <div class="mono" style="font-size:10px;color:var(--tx-dim)">${esc(p.codigo)}</div>
              </div>
            </div>
            <span class="badge b-ok" style="height:18px;font-size:9px"><i class="dot"></i>em área</span>
          </div>` : '').join('')}
          ${list.length > 6 ? `<span style="font-size:11px;color:var(--tx-dim)">+ ${list.length - 6} colaborador(es)</span>` : ''}
        </div>
      </div>`).join('') || '<span class="t-lo" style="font-size:12px">Nenhuma área ocupada.</span>'}</div>`,
  });
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

  $('#ac-emp', root)?.addEventListener('change', (e) => { sim.empId = e.target.value; sim.rec = null; sim.estado = 'idle'; repaint(); });
  $('#ac-area', root)?.addEventListener('change', (e) => { sim.areaId = e.target.value; sim.rec = null; sim.estado = 'idle'; repaint(); });

  const run = async (direcao) => {
    if (!sim.empId || !sim.areaId) { toast('Seleção incompleta', 'Escolha o colaborador e o ponto de acesso.', 'warn'); return; }
    sim.estado = 'scan'; sim.rec = null; repaint();
    await sleep(1250);
    const rec = registerAccess(sim.empId, sim.areaId, direcao);
    sim.rec = rec;
    sim.estado = rec.resultado === 'LIBERADO' ? 'ok' : 'bad';
    repaint();
    if (rec.resultado === 'LIBERADO') {
      toast('Acesso liberado', `${emp(rec.empId)?.nome} — ${rec.motivo}.`, 'ok');
    } else {
      toast('Acesso bloqueado', `${emp(rec.empId)?.nome ?? 'Colaborador'} — ${rec.motivo}. Alerta gerado.`, 'risk', 6000);
    }
  };

  $('#ac-run', root)?.addEventListener('click', () => run('ENTRADA'));
  $('#ac-exit', root)?.addEventListener('click', () => run('SAIDA'));

  /* One-click demo shortcuts: pick a scenario that is guaranteed to work. */
  $('#ac-lucky-ok', root)?.addEventListener('click', () => {
    /* Pick a pair the authorization rules actually approve, so the demo of the
       happy path never depends on which crew member happens to come first. */
    let alvo = null;
    for (const p of petsInScope().filter((x) => ['ATIVA', 'LIBERADA'].includes(x.status))) {
      const m = p.equipe.find((x) => evaluateAccess(x.empId, p.areaId).ok);
      if (m) { alvo = { empId: m.empId, areaId: p.areaId }; break; }
    }
    if (!alvo) { toast('Nenhum caso autorizado', 'Libere uma PET com equipe habilitada para a área.', 'warn'); return; }
    Object.assign(sim, { ...alvo, rec: null, estado: 'idle' });
    repaint(); run('ENTRADA');
  });
  $('#ac-lucky-bad', root)?.addEventListener('click', () => {
    const alvo = state.employees.find((e) => e.status !== 'ATIVO' || !e.face)
      ?? state.employees.find((e) => (e.treinamentos ?? []).some((t) => t.validade < Date.now()))
      ?? state.employees[state.employees.length - 1];
    const area = ALL_AREAS.find((a) => !alvo.areas.includes(a.id)) ?? ALL_AREAS[0];
    Object.assign(sim, { empId: alvo.id, areaId: area.id, rec: null, estado: 'idle' });
    repaint(); run('ENTRADA');
  });

  $('#ac-q', root)?.addEventListener('input', debounce((e) => {
    f.q = e.target.value; repaint();
    const el = $('#ac-q'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length);
  }, 250));
  $('#ac-res', root)?.addEventListener('change', (e) => { f.resultado = e.target.value; repaint(); });
  $('#ac-farea', root)?.addEventListener('change', (e) => { f.area = e.target.value; repaint(); });

  $('#ac-export', root)?.addEventListener('click', () => {
    const rows = filtered();
    downloadText(`acessos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Data/hora', get: (a) => dtFull(a.ts) },
      { label: 'Colaborador', get: (a) => emp(a.empId)?.nome ?? '' },
      { label: 'Matrícula', get: (a) => emp(a.empId)?.matricula ?? '' },
      { label: 'Área', get: (a) => areaName(a.areaId) },
      { label: 'Unidade', get: (a) => unitName(a.unidade) },
      { label: 'PET', get: (a) => pet(a.petId)?.codigo ?? '' },
      { label: 'Sentido', get: (a) => a.direcao },
      { label: 'Resultado', get: (a) => a.resultado },
      { label: 'Confiança (%)', get: (a) => a.confianca },
      { label: 'Motivo', get: (a) => a.motivo },
    ]));
    toast('Exportação concluída', `${rows.length} registros de acesso exportados.`, 'ok');
  });

  return null;
}
