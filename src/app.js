/**
 * PET CONTROL — Application shell, router and bootstrap.
 */

import { $, $$, esc, on, hhmmss, dayLabel, dur, ago } from './util.js';
import { icon } from './ui/icons.js';
import { avatar, levelTag } from './ui/kit.js';
import { toast, modal, drawer, close as closeOverlay } from './ui/overlay.js';
import { state, subscribe, me, myLevel, allow, signOut, setUI, startSimulation, resolveAlert } from './store.js';
import { alertasAbertos, kpis } from './selectors.js';
import { UNITS, NIVEIS, unitName, ALERTA_TIPOS, areaName } from './data/catalog.js';
import { renderAuth } from './screens/auth.js';

/* ============================================================
   ROUTES
   ============================================================ */
const ROUTES = [
  { id: 'dashboard',      label: 'Dashboard',        ico: 'dashboard', grupo: 'Operação',      cap: null,           mod: () => import('./screens/dashboard.js') },
  { id: 'pets',           label: 'Permissões (PETs)', ico: 'permit',   grupo: 'Operação',      cap: 'pet.view',     mod: () => import('./screens/pets.js') },
  { id: 'validacao',      label: 'Validação',        ico: 'checks',    grupo: 'Operação',      cap: 'pet.view',     mod: () => import('./screens/validacao.js') },
  { id: 'acessos',        label: 'Acessos',          ico: 'scanface',  grupo: 'Operação',      cap: 'access.view',  mod: () => import('./screens/acessos.js') },

  { id: 'medicoes',       label: 'Medições',         ico: 'gauge',     grupo: 'Monitoramento', cap: 'med.view',     mod: () => import('./screens/medicoes.js') },
  { id: 'alertas',        label: 'Alertas',          ico: 'alert',     grupo: 'Monitoramento', cap: 'alert.view',   mod: () => import('./screens/alertas.js') },
  { id: 'rastreabilidade', label: 'Rastreabilidade', ico: 'trace',     grupo: 'Monitoramento', cap: 'trace.view',   mod: () => import('./screens/rastreabilidade.js') },

  { id: 'funcionarios',   label: 'Funcionários',     ico: 'users',     grupo: 'Gestão',        cap: 'emp.view',     mod: () => import('./screens/funcionarios.js') },
  { id: 'relatorios',     label: 'Relatórios',       ico: 'report',    grupo: 'Gestão',        cap: 'report.view',  mod: () => import('./screens/relatorios.js') },

  { id: 'transformacao',  label: 'Antes × Depois',   ico: 'swap',      grupo: 'Plataforma',    cap: null,           mod: () => import('./screens/transformacao.js') },
  { id: 'configuracoes',  label: 'Configurações',    ico: 'settings',  grupo: 'Plataforma',    cap: null,           mod: () => import('./screens/configuracoes.js') },
];
const GRUPOS = ['Operação', 'Monitoramento', 'Gestão', 'Plataforma'];
const routeById = (id) => ROUTES.find((r) => r.id === id);

/* ============================================================
   SHELL
   ============================================================ */
function shellHTML() {
  return `<div class="shell ${state.ui.navCollapsed ? 'nav-collapsed' : ''}" id="shell">
    <nav class="nav" id="nav">
      <div class="brand">
        <div class="brand-mark">${icon('shieldOk')}</div>
        <div class="brand-tx">
          <div class="n">PET CONTROL</div>
          <div class="s">Permissões de trabalho</div>
        </div>
      </div>
      <div class="nav-scroll" id="nav-scroll"></div>
      <div class="nav-ft">
        <div class="nav-status">
          <span class="s-dot"></span>
          <div class="s-tx">
            <div class="a">Monitoramento ativo</div>
            <div class="b" id="nav-sensors">— sensores</div>
          </div>
        </div>
      </div>
    </nav>

    <header class="top">
      <button class="top-btn hide-sm" id="btn-nav" title="Recolher menu">${icon('panelLeft')}</button>
      <div class="top-unit">
        <span class="u-ico">${icon('building')}</span>
        <div class="u-tx">
          <div class="a" id="top-unit-name">Todas as unidades</div>
          <div class="b" id="top-unit-sub">Operação integrada</div>
        </div>
      </div>
      <button class="btn btn-sm btn-outline hide-sm" id="btn-unit">${icon('layers')} Trocar</button>

      <div class="grow"></div>

      <div class="sess hide-sm" id="sess-chip">
        <span class="d"></span><span class="tx">Sessão ativa</span><span class="tm" id="sess-time">00:00</span>
      </div>
      <div class="top-sep"></div>
      <div class="top-clock">
        <div class="t" id="clock">--:--:--</div>
        <div class="d" id="clock-day">—</div>
      </div>
      <div class="top-sep"></div>
      <button class="top-btn" id="btn-bell" title="Notificações">${icon('bell')}<span class="nb hidden" id="bell-count">0</span></button>
      <button class="top-user" id="btn-user"></button>
    </header>

    <main class="main" id="main"><div id="view"></div></main>
  </div>`;
}

function renderNav() {
  const host = $('#nav-scroll');
  if (!host) return;
  const lvl = myLevel();
  const abertos = alertasAbertos();
  const k = kpis();
  const counts = {
    pets: k.ativas,
    validacao: k.validacao,
    alertas: abertos.length,
  };
  const criticos = abertos.some((a) => a.sev === 'risk');

  host.innerHTML = GRUPOS.map((g) => {
    const items = ROUTES.filter((r) => r.grupo === g);
    if (!items.length) return '';
    return `<div class="nav-group">
      <div class="gl">${esc(g)}</div>
      ${items.map((r) => {
        const locked = r.cap && !allow(r.cap);
        const n = counts[r.id];
        return `<a class="nav-item ${locked ? 'locked' : ''}" data-route="${r.id}" href="#/${r.id}" title="${esc(r.label)}">
          ${icon(r.ico)}
          <span class="lbl">${esc(r.label)}</span>
          ${locked ? icon('lock', 12, 'lock') : n ? `<span class="pill ${r.id === 'alertas' && criticos ? 'hot' : ''}">${n}</span>` : ''}
        </a>`;
      }).join('')}
    </div>`;
  }).join('');

  const cur = location.hash.replace('#/', '').split('/')[0] || 'dashboard';
  $$('.nav-item').forEach((n) => n.classList.toggle('on', n.dataset.route === cur));
}

function renderTopUser() {
  const u = me();
  const btn = $('#btn-user');
  if (!btn || !u) return;
  btn.innerHTML = `${avatar(u, 'av-sm')}
    <span class="u-tx"><span class="a">${esc(u.nome.split(' ').slice(0, 2).join(' '))}</span><span class="b">${levelTag(u.nivel)}</span></span>
    ${icon('chevD')}`;
}

function renderTopUnit() {
  const u = state.ui.unidade;
  const n = $('#top-unit-name'), s = $('#top-unit-sub');
  if (!n) return;
  if (u === 'TODAS') { n.textContent = 'Todas as unidades'; s.textContent = 'Operação integrada'; }
  else { const un = UNITS.find((x) => x.id === u); n.textContent = un.nome; s.textContent = `${un.sigla} · Turno ${un.turno}`; }
}

function renderBell() {
  const abertos = alertasAbertos();
  const b = $('#bell-count');
  if (!b) return;
  b.textContent = abertos.length;
  b.classList.toggle('hidden', abertos.length === 0);
  b.style.background = abertos.some((a) => a.sev === 'risk') ? 'var(--risk)' : 'var(--warn)';
}

function renderSensorStatus() {
  const n = $('#nav-sensors');
  if (!n) return;
  const total = Object.keys(state.sensors).length;
  n.textContent = `${total} sensores · ${state.ui.simulacao ? 'tempo real' : 'pausado'}`;
}

/* ---------- clocks ---------- */
function startClock() {
  const tick = () => {
    const c = $('#clock'); if (!c) return;
    c.textContent = hhmmss(Date.now());
    $('#clock-day').textContent = dayLabel(Date.now());
    const s = $('#sess-time');
    if (s && state.session) s.textContent = dur(state.session.iniciadaEm);
  };
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   NOTIFICATION PANEL
   ============================================================ */
function openNotifications() {
  const abertos = alertasAbertos();
  drawer({
    title: 'Notificações',
    sub: `${abertos.length} alerta(s) em aberto`,
    width: 460,
    body: abertos.length ? `<div class="col g-2">${abertos.slice(0, 20).map((a) => {
      const t = ALERTA_TIPOS[a.tipo] ?? ALERTA_TIPOS.SISTEMA;
      return `<div class="panel panel-flat" style="padding:13px 14px">
        <div class="row-b" style="align-items:flex-start;gap:10px">
          <div class="row g-3" style="align-items:flex-start">
            <span class="feed-ico" style="color:var(--${a.sev === 'risk' ? 'risk' : a.sev === 'warn' ? 'warn' : 'info'})">${icon(t.icon)}</span>
            <div>
              <div style="font-size:12.5px;color:var(--tx-hi);font-weight:600">${esc(a.titulo)}</div>
              <div style="font-size:11.5px;color:var(--tx-lo);margin-top:3px;line-height:1.5">${esc(a.descricao)}</div>
              <div class="row g-3 wrap" style="margin-top:7px">
                <span class="mono" style="font-size:10px;color:var(--tx-dim)">${esc(ago(a.ts))}</span>
                <span style="font-size:10.5px;color:var(--tx-dim)">${esc(areaName(a.areaId))}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" data-resolve="${esc(a.id)}" title="Marcar como tratado">${icon('check')}</button>
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="empty">${icon('okCircle')}<div class="t">Nenhum alerta em aberto</div><div class="s">A operação está dentro dos parâmetros.</div></div>`,
    footer: `<button class="btn" data-close>Fechar</button>
      <a class="btn btn-primary" href="#/alertas" data-close>${icon('alert')} Abrir central de alertas</a>`,
    onMount(root) {
      on(root, 'click', '[data-resolve]', (e, t) => {
        resolveAlert(t.dataset.resolve);
        toast('Alerta tratado', 'A tratativa foi registrada na trilha de auditoria.', 'ok');
        closeOverlay();
      });
    },
  });
}

/* ============================================================
   UNIT SWITCHER · USER MENU
   ============================================================ */
function openUnitPicker() {
  const opts = [{ id: 'TODAS', nome: 'Todas as unidades', sigla: 'ALL', turno: 'Visão consolidada', areas: [] }, ...UNITS];
  modal({
    title: 'Unidade / operação',
    sub: 'Define o escopo de todos os indicadores e listagens',
    width: 520,
    body: `<div class="col g-2">${opts.map((u) => `
      <button class="pick ${state.ui.unidade === u.id ? 'on' : ''}" data-unit="${esc(u.id)}">
        <span class="pk-box">${icon('check')}</span>
        <span class="grow">
          <span class="pk-t">${esc(u.nome)}</span>
          <span class="pk-s">${esc(u.turno)}${u.areas.length ? ` · ${u.areas.length} áreas monitoradas` : ''}</span>
        </span>
      </button>`).join('')}</div>`,
    onMount(root) {
      on(root, 'click', '[data-unit]', (e, t) => {
        setUI({ unidade: t.dataset.unit });
        closeOverlay();
        toast('Escopo atualizado', `Exibindo ${t.dataset.unit === 'TODAS' ? 'todas as unidades' : unitName(t.dataset.unit)}.`, 'info', 2600);
      });
    },
  });
}

function openUserMenu() {
  const u = me();
  if (!u) return;
  const caps = NIVEIS[u.nivel];
  modal({
    title: 'Sessão do usuário',
    width: 520,
    body: `<div class="row g-4" style="align-items:center;margin-bottom:18px">
        ${avatar(u, 'av-xl')}
        <div>
          <div style="font-size:17px;font-weight:650;color:var(--tx-hi)">${esc(u.nome)}</div>
          <div style="font-size:12.5px;color:var(--tx-lo);margin-top:3px">${esc(u.funcao)} · ${esc(u.matricula)}</div>
          <div style="margin-top:8px">${levelTag(u.nivel)}</div>
        </div>
      </div>
      <div class="panel panel-inset" style="padding:14px">
        <dl class="kv">
          <dt>Nível de acesso</dt><dd>${esc(caps.label)} — ${esc(caps.desc)}</dd>
          <dt>Unidade</dt><dd>${esc(unitName(u.unidade))}</dd>
          <dt>Áreas autorizadas</dt><dd>${u.areas.map(areaName).map(esc).join(' · ') || '—'}</dd>
          <dt>Autenticação</dt><dd>Reconhecimento facial · confiança ${esc(String(state.session?.confianca ?? '—'))}%</dd>
          <dt>Sessão iniciada</dt><dd class="mono">${esc(new Date(state.session?.iniciadaEm ?? Date.now()).toLocaleString('pt-BR'))}</dd>
        </dl>
      </div>`,
    footer: `<button class="btn" data-close>Fechar</button>
      <button class="btn btn-risk" id="btn-logout">${icon('logout')} Encerrar sessão</button>`,
    onMount(root) {
      root.querySelector('#btn-logout').addEventListener('click', () => {
        closeOverlay();
        signOut();
        booted = false;
        boot();
      });
    },
  });
}

/* ============================================================
   ROUTER
   ============================================================ */
let current = null;
let disposeScreen = null;

async function navigate() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [id, ...rest] = raw.split('/');
  const route = routeById(id) ?? routeById('dashboard');

  if (route.cap && !allow(route.cap)) {
    $('#view').innerHTML = deniedHTML(route);
    $$('.nav-item').forEach((n) => n.classList.remove('on'));
    return;
  }

  const view = $('#view');
  view.innerHTML = `<div class="page"><div class="skeleton" style="height:78px;border-radius:12px"></div>
    <div class="grid g-kpi" style="margin-top:16px">${'<div class="skeleton" style="height:108px;border-radius:12px"></div>'.repeat(5)}</div>
    <div class="skeleton" style="height:300px;border-radius:12px;margin-top:16px"></div></div>`;

  try {
    disposeScreen?.();
    disposeScreen = null;
    const mod = await route.mod();
    current = { route, params: rest };
    view.innerHTML = mod.render(rest);
    disposeScreen = mod.mount?.(view, rest) ?? null;
    $('#main').scrollTop = 0;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="page"><div class="panel"><div class="panel-bd">
      <div class="empty">${icon('warnCircle')}<div class="t">Não foi possível carregar esta tela</div>
      <div class="s">${esc(err.message)}</div></div></div></div></div>`;
  }
  renderNav();
}

function deniedHTML(route) {
  const u = me();
  return `<div class="page"><div class="panel" style="max-width:560px;margin:60px auto">
    <div class="panel-bd" style="text-align:center;padding:44px 32px">
      <div style="width:54px;height:54px;border-radius:14px;background:rgba(240,87,77,.1);color:var(--risk);display:grid;place-items:center;margin:0 auto 18px">${icon('lock', 24)}</div>
      <h2 style="font-size:17px">Acesso restrito</h2>
      <p style="font-size:12.5px;color:var(--tx-lo);margin-top:9px;line-height:1.6">
        A área <strong style="color:var(--tx-hi)">${esc(route.label)}</strong> não está disponível para o nível
        <strong style="color:var(--tx-hi)">${esc(NIVEIS[u?.nivel]?.label ?? '—')}</strong>.<br>
        Solicite elevação de permissão à coordenação de SSMA.
      </p>
      <a class="btn btn-primary" href="#/dashboard" style="margin-top:20px">${icon('dashboard')} Voltar ao dashboard</a>
    </div></div></div>`;
}

/* ============================================================
   BOOT
   ============================================================ */
function mountShell() {
  const app = $('#app');
  app.innerHTML = shellHTML();

  renderNav(); renderTopUser(); renderTopUnit(); renderBell(); renderSensorStatus();
  startClock();

  $('#btn-nav').addEventListener('click', () => {
    setUI({ navCollapsed: !state.ui.navCollapsed });
    $('#shell').classList.toggle('nav-collapsed', state.ui.navCollapsed);
  });
  $('#btn-bell').addEventListener('click', openNotifications);
  $('#btn-user').addEventListener('click', openUserMenu);
  $('#btn-unit').addEventListener('click', openUnitPicker);

  window.addEventListener('hashchange', navigate);

  subscribe((s, reason) => {
    renderNav(); renderBell(); renderTopUnit(); renderSensorStatus();
    if (reason === 'ui' || reason === 'reset') navigate();
  });

  startSimulation();
  navigate();
}

let booted = false;
export function boot(force = false) {
  if (booted && !force) return;
  booted = true;
  const app = $('#app');
  if (!state.session) {
    app.innerHTML = '';
    renderAuth((person) => {
      booted = true;
      mountShell();
      setTimeout(() => toast(
        `Bem-vindo(a), ${person.nome.split(' ')[0]}`,
        `Sessão iniciada por reconhecimento facial · nível ${NIVEIS[person.nivel].label}.`, 'ok', 5200), 380);
    });
    return;
  }
  mountShell();
}

/* global helpers used by screens */
export { ROUTES, routeById };

window.addEventListener('hashchange', () => { if (state.session) renderNav(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot());
else boot();
