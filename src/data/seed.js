/**
 * PET CONTROL — Deterministic demo dataset.
 *
 * Everything the product shows derives from this single generator, so the
 * dashboard, the PET list, the access log, the alerts and the audit trail
 * always tell the same story. Times are generated relative to "now" so the
 * demo looks live whenever it is opened.
 *
 * All people, registrations and units are fictional.
 */

import { UNITS, ATIVIDADES, PARAMS, RISCOS, EQUIPAMENTOS, FERRAMENTAS, CHECKLIST, classify, atividadeById } from './catalog.js';

/* ---------- seeded PRNG (stable data between reloads) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R = mulberry32(20260904);
const rf = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(rf(a, b + 1));
const rp = (arr) => arr[Math.floor(R() * arr.length)];
const rpn = (arr, n) => {
  const c = [...arr];
  const out = [];
  while (out.length < Math.min(n, c.length)) out.push(...c.splice(Math.floor(R() * c.length), 1));
  return out;
};
const chance = (p) => R() < p;

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/* ---------- fictional Brazilian name pools ---------- */
const NOMES_M = ['João', 'Carlos', 'Marcos', 'Rafael', 'Bruno', 'Eduardo', 'Felipe', 'Gustavo', 'Rodrigo', 'Thiago', 'Anderson', 'Diego', 'Leandro', 'Vinícius', 'Fábio', 'Ricardo', 'Sérgio', 'Alexandre', 'Márcio', 'Renato'];
const NOMES_F = ['Ana', 'Juliana', 'Camila', 'Patrícia', 'Fernanda', 'Mariana', 'Luciana', 'Renata', 'Beatriz', 'Carolina', 'Simone', 'Tatiane', 'Vanessa', 'Cristiane'];
const SOBRE = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Almeida', 'Costa', 'Ferreira', 'Rodrigues', 'Martins', 'Barbosa', 'Ribeiro', 'Carvalho', 'Gomes', 'Araújo', 'Lima', 'Moreira', 'Nunes', 'Teixeira', 'Cardoso'];

const FUNCOES = {
  ADMINISTRADOR: ['Coordenador de SSMA', 'Administrador do Sistema'],
  GESTOR:        ['Gerente de Operações', 'Engenheiro de Segurança', 'Coordenador de Manutenção'],
  SUPERVISOR:    ['Supervisor de Segurança', 'Supervisor de Manutenção', 'Técnico de Segurança do Trabalho', 'Encarregado de Turno'],
  OPERADOR:      ['Mecânico Industrial', 'Eletricista de Manutenção', 'Soldador', 'Caldeireiro', 'Instrumentista', 'Auxiliar de Manutenção', 'Operador de Processo', 'Montador', 'Rigger', 'Vigia de Espaço Confinado'],
};

const TREINAMENTOS = ['NR-33 Espaço Confinado', 'NR-35 Trabalho em Altura', 'NR-10 Segurança em Eletricidade', 'NR-11 Movimentação de Cargas', 'NR-06 EPI', 'Brigada de Emergência', 'Trabalho a Quente'];

/* ============================================================
   EMPLOYEES
   ============================================================ */
function makeEmployees(now) {
  const list = [];
  const usados = new Set();
  const nome = () => {
    for (let i = 0; i < 60; i++) {
      const n = `${chance(.72) ? rp(NOMES_M) : rp(NOMES_F)} ${rp(SOBRE)}${chance(.35) ? ' ' + rp(SOBRE) : ''}`;
      if (!usados.has(n)) { usados.add(n); return n; }
    }
    return `Colaborador ${usados.size + 1}`;
  };

  /* Curated identities used by the facial-login demo */
  const destaque = [
    { nome: 'Marina Toledo Alves',   nivel: 'ADMINISTRADOR', funcao: 'Coordenadora de SSMA',       unidade: 'UN-A' },
    { nome: 'Carlos Eduardo Souza',  nivel: 'GESTOR',        funcao: 'Gerente de Operações',       unidade: 'UN-A' },
    { nome: 'Ana Paula Ribeiro',     nivel: 'SUPERVISOR',    funcao: 'Supervisora de Segurança',   unidade: 'UN-A' },
    { nome: 'João Batista Silva',    nivel: 'OPERADOR',      funcao: 'Mecânico Industrial',        unidade: 'UN-A' },
  ];

  const total = 72;
  for (let i = 0; i < total; i++) {
    const d = destaque[i];
    let nivel, funcao, nome_;
    if (d) { nivel = d.nivel; funcao = d.funcao; nome_ = d.nome; usados.add(nome_); }
    else {
      nivel = i < 8 ? 'GESTOR' : i < 21 ? 'SUPERVISOR' : 'OPERADOR';
      funcao = rp(FUNCOES[nivel]);
      nome_ = nome();
    }
    const unidade = d?.unidade ?? (i % 3 === 2 ? 'UN-B' : 'UN-A');
    const areasUnidade = UNITS.find((u) => u.id === unidade).areas.map((a) => a.id);
    const cadastro = now - ri(40, 900) * DAY;

    /* A handful of deliberate irregularities so the product has something to catch */
    const irregular = i === 17 || i === 29 || i === 55;
    const afastado = i === 23 || i === 61;

    const trein = rpn(TREINAMENTOS, ri(2, 4)).map((t) => ({
      nome: t,
      validade: now + (irregular && chance(.6) ? -ri(3, 40) * DAY : ri(20, 620) * DAY),
    }));

    list.push({
      id: `EMP-${String(i + 1).padStart(3, '0')}`,
      nome: nome_,
      matricula: `MT-${String(48210 + i * 37).slice(0, 5)}`,
      funcao,
      nivel,
      unidade,
      areas: nivel === 'ADMINISTRADOR' ? areasUnidade : rpn(areasUnidade, ri(2, areasUnidade.length)),
      status: afastado ? 'AFASTADO' : irregular ? 'PENDENTE' : 'ATIVO',
      face: !(i === 31 || i === 48),
      faceQualidade: (i === 31 || i === 48) ? 0 : Math.round(rf(88, 99)),
      restricoes: irregular ? ['Treinamento NR vencido'] : afastado ? ['Afastamento médico até 12/10'] : [],
      treinamentos: trein,
      cadastradoEm: cadastro,
      ultimoAcesso: chance(.85) ? now - ri(2, 5200) * MIN : null,
      telefone: `(45) 9${ri(6000, 9999)}-${ri(1000, 9999)}`,
    });
  }
  return list;
}

/* ============================================================
   SENSOR SERIES  (per area × parameter)
   ============================================================ */
function makeSensors(now) {
  const sensors = {};
  const POINTS = 60, STEP = 5 * MIN;

  const areasComSensor = [
    ['A-TQ7', ['O2', 'LEL', 'H2S', 'CO', 'TEMP']],
    ['A-GT2', ['O2', 'LEL', 'CO', 'TEMP']],
    ['A-SE2', ['TEMP', 'UMID']],
    ['A-TR',  ['VENTO', 'TEMP']],
    ['A-CM',  ['TEMP', 'RUIDO', 'PRESS']],
    ['B-R03', ['O2', 'LEL', 'H2S', 'TEMP']],
    ['B-SE1', ['TEMP', 'UMID']],
    ['B-CB',  ['PRESS', 'TEMP', 'RUIDO']],
  ];

  /* One deliberate excursion so "fora do parâmetro" is visible on load */
  const excursao = { area: 'A-GT2', param: 'CO' };

  for (const [areaId, params] of areasComSensor) {
    for (const pid of params) {
      const p = PARAMS[pid];
      const key = `${areaId}:${pid}`;
      const serie = [];
      let v = p.ideal + rf(-p.drift * 3, p.drift * 3);
      for (let i = POINTS - 1; i >= 0; i--) {
        const ts = now - i * STEP;
        v += rf(-p.drift, p.drift);
        /* gentle pull back to the ideal value */
        v += (p.ideal - v) * 0.06;
        if (excursao.area === areaId && excursao.param === pid && i < 8) v += (p.max + 6 - v) * 0.32;
        const val = Number(Math.max(p.scaleMin, Math.min(p.scaleMax, v)).toFixed(p.dec));
        serie.push({ ts, v: val });
      }
      sensors[key] = { key, areaId, param: pid, serie, ultimo: serie[serie.length - 1].v };
    }
  }
  return sensors;
}

/* ============================================================
   PETs
   ============================================================ */
const LOCAIS = {
  'A-TQ7': ['Bocal superior TQ-07', 'Costado interno TQ-07', 'Fundo do tanque TQ-07'],
  'A-GT2': ['Galeria N2 — trecho 14', 'Poço de visita PV-06', 'Ramal de drenagem N2'],
  'A-SE2': ['Cubículo 7 — 13,8 kV', 'Painel QGBT-02', 'Transformador T-03'],
  'A-TR':  ['Célula 3 — plataforma 18 m', 'Ventilador VT-02 (topo)', 'Passarela superior'],
  'A-CM':  ['Bomba B-104', 'Conjunto motor-redutor M-07', 'Linha de recalque'],
  'A-PT':  ['Spool 220-A', 'Rack de tubulação — eixo 12', 'Junta de expansão JE-04'],
  'B-SE1': ['Painel de comando PC-11', 'Barramento principal', 'Sala de baterias'],
  'B-R03': ['Câmara seca R-03', 'Tubulação de sucção', 'Câmara de válvulas'],
  'B-LP2': ['Transportador TC-08', 'Envasadora EN-02', 'Silo pulmão'],
  'B-DOC': ['Doca 3 — pátio de carga', 'Área de manobra sul'],
  'B-CB':  ['Bomba principal BP-01', 'Casa de bombas — piso -1'],
};

function makePets(now, emps) {
  const pets = [];
  const gestores = emps.filter((e) => ['GESTOR', 'ADMINISTRADOR'].includes(e.nivel));
  const supers = emps.filter((e) => e.nivel === 'SUPERVISOR');
  const opers = emps.filter((e) => e.nivel === 'OPERADOR' && e.status === 'ATIVO');
  let seqCodigo = 118;

  const build = (cfg) => {
    const ativ = atividadeById(cfg.tipo);
    const unidade = cfg.areaId.startsWith('A') ? 'UN-A' : 'UN-B';
    const responsavel = cfg.responsavelId ?? rp(supers).id;
    const solicitante = rp(gestores).id;
    /* Crews are drawn from operators authorised for that specific area — the
       same rule the turnstile applies, so a released PET never contains
       someone the access control would reject. */
    const tam = cfg.tam ?? ri(2, 5);
    const habilitados = opers.filter((e) => e.areas.includes(cfg.areaId));
    const escolhidos = rpn(habilitados, tam);
    while (escolhidos.length < tam) {
      const extra = rp(opers.filter((e) => !escolhidos.includes(e)));
      if (!extra) break;
      extra.areas = [...new Set([...extra.areas, cfg.areaId])];
      escolhidos.push(extra);
    }
    const equipe = (cfg.equipeIds ?? escolhidos.map((e) => e.id)).map((id, idx) => ({
      empId: id,
      papel: idx === 0 ? 'Executante líder' : idx === 1 && cfg.tipo === 'CONFINADO' ? 'Vigia' : 'Executante',
    }));

    const criadaEm = cfg.criadaEm;
    const medicoes = ativ.params.map((pid) => {
      const p = PARAMS[pid];
      let valor = Number((p.ideal + rf(-p.drift * 4, p.drift * 4)).toFixed(p.dec));
      if (cfg.medicaoFora === pid) valor = Number((p.max + rf(1, 5)).toFixed(p.dec));
      valor = Math.max(p.scaleMin, Math.min(p.scaleMax, valor));
      return {
        id: `MED-${pets.length}-${pid}`, param: pid, valor,
        ts: criadaEm + ri(6, 16) * MIN, byId: responsavel,
        status: classify(pid, valor),
      };
    });

    const riscos = cfg.riscos ?? ativ.riscos.slice(0, ri(3, ativ.riscos.length));
    const medidas = riscos.flatMap((r) => RISCOS[r]?.medidas ?? []).slice(0, 6);
    const epis = ativ.epis;
    const equipamentos = rpn(EQUIPAMENTOS, ri(2, 4));
    const ferramentas = rpn(FERRAMENTAS, ri(2, 3));

    const done = ['LIBERADA', 'ATIVA', 'ENCERRADA', 'SUSPENSA'].includes(cfg.status);
    const checklist = {};
    CHECKLIST.forEach((c, idx) => {
      const ok = done || (cfg.status === 'EM_VALIDACAO' ? idx < (cfg.checkDone ?? 5) : false);
      checklist[c.id] = ok ? { ok: true, byId: responsavel, ts: criadaEm + (18 + idx) * MIN } : { ok: false };
    });

    const validadaEm = done ? criadaEm + ri(22, 46) * MIN : null;
    const liberadaEm = done ? validadaEm + ri(3, 9) * MIN : null;
    const iniciadaEm = ['ATIVA', 'ENCERRADA', 'SUSPENSA'].includes(cfg.status) ? liberadaEm + ri(4, 14) * MIN : null;
    const encerradaEm = cfg.status === 'ENCERRADA' ? (cfg.encerradaEm ?? iniciadaEm + ri(90, 380) * MIN) : null;

    const p = {
      id: `PET-${String(++seqCodigo).padStart(4, '0')}`,
      codigo: `PET-2026-${String(seqCodigo).padStart(4, '0')}`,
      tipo: cfg.tipo,
      titulo: cfg.titulo,
      unidade, areaId: cfg.areaId,
      local: cfg.local ?? rp(LOCAIS[cfg.areaId] ?? ['Local a definir']),
      responsavelId: responsavel,
      solicitanteId: solicitante,
      equipe, riscos, medidas, medicoes,
      epis, equipamentos, ferramentas, checklist,
      status: cfg.status,
      criadaEm,
      criadaPorId: responsavel,
      validadaEm, validadaPorId: done ? rp(gestores).id : null,
      liberadaEm, liberadaPorId: done ? rp(gestores).id : null,
      iniciadaEm, encerradaEm,
      inicioPrevisto: liberadaEm ?? criadaEm + HOUR,
      fimPrevisto: (liberadaEm ?? criadaEm + HOUR) + ativ.validadeH * HOUR,
      observacoes: cfg.observacoes ?? '',
      motivoCancelamento: cfg.motivo ?? null,
      suspensaMotivo: cfg.suspensaMotivo ?? null,
    };
    pets.push(p);
    return p;
  };

  const hoje0 = new Date(now); hoje0.setHours(0, 0, 0, 0);
  const t0 = hoje0.getTime();
  const h = (hh, mm = 0) => t0 + hh * HOUR + mm * MIN;

  /* ---- Today's operational picture (12 active / 4 in validation) ---- */
  const ativas = [
    { tipo: 'CONFINADO', areaId: 'A-TQ7', titulo: 'Inspeção interna e limpeza do tanque TQ-07', criadaEm: h(7, 2), tam: 6 },
    { tipo: 'ELETRICA',  areaId: 'A-SE2', titulo: 'Manutenção preventiva no cubículo 7', criadaEm: h(7, 18), tam: 5 },
    { tipo: 'ALTURA',    areaId: 'A-TR',  titulo: 'Substituição do ventilador VT-02', criadaEm: h(7, 40), tam: 6 },
    { tipo: 'CONFINADO', areaId: 'A-GT2', titulo: 'Desobstrução da galeria técnica N2', criadaEm: h(8, 5), tam: 5, medicaoFora: 'CO' },
    { tipo: 'QUENTE',    areaId: 'A-PT',  titulo: 'Soldagem do spool 220-A', criadaEm: h(8, 22), tam: 5 },
    { tipo: 'ELETRICA',  areaId: 'B-SE1', titulo: 'Termografia e reaperto no PC-11', criadaEm: h(8, 44), tam: 4 },
    { tipo: 'ICAMENTO',  areaId: 'B-DOC', titulo: 'Içamento de conjunto motobomba', criadaEm: h(9, 6), tam: 6 },
    { tipo: 'CONFINADO', areaId: 'B-R03', titulo: 'Inspeção da câmara seca R-03', criadaEm: h(9, 20), tam: 5 },
    { tipo: 'ELETRICA',  areaId: 'A-CM',  titulo: 'Troca de contatoras do painel B-104', criadaEm: h(9, 48), tam: 5 },
    { tipo: 'ESCAVACAO', areaId: 'A-PT',  titulo: 'Abertura de vala para nova linha', criadaEm: h(10, 2), tam: 6 },
    { tipo: 'ALTURA',    areaId: 'B-LP2', titulo: 'Manutenção no transportador TC-08', criadaEm: h(10, 30), tam: 5 },
    { tipo: 'QUENTE',    areaId: 'B-CB',  titulo: 'Reparo em tubulação da bomba BP-01', criadaEm: h(10, 55), tam: 5 },
  ];
  ativas.forEach((c) => build({ ...c, status: 'ATIVA' }));

  const validando = [
    { tipo: 'ALTURA',    areaId: 'A-TR',  titulo: 'Inspeção estrutural da passarela superior', criadaEm: now - 52 * MIN, tam: 3, checkDone: 5 },
    { tipo: 'CONFINADO', areaId: 'A-TQ7', titulo: 'Segunda etapa — jateamento interno TQ-07', criadaEm: now - 38 * MIN, tam: 4, checkDone: 6 },
    { tipo: 'ELETRICA',  areaId: 'B-SE1', titulo: 'Substituição de disjuntor geral', criadaEm: now - 24 * MIN, tam: 2, checkDone: 4 },
    { tipo: 'QUENTE',    areaId: 'A-PT',  titulo: 'Corte e remoção de trecho corroído', criadaEm: now - 11 * MIN, tam: 3, checkDone: 3 },
  ];
  validando.forEach((c) => build({ ...c, status: 'EM_VALIDACAO' }));

  /* Liberadas, aguardando início */
  build({ tipo: 'ICAMENTO', areaId: 'B-DOC', titulo: 'Descarregamento de skid de processo', criadaEm: h(11, 5), status: 'LIBERADA', tam: 3 });
  build({ tipo: 'ELETRICA', areaId: 'A-SE2', titulo: 'Ensaio de relés de proteção', criadaEm: h(11, 22), status: 'LIBERADA', tam: 2 });

  /* Suspensa por medição fora do parâmetro */
  build({
    tipo: 'CONFINADO', areaId: 'A-GT2', titulo: 'Reparo em tubulação enterrada — trecho 14',
    criadaEm: h(6, 40), status: 'SUSPENSA', tam: 3, medicaoFora: 'CO',
    suspensaMotivo: 'Concentração de CO acima do limite durante a execução.',
  });

  /* Rascunho */
  build({ tipo: 'ALTURA', areaId: 'A-TR', titulo: 'Pintura da estrutura metálica — célula 1', criadaEm: now - 6 * MIN, status: 'RASCUNHO', tam: 2 });

  /* ---- Historical volume for reports (last 45 days) ---- */
  const tipos = ATIVIDADES.map((a) => a.id);
  const areas = Object.keys(LOCAIS);
  for (let d = 1; d <= 45; d++) {
    const qtd = ri(2, 6);
    for (let k = 0; k < qtd; k++) {
      const criada = t0 - d * DAY + ri(6, 15) * HOUR + ri(0, 59) * MIN;
      const cancel = chance(.07);
      build({
        tipo: rp(tipos), areaId: rp(areas),
        titulo: 'Atividade programada de manutenção',
        criadaEm: criada,
        status: cancel ? 'CANCELADA' : 'ENCERRADA',
        motivo: cancel ? rp(['Condição climática adversa', 'Indisponibilidade de equipe', 'Reprogramação da parada', 'Medição fora do parâmetro']) : null,
        tam: ri(2, 5),
      });
    }
  }

  return pets;
}

/* ============================================================
   ACCESS EVENTS · ALERTS · AUDIT TRAIL
   ============================================================ */
function makeAccess(now, pets, emps) {
  const ev = [];
  const ativas = pets.filter((p) => p.status === 'ATIVA');
  for (const p of ativas) {
    for (const m of p.equipe) {
      const ts = (p.iniciadaEm ?? p.criadaEm) + ri(1, 9) * MIN;
      ev.push({
        id: `ACC-${ev.length + 1}`, ts, empId: m.empId, petId: p.id, areaId: p.areaId,
        unidade: p.unidade, resultado: 'LIBERADO', motivo: 'PET liberada e equipe autorizada',
        confianca: Number(rf(94.2, 99.6).toFixed(1)), metodo: 'FACIAL', direcao: 'ENTRADA',
      });
    }
  }
  /* Denied attempts — the risk the platform exists to catch */
  const irregulares = emps.filter((e) => e.status !== 'ATIVO' || !e.face);
  const negados = [
    { emp: irregulares[0], motivo: 'Nenhuma PET vigente vincula o colaborador à área', area: 'A-TQ7', min: 46 },
    { emp: irregulares[1] ?? emps[30], motivo: 'Treinamento NR-33 vencido', area: 'A-GT2', min: 128 },
    { emp: emps[35], motivo: 'Colaborador fora da área autorizada', area: 'B-R03', min: 214 },
  ];
  negados.forEach((n, i) => {
    if (!n.emp) return;
    ev.push({
      id: `ACC-N${i + 1}`, ts: now - n.min * MIN, empId: n.emp.id, petId: null, areaId: n.area,
      unidade: n.area.startsWith('A') ? 'UN-A' : 'UN-B', resultado: 'BLOQUEADO', motivo: n.motivo,
      confianca: Number(rf(91.0, 98.4).toFixed(1)), metodo: 'FACIAL', direcao: 'ENTRADA',
    });
  });
  /* Exits from closed PETs */
  pets.filter((p) => p.status === 'ENCERRADA' && p.encerradaEm > now - 2 * DAY).slice(0, 12).forEach((p, i) => {
    p.equipe.slice(0, 2).forEach((m, j) => {
      ev.push({
        id: `ACC-S${i}${j}`, ts: p.encerradaEm - ri(2, 10) * MIN, empId: m.empId, petId: p.id,
        areaId: p.areaId, unidade: p.unidade, resultado: 'LIBERADO', motivo: 'Saída registrada',
        confianca: Number(rf(93, 99).toFixed(1)), metodo: 'FACIAL', direcao: 'SAIDA',
      });
    });
  });
  return ev.sort((a, b) => b.ts - a.ts);
}

function makeAlerts(now, pets, emps, access, sensors) {
  const al = [];
  const push = (o) => al.push({
    id: `ALR-${String(al.length + 1).padStart(3, '0')}`,
    status: 'ABERTO', resolvidoPorId: null, resolvidoEm: null, ...o,
  });

  /* 1. Denied access → critical */
  const negado = access.find((a) => a.resultado === 'BLOQUEADO');
  if (negado) {
    push({
      ts: negado.ts, tipo: 'ACESSO_NEGADO', sev: 'risk',
      titulo: 'Tentativa de acesso não autorizado',
      descricao: `${emps.find((e) => e.id === negado.empId)?.nome ?? 'Colaborador'} — ${negado.motivo}.`,
      areaId: negado.areaId, unidade: negado.unidade, petId: null, empId: negado.empId,
    });
  }

  /* 2. Sensor excursion → warning */
  const fora = Object.values(sensors).find((s) => classify(s.param, s.ultimo) === 'risk');
  if (fora) {
    push({
      ts: now - 6 * MIN, tipo: 'MEDICAO_FORA', sev: 'warn',
      titulo: `${PARAMS[fora.param].nome} fora do parâmetro`,
      descricao: `Leitura de ${fora.ultimo} ${PARAMS[fora.param].unidade} — limite operacional ${PARAMS[fora.param].min}–${PARAMS[fora.param].max} ${PARAMS[fora.param].unidade}.`,
      areaId: fora.areaId, unidade: fora.areaId.startsWith('A') ? 'UN-A' : 'UN-B',
      petId: pets.find((p) => p.areaId === fora.areaId && p.status === 'ATIVA')?.id ?? null, empId: null,
    });
  }

  /* 3. PETs approaching expiry */
  pets.filter((p) => p.status === 'ATIVA' && p.fimPrevisto - now < 75 * MIN && p.fimPrevisto > now)
    .slice(0, 2).forEach((p) => push({
      ts: now - ri(3, 25) * MIN, tipo: 'PET_VENCENDO', sev: 'warn',
      titulo: 'PET próxima do vencimento',
      descricao: `${p.codigo} — ${p.titulo}. Validade encerra em breve.`,
      areaId: p.areaId, unidade: p.unidade, petId: p.id, empId: null,
    }));

  /* 4. Pending validations */
  pets.filter((p) => p.status === 'EM_VALIDACAO').slice(0, 2).forEach((p) => push({
    ts: p.criadaEm + 4 * MIN, tipo: 'PET_AGUARDANDO', sev: 'info',
    titulo: 'Nova PET aguardando validação',
    descricao: `${p.codigo} — ${p.titulo}.`,
    areaId: p.areaId, unidade: p.unidade, petId: p.id, empId: null,
  }));

  /* 5. Expired training */
  const irregular = emps.find((e) => e.status === 'PENDENTE');
  if (irregular) {
    push({
      ts: now - ri(120, 400) * MIN, tipo: 'EQUIPE_IRREGULAR', sev: 'warn',
      titulo: 'Treinamento obrigatório vencido',
      descricao: `${irregular.nome} (${irregular.matricula}) — regularizar antes de nova alocação.`,
      areaId: irregular.areas[0], unidade: irregular.unidade, petId: null, empId: irregular.id,
    });
  }

  /* 6. Historic, already handled */
  for (let i = 0; i < 9; i++) {
    const p = rp(pets.filter((x) => x.status === 'ENCERRADA'));
    const tipo = rp(['MEDICAO_FORA', 'PET_VENCENDO', 'ACESSO_NEGADO', 'SISTEMA']);
    al.push({
      id: `ALR-H${i + 1}`,
      ts: now - ri(1, 20) * DAY,
      tipo, sev: tipo === 'ACESSO_NEGADO' ? 'risk' : tipo === 'SISTEMA' ? 'info' : 'warn',
      titulo: tipo === 'SISTEMA' ? 'Sincronização de detectores concluída' : 'Ocorrência registrada e tratada',
      descricao: 'Ocorrência histórica encerrada pela equipe de segurança operacional.',
      areaId: p?.areaId ?? 'A-CM', unidade: p?.unidade ?? 'UN-A', petId: p?.id ?? null, empId: null,
      status: 'RESOLVIDO', resolvidoPorId: rp(emps.filter((e) => e.nivel === 'GESTOR')).id,
      resolvidoEm: now - ri(1, 19) * DAY,
    });
  }

  return al.sort((a, b) => b.ts - a.ts);
}

/** Rebuild the full audit trail from the entities, so both always agree. */
function makeEvents(pets, access, alerts, emps) {
  const ev = [];
  let n = 0;
  const add = (o) => ev.push({ id: `EVT-${String(++n).padStart(5, '0')}`, ...o });

  for (const p of pets) {
    const A = { petId: p.id, areaId: p.areaId, unidade: p.unidade };
    add({ ts: p.criadaEm, tipo: 'PET_CRIADA', atorId: p.criadaPorId, ...A, detalhe: p.titulo });
    add({ ts: p.criadaEm + 3 * MIN, tipo: 'EQUIPE_DEFINIDA', atorId: p.criadaPorId, ...A, detalhe: `${p.equipe.length} colaboradores vinculados` });
    add({ ts: p.criadaEm + 5 * MIN, tipo: 'RISCOS_AVALIADOS', atorId: p.criadaPorId, ...A, detalhe: `${p.riscos.length} riscos · ${p.medidas.length} medidas preventivas` });
    for (const m of p.medicoes) {
      add({
        ts: m.ts, tipo: m.status === 'risk' ? 'MEDICAO_FORA' : 'MEDICAO', atorId: m.byId, ...A,
        detalhe: `${PARAMS[m.param].nome}: ${m.valor} ${PARAMS[m.param].unidade}`,
      });
    }
    add({ ts: p.criadaEm + 17 * MIN, tipo: 'EQUIP_CONFERIDO', atorId: p.criadaPorId, ...A, detalhe: `${p.epis.length} EPIs · ${p.equipamentos.length} equipamentos` });
    if (p.status !== 'RASCUNHO') add({ ts: p.criadaEm + 20 * MIN, tipo: 'ENVIADA_VALIDACAO', atorId: p.criadaPorId, ...A, detalhe: 'Checklist de segurança submetido' });
    if (p.validadaEm) add({ ts: p.validadaEm, tipo: 'PET_VALIDADA', atorId: p.validadaPorId, ...A, detalhe: 'Checklist aprovado integralmente' });
    if (p.liberadaEm) add({ ts: p.liberadaEm, tipo: 'PET_LIBERADA', atorId: p.liberadaPorId, ...A, detalhe: 'Permissão liberada para execução' });
    if (p.iniciadaEm) add({ ts: p.iniciadaEm, tipo: 'ATIV_INICIADA', atorId: p.responsavelId, ...A, detalhe: p.local });
    if (p.status === 'SUSPENSA') add({ ts: p.iniciadaEm + 40 * MIN, tipo: 'ATIV_SUSPENSA', atorId: p.responsavelId, ...A, detalhe: p.suspensaMotivo });
    if (p.encerradaEm) {
      add({ ts: p.encerradaEm, tipo: 'ATIV_ENCERRADA', atorId: p.responsavelId, ...A, detalhe: 'Frente de serviço desmobilizada' });
      add({ ts: p.encerradaEm + 2 * MIN, tipo: 'PET_FINALIZADA', atorId: p.responsavelId, ...A, detalhe: 'Documentação arquivada digitalmente' });
    }
    if (p.status === 'CANCELADA') add({ ts: p.criadaEm + 30 * MIN, tipo: 'PET_CANCELADA', atorId: p.criadaPorId, ...A, detalhe: p.motivoCancelamento });
  }

  for (const a of access) {
    add({
      ts: a.ts, tipo: a.resultado === 'LIBERADO' ? 'ACESSO_LIBERADO' : 'ACESSO_BLOQUEADO',
      atorId: a.empId, petId: a.petId, areaId: a.areaId, unidade: a.unidade,
      detalhe: `${a.direcao === 'SAIDA' ? 'Saída' : 'Entrada'} · reconhecimento facial ${a.confianca}% · ${a.motivo}`,
    });
  }

  for (const a of alerts) {
    add({ ts: a.ts, tipo: 'ALERTA_GERADO', atorId: null, petId: a.petId, areaId: a.areaId, unidade: a.unidade, detalhe: a.titulo });
    if (a.status === 'RESOLVIDO') add({ ts: a.resolvidoEm, tipo: 'ALERTA_TRATADO', atorId: a.resolvidoPorId, petId: a.petId, areaId: a.areaId, unidade: a.unidade, detalhe: `Tratativa concluída — ${a.titulo}` });
  }

  for (const e of emps) {
    add({ ts: e.cadastradoEm, tipo: 'FUNC_CADASTRADO', atorId: null, alvoId: e.id, petId: null, areaId: e.areas[0], unidade: e.unidade, detalhe: `${e.nome} · ${e.funcao}` });
    if (e.face) add({ ts: e.cadastradoEm + 6 * MIN, tipo: 'FACE_REGISTRADA', atorId: null, alvoId: e.id, petId: null, areaId: e.areas[0], unidade: e.unidade, detalhe: `Qualidade do template: ${e.faceQualidade}%` });
  }

  return ev.sort((a, b) => b.ts - a.ts);
}

/* ============================================================
   PUBLIC
   ============================================================ */
export function buildSeed() {
  R = mulberry32(20260904);
  const now = Date.now();
  const employees = makeEmployees(now);
  const sensors = makeSensors(now);
  const pets = makePets(now, employees);
  const access = makeAccess(now, pets, employees);
  const alerts = makeAlerts(now, pets, employees, access, sensors);
  const events = makeEvents(pets, access, alerts, employees);

  return {
    version: 4,
    geradoEm: now,
    employees, pets, sensors, access, alerts, events,
    session: null,
    ui: { unidade: 'TODAS', navCollapsed: false, simulacao: true },
  };
}

/** Identities offered on the facial-login screen. */
export const DEMO_FACES = ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004'];
