/**
 * PET CONTROL — Configurações.
 * Platform preferences, the RBAC matrix in plain sight, and demo controls.
 */

import { esc, dtFull, $ } from '../util.js';
import { icon } from '../ui/icons.js';
import { panel, levelTag, avatar } from '../ui/kit.js';
import { toast, confirm } from '../ui/overlay.js';
import { state, me, myLevel, setUI, resetDemo, startSimulation } from '../store.js';
import { UNITS, NIVEIS, NIVEL_LIST, PARAMS, unitName } from '../data/catalog.js';

const CAPS = [
  ['pet.view', 'Visualizar permissões'],
  ['pet.create', 'Emitir nova PET'],
  ['pet.edit', 'Editar / iniciar / suspender'],
  ['pet.validate', 'Validar e liberar PET'],
  ['pet.cancel', 'Cancelar permissão'],
  ['pet.close', 'Encerrar atividade'],
  ['med.register', 'Registrar medições'],
  ['emp.view', 'Consultar funcionários'],
  ['emp.create', 'Cadastrar funcionários'],
  ['alert.ack', 'Tratar alertas'],
  ['report.view', 'Acessar relatórios'],
  ['report.export', 'Exportar dados'],
];

export function render() {
  const u = me();
  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('settings')} Plataforma ${icon('chevR')} Configurações</div>
        <h1>Configurações</h1>
        <p class="lead">Preferências da plataforma, matriz de permissões por nível de acesso e controles da demonstração.</p>
      </div>
    </div>

    <div class="grid g-side" style="align-items:start">
      <div class="col g-4">
        ${panel({
          title: 'Matriz de níveis de acesso',
          sub: 'O que cada perfil pode fazer na plataforma',
          flush: true,
          body: `<div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Ação</th>${NIVEL_LIST.map((n) => `<th style="text-align:center">${esc(NIVEIS[n].label)}</th>`).join('')}</tr></thead>
            <tbody>${CAPS.map(([cap, label]) => `<tr>
              <td class="cell-hi">${esc(label)}</td>
              ${NIVEL_LIST.map((n) => {
                const ok = NIVEIS[n].caps.includes('*') || NIVEIS[n].caps.includes(cap);
                const atual = n === myLevel();
                return `<td style="text-align:center;${atual ? 'background:var(--ac-glow-soft)' : ''}">
                  <span style="color:${ok ? 'var(--ok)' : 'var(--tx-dim)'};display:inline-flex">${icon(ok ? 'check' : 'x', 14)}</span></td>`;
              }).join('')}
            </tr>`).join('')}</tbody>
          </table></div>`,
          footer: `<span style="font-size:11.5px;color:var(--tx-lo)">A coluna destacada corresponde ao seu nível atual.</span>
            <span>${levelTag(myLevel())}</span>`,
        })}

        ${panel({
          title: 'Parâmetros de medição',
          sub: 'Faixas aceitáveis aplicadas às validações e aos alertas',
          flush: true,
          body: `<div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Parâmetro</th><th>Unidade</th><th>Limite mínimo</th><th>Limite máximo</th><th>Valor ideal</th><th class="right">Criticidade</th></tr></thead>
            <tbody>${Object.values(PARAMS).map((p) => `<tr>
              <td class="cell-hi"><span class="row g-2">${icon(p.icon, 13)} ${esc(p.nome)}</span></td>
              <td class="mono">${esc(p.unidade)}</td>
              <td class="num">${p.min}</td>
              <td class="num">${p.max}</td>
              <td class="num">${p.ideal}</td>
              <td class="right"><span class="badge b-idle">${p.crit === 'both' ? 'ambos os extremos' : p.crit === 'high' ? 'limite superior' : 'limite inferior'}</span></td>
            </tr>`).join('')}</tbody>
          </table></div>`,
        })}

        ${panel({
          title: 'Unidades e áreas monitoradas',
          body: `<div class="col g-4">${UNITS.map((un) => `
            <div>
              <div class="row-b" style="margin-bottom:9px">
                <span class="row g-2" style="font-size:12.5px;color:var(--tx-hi)">${icon('building', 14)} ${esc(un.nome)}</span>
                <span class="badge b-idle">${un.areas.length} áreas · turno ${esc(un.turno)}</span>
              </div>
              <div class="row g-2 wrap">${un.areas.map((a) => {
                const sensores = Object.values(state.sensors).filter((s) => s.areaId === a.id).length;
                return `<span class="chip">${icon('pin', 12)} ${esc(a.nome)}
                  <span class="mono" style="color:var(--tx-dim);font-size:10px">${sensores ? `${sensores} sensores` : 'sem sensor'}</span></span>`;
              }).join('')}</div>
            </div>`).join('')}</div>`,
        })}
      </div>

      <div class="col g-4">
        ${panel({
          title: 'Sessão atual',
          body: u ? `<div class="col g-4">
            <div class="row g-3" style="align-items:center">
              ${avatar(u, 'av-lg')}
              <div><div style="font-size:13.5px;color:var(--tx-hi);font-weight:600">${esc(u.nome)}</div>
              <div style="font-size:11.5px;color:var(--tx-lo);margin-top:2px">${esc(u.funcao)}</div>
              <div style="margin-top:6px">${levelTag(u.nivel)}</div></div>
            </div>
            <dl class="kv">
              <dt>Autenticação</dt><dd>Reconhecimento facial</dd>
              <dt>Confiança</dt><dd class="mono">${esc(String(state.session?.confianca ?? '—'))}%</dd>
              <dt>Início</dt><dd class="mono">${esc(dtFull(state.session?.iniciadaEm ?? Date.now()))}</dd>
              <dt>Unidade</dt><dd>${esc(unitName(u.unidade))}</dd>
            </dl>
          </div>` : '<span class="t-lo">Sessão não identificada.</span>',
        })}

        ${panel({
          title: 'Preferências',
          body: `<div class="col g-4">
            <label class="sw row-b" style="width:100%">
              <span>
                <span style="display:block;font-size:12.5px;color:var(--tx-hi)">Monitoramento em tempo real</span>
                <span style="display:block;font-size:11px;color:var(--tx-lo);margin-top:2px">Atualiza sensores, alertas e acessos a cada 5 segundos</span>
              </span>
              <span class="row g-2" style="flex:none">
                <input type="checkbox" id="cf-sim" ${state.ui.simulacao ? 'checked' : ''}>
                <span class="track"></span>
              </span>
            </label>

            <label class="sw row-b" style="width:100%">
              <span>
                <span style="display:block;font-size:12.5px;color:var(--tx-hi)">Menu lateral recolhido</span>
                <span style="display:block;font-size:11px;color:var(--tx-lo);margin-top:2px">Aumenta a área útil das telas operacionais</span>
              </span>
              <span class="row g-2" style="flex:none">
                <input type="checkbox" id="cf-nav" ${state.ui.navCollapsed ? 'checked' : ''}>
                <span class="track"></span>
              </span>
            </label>

            <div class="field">
              <label for="cf-unidade">Escopo padrão</label>
              <select id="cf-unidade" class="sel">
                <option value="TODAS" ${state.ui.unidade === 'TODAS' ? 'selected' : ''}>Todas as unidades</option>
                ${UNITS.map((x) => `<option value="${x.id}" ${state.ui.unidade === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
              </select>
            </div>
          </div>`,
        })}

        ${panel({
          title: 'Base de demonstração',
          sub: 'Dados fictícios gerados localmente',
          body: `<dl class="kv">
            <dt>Funcionários</dt><dd class="num">${state.employees.length}</dd>
            <dt>Permissões</dt><dd class="num">${state.pets.length}</dd>
            <dt>Registros de acesso</dt><dd class="num">${state.access.length}</dd>
            <dt>Alertas</dt><dd class="num">${state.alerts.length}</dd>
            <dt>Eventos de auditoria</dt><dd class="num">${state.events.length}</dd>
            <dt>Sensores</dt><dd class="num">${Object.keys(state.sensors).length}</dd>
            <dt>Gerada em</dt><dd class="mono">${esc(dtFull(state.geradoEm))}</dd>
          </dl>
          <div class="panel panel-inset" style="padding:12px 14px;margin-top:14px">
            <div style="font-size:11px;color:var(--tx-lo);line-height:1.6">
              ${icon('info', 12)} Todos os dados são fictícios e permanecem apenas neste navegador.
              O reconhecimento facial é simulado — nenhuma imagem biométrica é capturada ou armazenada.
            </div>
          </div>`,
          footer: `<span style="font-size:11.5px;color:var(--tx-lo)">Restaurar recria a operação do zero</span>
            <button class="btn btn-sm btn-risk" id="cf-reset">${icon('refresh')} Restaurar demonstração</button>`,
        })}

        ${panel({
          title: 'Sobre',
          body: `<div style="font-size:12px;color:var(--tx-lo);line-height:1.7">
            <strong style="color:var(--tx-hi)">PET CONTROL</strong> — Gestão inteligente de Permissões de Entrada de Trabalho.<br>
            MVP demonstrativo v0.9 · protótipo funcional.<br><br>
            Escopo do protótipo: emissão digital da PET, validação assistida, identificação de pessoas,
            controle de acesso por área, monitoramento de medições, central de alertas,
            rastreabilidade ponta a ponta e relatórios operacionais.
          </div>`,
        })}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
export function mount(root) {
  $('#cf-sim', root)?.addEventListener('change', (e) => {
    setUI({ simulacao: e.target.checked });
    if (e.target.checked) startSimulation();
    toast(e.target.checked ? 'Monitoramento ativado' : 'Monitoramento pausado',
      e.target.checked ? 'Sensores e eventos voltam a atualizar em tempo real.' : 'Os dados permanecem estáticos até ser reativado.',
      e.target.checked ? 'ok' : 'info', 2800);
  });

  $('#cf-nav', root)?.addEventListener('change', (e) => {
    setUI({ navCollapsed: e.target.checked });
    document.querySelector('#shell')?.classList.toggle('nav-collapsed', e.target.checked);
  });

  $('#cf-unidade', root)?.addEventListener('change', (e) => {
    setUI({ unidade: e.target.value });
    toast('Escopo atualizado', 'Indicadores e listagens foram recalculados.', 'info', 2400);
  });

  $('#cf-reset', root)?.addEventListener('click', () => {
    confirm({
      title: 'Restaurar demonstração', tone: 'risk', confirmLabel: 'Restaurar tudo',
      message: 'Toda a operação simulada será recriada: permissões, acessos, alertas e trilha de auditoria voltam ao estado inicial. Sua sessão permanece ativa.',
      onConfirm: () => {
        const s = state.session;
        resetDemo();
        state.session = s;
        toast('Demonstração restaurada', 'A base foi regenerada com o horário atual.', 'ok');
        location.hash = '#/dashboard';
      },
    });
  });

  return null;
}
