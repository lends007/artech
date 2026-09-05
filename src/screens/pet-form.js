/**
 * PET CONTROL — Nova Permissão de Entrada de Trabalho (fluxo em 7 etapas).
 *
 * The paper form becomes a guided flow: each step validates before it lets the
 * user advance, measurements are checked against their bands in real time, and
 * the final release is a single, auditable action.
 */

import { esc, matches, on, $, debounce } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, panel, empty, gaugeCard, medBadge } from '../ui/kit.js';
import { toast, confirm } from '../ui/overlay.js';
import { state, emp, allow, me, createPet, validatePet } from '../store.js';
import { UNITS, ATIVIDADES, atividadeById, atividadeNome, areaName, unitName, PARAMS, classify, RISCOS, riscoNome, EPIS, epiNome, EQUIPAMENTOS, FERRAMENTAS, CHECKLIST } from '../data/catalog.js';

const STEPS = [
  { n: '01', id: 'ident',  t: 'Identificação', s: 'Local, área e atividade' },
  { n: '02', id: 'equipe', t: 'Equipe',        s: 'Executantes e papéis' },
  { n: '03', id: 'riscos', t: 'Riscos',        s: 'Análise e medidas' },
  { n: '04', id: 'medic',  t: 'Medições',      s: 'Condições ambientais' },
  { n: '05', id: 'recur',  t: 'Equipamentos',  s: 'EPIs e ferramentas' },
  { n: '06', id: 'valid',  t: 'Validação',     s: 'Checklist de segurança' },
  { n: '07', id: 'liber',  t: 'Liberação',     s: 'Resumo e emissão' },
];

/* ---------- draft ---------- */
let D = null;
let step = 0;
let teamQuery = '';

function blank() {
  const u = me();
  return {
    tipo: '', titulo: '', unidade: u?.unidade ?? 'UN-A', areaId: '', local: '',
    responsavelId: u?.id ?? '', equipe: [], riscos: [], medidas: [], medidasExtra: '',
    medicoes: {}, epis: [], equipamentos: [], ferramentas: [],
    checklist: {}, observacoes: '',
    duracaoH: 8,
  };
}

/* ============================================================
   RENDER
   ============================================================ */
export function render() {
  if (!D) { D = blank(); step = 0; }
  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs"><a href="#/pets" style="color:var(--tx-dim)">Permissões</a> ${icon('chevR')} Nova PET</div>
        <h1>Nova permissão de entrada de trabalho</h1>
        <p class="lead">Preenchimento assistido em 7 etapas. Cada etapa é validada antes da liberação, e todo o percurso fica registrado na trilha de auditoria.</p>
      </div>
      <div class="acts">
        <a class="btn btn-ghost" href="#/pets">${icon('x')} Descartar</a>
      </div>
    </div>

    <div class="wiz">
      <aside class="wiz-steps panel" style="padding:10px">
        ${STEPS.map((s, i) => `<button class="wstep ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-step="${i}">
          <span class="wn">${i < step ? icon('check') : s.n}</span>
          <span><span class="wt">${esc(s.t)}</span><span class="ws">${esc(s.s)}</span></span>
        </button>`).join('')}
      </aside>

      <section class="panel wiz-body">
        <header class="panel-hd">
          <div>
            <h3>${STEPS[step].n} — ${esc(STEPS[step].t)}</h3>
            <div class="sub">${esc(STEPS[step].s)}</div>
          </div>
          <span class="mono" style="font-size:11px;color:var(--tx-dim)">Etapa ${step + 1} de ${STEPS.length}</span>
        </header>
        <div class="panel-bd" id="wz-pane">${pane()}</div>
        <footer class="panel-ft">
          <button class="btn btn-ghost" id="wz-prev" ${step === 0 ? 'disabled' : ''}>${icon('chevL')} Voltar</button>
          <div class="row g-3">
            <span class="mono" style="font-size:11px;color:var(--tx-dim)" id="wz-hint"></span>
            ${step < STEPS.length - 1
              ? `<button class="btn btn-primary" id="wz-next">Avançar ${icon('chevR')}</button>`
              : `<button class="btn btn-primary btn-lg" id="wz-done">${icon('shieldOk')} ${allow('pet.validate') ? 'LIBERAR ATIVIDADE' : 'ENVIAR PARA VALIDAÇÃO'}</button>`}
          </div>
        </footer>
      </section>
    </div>
  </div>`;
}

/* ============================================================
   PANES
   ============================================================ */
function pane() {
  return [paneIdent, paneEquipe, paneRiscos, paneMedic, paneRecur, paneValid, paneLiber][step]();
}

/* ---------- 01 ---------- */
function paneIdent() {
  const unidade = UNITS.find((u) => u.id === D.unidade) ?? UNITS[0];
  const responsaveis = state.employees.filter((e) => ['SUPERVISOR', 'GESTOR', 'ADMINISTRADOR'].includes(e.nivel) && e.status === 'ATIVO');
  return `<div class="wiz-pane col g-5">
    <div>
      <div class="eyebrow" style="margin-bottom:11px">Tipo de atividade</div>
      <div class="grid g-auto" style="gap:9px">
        ${ATIVIDADES.map((a) => `<button class="pick ${D.tipo === a.id ? 'on' : ''}" data-tipo="${a.id}">
          <span class="pk-box">${icon('check')}</span>
          <span class="grow">
            <span class="pk-t row g-2">${icon(a.icon, 14)} ${esc(a.nome)}</span>
            <span class="pk-s">Severidade ${esc(a.severidade.toLowerCase())} · validade ${a.validadeH}h · ${a.params.length} parâmetro(s)</span>
          </span>
        </button>`).join('')}
      </div>
    </div>

    <div class="form-grid">
      <div class="field span-2">
        <label for="f-titulo">Descrição da atividade</label>
        <input id="f-titulo" class="inp" value="${esc(D.titulo)}" placeholder="Ex.: Inspeção interna e limpeza do tanque TQ-07">
      </div>
      <div class="field">
        <label for="f-unidade">Unidade</label>
        <select id="f-unidade" class="sel">${UNITS.map((u) => `<option value="${u.id}" ${D.unidade === u.id ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="f-area">Área</label>
        <select id="f-area" class="sel">
          <option value="">Selecione…</option>
          ${unidade.areas.map((a) => `<option value="${a.id}" ${D.areaId === a.id ? 'selected' : ''}>${esc(a.nome)} · ${esc(a.classe)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-local">Local específico</label>
        <input id="f-local" class="inp" value="${esc(D.local)}" placeholder="Ex.: Bocal superior TQ-07">
      </div>
      <div class="field">
        <label for="f-resp">Responsável pela permissão</label>
        <select id="f-resp" class="sel">${responsaveis.map((e) => `<option value="${e.id}" ${D.responsavelId === e.id ? 'selected' : ''}>${esc(e.nome)} — ${esc(e.funcao)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="f-dur">Duração prevista (horas)</label>
        <input id="f-dur" class="inp" type="number" min="1" max="24" value="${D.duracaoH}">
      </div>
      <div class="field span-2">
        <label for="f-obs">Observações operacionais</label>
        <textarea id="f-obs" class="ta" placeholder="Informações relevantes para a equipe e para a validação…">${esc(D.observacoes)}</textarea>
      </div>
    </div>
  </div>`;
}

/* ---------- 02 ---------- */
function paneEquipe() {
  /* Operators already authorised for the chosen area come first: picking them
     is what keeps the released PET consistent with the turnstile rules. */
  const habilitado = (e) => e.status === 'ATIVO' && e.face
    && (!D.areaId || e.areas.includes(D.areaId))
    && !(e.treinamentos ?? []).some((t) => t.validade < Date.now());

  const disponiveis = state.employees
    .filter((e) => e.nivel === 'OPERADOR' || e.nivel === 'SUPERVISOR')
    .filter((e) => matches(teamQuery, e.nome, e.funcao, e.matricula))
    .sort((a, b) => Number(habilitado(b)) - Number(habilitado(a)))
    .slice(0, 40);

  const selecionados = D.equipe.map((m) => ({ ...m, e: emp(m.empId) })).filter((x) => x.e);
  const bloqueios = selecionados.filter((x) => x.e.status !== 'ATIVO' || !x.e.face
    || (D.areaId && !x.e.areas.includes(D.areaId))
    || (x.e.treinamentos ?? []).some((t) => t.validade < Date.now()));

  return `<div class="wiz-pane grid g-2" style="gap:20px;align-items:start">
    <div>
      <div class="eyebrow" style="margin-bottom:10px">Colaboradores disponíveis</div>
      <div class="search" style="margin-bottom:10px">${icon('search')}
        <input id="f-team-q" type="search" placeholder="Buscar por nome, função ou matrícula…" value="${esc(teamQuery)}">
      </div>
      <div class="col g-1" style="max-height:390px;overflow-y:auto;padding-right:4px">
        ${disponiveis.map((e) => {
          const on_ = D.equipe.some((m) => m.empId === e.id);
          const impedido = !habilitado(e);
          return `<button class="pick ${on_ ? 'on' : ''}" data-emp="${e.id}" style="padding:9px 11px">
            <span class="pk-box">${icon('check')}</span>
            ${avatar(e, 'av-sm')}
            <span class="grow" style="min-width:0">
              <span class="pk-t truncate">${esc(e.nome)}</span>
              <span class="pk-s truncate">${esc(e.funcao)} · ${esc(e.matricula)}</span>
            </span>
            ${impedido ? `<span class="badge b-warn nowrap" style="flex:none">${esc(motivoCurto(e))}</span>` : ''}
          </button>`;
        }).join('') || empty('Nenhum colaborador encontrado', '', 'users')}
      </div>
    </div>

    <div>
      <div class="row-b" style="margin-bottom:10px">
        <div class="eyebrow">Equipe da permissão</div>
        <span class="badge ${D.equipe.length ? 'b-ac' : 'b-idle'}">${D.equipe.length} selecionado(s)</span>
      </div>
      ${selecionados.length ? `<div class="col g-2">${selecionados.map((x, i) => `
        <div class="panel panel-inset" style="padding:10px 12px">
          <div class="row-b g-3">
            <div class="row g-3" style="min-width:0">
              ${avatar(x.e, 'av-sm')}
              <div style="min-width:0">
                <div class="truncate" style="font-size:12.5px;color:var(--tx-hi)">${esc(x.e.nome)}</div>
                <div style="font-size:10.5px;color:var(--tx-dim)">${esc(x.e.funcao)}</div>
              </div>
            </div>
            <div class="row g-2" style="flex:none">
              <select class="sel" data-papel="${x.empId}" style="height:28px;width:auto;font-size:11.5px;min-width:130px">
                ${['Executante líder', 'Executante', 'Vigia', 'Observador de segurança', 'Sinaleiro'].map((pp) =>
                  `<option ${x.papel === pp ? 'selected' : ''}>${pp}</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-ghost" data-rm="${x.empId}">${icon('x')}</button>
            </div>
          </div>
        </div>`).join('')}</div>`
        : empty('Nenhum colaborador vinculado', 'Selecione ao menos um executante à esquerda.', 'users')}

      ${bloqueios.length ? `<div class="panel" style="margin-top:12px;border-color:rgba(245,176,44,.35);background:rgba(245,176,44,.05)">
        <div class="panel-bd" style="padding:12px 14px">
          <div class="row g-2" style="color:var(--warn);font-size:12px;font-weight:600">${icon('warnCircle', 14)} ${bloqueios.length} pendência(s) de habilitação</div>
          <ul class="col g-1" style="margin-top:8px">${bloqueios.map((b) => `<li style="font-size:11.5px;color:var(--tx-lo)">
            <strong style="color:var(--tx)">${esc(b.e.nome)}</strong> — ${esc(motivoBloqueio(b.e))}</li>`).join('')}</ul>
          <div style="font-size:11px;color:var(--tx-dim);margin-top:8px">
            O sistema bloqueará o acesso físico destes colaboradores mesmo com a PET liberada.
          </div>
        </div></div>` : ''}
    </div>
  </div>`;
}

/** Short label for the blocking reason, shown on the picker row. */
function motivoCurto(e) {
  if (!e.face) return 'sem face';
  if (e.status !== 'ATIVO') return e.status.toLowerCase();
  if ((e.treinamentos ?? []).some((t) => t.validade < Date.now())) return 'NR vencida';
  return 'fora da área';
}

function motivoBloqueio(e) {
  if (!e.face) return 'sem registro facial ativo';
  if (e.status === 'AFASTADO') return 'colaborador afastado';
  if (e.status === 'PENDENTE') return 'cadastro pendente de regularização';
  const v = (e.treinamentos ?? []).find((t) => t.validade < Date.now());
  if (v) return `treinamento vencido — ${v.nome}`;
  if (D.areaId && !e.areas.includes(D.areaId)) return `sem autorização para ${areaName(D.areaId)}`;
  return 'pendência de habilitação';
}

/* ---------- 03 ---------- */
function paneRiscos() {
  const ativ = atividadeById(D.tipo);
  const sugeridos = ativ?.riscos ?? [];
  const outros = Object.keys(RISCOS).filter((r) => !sugeridos.includes(r));
  const medidas = D.riscos.flatMap((r) => (RISCOS[r]?.medidas ?? []).map((m) => ({ r, m })));

  return `<div class="wiz-pane col g-5">
    <div>
      <div class="row-b" style="margin-bottom:11px">
        <div class="eyebrow">Riscos sugeridos para ${esc(atividadeNome(D.tipo))}</div>
        <button class="btn btn-sm btn-outline" id="f-riscos-all">${icon('checks')} Selecionar todos</button>
      </div>
      <div class="grid g-2" style="gap:9px">
        ${sugeridos.map((r) => riscoCard(r)).join('')}
      </div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:11px">Outros riscos do catálogo</div>
      <div class="grid g-2" style="gap:9px">${outros.slice(0, 8).map((r) => riscoCard(r)).join('')}</div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:11px">Medidas preventivas aplicáveis</div>
      ${medidas.length ? `<div class="panel panel-inset" style="padding:14px">
        <ul class="col g-2">${medidas.map(({ r, m }) => `<li class="row g-2" style="align-items:flex-start;font-size:12.5px;color:var(--tx)">
          <span style="color:var(--ok);display:flex;margin-top:2px;flex:none">${icon('check', 13)}</span>
          <span>${esc(m)} <span style="color:var(--tx-dim);font-size:10.5px">— ${esc(riscoNome(r))}</span></span></li>`).join('')}</ul>
      </div>` : `<div class="panel panel-inset" style="padding:16px;text-align:center;color:var(--tx-dim);font-size:12px">
        Selecione ao menos um risco para carregar as medidas preventivas.</div>`}
      <div class="field" style="margin-top:12px">
        <label for="f-medidas">Medidas complementares</label>
        <textarea id="f-medidas" class="ta" placeholder="Uma medida por linha…">${esc(D.medidasExtra)}</textarea>
      </div>
    </div>
  </div>`;
}

function riscoCard(r) {
  const R = RISCOS[r];
  const on_ = D.riscos.includes(r);
  return `<button class="pick ${on_ ? 'on' : ''}" data-risco="${r}">
    <span class="pk-box">${icon('check')}</span>
    <span class="grow">
      <span class="pk-t">${esc(R.nome)}</span>
      <span class="pk-s">${R.medidas.length} medida(s) preventiva(s) associada(s)</span>
    </span>
    <span class="badge ${R.grau === 'ALTO' ? 'b-risk' : 'b-warn'}" style="flex:none">${esc(R.grau)}</span>
  </button>`;
}

/* ---------- 04 ---------- */
function paneMedic() {
  const ativ = atividadeById(D.tipo);
  const params = ativ?.params ?? [];
  const fora = params.filter((p) => D.medicoes[p] != null && classify(p, D.medicoes[p]) === 'risk');

  return `<div class="wiz-pane col g-5">
    <div class="row-b">
      <div>
        <div class="eyebrow">Parâmetros obrigatórios</div>
        <div style="font-size:11.5px;color:var(--tx-lo);margin-top:4px">
          Medições exigidas para ${esc(atividadeNome(D.tipo))} em ${esc(areaName(D.areaId) || 'área não definida')}
        </div>
      </div>
      <button class="btn btn-sm btn-outline" id="f-med-sensor">${icon('radio')} Importar dos detectores</button>
    </div>

    ${params.length ? `<div class="grid g-2" style="gap:14px">
      ${params.map((pid) => {
        const P = PARAMS[pid];
        const v = D.medicoes[pid];
        const has = v != null && v !== '';
        return `<div class="panel panel-inset" style="padding:14px">
          <div class="row-b" style="margin-bottom:10px">
            <span class="row g-2" style="font-size:12.5px;color:var(--tx-hi)">${icon(P.icon, 14)} ${esc(P.nome)}</span>
            ${has ? medBadge(classify(pid, Number(v))) : '<span class="badge b-idle">pendente</span>'}
          </div>
          <div class="row g-2">
            <input class="inp" data-med="${pid}" type="number" step="${P.dec ? '0.1' : '1'}" value="${has ? esc(String(v)) : ''}" placeholder="${P.ideal}">
            <span class="mono" style="font-size:12px;color:var(--tx-lo);flex:none;min-width:44px">${esc(P.unidade)}</span>
          </div>
          <div class="mono" style="font-size:10.5px;color:var(--tx-dim);margin-top:7px">Faixa aceitável: ${P.min} – ${P.max} ${esc(P.unidade)}</div>
          ${has ? `<div style="margin-top:12px">${gaugeCard(pid, Number(v), { compact: false })}</div>` : ''}
        </div>`;
      }).join('')}
    </div>` : `<div class="panel panel-inset" style="padding:20px;text-align:center;color:var(--tx-dim);font-size:12px">
      Selecione o tipo de atividade na etapa 01 para carregar os parâmetros exigidos.</div>`}

    ${fora.length ? `<div class="panel" style="border-color:rgba(240,87,77,.4);background:rgba(240,87,77,.05)">
      <div class="panel-bd" style="padding:14px 16px">
        <div class="row g-2" style="color:var(--risk);font-size:12.5px;font-weight:600">${icon('warnCircle', 15)} ${fora.length} medição(ões) fora do parâmetro</div>
        <div style="font-size:12px;color:var(--tx-lo);margin-top:6px;line-height:1.6">
          A permissão não pode ser liberada com leituras fora da faixa aceitável.
          Corrija a condição da área (ventilação, bloqueio, resfriamento) e registre uma nova medição.
        </div>
      </div></div>` : ''}
  </div>`;
}

/* ---------- 05 ---------- */
function paneRecur() {
  const ativ = atividadeById(D.tipo);
  const sugeridos = ativ?.epis ?? [];
  const outros = Object.keys(EPIS).filter((e) => !sugeridos.includes(e));
  const chips = (arr, sel, attr) => arr.map((x) => `<button class="chip" data-${attr}="${esc(x)}"
    style="${sel.includes(x) ? 'border-color:var(--line-accent);background:var(--ac-glow-soft);color:var(--tx-hi)' : ''}">
    ${sel.includes(x) ? icon('check', 12) : icon('plus', 12)} ${esc(x)}</button>`).join('');

  return `<div class="wiz-pane col g-5">
    <div>
      <div class="row-b" style="margin-bottom:11px">
        <div class="eyebrow">EPIs obrigatórios para a atividade</div>
        <button class="btn btn-sm btn-outline" id="f-epi-all">${icon('checks')} Marcar sugeridos</button>
      </div>
      <div class="grid g-2" style="gap:9px">
        ${sugeridos.map((e) => `<button class="pick ${D.epis.includes(e) ? 'on' : ''}" data-epi="${e}" style="padding:10px 12px">
          <span class="pk-box">${icon('check')}</span>
          <span class="grow"><span class="pk-t">${esc(epiNome(e))}</span></span>
        </button>`).join('')}
      </div>
      <div class="eyebrow" style="margin:16px 0 9px">EPIs adicionais</div>
      <div class="row g-2 wrap">${chips(outros.map(epiNome), D.epis.map(epiNome), 'epiname')}</div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:10px">Equipamentos</div>
      <div class="row g-2 wrap">${chips(EQUIPAMENTOS, D.equipamentos, 'equip')}</div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:10px">Ferramentas</div>
      <div class="row g-2 wrap">${chips(FERRAMENTAS, D.ferramentas, 'ferr')}</div>
    </div>
  </div>`;
}

/* ---------- 06 ---------- */
function paneValid() {
  const auto = autoChecks();
  return `<div class="wiz-pane col g-4">
    <div class="panel panel-inset" style="padding:14px 16px">
      <div class="row g-2" style="font-size:12px;color:var(--tx-mid)">
        ${icon('info', 14)} Itens marcados automaticamente refletem o que já foi preenchido nas etapas anteriores.
        Os demais exigem conferência presencial e resposta do emissor.
      </div>
    </div>
    <div class="col g-2">
      ${CHECKLIST.map((c) => {
        const a = c.auto ? auto[c.auto] : null;
        const marcado = D.checklist[c.id] ?? (a === true);
        return `<label class="pick ${marcado ? 'on' : ''}" data-check="${c.id}" style="cursor:pointer">
          <span class="pk-box">${icon('check')}</span>
          <span class="grow">
            <span class="pk-t">${esc(c.label)}</span>
            <span class="pk-s">${esc(c.grupo)}${a === true ? ' · conferido automaticamente' : a === false ? ' · pendência detectada pelo sistema' : ' · conferência manual'}</span>
          </span>
          ${a === false ? '<span class="badge b-risk" style="flex:none">pendente</span>' : a === true ? '<span class="badge b-ok" style="flex:none">auto</span>' : ''}
        </label>`;
      }).join('')}
    </div>
  </div>`;
}

function autoChecks() {
  const equipeOk = D.equipe.length > 0 && D.equipe.every((m) => {
    const e = emp(m.empId);
    return e && e.status === 'ATIVO' && e.face && !(e.treinamentos ?? []).some((t) => t.validade < Date.now());
  });
  const params = atividadeById(D.tipo)?.params ?? [];
  const medOk = params.length > 0 && params.every((p) => D.medicoes[p] != null && classify(p, Number(D.medicoes[p])) !== 'risk');
  return {
    equipe: equipeOk,
    medicoes: medOk,
    riscos: D.riscos.length > 0,
    medidas: D.riscos.length > 0 || D.medidasExtra.trim().length > 0,
    epis: D.epis.length > 0,
  };
}

/* ---------- 07 ---------- */
function paneLiber() {
  const ativ = atividadeById(D.tipo);
  const team = D.equipe.map((m) => ({ ...m, e: emp(m.empId) })).filter((x) => x.e);
  const params = ativ?.params ?? [];
  const problemas = validateAll();

  const sec = (n, t, inner) => `<div class="review-sec">
    <div class="rs-hd"><span class="t">${n} — ${esc(t)}</span></div><div class="rs-bd">${inner}</div></div>`;

  return `<div class="wiz-pane col g-4">
    ${problemas.length ? `<div class="panel" style="border-color:rgba(240,87,77,.4);background:rgba(240,87,77,.05)">
      <div class="panel-bd" style="padding:14px 16px">
        <div class="row g-2" style="color:var(--risk);font-size:12.5px;font-weight:600">${icon('warnCircle', 15)} Pendências que impedem a liberação</div>
        <ul class="col g-1" style="margin-top:8px">${problemas.map((p) => `<li style="font-size:12px;color:var(--tx-lo)">• ${esc(p)}</li>`).join('')}</ul>
      </div></div>`
      : `<div class="panel" style="border-color:rgba(45,212,167,.35);background:rgba(45,212,167,.05)">
        <div class="panel-bd" style="padding:14px 16px">
          <div class="row g-2" style="color:var(--ok);font-size:12.5px;font-weight:600">${icon('shieldOk', 15)} Permissão pronta para emissão</div>
          <div style="font-size:12px;color:var(--tx-lo);margin-top:5px">
            Todas as etapas foram concluídas e as condições estão dentro dos parâmetros.
            ${allow('pet.validate') ? 'Ao liberar, a atividade fica autorizada e o acesso da equipe é habilitado nas portarias.' : 'A permissão será enviada para validação de um gestor.'}
          </div>
        </div></div>`}

    ${sec('01', 'Identificação', `<dl class="kv">
      <dt>Atividade</dt><dd>${esc(atividadeNome(D.tipo) || '—')}</dd>
      <dt>Descrição</dt><dd>${esc(D.titulo || '—')}</dd>
      <dt>Local</dt><dd>${esc(D.local || '—')} — ${esc(areaName(D.areaId) || '—')}, ${esc(unitName(D.unidade))}</dd>
      <dt>Responsável</dt><dd>${esc(emp(D.responsavelId)?.nome ?? '—')}</dd>
      <dt>Validade</dt><dd class="mono">${D.duracaoH}h a partir da liberação</dd></dl>`)}

    ${sec('02', `Equipe (${team.length})`, team.length ? `<div class="col g-2">${team.map((x) => `
      <div class="row-b"><span class="row g-2" style="font-size:12.5px;color:var(--tx-hi)">${avatar(x.e, 'av-sm')} ${esc(x.e.nome)}</span>
      <span style="font-size:11.5px;color:var(--tx-lo)">${esc(x.papel)}</span></div>`).join('')}</div>` : '<span class="t-lo">Nenhum colaborador vinculado.</span>')}

    ${sec('03', `Riscos (${D.riscos.length}) e medidas`, D.riscos.length
      ? `<div class="row g-2 wrap" style="margin-bottom:10px">${D.riscos.map((r) => `<span class="chip">${icon('alert', 12)} ${esc(riscoNome(r))}</span>`).join('')}</div>
         <div style="font-size:12px;color:var(--tx-lo);line-height:1.6">${esc(collectMedidas().join(' · ')) || '—'}</div>`
      : '<span class="t-lo">Nenhum risco avaliado.</span>')}

    ${sec('04', 'Medições', params.length ? `<div class="grid g-auto">${params.map((pid) =>
      D.medicoes[pid] != null && D.medicoes[pid] !== ''
        ? gaugeCard(pid, Number(D.medicoes[pid]), { compact: true })
        : `<div class="gauge-card"><div class="g-lbl">${esc(PARAMS[pid].nome)}</div>
           <div class="row-b" style="margin-top:8px"><span class="g-val">—</span><span class="badge b-idle">pendente</span></div></div>`
    ).join('')}</div>` : '<span class="t-lo">—</span>')}

    ${sec('05', 'Recursos', `<div class="row g-2 wrap">
      ${[...D.epis.map(epiNome), ...D.equipamentos, ...D.ferramentas].map((x) => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="t-lo">—</span>'}
    </div>`)}

    ${sec('06', 'Checklist de segurança', `<div class="col g-2">${CHECKLIST.map((c) => {
      const ok = D.checklist[c.id] ?? (c.auto ? autoChecks()[c.auto] === true : false);
      return `<div class="row g-2" style="font-size:12.5px;color:${ok ? 'var(--tx)' : 'var(--tx-dim)'}">
        <span style="color:${ok ? 'var(--ok)' : 'var(--tx-dim)'};display:flex">${icon(ok ? 'okCircle' : 'xCircle', 14)}</span>${esc(c.label)}</div>`;
    }).join('')}</div>`)}
  </div>`;
}

function collectMedidas() {
  const base = D.riscos.flatMap((r) => RISCOS[r]?.medidas ?? []);
  const extra = D.medidasExtra.split('\n').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...base, ...extra])];
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateStep(i) {
  const e = [];
  if (i === 0) {
    if (!D.tipo) e.push('Selecione o tipo de atividade.');
    if (D.titulo.trim().length < 5) e.push('Descreva a atividade (mínimo 5 caracteres).');
    if (!D.areaId) e.push('Selecione a área.');
    if (D.local.trim().length < 3) e.push('Informe o local específico.');
    if (!D.responsavelId) e.push('Defina o responsável pela permissão.');
  }
  if (i === 1 && !D.equipe.length) e.push('Vincule ao menos um colaborador à equipe.');
  if (i === 2 && !D.riscos.length) e.push('Selecione ao menos um risco identificado.');
  if (i === 3) {
    const params = atividadeById(D.tipo)?.params ?? [];
    const faltando = params.filter((p) => D.medicoes[p] == null || D.medicoes[p] === '');
    if (faltando.length) e.push(`Registre as medições pendentes: ${faltando.map((p) => PARAMS[p].nome).join(', ')}.`);
  }
  if (i === 4 && !D.epis.length) e.push('Selecione os EPIs obrigatórios.');
  if (i === 5) {
    const auto = autoChecks();
    const pend = CHECKLIST.filter((c) => !(D.checklist[c.id] ?? (c.auto ? auto[c.auto] === true : false)));
    if (pend.length) e.push(`Confirme os itens do checklist: ${pend.map((c) => c.label).join('; ')}.`);
  }
  return e;
}

function validateAll() {
  const all = [];
  for (let i = 0; i < 6; i++) all.push(...validateStep(i));
  const params = atividadeById(D.tipo)?.params ?? [];
  const fora = params.filter((p) => D.medicoes[p] != null && classify(p, Number(D.medicoes[p])) === 'risk');
  if (fora.length) all.push(`Medições fora do parâmetro: ${fora.map((p) => PARAMS[p].nome).join(', ')}.`);
  return all;
}

/* ============================================================
   MOUNT
   ============================================================ */
export function mount(root) {
  /* Delegated listeners attach to `.wiz`, which is rebuilt by every full
     repaint — binding to `#view` instead would stack duplicate handlers. */
  const wiz = root.querySelector('.wiz');
  if (!wiz) return () => {};

  const repaint = () => {
    const view = document.querySelector('#view');
    view.innerHTML = render();
    mount(view);
    document.querySelector('#main').scrollTop = 0;
  };
  const repaintPane = () => {
    $('#wz-pane', root).innerHTML = pane();
    bindDirect();
  };

  /* ---- step navigation ---- */
  on(root, 'click', '[data-step]', (e, t) => {
    const target = Number(t.dataset.step);
    if (target > step) {
      for (let i = step; i < target; i++) {
        const errs = validateStep(i);
        if (errs.length) { toast('Etapa incompleta', errs[0], 'warn'); step = i; repaint(); return; }
      }
    }
    step = target; repaint();
  });

  $('#wz-prev', root)?.addEventListener('click', () => { if (step > 0) { step--; repaint(); } });
  $('#wz-next', root)?.addEventListener('click', () => {
    const errs = validateStep(step);
    if (errs.length) { toast('Etapa incompleta', errs[0], 'warn'); return; }
    step++; repaint();
  });

  $('#wz-done', root)?.addEventListener('click', () => {
    const problemas = validateAll();
    if (problemas.length) { toast('Não é possível liberar', problemas[0], 'risk', 6000); return; }
    const podeValidar = allow('pet.validate');
    confirm({
      title: podeValidar ? 'Liberar atividade' : 'Enviar para validação',
      confirmLabel: podeValidar ? 'Liberar atividade' : 'Enviar',
      message: podeValidar
        ? 'A permissão será emitida, validada e liberada em seu nome. O acesso da equipe será habilitado nas portarias e a ação ficará registrada na trilha de auditoria.'
        : 'A permissão será emitida e encaminhada à fila de validação de um gestor.',
      onConfirm: () => {
        const p = createPet({
          tipo: D.tipo, titulo: D.titulo.trim(), areaId: D.areaId, local: D.local.trim(),
          responsavelId: D.responsavelId, equipe: D.equipe,
          riscos: D.riscos, medidas: collectMedidas(),
          medicoes: Object.entries(D.medicoes).filter(([, v]) => v !== '' && v != null)
            .map(([param, valor]) => ({ param, valor: Number(valor) })),
          epis: D.epis, equipamentos: D.equipamentos, ferramentas: D.ferramentas,
          checklist: Object.fromEntries(CHECKLIST.map((c) => [c.id, true])),
          observacoes: D.observacoes,
          fimPrevisto: Date.now() + D.duracaoH * 3600000,
        });
        if (podeValidar) validatePet(p.id);
        D = null; step = 0; teamQuery = '';
        toast(
          podeValidar ? 'Permissão liberada' : 'Permissão enviada para validação',
          `${p.codigo} — ${podeValidar ? 'a equipe já pode acessar a área.' : 'aguardando aprovação de um gestor.'}`,
          'ok', 6000);
        location.hash = `#/pets/${p.id}`;
      },
    });
  });

  bindDelegated();
  bindDirect();

  /* Delegated handlers are attached once — the pane is re-rendered in place. */
  function bindDelegated() {
    /* 01 */
    on(wiz, 'click', '[data-tipo]', (e, t) => {
      D.tipo = t.dataset.tipo;
      const a = atividadeById(D.tipo);
      D.duracaoH = a.validadeH;
      D.riscos = [...a.riscos];
      D.epis = [...a.epis];
      repaintPane();
    });
    /* 02 */
    on(wiz, 'click', '[data-emp]', (e, t) => {
      const id = t.dataset.emp;
      const i = D.equipe.findIndex((m) => m.empId === id);
      if (i >= 0) D.equipe.splice(i, 1);
      else D.equipe.push({ empId: id, papel: D.equipe.length === 0 ? 'Executante líder' : 'Executante' });
      repaintPane();
    });
    on(wiz, 'click', '[data-rm]', (e, t) => {
      e.stopPropagation();
      D.equipe = D.equipe.filter((m) => m.empId !== t.dataset.rm);
      repaintPane();
    });
    on(wiz, 'change', '[data-papel]', (e, t) => {
      const m = D.equipe.find((x) => x.empId === t.dataset.papel);
      if (m) m.papel = t.value;
    });

    /* 03 */
    on(wiz, 'click', '[data-risco]', (e, t) => {
      const r = t.dataset.risco;
      D.riscos = D.riscos.includes(r) ? D.riscos.filter((x) => x !== r) : [...D.riscos, r];
      repaintPane();
    });

    /* 04 */
    on(wiz, 'input', '[data-med]', debounce((e, t) => {
      D.medicoes[t.dataset.med] = t.value;
      repaintPane();
      const f = root.querySelector(`[data-med="${t.dataset.med}"]`);
      f?.focus(); f?.setSelectionRange(f.value.length, f.value.length);
    }, 420));

    /* 05 */
    on(wiz, 'click', '[data-epi]', (e, t) => {
      const x = t.dataset.epi;
      D.epis = D.epis.includes(x) ? D.epis.filter((y) => y !== x) : [...D.epis, x];
      repaintPane();
    });
    on(wiz, 'click', '[data-epiname]', (e, t) => {
      const nome = t.dataset.epiname;
      const id = Object.keys(EPIS).find((k) => EPIS[k] === nome);
      if (!id) return;
      D.epis = D.epis.includes(id) ? D.epis.filter((y) => y !== id) : [...D.epis, id];
      repaintPane();
    });
    on(wiz, 'click', '[data-equip]', (e, t) => {
      const x = t.dataset.equip;
      D.equipamentos = D.equipamentos.includes(x) ? D.equipamentos.filter((y) => y !== x) : [...D.equipamentos, x];
      repaintPane();
    });
    on(wiz, 'click', '[data-ferr]', (e, t) => {
      const x = t.dataset.ferr;
      D.ferramentas = D.ferramentas.includes(x) ? D.ferramentas.filter((y) => y !== x) : [...D.ferramentas, x];
      repaintPane();
    });

    /* 06 */
    on(wiz, 'click', '[data-check]', (e, t) => {
      const id = t.dataset.check;
      const auto = autoChecks();
      const c = CHECKLIST.find((x) => x.id === id);
      const atual = D.checklist[id] ?? (c.auto ? auto[c.auto] === true : false);
      D.checklist[id] = !atual;
      repaintPane();
    });
  }

  /* Listeners bound to elements that are replaced on every pane repaint. */
  function bindDirect() {
    $('#f-titulo', root)?.addEventListener('input', (e) => { D.titulo = e.target.value; });
    $('#f-local', root)?.addEventListener('input', (e) => { D.local = e.target.value; });
    $('#f-obs', root)?.addEventListener('input', (e) => { D.observacoes = e.target.value; });
    $('#f-dur', root)?.addEventListener('input', (e) => { D.duracaoH = Math.max(1, Math.min(24, Number(e.target.value) || 8)); });
    $('#f-resp', root)?.addEventListener('change', (e) => { D.responsavelId = e.target.value; });
    $('#f-unidade', root)?.addEventListener('change', (e) => { D.unidade = e.target.value; D.areaId = ''; repaintPane(); });
    $('#f-area', root)?.addEventListener('change', (e) => { D.areaId = e.target.value; });

    $('#f-team-q', root)?.addEventListener('input', debounce((e) => {
      teamQuery = e.target.value;
      repaintPane();
      const f = $('#f-team-q', root);
      f?.focus(); f?.setSelectionRange(f.value.length, f.value.length);
    }, 240));

    $('#f-riscos-all', root)?.addEventListener('click', () => {
      D.riscos = [...new Set([...D.riscos, ...(atividadeById(D.tipo)?.riscos ?? [])])];
      repaintPane();
    });
    $('#f-medidas', root)?.addEventListener('input', (e) => { D.medidasExtra = e.target.value; });

    $('#f-med-sensor', root)?.addEventListener('click', () => {
      const params = atividadeById(D.tipo)?.params ?? [];
      params.forEach((pid) => {
        const s = state.sensors[`${D.areaId}:${pid}`];
        D.medicoes[pid] = s ? s.ultimo : PARAMS[pid].ideal;
      });
      repaintPane();
      toast('Leituras importadas', `${params.length} parâmetro(s) preenchido(s) a partir dos detectores da área.`, 'ok');
    });

    $('#f-epi-all', root)?.addEventListener('click', () => {
      D.epis = [...new Set([...D.epis, ...(atividadeById(D.tipo)?.epis ?? [])])];
      repaintPane();
    });
  }

  return () => {};
}
