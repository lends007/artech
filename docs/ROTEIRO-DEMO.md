# Roteiro de demonstração — PET CONTROL

Percurso de ~6 minutos que mostra o ciclo completo e conecta cada tela à dor
que ela resolve. Antes de começar, abra **Configurações → Restaurar
demonstração** para partir de um estado limpo.

---

## 1. Identificação facial · 30s

> “O acesso à plataforma não começa com usuário e senha. Começa com a pessoa.”

Selecione **Marina Toledo Alves (Administrador)**. Mostre o pipeline
acompanhando a leitura: câmera → leitura facial → identificação → validação de
permissão → acesso liberado, com a confiança subindo em tempo real.

Depois volte (menu do usuário → encerrar sessão) e clique em **“Simular rosto
não cadastrado”**: a similaridade fica abaixo do limiar, o acesso é negado e o
registro segue para a central de alertas.

## 2. Dashboard · 45s

> “Isto é o que hoje não existe: a operação inteira em uma tela.”

Aponte os indicadores — PETs ativas, pessoas em área, PETs em validação, alertas
e atividades em andamento. Role até **Atividades em tempo real**: cada linha tem
progresso da janela de validade, equipe, área e tempo em execução. Note que os
números continuam se movendo: os sensores são lidos a cada 5 segundos.

## 3. Emitir uma PET · 2min

> “O formulário de papel vira um fluxo que não deixa passar erro.”

**Nova PET** → percorra as sete etapas:

1. **Identificação** — escolha *Espaço confinado*; observe que o sistema já
   carrega riscos, EPIs e validade típicos dessa atividade.
2. **Equipe** — os colaboradores habilitados para a área aparecem primeiro; os
   demais vêm marcados com o motivo (*sem face*, *NR vencida*, *fora da área*).
   Selecione três pessoas.
3. **Riscos** — “Selecionar todos”; as medidas preventivas correspondentes são
   carregadas automaticamente.
4. **Medições** — clique em **Importar dos detectores**: as leituras vêm dos
   sensores da própria área, já classificadas contra a faixa aceitável.
   *Para demonstrar o bloqueio, digite um valor fora da faixa — a etapa 07
   passa a impedir a liberação.*
5. **Equipamentos** — EPIs sugeridos, equipamentos e ferramentas.
6. **Validação** — o checklist já vem parcialmente conferido a partir do que foi
   preenchido; os itens de conferência presencial ficam para o emissor.
7. **Liberação** — resumo completo e **LIBERAR ATIVIDADE**.

Na ficha da PET, clique em **Iniciar atividade**.

## 4. Portaria eletrônica · 1min

> “A autorização deixa de estar no papel e passa a estar na portaria.”

**Acessos** → **Caso autorizado**: o sistema identifica o colaborador, encontra
a PET que acabou de ser emitida e libera o acesso.

Em seguida, **Caso bloqueado**: alguém sem permissão para aquela área. O acesso
é negado, o motivo é registrado e **um alerta é gerado automaticamente** —
confira o contador de notificações subindo no topo.

## 5. Medição fora do parâmetro · 45s

> “A condição da área muda durante o trabalho. O sistema percebe antes das pessoas.”

Volte à PET → **Registrar medição** → escolha *Monóxido de carbono* e informe
um valor acima do limite. A leitura é classificada como fora do parâmetro, um
alerta é criado e a ficha da PET passa a exibir o aviso. Suspenda a atividade
para mostrar o registro da justificativa.

## 6. Rastreabilidade · 1min

> “Este é o diferencial. Nada disso existia no processo em papel.”

**Rastreabilidade** → selecione a PET criada. A linha do tempo mostra o ciclo
inteiro — criação, equipe, riscos, cada medição, validação, liberação, acessos,
início e suspensão — e **cada evento registra quem, o quê, quando, onde e o
status**. Role até a trilha global e filtre por autor ou tipo de evento.

## 7. Relatórios e o contraste · 45s

**Relatórios** — total de PETs, taxa de aprovação, canceladas, tempo médio de
aprovação, acessos bloqueados, homem-hora. Aplique um filtro e mostre a
exportação em CSV.

Feche em **Antes × Depois**: o processo físico e o digital lado a lado, com os
ganhos quantificados pelos próprios números da plataforma.

---

## Perguntas prováveis

**“O reconhecimento facial é real?”**
Não neste protótipo, e isso é intencional. A câmera é real, o fluxo e a decisão
de autorização são reais, mas a comparação biométrica é simulada contra os
colaboradores cadastrados. Isso mantém o foco na experiência e no conceito.
Nenhuma imagem é capturada ou armazenada.

**“Os dados são reais?”**
Não. Pessoas, matrículas, unidades e áreas são fictícias.

**“Onde ficam os dados?”**
Apenas no navegador (`localStorage`). Não há backend nem envio de informação.

**“Quanto tempo para virar produto?”**
O que falta é backend com auditoria imutável, integração biométrica com
tratamento adequado sob a LGPD, integração com catracas e detectores reais,
assinatura eletrônica com valor jurídico e operação offline em campo. A camada
de experiência e as regras de negócio estão demonstradas aqui.
