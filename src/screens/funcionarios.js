/**
 * PET CONTROL — Cadastro de funcionários.
 * Identity is the foundation of the whole platform: without a registered face
 * and a valid training record, the turnstile will not open.
 */

import { esc, ago, dtFull, ddmmyy, matches, on, $, sleep, debounce, toCSV, downloadText } from '../util.js';
import { icon } from '../ui/icons.js';
import { avatar, panel, kpi, empty, levelTag, empStatusBadge, searchBox, selectBox } from '../ui/kit.js';
import { attachFeed, releaseStream, meshSVG } from '../ui/camera.js';
import { toast, modal, drawer, close as closeOverlay } from '../ui/overlay.js';
import { state, emp, allow, createEmployee, registerFace, setEmployeeStatus } from '../store.js';
import { empsInScope } from '../selectors.js';
import { UNITS, NIVEIS, NIVEL_LIST, areaName, unitName } from '../data/catalog.js';

const f = { q: '', nivel: 'TODOS', status: 'TODOS', unidade: 'TODAS' };

export function render() {
  const all = empsInScope();
  const rows = filtered();
  const comFace = all.filter((e) => e.face).length;
  const pend = all.filter((e) => e.status !== 'ATIVO' || !e.face
    || (e.treinamentos ?? []).some((t) => t.validade < Date.now())).length;

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('users')} Gestão ${icon('chevR')} Funcionários</div>
        <h1>Funcionários</h1>
        <p class="lead">Base cadastral que sustenta a identificação facial, os níveis de acesso e a autorização por área.</p>
      </div>
      <div class="acts">
        <button class="btn btn-outline" id="fn-export">${icon('download')} Exportar</button>
        ${allow('emp.create') ? `<button class="btn btn-primary" id="fn-new">${icon('plus')} Cadastrar funcionário</button>` : ''}
      </div>
    </div>

    <div class="grid g-kpi" style="margin-bottom:16px">
      ${kpi({ label: 'Cadastrados', value: all.length, ico: 'users', color: 'var(--ac)', foot: '<span>base ativa da unidade</span>' })}
      ${kpi({ label: 'Aptos ao acesso', value: all.filter((e) => e.status === 'ATIVO').length, ico: 'userCheck', color: 'var(--ok)', foot: '<span>sem restrições vigentes</span>' })}
      ${kpi({ label: 'Com biometria facial', value: comFace, unit: `/${all.length}`, ico: 'scanface', color: 'var(--info)', foot: `<span>${((comFace / (all.length || 1)) * 100).toFixed(0)}% da base</span>` })}
      ${kpi({ label: 'Pendências', value: String(pend).padStart(2, '0'), ico: 'warnCircle', color: pend ? 'var(--warn)' : 'var(--ok)', foot: '<span>treinamento, face ou situação</span>' })}
    </div>

    <section class="panel">
      <div class="toolbar">
        ${searchBox('fn-q', 'Buscar por nome, matrícula ou função…', f.q)}
        ${selectBox('fn-nivel', [{ value: 'TODOS', label: 'Todos os níveis' }, ...NIVEL_LIST.map((n) => ({ value: n, label: NIVEIS[n].label }))], f.nivel)}
        ${selectBox('fn-status', [{ value: 'TODOS', label: 'Todas as situações' }, { value: 'ATIVO', label: 'Ativo' }, { value: 'PENDENTE', label: 'Pendente' }, { value: 'AFASTADO', label: 'Afastado' }], f.status)}
        ${selectBox('fn-unidade', [{ value: 'TODAS', label: 'Todas as unidades' }, ...UNITS.map((u) => ({ value: u.id, label: u.nome }))], f.unidade)}
        <div class="grow"></div>
        <span class="mono" style="font-size:11px;color:var(--tx-dim)">${rows.length} de ${all.length}</span>
      </div>
      <div class="tbl-wrap">
        ${rows.length ? `<table class="tbl">
          <thead><tr><th>Colaborador</th><th>Função</th><th>Matrícula</th><th>Nível de acesso</th>
            <th>Áreas autorizadas</th><th>Biometria</th><th>Situação</th><th class="right">Último acesso</th></tr></thead>
          <tbody>${rows.slice(0, 100).map(rowHTML).join('')}</tbody>
        </table>` : empty('Nenhum funcionário encontrado', 'Ajuste os filtros ou cadastre um novo colaborador.', 'users')}
      </div>
    </section>
  </div>`;
}

function filtered() {
  return empsInScope().filter((e) => {
    if (f.nivel !== 'TODOS' && e.nivel !== f.nivel) return false;
    if (f.status !== 'TODOS' && e.status !== f.status) return false;
    if (f.unidade !== 'TODAS' && e.unidade !== f.unidade) return false;
    return matches(f.q, e.nome, e.matricula, e.funcao);
  }).sort((a, b) => b.cadastradoEm - a.cadastradoEm);
}

function rowHTML(e) {
  const vencido = (e.treinamentos ?? []).some((t) => t.validade < Date.now());
  return `<tr class="clickable" data-emp="${esc(e.id)}">
    <td><div class="row g-3">${avatar(e)}
      <div><div class="cell-hi">${esc(e.nome)}</div>
      <div style="font-size:11px;color:var(--tx-lo)">${esc(unitName(e.unidade))}</div></div></div></td>
    <td>${esc(e.funcao)}</td>
    <td class="mono" style="font-size:11.5px">${esc(e.matricula)}</td>
    <td>${levelTag(e.nivel)}</td>
    <td><span class="truncate" style="display:block;max-width:190px;font-size:11.5px;color:var(--tx-lo)">${esc(e.areas.map(areaName).join(', ')) || '—'}</span></td>
    <td>${e.face
      ? `<span class="badge b-ok"><i class="dot"></i>${e.faceQualidade}%</span>`
      : '<span class="badge b-warn"><i class="dot"></i>sem registro</span>'}</td>
    <td>${vencido ? '<span class="badge b-warn"><i class="dot"></i>NR vencida</span>' : empStatusBadge(e.status)}</td>
    <td class="right mono" style="font-size:11.5px">${e.ultimoAcesso ? esc(ago(e.ultimoAcesso)) : '—'}</td>
  </tr>`;
}

/* ============================================================
   DETAIL DRAWER
   ============================================================ */
function openDetail(id, refresh) {
  const e = emp(id);
  if (!e) return;
  const vinculos = state.pets.filter((p) => p.equipe.some((m) => m.empId === id))
    .sort((a, b) => b.criadaEm - a.criadaEm).slice(0, 6);
  const acessos = state.access.filter((a) => a.empId === id).slice(0, 6);

  drawer({
    title: e.nome,
    sub: `${e.funcao} · ${e.matricula}`,
    width: 580,
    body: `<div class="col g-5">
      <div class="row g-4" style="align-items:center">
        ${avatar(e, 'av-xl')}
        <div class="grow">
          <div class="row g-2 wrap">${levelTag(e.nivel)} ${empStatusBadge(e.status)}
            ${e.face ? `<span class="badge b-ac">${icon('scanface', 11)} biometria ${e.faceQualidade}%</span>` : '<span class="badge b-warn">sem biometria</span>'}</div>
          <div style="font-size:12px;color:var(--tx-lo);margin-top:8px">${esc(NIVEIS[e.nivel].desc)}</div>
        </div>
      </div>

      <div class="panel panel-inset" style="padding:14px">
        <dl class="kv">
          <dt>Unidade</dt><dd>${esc(unitName(e.unidade))}</dd>
          <dt>Áreas autorizadas</dt><dd>${esc(e.areas.map(areaName).join(' · ')) || '—'}</dd>
          <dt>Telefone</dt><dd class="mono">${esc(e.telefone || '—')}</dd>
          <dt>Cadastrado em</dt><dd class="mono">${esc(dtFull(e.cadastradoEm))}</dd>
          <dt>Último acesso</dt><dd class="mono">${e.ultimoAcesso ? esc(dtFull(e.ultimoAcesso)) : '—'}</dd>
          ${e.restricoes.length ? `<dt>Restrições</dt><dd class="t-warn">${esc(e.restricoes.join(' · '))}</dd>` : ''}
        </dl>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:10px">Treinamentos e certificações</div>
        <div class="col g-2">${(e.treinamentos ?? []).map((t) => {
          const venc = t.validade < Date.now();
          const perto = !venc && t.validade - Date.now() < 45 * 86400000;
          return `<div class="row-b" style="padding:8px 11px;border:1px solid var(--line-soft);border-radius:6px;background:var(--bg-inset)">
            <span style="font-size:12px;color:var(--tx)">${esc(t.nome)}</span>
            <span class="badge ${venc ? 'b-risk' : perto ? 'b-warn' : 'b-ok'}"><i class="dot"></i>${venc ? 'vencido' : `até ${ddmmyy(t.validade)}`}</span>
          </div>`;
        }).join('') || '<span class="t-lo" style="font-size:12px">Nenhum treinamento registrado.</span>'}</div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:10px">Permissões vinculadas</div>
        <div class="col g-2">${vinculos.map((p) => `
          <a class="row-b" href="#/pets/${esc(p.id)}" data-close style="padding:9px 11px;border:1px solid var(--line-soft);border-radius:6px">
            <div><div class="mono" style="font-size:11.5px;color:var(--ac)">${esc(p.codigo)}</div>
            <div class="truncate" style="font-size:11.5px;color:var(--tx-lo);max-width:300px">${esc(p.titulo)}</div></div>
            <span class="badge b-idle">${esc(p.status.toLowerCase().replace('_', ' '))}</span>
          </a>`).join('') || '<span class="t-lo" style="font-size:12px">Nenhuma permissão vinculada.</span>'}</div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:10px">Últimos acessos</div>
        <div class="col g-2">${acessos.map((a) => `
          <div class="row-b" style="font-size:11.5px">
            <span style="color:var(--tx)">${esc(areaName(a.areaId))} · ${a.direcao === 'SAIDA' ? 'saída' : 'entrada'}</span>
            <span class="row g-2"><span class="mono" style="color:var(--tx-dim)">${esc(dtFull(a.ts))}</span>
            <span class="badge ${a.resultado === 'LIBERADO' ? 'b-ok' : 'b-risk'}" style="height:18px;font-size:9px">${a.resultado === 'LIBERADO' ? 'ok' : 'bloq'}</span></span>
          </div>`).join('') || '<span class="t-lo" style="font-size:12px">Nenhum acesso registrado.</span>'}</div>
      </div>
    </div>`,
    footer: `<button class="btn" data-close>Fechar</button>
      ${!e.face && allow('emp.edit') ? `<button class="btn btn-primary" id="dt-face">${icon('scanface')} Registrar face</button>` : ''}
      ${allow('emp.edit') && e.status !== 'ATIVO' ? `<button class="btn btn-ok" id="dt-activate">${icon('check')} Regularizar</button>` : ''}`,
    onMount(root) {
      root.querySelector('#dt-face')?.addEventListener('click', () => {
        closeOverlay();
        openFaceCapture((q) => { registerFace(e.id, q); toast('Biometria registrada', `${e.nome} — template com ${q}% de qualidade.`, 'ok'); refresh?.(); });
      });
      root.querySelector('#dt-activate')?.addEventListener('click', () => {
        setEmployeeStatus(e.id, 'ATIVO');
        closeOverlay();
        toast('Cadastro regularizado', `${e.nome} está apto ao acesso.`, 'ok');
        refresh?.();
      });
    },
  });
}

/* ============================================================
   FACE CAPTURE
   ============================================================ */
export function openFaceCapture(onDone) {
  let stop = () => {};
  modal({
    title: 'Registro facial',
    sub: 'Captura do template biométrico do colaborador',
    width: 480,
    body: `<div class="col g-4">
      <div class="capture" id="cap-box">
        <div class="fx-scan"></div><div class="fx-vig"></div>
        <div class="cap-frame"></div>
        ${meshSVG()}
        <div class="cap-ft" id="cap-ft">Posicione o rosto dentro da moldura</div>
      </div>
      <div class="panel panel-inset" style="padding:12px 14px">
        <div class="row-b"><span class="eyebrow">Qualidade do template</span>
          <span class="num" id="cap-q" style="font-size:15px">—</span></div>
        <div class="progress" style="margin-top:9px"><i id="cap-bar" style="width:0%"></i></div>
        <div style="font-size:11px;color:var(--tx-dim);margin-top:9px;line-height:1.55">
          MVP demonstrativo: nenhuma imagem é armazenada. O template é simulado
          para demonstrar o fluxo de cadastro biométrico.
        </div>
      </div>
    </div>`,
    footer: `<button class="btn" data-close>Cancelar</button>
      <button class="btn btn-primary" id="cap-go">${icon('camera')} Capturar</button>`,
    onMount(root) {
      const box = root.querySelector('#cap-box');
      attachFeed(box).then((s) => { stop = s; });
      root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { stop(); releaseStream(); } });

      root.querySelector('#cap-go').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        btn.classList.add('btn-loading');
        root.querySelector('#cap-ft').textContent = 'Capturando pontos de referência…';
        let q = 0;
        const target = 88 + Math.round(Math.random() * 11);
        await new Promise((res) => {
          const t = setInterval(() => {
            q = Math.min(target, q + Math.random() * 9);
            root.querySelector('#cap-q').textContent = `${q.toFixed(0)}%`;
            root.querySelector('#cap-bar').style.width = `${q}%`;
            root.querySelector('#cap-bar').style.background = q > 85 ? 'var(--ok)' : q > 60 ? 'var(--warn)' : 'var(--risk)';
            if (q >= target) { clearInterval(t); res(); }
          }, 90);
        });
        box.classList.add('done');
        root.querySelector('#cap-ft').textContent = 'Template biométrico registrado com sucesso';
        btn.classList.remove('btn-loading');
        await sleep(650);
        stop(); releaseStream();
        closeOverlay();
        onDone(Math.round(target));
      });
    },
  });
}

/* ============================================================
   NEW EMPLOYEE
   ============================================================ */
function openNew(refresh, retomar = null) {
  const draft = retomar ?? {
    nome: '', funcao: '', matricula: `MT-${Math.floor(50000 + Math.random() * 9000)}`,
    nivel: 'OPERADOR', unidade: 'UN-A', areas: [], restricoes: '', telefone: '',
    face: false, faceQualidade: 0,
  };

  const areasHTML = () => {
    const u = UNITS.find((x) => x.id === draft.unidade);
    return u.areas.map((a) => `<button class="chip" data-area="${a.id}" type="button"
      style="${draft.areas.includes(a.id) ? 'border-color:var(--line-accent);background:var(--ac-glow-soft);color:var(--tx-hi)' : ''}">
      ${draft.areas.includes(a.id) ? icon('check', 12) : icon('plus', 12)} ${esc(a.nome)}</button>`).join('');
  };

  modal({
    title: 'Cadastrar funcionário',
    sub: 'Identificação, nível de acesso e registro biométrico',
    width: 720,
    body: `<div class="col g-5">
      <div>
        <div class="eyebrow" style="margin-bottom:12px">01 — Identificação</div>
        <div class="form-grid">
          <div class="field span-2"><label for="nf-nome">Nome completo</label>
            <input id="nf-nome" class="inp" value="${esc(draft.nome)}" placeholder="Ex.: Ana Paula Ribeiro"><span class="err">Informe o nome completo.</span></div>
          <div class="field"><label for="nf-funcao">Função</label>
            <input id="nf-funcao" class="inp" value="${esc(draft.funcao)}" placeholder="Ex.: Técnica de Segurança do Trabalho"><span class="err">Informe a função.</span></div>
          <div class="field"><label for="nf-mat">Matrícula</label>
            <input id="nf-mat" class="inp" value="${esc(draft.matricula)}"></div>
          <div class="field"><label for="nf-tel">Telefone</label>
            <input id="nf-tel" class="inp" value="${esc(draft.telefone)}" placeholder="(45) 90000-0000"></div>
        </div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:12px">02 — Acesso</div>
        <div class="form-grid">
          <div class="field"><label for="nf-nivel">Nível de acesso</label>
            <select id="nf-nivel" class="sel">${NIVEL_LIST.map((n) => `<option value="${n}" ${draft.nivel === n ? 'selected' : ''}>${esc(NIVEIS[n].label)}</option>`).join('')}</select>
            <span class="hint" id="nf-nivel-hint">${esc(NIVEIS[draft.nivel].desc)}</span></div>
          <div class="field"><label for="nf-unidade">Unidade</label>
            <select id="nf-unidade" class="sel">${UNITS.map((u) => `<option value="${u.id}" ${draft.unidade === u.id ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></div>
          <div class="field span-2"><label>Áreas permitidas</label>
            <div class="row g-2 wrap" id="nf-areas">${areasHTML()}</div>
            <span class="err">Selecione ao menos uma área.</span></div>
          <div class="field span-2"><label for="nf-restr">Restrições</label>
            <input id="nf-restr" class="inp" value="${esc(draft.restricoes)}" placeholder="Ex.: não autorizado a espaço confinado"></div>
        </div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:12px">03 — Identificação facial</div>
        <div class="panel panel-inset" style="padding:14px">
          <div class="row-b wrap g-3">
            <div class="row g-3">
              <span class="feed-ico" id="nf-face-ico" style="color:var(--tx-dim)">${icon('scanface')}</span>
              <div>
                <div style="font-size:12.5px;color:var(--tx-hi)" id="nf-face-t">Nenhum registro facial</div>
                <div style="font-size:11.5px;color:var(--tx-lo);margin-top:2px" id="nf-face-s">
                  Sem biometria, o colaborador não será liberado nas portarias.
                </div>
              </div>
            </div>
            <button class="btn btn-outline" id="nf-face" type="button">${icon('camera')} Capturar rosto</button>
          </div>
        </div>
      </div>
    </div>`,
    footer: `<button class="btn" data-close>Cancelar</button>
      <button class="btn btn-primary" id="nf-save">${icon('check')} Cadastrar colaborador</button>`,
    onMount(root) {
      const nivel = root.querySelector('#nf-nivel');
      nivel.addEventListener('change', () => {
        draft.nivel = nivel.value;
        root.querySelector('#nf-nivel-hint').textContent = NIVEIS[draft.nivel].desc;
      });
      root.querySelector('#nf-unidade').addEventListener('change', (e) => {
        draft.unidade = e.target.value; draft.areas = [];
        root.querySelector('#nf-areas').innerHTML = areasHTML();
      });
      on(root, 'click', '[data-area]', (e, t) => {
        const a = t.dataset.area;
        draft.areas = draft.areas.includes(a) ? draft.areas.filter((x) => x !== a) : [...draft.areas, a];
        root.querySelector('#nf-areas').innerHTML = areasHTML();
      });

      root.querySelector('#nf-face').addEventListener('click', () => {
        const nome = root.querySelector('#nf-nome').value.trim();
        Object.assign(draft, {
          nome, funcao: root.querySelector('#nf-funcao').value.trim(),
          matricula: root.querySelector('#nf-mat').value.trim(),
          telefone: root.querySelector('#nf-tel').value.trim(),
          restricoes: root.querySelector('#nf-restr').value.trim(),
        });
        closeOverlay();
        openFaceCapture((q) => {
          draft.face = true; draft.faceQualidade = q;
          openNew(refresh, draft);
        });
      });

      root.querySelector('#nf-save').addEventListener('click', () => {
        const nome = root.querySelector('#nf-nome');
        const funcao = root.querySelector('#nf-funcao');
        let bad = false;
        [[nome, nome.value.trim().length > 4], [funcao, funcao.value.trim().length > 2]].forEach(([inp, ok]) => {
          inp.closest('.field').classList.toggle('invalid', !ok);
          if (!ok) bad = true;
        });
        const areaField = root.querySelector('#nf-areas').closest('.field');
        areaField.classList.toggle('invalid', draft.areas.length === 0);
        if (draft.areas.length === 0) bad = true;
        if (bad) { toast('Cadastro incompleto', 'Revise os campos destacados.', 'warn'); return; }

        const e = createEmployee({
          nome: nome.value.trim(),
          funcao: funcao.value.trim(),
          matricula: root.querySelector('#nf-mat').value.trim(),
          telefone: root.querySelector('#nf-tel').value.trim(),
          nivel: draft.nivel, unidade: draft.unidade, areas: draft.areas,
          restricoes: root.querySelector('#nf-restr').value.trim() ? [root.querySelector('#nf-restr').value.trim()] : [],
          face: draft.face, faceQualidade: draft.faceQualidade,
          treinamentos: [{ nome: 'NR-06 EPI', validade: Date.now() + 365 * 86400000 }],
        });
        closeOverlay();
        toast('Funcionário cadastrado',
          draft.face ? `${e.nome} já pode ser vinculado a uma PET.` : `${e.nome} cadastrado — registre a biometria para liberar o acesso físico.`,
          draft.face ? 'ok' : 'warn', 5200);
        refresh?.();
      });

      /* Reflect a template captured before returning to this form. */
      if (draft.face) {
        root.querySelector('#nf-face-ico').style.color = 'var(--ok)';
        root.querySelector('#nf-face-ico').innerHTML = icon('userCheck');
        root.querySelector('#nf-face-t').textContent = 'Biometria capturada';
        root.querySelector('#nf-face-s').textContent = `Template com ${draft.faceQualidade}% de qualidade — pronto para uso nas portarias.`;
        root.querySelector('#nf-face').innerHTML = `${icon('refresh')} Recapturar`;
      }
    },
  });
}

/* ============================================================ */
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

  $('#fn-q', root)?.addEventListener('input', debounce((e) => {
    f.q = e.target.value; repaint();
    const el = $('#fn-q'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length);
  }, 240));
  $('#fn-nivel', root)?.addEventListener('change', (e) => { f.nivel = e.target.value; repaint(); });
  $('#fn-status', root)?.addEventListener('change', (e) => { f.status = e.target.value; repaint(); });
  $('#fn-unidade', root)?.addEventListener('change', (e) => { f.unidade = e.target.value; repaint(); });

  $('#fn-new', root)?.addEventListener('click', () => openNew(repaint));
  on(page, 'click', '[data-emp]', (e, t) => openDetail(t.dataset.emp, repaint));

  $('#fn-export', root)?.addEventListener('click', () => {
    const rows = filtered();
    downloadText(`funcionarios-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'Nome', get: (e) => e.nome },
      { label: 'Matrícula', get: (e) => e.matricula },
      { label: 'Função', get: (e) => e.funcao },
      { label: 'Nível', get: (e) => NIVEIS[e.nivel].label },
      { label: 'Unidade', get: (e) => unitName(e.unidade) },
      { label: 'Áreas', get: (e) => e.areas.map(areaName).join(' | ') },
      { label: 'Biometria', get: (e) => (e.face ? `${e.faceQualidade}%` : 'não registrada') },
      { label: 'Situação', get: (e) => e.status },
      { label: 'Cadastro', get: (e) => dtFull(e.cadastradoEm) },
      { label: 'Último acesso', get: (e) => (e.ultimoAcesso ? dtFull(e.ultimoAcesso) : '') },
    ])).then((ok) => {
      if (ok) toast('Exportação concluída', `${rows.length} colaboradores exportados.`, 'ok');
    });
  });

  return null;
}
