/**
 * PET CONTROL — Validação da PET.
 * The approval gate: a supervisor/manager confirms the checklist and releases
 * the activity. Every approval records who, what, when and where.
 */

import { esc, dur, hhmm, on } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, panel, petBadge, empty, gaugeCard } from '../ui/kit.js';
import { toast, confirm } from '../ui/overlay.js';
import { emp, pet, allow, me, validatePet, setChecklist, cancelPet } from '../store.js';
import { petsValidacao, petReadings, petChecklistDone } from '../selectors.js';
import { CHECKLIST, classify, atividadeById, areaName, unitName, riscoNome, epiNome } from '../data/catalog.js';

export function render(params = []) {
  const [id] = params;
  const fila = petsValidacao();
  const alvo = id ? pet(id) : fila[0];

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('checks')} Operação ${icon('chevR')} Validação</div>
        <h1>Validação da PET</h1>
        <p class="lead">Conferência final antes da liberação. A aprovação registra usuário, data, horário e ação — substituindo a assinatura física por um registro auditável.</p>
      </div>
      <div class="acts">
        <span class="badge ${fila.length ? 'b-warn' : 'b-ok'} badge-live"><i class="dot"></i>${fila.length} na fila</span>
      </div>
    </div>

    <div class="grid g-split">
      <aside class="panel">
        <header class="panel-hd"><h3>Fila de validação</h3><span class="mono" style="font-size:11px;color:var(--tx-dim)">${fila.length}</span></header>
        <div class="feed">
          ${fila.length ? fila.map((p) => {
            const done = petChecklistDone(p);
            const sel = alvo && p.id === alvo.id;
            return `<button class="feed-row" data-pick="${esc(p.id)}" style="text-align:left;width:100%;${sel ? 'background:var(--bg-active);box-shadow:inset 2px 0 0 var(--ac)' : ''}">
              <span class="feed-ico" style="color:var(--warn);border-color:rgba(245,176,44,.28)">${icon(atividadeById(p.tipo)?.icon ?? 'permit')}</span>
              <div class="feed-bd">
                <div class="mono" style="font-size:11px;color:var(--ac)">${esc(p.codigo)}</div>
                <div class="feed-t truncate" style="margin-top:2px">${esc(p.titulo)}</div>
                <div class="feed-s">${esc(areaName(p.areaId))} · ${done}/${CHECKLIST.length} itens</div>
                <div class="progress" style="margin-top:6px"><i style="width:${(done / CHECKLIST.length * 100).toFixed(0)}%;background:var(--warn)"></i></div>
              </div>
            </button>`;
          }).join('') : empty('Fila vazia', 'Nenhuma permissão aguardando validação.', 'okCircle')}
        </div>
      </aside>

      <div id="vl-detail">${alvo ? detailHTML(alvo) : empty('Selecione uma permissão', 'Escolha um item da fila para iniciar a validação.', 'checks')}</div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
function detailHTML(p) {
  const ativ = atividadeById(p.tipo);
  const team = p.equipe.map((m) => emp(m.empId)).filter(Boolean);
  const readings = petReadings(p);
  const fora = readings.filter((r) => classify(r.param, r.valor) === 'risk');
  const done = petChecklistDone(p);
  const completo = done === CHECKLIST.length;
  const podeAprovar = allow('pet.validate');
  const bloqueios = [];
  if (fora.length) bloqueios.push(`${fora.length} medição(ões) fora do parâmetro`);
  if (!completo) bloqueios.push(`${CHECKLIST.length - done} item(ns) do checklist pendente(s)`);
  const equipeIrregular = team.filter((e) => e.status !== 'ATIVO' || !e.face);
  if (equipeIrregular.length) bloqueios.push(`${equipeIrregular.length} colaborador(es) com pendência cadastral`);

  return `<div class="col g-4">
    <section class="panel panel-rail">
      <div class="panel-bd">
        <div class="row-b wrap g-4">
          <div>
            <div class="row g-3 wrap">
              <span class="mono" style="font-size:15px;color:var(--ac);font-weight:600">${esc(p.codigo)}</span>
              ${petBadge(p.status, true)}
              <span class="badge ${ativ?.severidade === 'ALTA' ? 'b-risk' : 'b-warn'}">Severidade ${esc((ativ?.severidade ?? '').toLowerCase())}</span>
            </div>
            <h2 style="font-size:18px;margin-top:8px">${esc(p.titulo)}</h2>
            <div class="row g-4 wrap" style="margin-top:8px;font-size:12px;color:var(--tx-lo)">
              <span>${icon('pin', 12)} ${esc(areaName(p.areaId))} · ${esc(p.local)}</span>
              <span>${icon('building', 12)} ${esc(unitName(p.unidade))}</span>
              <span>${icon('clock', 12)} aguardando há ${esc(dur(p.criadaEm))}</span>
              <span>${icon('userCheck', 12)} ${esc(emp(p.responsavelId)?.nome ?? '—')}</span>
            </div>
          </div>
          <div style="text-align:right">
            <div class="eyebrow">Checklist</div>
            <div class="num" style="font-size:28px;margin-top:4px">${done}<span style="font-size:15px;color:var(--tx-dim)">/${CHECKLIST.length}</span></div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid g-2" style="align-items:start">
      ${panel({
        title: 'Checklist de segurança',
        sub: podeAprovar ? 'Marque cada item conferido' : 'Somente leitura para o seu nível de acesso',
        body: `<div class="col g-2">${CHECKLIST.map((c) => {
          const s = p.checklist?.[c.id];
          return `<label class="pick ${s?.ok ? 'on' : ''}" data-chk="${c.id}" style="${podeAprovar ? 'cursor:pointer' : 'cursor:default;opacity:.85'}">
            <span class="pk-box">${icon('check')}</span>
            <span class="grow">
              <span class="pk-t">${esc(c.label)}</span>
              <span class="pk-s">${esc(c.grupo)}${s?.ok && s.byId ? ` · conferido por ${esc(emp(s.byId)?.nome.split(' ')[0] ?? '')} às ${esc(hhmm(s.ts))}` : ''}</span>
            </span>
          </label>`;
        }).join('')}</div>`,
        footer: `<span style="font-size:11.5px;color:var(--tx-lo)">${completo ? 'Todos os itens conferidos' : `${CHECKLIST.length - done} pendente(s)`}</span>
          <div class="progress" style="width:130px"><i style="width:${(done / CHECKLIST.length * 100).toFixed(0)}%;background:${completo ? 'var(--ok)' : 'var(--warn)'}"></i></div>`,
      })}

      <div class="col g-4">
        ${panel({
          title: 'Medições registradas',
          sub: fora.length ? `${fora.length} fora do parâmetro` : 'Todas dentro da faixa aceitável',
          body: readings.length ? `<div class="col g-3">${readings.map((r) => gaugeCard(r.param, r.valor, { ts: r.ts, live: r.live, compact: true })).join('')}</div>`
            : '<span class="t-lo" style="font-size:12px">Nenhuma medição registrada.</span>',
        })}

        ${panel({
          title: `Equipe autorizada (${team.length})`,
          body: `<div class="col g-2">${team.map((e) => {
            const irregular = e.status !== 'ATIVO' || !e.face;
            return `<div class="row-b">
              <div class="row g-3" style="min-width:0">
                ${avatar(e, 'av-sm')}
                <div style="min-width:0">
                  <div class="truncate" style="font-size:12.5px;color:var(--tx-hi)">${esc(e.nome)}</div>
                  <div style="font-size:10.5px;color:var(--tx-dim)">${esc(p.equipe.find((m) => m.empId === e.id)?.papel ?? e.funcao)}</div>
                </div>
              </div>
              ${irregular ? '<span class="badge b-warn">pendência</span>' : '<span class="badge b-ok">apto</span>'}
            </div>`;
          }).join('')}</div>`,
        })}
      </div>
    </div>

    ${panel({
      title: 'Análise de riscos e recursos',
      body: `<div class="grid g-3" style="gap:22px">
        <div>
          <div class="eyebrow" style="margin-bottom:9px">Riscos (${p.riscos.length})</div>
          <div class="row g-2 wrap">${p.riscos.map((r) => `<span class="chip">${icon('alert', 12)} ${esc(riscoNome(r))}</span>`).join('') || '<span class="t-lo">—</span>'}</div>
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:9px">Medidas preventivas (${p.medidas.length})</div>
          <ul class="col g-1">${p.medidas.slice(0, 6).map((m) => `<li style="font-size:11.5px;color:var(--tx-lo)">• ${esc(m)}</li>`).join('') || '<span class="t-lo">—</span>'}</ul>
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:9px">EPIs e equipamentos</div>
          <div class="row g-2 wrap">${[...p.epis.map(epiNome), ...p.equipamentos].slice(0, 8).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
        </div>
      </div>`,
    })}

    <section class="panel" style="${bloqueios.length ? 'border-color:rgba(245,176,44,.35)' : 'border-color:rgba(45,212,167,.35)'}">
      <div class="panel-bd">
        <div class="row-b wrap g-4">
          <div class="row g-3">
            <span style="color:${bloqueios.length ? 'var(--warn)' : 'var(--ok)'};display:flex">${icon(bloqueios.length ? 'warnCircle' : 'shieldOk', 22)}</span>
            <div>
              <div style="font-size:13.5px;font-weight:600;color:var(--tx-hi)">
                ${bloqueios.length ? 'Pendências identificadas' : 'Permissão apta à liberação'}
              </div>
              <div style="font-size:12px;color:var(--tx-lo);margin-top:3px">
                ${bloqueios.length ? esc(bloqueios.join(' · ')) : `Aprovação será registrada em nome de ${esc(me()?.nome ?? '')} (${esc(me()?.nivel ?? '')}).`}
              </div>
            </div>
          </div>
          <div class="row g-2">
            ${allow('pet.cancel') ? `<button class="btn btn-risk" data-vact="cancel">${icon('xCircle')} Recusar</button>` : ''}
            ${podeAprovar
              ? `<button class="btn btn-primary btn-lg" data-vact="approve" ${bloqueios.length ? 'disabled' : ''}>${icon('shieldOk')} APROVAR PET</button>`
              : `<span class="badge b-idle">Aprovação exige nível Gestor</span>`}
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------ */
export function mount(root, params = []) {
  const page = root.querySelector('.page');
  if (!page) return null;
  let currentId = params[0] ?? petsValidacao()[0]?.id ?? null;

  const repaint = () => {
    const view = document.querySelector('#view');
    const scroll = document.querySelector('#main')?.scrollTop ?? 0;
    view.innerHTML = render(currentId ? [currentId] : []);
    mount(view, currentId ? [currentId] : []);
    const m = document.querySelector('#main'); if (m) m.scrollTop = scroll;
  };

  on(page, 'click', '[data-pick]', (e, t) => { currentId = t.dataset.pick; repaint(); });

  on(page, 'click', '[data-chk]', (e, t) => {
    if (!allow('pet.validate')) { toast('Sem permissão', 'A conferência do checklist exige nível Gestor.', 'warn'); return; }
    const p = pet(currentId); if (!p) return;
    const id = t.dataset.chk;
    setChecklist(p.id, id, !p.checklist?.[id]?.ok);
    repaint();
  });

  on(page, 'click', '[data-vact]', (e, t) => {
    const p = pet(currentId); if (!p) return;
    if (t.dataset.vact === 'approve') {
      confirm({
        title: 'Aprovar permissão',
        confirmLabel: 'Aprovar e liberar',
        message: `${p.codigo} será validada e liberada para execução. O acesso da equipe será habilitado e o registro (usuário, data, horário e ação) ficará permanente na trilha de auditoria.`,
        onConfirm: () => {
          validatePet(p.id);
          toast('PET liberada', `${p.codigo} validada por ${me()?.nome.split(' ')[0]} — equipe autorizada nas portarias.`, 'ok', 6000);
          currentId = petsValidacao()[0]?.id ?? null;
          repaint();
        },
      });
    }
    if (t.dataset.vact === 'cancel') {
      confirm({
        title: 'Recusar permissão', tone: 'risk', confirmLabel: 'Recusar PET', requireReason: true,
        message: `${p.codigo} será cancelada e devolvida ao emissor. Informe o motivo da recusa.`,
        onConfirm: (motivo) => {
          cancelPet(p.id, `Recusada na validação — ${motivo}`);
          toast('Permissão recusada', 'O emissor foi notificado e o motivo registrado.', 'warn');
          currentId = petsValidacao()[0]?.id ?? null;
          repaint();
        },
      });
    }
  });

  return null;
}
