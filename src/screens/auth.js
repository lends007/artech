/**
 * PET CONTROL — Facial identification.
 *
 * MVP scope: biometric matching is SIMULATED against the registered employee
 * base. The camera feed is real when the browser allows it; the pipeline,
 * confidence scoring and permission check are demonstrations of the concept,
 * not a biometric implementation.
 */

import { $, el, esc, sleep, rnd } from '../util.js';
import { icon } from '../ui/icons.js';
import { attachFeed, meshSVG, releaseStream } from '../ui/camera.js';
import { avatar, levelTag } from '../ui/kit.js';
import { artechLogo } from '../ui/brand.js';
import { state, signIn } from '../store.js';
import { DEMO_FACES } from '../data/seed.js';
import { unitName } from '../data/catalog.js';

const PIPE = [
  { id: 'cam',   label: 'Câmera ativa' },
  { id: 'read',  label: 'Leitura facial' },
  { id: 'ident', label: 'Identificação do colaborador' },
  { id: 'perm',  label: 'Validação de permissão' },
  { id: 'grant', label: 'Acesso liberado' },
];

export function renderAuth(onDone) {
  const root = el(`<div class="auth">
    <!-- ---------- narrative ---------- -->
    <aside class="auth-side">
      <div class="auth-brand">
        <div class="m">${icon('shieldOk')}</div>
        <div>
          <div class="n">PET CONTROL</div>
          <div class="s">Gestão inteligente de Permissões de Entrada de Trabalho</div>
        </div>
      </div>

      <div class="auth-hero">
        <h1>Da folha de papel ao <em>controle em tempo real</em>.</h1>
        <p>
          Permissões digitais, identificação de pessoas, validação assistida, medições
          monitoradas e trilha de auditoria completa — em uma única plataforma operacional.
        </p>
        <div class="auth-pills">
          <span>${icon('scanface')} Identificação facial</span>
          <span>${icon('checks')} Validação assistida</span>
          <span>${icon('gauge')} Medições monitoradas</span>
          <span>${icon('trace')} Rastreabilidade ponta a ponta</span>
        </div>
      </div>

      <div class="auth-foot">
        <div class="auth-by">
          <div class="eyebrow" style="margin-bottom:9px">Uma solução</div>
          ${artechLogo({ size: 34 })}
        </div>
        <div class="col g-2" style="align-items:flex-end">
          <span class="mono">PLATAFORMA v0.9 · MVP DEMONSTRATIVO</span>
          <span class="row g-2">${icon('wifi', 12)} <span class="mono">Rede industrial · OK</span></span>
        </div>
      </div>
    </aside>

    <!-- ---------- scanner ---------- -->
    <main class="auth-main">
      <div class="auth-title">
        <div class="eyebrow">Controle de acesso · Biometria</div>
        <h2 id="au-h">Olhe para a câmera para continuar</h2>
        <p id="au-p">A identificação substitui usuário e senha no ambiente operacional.</p>
      </div>

      <div class="cam" id="au-cam">
        <div class="fx-scan"></div><div class="fx-tint"></div><div class="fx-vig"></div>
        <span class="hud-c tl"></span><span class="hud-c tr"></span>
        <span class="hud-c bl"></span><span class="hud-c br"></span>
        <div class="face-frame"></div>
        ${meshSVG()}
        <div class="scanbar"></div>
        <div class="cam-status">
          <span class="cs-dot"></span>
          <div class="cs-tx">
            <div class="a" id="au-st">Câmera em espera</div>
            <div class="b" id="au-sub">CAM-01 · PORTARIA UN-A · 640×480</div>
          </div>
          <div class="cs-conf" id="au-conf">—</div>
        </div>
      </div>

      <div class="pipe" id="au-pipe">
        ${PIPE.map((s, i) => `<div class="pipe-step" data-step="${s.id}">
          <span class="pn">0${i + 1}</span>
          <span class="pi">${icon('chevR', 12)}</span>
          <span class="grow">${esc(s.label)}</span>
        </div>`).join('')}
      </div>

      <div id="au-result"></div>

      <div class="demo-pick" id="au-pick">
        <div class="dp-hd"><span class="ln"></span><span>Simulação · selecione um rosto cadastrado</span><span class="ln"></span></div>
        <div class="dp-grid" id="au-grid"></div>
        <button class="btn btn-ghost btn-sm btn-block" id="au-unknown" style="margin-top:7px">
          ${icon('userX')} Simular rosto não cadastrado
        </button>
      </div>
    </main>
  </div>`);

  document.body.appendChild(root);

  /* demo identities */
  const faces = DEMO_FACES.map((id) => state.employees.find((e) => e.id === id)).filter(Boolean);
  $('#au-grid', root).innerHTML = faces.map((e) => `
    <button class="dp-card" data-emp="${esc(e.id)}">
      ${avatar(e, 'av-sm')}
      <span class="dp-tx">
        <span class="a">${esc(e.nome)}</span>
        <span class="b">${levelTag(e.nivel)}</span>
      </span>
    </button>`).join('');

  let stopFeed = () => {};
  attachFeed($('#au-cam', root)).then((s) => { stopFeed = s; setStatus('idle'); });

  /* ---------- state helpers ---------- */
  const cam = $('#au-cam', root);
  const setCam = (cls) => { cam.className = `cam ${cls}`; };
  const setStep = (id, cls) => {
    const n = root.querySelector(`[data-step="${id}"]`);
    if (!n) return;
    n.className = `pipe-step ${cls}`;
    n.querySelector('.pi').innerHTML = cls === 'doing' ? '<span class="spin"></span>'
      : cls === 'done' ? icon('check', 12)
      : cls === 'fail' ? icon('x', 12)
      : icon('chevR', 12);
  };
  const resetSteps = () => PIPE.forEach((s) => setStep(s.id, ''));

  function setStatus(kind, { titulo, sub, conf } = {}) {
    const map = {
      idle:   ['Câmera em espera', 'Aguardando aproximação'],
      scan:   ['Leitura facial em andamento', 'Capturando pontos de referência'],
      lock:   ['Rosto detectado', 'Estabilizando template biométrico'],
      verify: ['Consultando base de colaboradores', 'Verificando permissões vigentes'],
      ok:     ['Identificação concluída', 'Permissão validada'],
      bad:    ['Identificação falhou', 'Nenhuma correspondência na base'],
    };
    const [a, b] = map[kind] ?? map.idle;
    $('#au-st', root).textContent = titulo ?? a;
    $('#au-sub', root).textContent = sub ?? `CAM-01 · PORTARIA UN-A · ${b}`;
    $('#au-conf', root).textContent = conf != null ? `${conf}%` : '—';
  }

  let busy = false;

  /* ---------- the identification pipeline ---------- */
  async function identify(empId) {
    if (busy) return;
    busy = true;
    $('#au-pick', root).style.opacity = '.4';
    $('#au-pick', root).style.pointerEvents = 'none';
    $('#au-result', root).innerHTML = '';
    resetSteps();

    const person = empId ? state.employees.find((e) => e.id === empId) : null;

    /* 01 — camera */
    setCam('st-scan'); setStep('cam', 'doing'); setStatus('scan');
    await sleep(420); setStep('cam', 'done');

    /* 02 — facial read */
    setStep('read', 'doing');
    let conf = 0;
    const target = person ? rnd(96.4, 99.4) : rnd(38, 61);
    const t0 = performance.now();
    await new Promise((res) => {
      const tickAnim = () => {
        const k = Math.min(1, (performance.now() - t0) / 1400);
        conf = +(target * (1 - Math.pow(1 - k, 3))).toFixed(1);
        $('#au-conf', root).textContent = `${conf.toFixed(1)}%`;
        if (k < 1) requestAnimationFrame(tickAnim); else res();
      };
      tickAnim();
    });
    setStep('read', 'done');
    setCam('st-locked'); setStatus('lock', { conf: conf.toFixed(1) });
    await sleep(320);

    /* 03 — identity match */
    setStep('ident', 'doing'); setCam('st-verify'); setStatus('verify', { conf: conf.toFixed(1) });
    await sleep(620);

    if (!person) {
      setStep('ident', 'fail');
      setStep('perm', ''); setStep('grant', '');
      setCam('st-denied');
      setStatus('bad', { conf: conf.toFixed(1) });
      showDenied(conf);
      busy = false;
      $('#au-pick', root).style.opacity = '';
      $('#au-pick', root).style.pointerEvents = '';
      return;
    }
    setStep('ident', 'done');

    /* 04 — permission check */
    setStep('perm', 'doing');
    await sleep(560);
    setStep('perm', 'done');

    /* 05 — granted */
    setStep('grant', 'doing');
    setCam('st-granted');
    setStatus('ok', { conf: conf.toFixed(1) });
    showGranted(person, conf);
    await sleep(520);
    setStep('grant', 'done');

    await sleep(780);
    signIn(person.id, +conf.toFixed(1));
    root.classList.add('leaving');
    await sleep(340);
    stopFeed(); releaseStream();
    root.remove();
    onDone(person);
  }

  function showGranted(p, conf) {
    $('#au-result', root).innerHTML = `
      <div class="ident ok">
        ${avatar(p, 'av-lg')}
        <div class="id-tx">
          <div class="a">${esc(p.nome)}</div>
          <div class="b">${esc(p.funcao)} · ${esc(p.matricula)}</div>
        </div>
        <div style="text-align:right">
          <div>${levelTag(p.nivel)}</div>
          <div class="mono" style="font-size:10px;color:var(--tx-dim);margin-top:3px">${esc(unitName(p.unidade))}</div>
        </div>
      </div>
      <div class="row g-2" style="justify-content:center;margin-top:11px">
        <span class="badge b-ok badge-live"><i class="dot"></i>Acesso liberado</span>
        <span class="badge b-ac">Confiança ${conf.toFixed(1)}%</span>
      </div>`;
  }

  function showDenied(conf) {
    $('#au-result', root).innerHTML = `
      <div class="ident bad">
        <div class="av av-lg" style="background:rgba(240,87,77,.14);color:var(--risk);box-shadow:0 0 0 1px rgba(240,87,77,.3)">${icon('userX', 22)}</div>
        <div class="id-tx">
          <div class="a">Colaborador não identificado</div>
          <div class="b">Similaridade ${conf.toFixed(1)}% — abaixo do limiar de 92%</div>
        </div>
        <span class="badge b-risk"><i class="dot"></i>Bloqueado</span>
      </div>
      <div style="text-align:center;font-size:11.5px;color:var(--tx-lo);margin-top:10px">
        Registro enviado à central de alertas. Procure a supervisão de segurança.
      </div>`;
  }

  /* ---------- interactions ---------- */
  root.addEventListener('click', (e) => {
    const card = e.target.closest('[data-emp]');
    if (card) return identify(card.dataset.emp);
    if (e.target.closest('#au-unknown')) return identify(null);
  });

  /* Keyboard shortcut for a fast demo: Enter starts with the admin identity. */
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !busy) identify(DEMO_FACES[0]); });

  return root;
}
