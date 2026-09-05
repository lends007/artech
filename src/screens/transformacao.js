/**
 * PET CONTROL — Antes × Depois.
 * The pitch screen: the physical process side by side with the digital one,
 * quantified with the platform's own numbers.
 */

import { esc, nf } from '../util.js';
import { icon } from '../ui/icons.js';
import { panel } from '../ui/kit.js';
import { state } from '../store.js';
import { reportData, kpis } from '../selectors.js';

const DAY = 86400000;

const ANTES = [
  { ico: 'paper',     t: 'Formulário em papel',        s: 'Vias impressas, preenchidas à mão em campo' },
  { ico: 'edit',      t: 'Preenchimento manual',       s: 'Letra ilegível, campos em branco, retrabalho' },
  { ico: 'users',     t: 'Conferência presencial',     s: 'Emissor procura o gestor para assinar' },
  { ico: 'folder',    t: 'Arquivamento físico',        s: 'Pastas, caixas e armários por unidade' },
  { ico: 'search',    t: 'Busca manual',               s: 'Minutos ou horas para localizar uma PET' },
  { ico: 'xCircle',   t: 'Baixa rastreabilidade',      s: 'Não se sabe quem fez o quê, quando e onde' },
  { ico: 'alert',     t: 'Risco operacional maior',    s: 'Pessoa não autorizada pode entrar na área' },
];

const DEPOIS = [
  { ico: 'permit',    t: 'PET digital guiada',         s: 'Sete etapas validadas, sem campo esquecido' },
  { ico: 'bot',       t: 'Validação assistida',        s: 'Checklist automático a partir dos dados já preenchidos' },
  { ico: 'scanface',  t: 'Identificação facial',       s: 'Acesso liberado apenas com PET vigente' },
  { ico: 'gauge',     t: 'Medições monitoradas',       s: 'Detectores em tempo real e alerta automático' },
  { ico: 'trace',     t: 'Rastreabilidade total',      s: 'Quem, o quê, quando, onde e status — sempre' },
  { ico: 'report',    t: 'Relatórios instantâneos',    s: 'Indicadores prontos, exportáveis em segundos' },
  { ico: 'shieldOk',  t: 'Controle e segurança',       s: 'Bloqueio ativo do que antes passava despercebido' },
];

export function render() {
  const r = reportData({ de: Date.now() - 30 * DAY });
  const k = kpis();

  return `<div class="page">
    <div class="page-hd">
      <div>
        <div class="crumbs">${icon('swap')} Plataforma ${icon('chevR')} Transformação</div>
        <h1>Antes × Depois</h1>
        <p class="lead">
          O mesmo processo de Permissão de Entrada de Trabalho, executado de duas formas.
          À esquerda, a gestão física atual. À direita, o que a plataforma entrega hoje neste protótipo.
        </p>
      </div>
      <div class="acts">
        <a class="btn btn-primary" href="#/dashboard">${icon('dashboard')} Ver operação ao vivo</a>
      </div>
    </div>

    <div class="tf" style="margin-bottom:24px">
      <div class="tf-col before">
        <div class="tf-hd">
          <div class="t">Antes · processo físico</div>
          <div class="s">Papel, assinatura manual e arquivo morto</div>
        </div>
        <div class="tf-flow">
          ${ANTES.map((n, i) => nodeHTML(n, i === ANTES.length - 1)).join('')}
        </div>
      </div>

      <div class="tf-arrow">${icon('arrowR')}</div>

      <div class="tf-col after">
        <div class="tf-hd">
          <div class="t">Depois · PET Control</div>
          <div class="s">Digital, centralizado, rastreável e seguro</div>
        </div>
        <div class="tf-flow">
          ${DEPOIS.map((n, i) => nodeHTML(n, i === DEPOIS.length - 1)).join('')}
        </div>
      </div>
    </div>

    ${panel({
      title: 'O que muda em números',
      sub: 'Comparação entre a operação em papel e o mesmo volume operado na plataforma',
      body: `<div class="tf-gain">
        ${[
          ['&lt; 3 s', 'para localizar qualquer PET, contra minutos de busca manual em arquivo'],
          [`${r.tempoMedio.toFixed(0)} min`, 'tempo médio de aprovação medido pela plataforma — antes, não era medido'],
          ['100%', 'das ações com autor, data, hora e local registrados automaticamente'],
          [`${nf(r.bloqueios)}`, 'tentativas de acesso sem permissão bloqueadas no período'],
        ].map(([v, l]) => `<div class="g"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}
      </div>`,
    })}

    <div class="grid g-2" style="margin-top:16px;align-items:start">
      ${panel({
        title: 'Onde o papel falha',
        body: `<div class="col g-3">${[
          ['Informação indisponível', 'A PET só existe fisicamente, no local onde foi arquivada.'],
          ['Erro de preenchimento', 'Campos obrigatórios ficam em branco e só são notados depois.'],
          ['Sem controle de quem entra', 'A autorização está no papel, não na portaria.'],
          ['Auditoria trabalhosa', 'Reconstituir um evento exige reunir documentos de várias pastas.'],
          ['Medição sem histórico', 'O valor é anotado uma vez e perde-se a evolução da condição.'],
        ].map(([t, s]) => `<div class="row g-3" style="align-items:flex-start">
          <span style="color:var(--risk);display:flex;flex:none;margin-top:1px">${icon('xCircle', 15)}</span>
          <div><div style="font-size:12.5px;color:var(--tx-hi);font-weight:550">${esc(t)}</div>
          <div style="font-size:11.5px;color:var(--tx-lo);margin-top:2px;line-height:1.5">${esc(s)}</div></div>
        </div>`).join('')}</div>`,
      })}
      ${panel({
        title: 'Como a plataforma resolve',
        body: `<div class="col g-3">${[
          ['Base única e consultável', 'Toda PET, medição e acesso em um só lugar, filtrável em segundos.'],
          ['Validação antes de avançar', 'Cada etapa exige o que é obrigatório para aquele tipo de atividade.'],
          ['Autorização na portaria', 'A identificação facial consulta a PET vigente antes de liberar.'],
          ['Trilha imutável', 'Cada evento registra quem, o quê, quando, onde e o status resultante.'],
          ['Monitoramento contínuo', 'Detectores alimentam o histórico e disparam alerta ao sair da faixa.'],
        ].map(([t, s]) => `<div class="row g-3" style="align-items:flex-start">
          <span style="color:var(--ok);display:flex;flex:none;margin-top:1px">${icon('okCircle', 15)}</span>
          <div><div style="font-size:12.5px;color:var(--tx-hi);font-weight:550">${esc(t)}</div>
          <div style="font-size:11.5px;color:var(--tx-lo);margin-top:2px;line-height:1.5">${esc(s)}</div></div>
        </div>`).join('')}</div>`,
      })}
    </div>

    ${panel({
      cls: 'panel-rail',
      title: 'Fluxo completo demonstrado neste MVP',
      sub: 'Todas as etapas abaixo estão implementadas e conectadas entre si',
      body: `<div class="row g-2 wrap">${[
        ['Cadastrar funcionário', '#/funcionarios'], ['Registrar rosto', '#/funcionarios'],
        ['Criar PET', '#/pets/nova'], ['Vincular equipe', '#/pets/nova'],
        ['Registrar medições', '#/medicoes'], ['Validar PET', '#/validacao'],
        ['Identificar na portaria', '#/acessos'], ['Liberar acesso', '#/acessos'],
        ['Monitorar atividade', '#/dashboard'], ['Encerrar PET', '#/pets'],
        ['Consultar histórico', '#/rastreabilidade'], ['Gerar relatório', '#/relatorios'],
      ].map(([t, href], i) => `<a class="chip" href="${href}" style="height:30px;padding:0 12px">
        <span class="mono" style="color:var(--ac);font-size:10px">${String(i + 1).padStart(2, '0')}</span> ${esc(t)}</a>`).join('')}
      </div>`,
      footer: `<span style="font-size:11.5px;color:var(--tx-lo)">
        ${k.ativas} permissões ativas · ${k.pessoas} pessoas em área · ${state.events.length.toLocaleString('pt-BR')} eventos rastreados nesta sessão</span>
        <a class="btn btn-sm btn-primary" href="#/pets/nova">${icon('plus')} Emitir uma PET agora</a>`,
    })}
  </div>`;
}

function nodeHTML(n, last) {
  return `<div class="tf-node">
    <span class="ic">${icon(n.ico)}</span>
    <span class="tx"><span class="a">${esc(n.t)}</span><span class="b">${esc(n.s)}</span></span>
  </div>${last ? '' : '<span class="tf-link"></span>'}`;
}
