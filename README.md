# PET CONTROL

**Gestão inteligente de Permissões de Entrada de Trabalho**

MVP funcional desenvolvido pela **ARTECH** para o hackathon da CEI em parceria
com o Itaipu Parquetec.

---

## O problema

A gestão física da Permissão de Entrada de Trabalho (PET) depende de formulários
impressos, preenchimento manual, conferências presenciais, assinaturas e
arquivamento em papel. O resultado é conhecido:

- ineficiência operacional e retrabalho
- erros de preenchimento detectados tarde demais
- dificuldade de acesso à informação e de auditoria
- perda de rastreabilidade — não se sabe **quem** fez **o quê**, **quando** e **onde**
- nenhum controle efetivo sobre quem está autorizado a entrar na área
- risco operacional que só é percebido depois do incidente

## A proposta

Uma plataforma **digital, centralizada, rastreável, inteligente e segura** que
cobre o ciclo completo da permissão:

```
Cadastrar funcionário → Registrar rosto → Criar PET → Vincular equipe
→ Registrar medições → Validar PET → Identificar na portaria → Liberar acesso
→ Monitorar atividade → Encerrar PET → Consultar histórico → Gerar relatório
```

Todas essas etapas estão implementadas e **conectadas entre si** neste MVP:
uma PET criada no formulário aparece no dashboard, habilita o acesso da equipe
na portaria eletrônica, alimenta a central de alertas e produz uma trilha de
auditoria consultável.

---

## Como abrir

**Jeito mais simples — duplo clique.** O arquivo `dist/pet-control.html` é a
plataforma inteira em um único arquivo (HTML, CSS e JavaScript embutidos).
Abre direto no navegador, sem servidor e sem instalação.

**A partir do código-fonte**, para desenvolver: não há build nem dependências,
basta servir a pasta:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Qualquer servidor estático funciona (`npx serve`, `php -S`, Live Server…).
Aqui o servidor é necessário: o `index.html` carrega módulos ES separados, que
o navegador bloqueia no protocolo `file://`. Só a versão empacotada
(`dist/pet-control.html`) abre com duplo clique.

Para regerar o arquivo único depois de mexer no código:

```bash
python3 build.py              # dist/pet-control.html  (autônoma)
python3 build.py --fragment   # dist/pet-control-fragmento.html  (para hospedar)
```

**Entrar na plataforma:** a tela inicial é a identificação facial. Selecione um
dos quatro rostos cadastrados para simular o reconhecimento. Cada um tem um
nível de acesso diferente e a interface se adapta a ele:

| Rosto | Nível | O que consegue fazer |
|---|---|---|
| Marina Toledo Alves | Administrador | Tudo, incluindo configurações |
| Carlos Eduardo Souza | Gestor | Validar, liberar, cancelar, cadastrar, exportar |
| Ana Paula Ribeiro | Supervisor | Criar PETs, registrar medições, encerrar atividades |
| João Batista Silva | Operador | Apenas consulta das telas operacionais |

O botão **“Simular rosto não cadastrado”** demonstra o caminho de bloqueio.

---

## Telas

| Tela | O que demonstra |
|---|---|
| **Identificação facial** | Pipeline câmera → leitura → identificação → validação de permissão → acesso |
| **Dashboard** | Visão operacional em tempo real: indicadores, atividades, sensores, alertas |
| **Permissões (PETs)** | Listagem filtrável, ficha completa, ciclo de vida (iniciar, suspender, encerrar) |
| **Nova PET** | Formulário guiado em 7 etapas com validação a cada passo |
| **Validação** | Fila de aprovação, checklist de segurança e liberação auditável |
| **Acessos** | Portaria eletrônica: decisão de autorização e registro de entradas/saídas |
| **Funcionários** | Base cadastral, níveis de acesso, áreas autorizadas e captura biométrica |
| **Medições** | Monitoramento contínuo dos detectores com faixa aceitável sempre visível |
| **Alertas** | Central de ocorrências geradas automaticamente pelo sistema |
| **Rastreabilidade** | Linha do tempo completa da PET + trilha de auditoria global |
| **Relatórios** | Indicadores consolidados com filtros e exportação |
| **Antes × Depois** | Comparação do processo em papel com o processo digital |
| **Configurações** | Matriz de permissões, parâmetros de medição e controles da demonstração |

---

## Decisões de arquitetura

**Zero build, zero dependências.** JavaScript com módulos ES nativos, CSS puro
e gráficos SVG escritos à mão. A escolha é deliberada: um MVP de hackathon
precisa abrir instantaneamente em qualquer máquina, sem `npm install`, sem
bundler e sem risco de quebrar minutos antes da apresentação.

**Um único store observável.** Todo o estado vive em `src/store.js`. As telas
não guardam dados próprios — leem do store e se redesenham quando ele muda.
É por isso que as informações batem entre as telas.

**A trilha de auditoria mora no store, não nas telas.** Toda mutação relevante
(`createPet`, `validatePet`, `registerAccess`, `registerMeasurement`…) grava um
evento com autor, tipo, momento, local e detalhe. Rastreabilidade é a promessa
central do produto, então ela não pode depender de a tela lembrar de registrar.

**Uma única regra de autorização.** `evaluateAccess()` concentra a decisão da
portaria: cadastro ativo, biometria registrada, treinamentos válidos, área
autorizada e PET vigente. A prévia da decisão, a simulação e o registro usam
exatamente a mesma função.

**Dados determinísticos.** O gerador usa uma semente fixa, então a demonstração
é sempre a mesma — mas os horários são relativos ao momento da abertura, então
a operação parece sempre atual.

### Estrutura

```
index.html         versão modular, para desenvolvimento
build.py           empacota tudo em um arquivo único
assets/css/
  tokens.css        design tokens (cores, tipografia, espaçamento, motion)
  base.css          reset, primitivas tipográficas, animações
  components.css    biblioteca de componentes (painéis, tabelas, badges, KPI…)
  layout.css        shell da aplicação (menu, topo, grids, responsividade)
  screens.css       estilos específicos de tela (scanner, wizard, portaria…)
src/
  app.js            shell, roteador, sessão, notificações
  store.js          estado, ações, auditoria e simulação em tempo real
  selectors.js      métricas derivadas (KPIs, relatórios, séries)
  util.js           formatação, datas, DOM, CSV
  data/
    catalog.js      catálogos de domínio: unidades, atividades, riscos, EPIs, RBAC
    seed.js         geração determinística da base de demonstração
  ui/
    brand.js        marca ARTECH (símbolo e logotipo em SVG vetorial)
    icons.js        conjunto de ícones
    kit.js          helpers de renderização compartilhados
    charts.js       gráficos SVG (área, barras, rosca, sparkline, radial)
    overlay.js      toasts, modais, drawers e confirmações
    camera.js       câmera real quando disponível, feed sintético como alternativa
  screens/          uma tela por arquivo
```

---

## Escopo do MVP

Este é um **protótipo demonstrativo**, não um sistema em produção. O que isso
significa na prática:

- **O reconhecimento facial é simulado.** A câmera é real quando o navegador
  permite, e a interface reproduz o fluxo biométrico completo — mas não há
  extração de características nem comparação de templates. Nenhuma imagem é
  capturada, transmitida ou armazenada. A decisão usa colaboradores previamente
  cadastrados, exatamente como o enunciado pede.
- **As medições são simuladas.** Os detectores de área são modelados com deriva
  aleatória dentro e fora das faixas aceitáveis, o que permite demonstrar o
  alerta automático.
- **Não há backend.** Todo o estado fica no `localStorage` do navegador e é
  regenerado após 8 horas para que a demonstração nunca apareça “parada no
  tempo”. **Restaurar demonstração**, em Configurações, recria tudo.
- **Todos os dados são fictícios.** Nomes, matrículas, unidades e áreas foram
  inventados para a demonstração e não correspondem a pessoas reais.

### Marca

O símbolo e o logotipo da ARTECH estão em `src/ui/brand.js` como SVG vetorial,
recriados a partir da identidade original para escalar sem perda e assumir as
cores corretas sobre o fundo escuro da interface. Aparecem na tela de
identificação, no rodapé do menu lateral e em Configurações → Sobre.
Para usar o arquivo original em vez da versão vetorial, coloque-o em
`assets/brand/` e troque a chamada de `artechLogo()` por uma tag `<img>`.

### O que um piloto real exigiria

API e banco de dados com trilha de auditoria imutável (append-only, com
assinatura); integração biométrica real com consentimento e retenção conforme
a LGPD; integração com catracas, detectores de gás e sistema de RH; assinatura
eletrônica com valor jurídico; operação offline em campo com sincronização
posterior.
