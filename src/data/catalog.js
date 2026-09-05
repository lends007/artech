/**
 * PET CONTROL — Domain catalogs.
 * Static reference data shared by every screen: units, activity types,
 * risk library, PPE, measurement parameters and the RBAC matrix.
 */

/* ============================================================
   ORGANIZATION
   ============================================================ */
export const UNITS = [
  {
    id: 'UN-A', nome: 'Unidade Industrial A', sigla: 'UN-A', turno: 'A · 07:00–19:00',
    areas: [
      { id: 'A-CM',  nome: 'Casa de Máquinas',      classe: 'CRITICA' },
      { id: 'A-TQ7', nome: 'Tanque TQ-07',          classe: 'CONFINADO' },
      { id: 'A-SE2', nome: 'Subestação SE-02',      classe: 'ELETRICA' },
      { id: 'A-GT2', nome: 'Galeria Técnica N2',    classe: 'CONFINADO' },
      { id: 'A-PT',  nome: 'Pátio de Tubulação',    classe: 'ABERTA' },
      { id: 'A-TR',  nome: 'Torre de Resfriamento', classe: 'ALTURA' },
    ],
  },
  {
    id: 'UN-B', nome: 'Unidade Industrial B', sigla: 'UN-B', turno: 'B · 19:00–07:00',
    areas: [
      { id: 'B-SE1', nome: 'Sala Elétrica B1',      classe: 'ELETRICA' },
      { id: 'B-R03', nome: 'Reservatório R-03',     classe: 'CONFINADO' },
      { id: 'B-LP2', nome: 'Linha de Produção 2',   classe: 'CRITICA' },
      { id: 'B-DOC', nome: 'Docas',                 classe: 'ABERTA' },
      { id: 'B-CB',  nome: 'Casa de Bombas',        classe: 'CRITICA' },
    ],
  },
];

export const ALL_AREAS = UNITS.flatMap((u) => u.areas.map((a) => ({ ...a, unidade: u.id })));
export const areaById = (id) => ALL_AREAS.find((a) => a.id === id);
export const unitById = (id) => UNITS.find((u) => u.id === id);
export const areaName = (id) => areaById(id)?.nome ?? '—';
export const unitName = (id) => unitById(id)?.nome ?? '—';

/* ============================================================
   MEASUREMENT PARAMETERS
   Each parameter declares the acceptable band and how it drifts,
   so the live simulator and the PET form share one definition.
   ============================================================ */
export const PARAMS = {
  O2:    { id: 'O2',    nome: 'Oxigênio',           unidade: '%',      icon: 'wind',    ideal: 20.9, min: 19.5, max: 23.0, scaleMin: 17,  scaleMax: 25,  dec: 1, drift: .06, crit: 'both' },
  LEL:   { id: 'LEL',   nome: 'Gases inflamáveis',  unidade: '% LIE',  icon: 'flame',   ideal: 0,    min: 0,    max: 10,   scaleMin: 0,   scaleMax: 25,  dec: 1, drift: .35, crit: 'high' },
  H2S:   { id: 'H2S',   nome: 'Sulfeto de hidrogênio', unidade: 'ppm', icon: 'droplet', ideal: 0,    min: 0,    max: 8,    scaleMin: 0,   scaleMax: 20,  dec: 1, drift: .25, crit: 'high' },
  CO:    { id: 'CO',    nome: 'Monóxido de carbono', unidade: 'ppm',   icon: 'radio',   ideal: 2,    min: 0,    max: 25,   scaleMin: 0,   scaleMax: 60,  dec: 0, drift: .9,  crit: 'high' },
  TEMP:  { id: 'TEMP',  nome: 'Temperatura',        unidade: '°C',     icon: 'thermo',  ideal: 28,   min: 10,   max: 35,   scaleMin: 5,   scaleMax: 48,  dec: 1, drift: .22, crit: 'both' },
  UMID:  { id: 'UMID',  nome: 'Umidade relativa',   unidade: '%',      icon: 'droplet', ideal: 55,   min: 30,   max: 80,   scaleMin: 10,  scaleMax: 100, dec: 0, drift: .8,  crit: 'both' },
  VENTO: { id: 'VENTO', nome: 'Velocidade do vento', unidade: 'km/h',  icon: 'wind',    ideal: 9,    min: 0,    max: 40,   scaleMin: 0,   scaleMax: 70,  dec: 1, drift: 1.4, crit: 'high' },
  RUIDO: { id: 'RUIDO', nome: 'Nível de ruído',     unidade: 'dB',     icon: 'radio',   ideal: 72,   min: 0,    max: 85,   scaleMin: 40,  scaleMax: 110, dec: 0, drift: 1.2, crit: 'high' },
  PRESS: { id: 'PRESS', nome: 'Pressão de linha',   unidade: 'bar',    icon: 'gauge',   ideal: 4.2,  min: 3.0,  max: 6.0,  scaleMin: 0,   scaleMax: 8,   dec: 1, drift: .1,  crit: 'both' },
};

/** Classify a reading against its parameter band. */
export function classify(paramId, valor) {
  const p = PARAMS[paramId];
  if (!p || valor == null || Number.isNaN(valor)) return 'idle';
  const span = p.max - p.min;
  const guard = span * 0.12;
  if (valor < p.min || valor > p.max) return 'risk';
  if ((p.crit !== 'high' && valor < p.min + guard) || (p.crit !== 'low' && valor > p.max - guard)) return 'warn';
  return 'ok';
}

export const STATUS_MEDICAO = {
  ok:   { label: 'NORMAL',    cls: 'b-ok' },
  warn: { label: 'ATENÇÃO',   cls: 'b-warn' },
  risk: { label: 'FORA DO PARÂMETRO', cls: 'b-risk' },
  idle: { label: 'SEM LEITURA', cls: 'b-idle' },
};

/* ============================================================
   ACTIVITY TYPES
   ============================================================ */
export const ATIVIDADES = [
  {
    id: 'CONFINADO', nome: 'Espaço confinado', icon: 'confined', severidade: 'ALTA',
    params: ['O2', 'LEL', 'H2S', 'CO', 'TEMP'],
    riscos: ['R-ATM', 'R-ASF', 'R-ENG', 'R-TEMP', 'R-ACES'],
    epis: ['E-CAP', 'E-OCU', 'E-LUV', 'E-BOT', 'E-CIN', 'E-RESP', 'E-DET'],
    validadeH: 6,
  },
  {
    id: 'ALTURA', nome: 'Trabalho em altura', icon: 'height', severidade: 'ALTA',
    params: ['VENTO', 'TEMP'],
    riscos: ['R-QUEDA', 'R-OBJ', 'R-VENTO', 'R-ELET'],
    epis: ['E-CAP', 'E-OCU', 'E-LUV', 'E-BOT', 'E-CIN', 'E-TRAV'],
    validadeH: 8,
  },
  {
    id: 'ELETRICA', nome: 'Manutenção elétrica', icon: 'zap', severidade: 'ALTA',
    params: ['TEMP', 'UMID'],
    riscos: ['R-ELET', 'R-ARCO', 'R-ENERG', 'R-QUEIM'],
    epis: ['E-CAP', 'E-OCU', 'E-LUVE', 'E-BOT', 'E-VEST', 'E-BALA'],
    validadeH: 8,
  },
  {
    id: 'QUENTE', nome: 'Trabalho a quente', icon: 'flame', severidade: 'ALTA',
    params: ['LEL', 'CO', 'TEMP'],
    riscos: ['R-INC', 'R-QUEIM', 'R-FUM', 'R-EXPL'],
    epis: ['E-CAP', 'E-MASC', 'E-LUVS', 'E-BOT', 'E-AVEN', 'E-EXT'],
    validadeH: 6,
  },
  {
    id: 'ICAMENTO', nome: 'Içamento de carga', icon: 'layers', severidade: 'MEDIA',
    params: ['VENTO'],
    riscos: ['R-OBJ', 'R-VENTO', 'R-ESMAG'],
    epis: ['E-CAP', 'E-OCU', 'E-LUV', 'E-BOT', 'E-COLE'],
    validadeH: 10,
  },
  {
    id: 'ESCAVACAO', nome: 'Escavação', icon: 'target', severidade: 'MEDIA',
    params: ['O2', 'LEL', 'TEMP'],
    riscos: ['R-SOTER', 'R-ATM', 'R-INTERF'],
    epis: ['E-CAP', 'E-OCU', 'E-LUV', 'E-BOT', 'E-COLE'],
    validadeH: 10,
  },
];
export const atividadeById = (id) => ATIVIDADES.find((a) => a.id === id);
export const atividadeNome = (id) => atividadeById(id)?.nome ?? '—';

/* ============================================================
   RISK LIBRARY  (risco → medidas preventivas sugeridas)
   ============================================================ */
export const RISCOS = {
  'R-ATM':    { nome: 'Atmosfera perigosa / deficiência de O₂', grau: 'ALTO',  medidas: ['Ventilação forçada contínua', 'Monitoramento atmosférico contínuo', 'Bloqueio e etiquetagem de linhas'] },
  'R-ASF':    { nome: 'Asfixia',                                grau: 'ALTO',  medidas: ['Vigia permanente no acesso', 'Conjunto autônomo de resgate disponível'] },
  'R-ENG':    { nome: 'Engolfamento por produto',               grau: 'ALTO',  medidas: ['Bloqueio físico (raqueteamento)', 'Dreno e purga confirmados'] },
  'R-TEMP':   { nome: 'Temperatura extrema',                    grau: 'MEDIO', medidas: ['Pausas programadas', 'Hidratação assistida'] },
  'R-ACES':   { nome: 'Acesso e resgate dificultados',          grau: 'ALTO',  medidas: ['Tripé de resgate posicionado', 'Plano de emergência revisado'] },
  'R-QUEDA':  { nome: 'Queda de altura',                        grau: 'ALTO',  medidas: ['Linha de vida instalada e inspecionada', 'Cinto tipo paraquedista com talabarte duplo'] },
  'R-OBJ':    { nome: 'Queda de objetos',                       grau: 'MEDIO', medidas: ['Isolamento e sinalização da projeção vertical', 'Amarração de ferramentas'] },
  'R-VENTO':  { nome: 'Rajadas de vento',                       grau: 'MEDIO', medidas: ['Interrupção acima de 40 km/h', 'Monitoramento de anemômetro'] },
  'R-ELET':   { nome: 'Choque elétrico',                        grau: 'ALTO',  medidas: ['Desenergização e bloqueio (LOTO)', 'Teste de ausência de tensão'] },
  'R-ARCO':   { nome: 'Arco elétrico',                          grau: 'ALTO',  medidas: ['Vestimenta com proteção contra arco', 'Distância de segurança demarcada'] },
  'R-ENERG':  { nome: 'Energização acidental',                  grau: 'ALTO',  medidas: ['Cadeado individual por executante', 'Cartão de identificação no dispositivo'] },
  'R-QUEIM':  { nome: 'Queimaduras',                            grau: 'MEDIO', medidas: ['Luvas e mangas resistentes ao calor', 'Resfriamento prévio da superfície'] },
  'R-INC':    { nome: 'Incêndio',                               grau: 'ALTO',  medidas: ['Remoção de combustíveis num raio de 11 m', 'Vigia de fogo por 30 min após o término'] },
  'R-FUM':    { nome: 'Fumos metálicos',                        grau: 'MEDIO', medidas: ['Exaustão localizada', 'Respirador com filtro P3'] },
  'R-EXPL':   { nome: 'Atmosfera explosiva',                    grau: 'ALTO',  medidas: ['Medição de LIE antes e durante', 'Ferramentas antifaiscantes'] },
  'R-ESMAG':  { nome: 'Esmagamento',                            grau: 'ALTO',  medidas: ['Área de manobra isolada', 'Sinaleiro exclusivo'] },
  'R-SOTER':  { nome: 'Soterramento',                           grau: 'ALTO',  medidas: ['Escoramento da vala', 'Talude conforme projeto'] },
  'R-INTERF': { nome: 'Interferências enterradas',              grau: 'MEDIO', medidas: ['Locação prévia por georadar', 'Escavação manual nos primeiros 50 cm'] },
};
export const riscoNome = (id) => RISCOS[id]?.nome ?? id;

/* ============================================================
   PPE / EQUIPMENT
   ============================================================ */
export const EPIS = {
  'E-CAP':  'Capacete com jugular',
  'E-OCU':  'Óculos de segurança',
  'E-LUV':  'Luvas de segurança',
  'E-LUVE': 'Luvas isolantes classe 2',
  'E-LUVS': 'Luvas de raspa (solda)',
  'E-BOT':  'Botina de segurança',
  'E-CIN':  'Cinturão paraquedista',
  'E-TRAV': 'Trava-quedas retrátil',
  'E-RESP': 'Respirador semifacial',
  'E-MASC': 'Máscara de solda',
  'E-AVEN': 'Avental de raspa',
  'E-VEST': 'Vestimenta antichama',
  'E-BALA': 'Balaclava antichama',
  'E-COLE': 'Colete refletivo',
  'E-DET':  'Detector multigás pessoal',
  'E-EXT':  'Extintor portátil (vigia de fogo)',
};
export const epiNome = (id) => EPIS[id] ?? id;

export const EQUIPAMENTOS = [
  'Ventilador/exaustor portátil', 'Tripé de resgate com guincho', 'Andaime certificado',
  'Plataforma elevatória (PTA)', 'Talha elétrica 2 t', 'Escada de fibra 6 m',
  'Detector multigás calibrado', 'Anemômetro digital', 'Iluminação à prova de explosão',
  'Conjunto de bloqueio LOTO', 'Máquina de solda', 'Bomba de esgotamento',
];

export const FERRAMENTAS = [
  'Chave de grifo', 'Torquímetro', 'Chaves combinadas isoladas', 'Multímetro categoria IV',
  'Ferramentas antifaiscantes', 'Esmerilhadeira', 'Maçarico oxiacetilênico', 'Furadeira industrial',
];

/* ============================================================
   VALIDATION CHECKLIST
   ============================================================ */
export const CHECKLIST = [
  { id: 'C1', label: 'Equipe autorizada e treinamentos válidos',     grupo: 'Pessoas',      auto: 'equipe' },
  { id: 'C2', label: 'Medições atmosféricas dentro dos parâmetros',  grupo: 'Ambiente',     auto: 'medicoes' },
  { id: 'C3', label: 'Riscos identificados e classificados',         grupo: 'Análise',      auto: 'riscos' },
  { id: 'C4', label: 'Medidas preventivas definidas e implantadas',  grupo: 'Análise',      auto: 'medidas' },
  { id: 'C5', label: 'EPIs e equipamentos conferidos no local',      grupo: 'Recursos',     auto: 'epis' },
  { id: 'C6', label: 'Área isolada, sinalizada e liberada',          grupo: 'Ambiente',     auto: null },
  { id: 'C7', label: 'Bloqueio de energias confirmado (LOTO)',       grupo: 'Ambiente',     auto: null },
  { id: 'C8', label: 'Plano de emergência e resgate comunicado',     grupo: 'Emergência',   auto: null },
];

/* ============================================================
   PET LIFECYCLE
   ============================================================ */
export const PET_STATUS = {
  RASCUNHO:     { label: 'Rascunho',      badge: 'b-idle', dot: 'var(--idle)', ordem: 0 },
  EM_VALIDACAO: { label: 'Em validação',  badge: 'b-warn', dot: 'var(--warn)', ordem: 1 },
  LIBERADA:     { label: 'Liberada',      badge: 'b-ac',   dot: 'var(--ac)',   ordem: 2 },
  ATIVA:        { label: 'Ativa',         badge: 'b-ok',   dot: 'var(--ok)',   ordem: 3 },
  SUSPENSA:     { label: 'Suspensa',      badge: 'b-risk', dot: 'var(--risk)', ordem: 4 },
  ENCERRADA:    { label: 'Encerrada',     badge: 'b-info', dot: 'var(--info)', ordem: 5 },
  CANCELADA:    { label: 'Cancelada',     badge: 'b-idle', dot: 'var(--idle)', ordem: 6 },
};
export const petStatusLabel = (s) => PET_STATUS[s]?.label ?? s;

/* ============================================================
   RBAC
   ============================================================ */
export const NIVEIS = {
  ADMINISTRADOR: {
    label: 'Administrador', ordem: 4, cor: '#C084FC',
    desc: 'Acesso completo à plataforma, incluindo configurações e auditoria.',
    caps: ['*'],
  },
  GESTOR: {
    label: 'Gestor', ordem: 3, cor: '#22D3EE',
    desc: 'Visualização, aprovação e gerenciamento de permissões e equipes.',
    caps: ['pet.view', 'pet.create', 'pet.edit', 'pet.validate', 'pet.release', 'pet.cancel', 'pet.close',
           'emp.view', 'emp.create', 'emp.edit', 'med.view', 'med.register',
           'alert.view', 'alert.ack', 'access.view', 'trace.view', 'report.view', 'report.export'],
  },
  SUPERVISOR: {
    label: 'Supervisor', ordem: 2, cor: '#60A5FA',
    desc: 'Controle das atividades em campo, criação de PETs e registro de medições.',
    caps: ['pet.view', 'pet.create', 'pet.edit', 'pet.close',
           'emp.view', 'med.view', 'med.register',
           'alert.view', 'alert.ack', 'access.view', 'trace.view', 'report.view'],
  },
  OPERADOR: {
    label: 'Operador', ordem: 1, cor: '#94A3B8',
    desc: 'Acesso restrito às funcionalidades necessárias para a execução da atividade.',
    caps: ['pet.view', 'med.view', 'alert.view', 'access.view', 'trace.view'],
  },
};
export const NIVEL_LIST = Object.keys(NIVEIS);

export function can(nivel, cap) {
  const n = NIVEIS[nivel];
  if (!n) return false;
  return n.caps.includes('*') || n.caps.includes(cap);
}

/* ============================================================
   ALERTS
   ============================================================ */
export const ALERTA_TIPOS = {
  ACESSO_NEGADO:    { label: 'Acesso não autorizado',   sev: 'risk', icon: 'userX' },
  MEDICAO_FORA:     { label: 'Medição fora do parâmetro', sev: 'warn', icon: 'gauge' },
  PET_VENCENDO:     { label: 'PET próxima do vencimento', sev: 'warn', icon: 'clock' },
  PET_VENCIDA:      { label: 'PET vencida',             sev: 'risk', icon: 'clock' },
  PET_AGUARDANDO:   { label: 'PET aguardando validação', sev: 'info', icon: 'checks' },
  EQUIPE_IRREGULAR: { label: 'Treinamento vencido',     sev: 'warn', icon: 'shield' },
  SISTEMA:          { label: 'Evento de sistema',       sev: 'info', icon: 'cpu' },
};
export const SEV = {
  risk: { label: 'Crítico', badge: 'b-risk', peso: 3 },
  warn: { label: 'Atenção', badge: 'b-warn', peso: 2 },
  info: { label: 'Informativo', badge: 'b-info', peso: 1 },
  ok:   { label: 'Resolvido', badge: 'b-ok', peso: 0 },
};

/* ============================================================
   TRACEABILITY EVENT TYPES
   ============================================================ */
export const EVENTO = {
  PET_CRIADA:        { label: 'PET criada',                  icon: 'permit',    tone: '' },
  PET_EDITADA:       { label: 'PET atualizada',              icon: 'edit',      tone: '' },
  EQUIPE_DEFINIDA:   { label: 'Equipe vinculada',            icon: 'users',     tone: '' },
  RISCOS_AVALIADOS:  { label: 'Riscos avaliados',            icon: 'alert',     tone: '' },
  MEDICAO:           { label: 'Medição registrada',          icon: 'gauge',     tone: '' },
  MEDICAO_FORA:      { label: 'Medição fora do parâmetro',   icon: 'gauge',     tone: 'warn' },
  EQUIP_CONFERIDO:   { label: 'Equipamentos conferidos',     icon: 'helmet',    tone: '' },
  ENVIADA_VALIDACAO: { label: 'Enviada para validação',      icon: 'checks',    tone: '' },
  PET_VALIDADA:      { label: 'PET validada',                icon: 'shieldOk',  tone: 'ok' },
  PET_LIBERADA:      { label: 'PET liberada',                icon: 'unlock',    tone: 'ok' },
  ACESSO_LIBERADO:   { label: 'Acesso liberado',             icon: 'userCheck', tone: 'ok' },
  ACESSO_BLOQUEADO:  { label: 'Acesso bloqueado',            icon: 'userX',     tone: 'risk' },
  ATIV_INICIADA:     { label: 'Atividade iniciada',          icon: 'play',      tone: 'on' },
  ATIV_SUSPENSA:     { label: 'Atividade suspensa',          icon: 'pause',     tone: 'risk' },
  ATIV_RETOMADA:     { label: 'Atividade retomada',          icon: 'play',      tone: 'on' },
  ATIV_ENCERRADA:    { label: 'Atividade encerrada',         icon: 'stop',      tone: '' },
  PET_FINALIZADA:    { label: 'PET finalizada',              icon: 'okCircle',  tone: 'ok' },
  PET_CANCELADA:     { label: 'PET cancelada',               icon: 'xCircle',   tone: 'risk' },
  ALERTA_GERADO:     { label: 'Alerta gerado',               icon: 'alert',     tone: 'warn' },
  ALERTA_TRATADO:    { label: 'Alerta tratado',              icon: 'okCircle',  tone: 'ok' },
  FUNC_CADASTRADO:   { label: 'Funcionário cadastrado',      icon: 'userCheck', tone: '' },
  FACE_REGISTRADA:   { label: 'Biometria facial registrada', icon: 'scanface',  tone: '' },
  LOGIN:             { label: 'Sessão iniciada',             icon: 'fingerprint', tone: '' },
  LOGOUT:            { label: 'Sessão encerrada',            icon: 'logout',    tone: '' },
};
export const eventoLabel = (t) => EVENTO[t]?.label ?? t;
