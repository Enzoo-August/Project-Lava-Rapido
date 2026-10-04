# Escopo do produto

Versão 3, de 04/10/2026. (Versão 2, de 02/10: agenda, serviço livre e barra escura. Versão 3: aparência escura, carros que ficam vários dias e teste completo de funções.) Este é o padrão que vale para todos os lava-rápidos. A personalização de cada cliente (logo, cor, preços, textos) é feita dentro do próprio aplicativo, em Ajustes, sem mexer no código.

## O problema que resolve

Hoje o lava-rápido anota no papel: carro, placa, nome. Não sabe quantos carros passaram, não avisa o cliente, não lembra quem é freguês e não sabe quanto sobrou no mês.

## O que o dono ganha

1. **Agilidade:** carro que já veio entra em 3 toques (placa → serviço → confirmar).
2. **Cliente avisado:** WhatsApp com a mensagem pronta quando o carro fica pronto.
3. **Cliente que volta:** fidelidade automática e lista de clientes sumidos para chamar de volta.
4. **Mais avaliações no Google:** pedido automático para todo cliente novo.
5. **Visão do negócio de onde estiver:** quanto entrou hoje, o que está no pátio, dias e horários fortes, quanto sobra no mês.

## O que está pronto

### Funcionário (celular)

- Tela inicial com quatro botões grandes e os números de cada um.
- **Chegou carro**, uma pergunta por tela:
  - Placa em teclado próprio, que só libera letra ou número na posição certa (Mercosul e antiga).
  - Digitou parte da placa, já aparecem os carros conhecidos. Carro que já está no pátio é avisado.
  - Carro novo: modelo por busca (catálogo com mais de 330 modelos, de Fusca a BYD, e motos; o que não estiver na lista é digitado), cor por botões, nome e WhatsApp.
  - Telefone já cadastrado? O aplicativo reconhece o cliente e oferece usar o cadastro.
  - Carro sem placa e busca pelo nome do cliente.
  - Serviço com o preço certo para o tamanho do veículo (moto, pequeno, médio, grande, extra). O último serviço do cliente já vem marcado.
  - Previsão de entrega, observações rápidas (risco, objeto de valor…), ajuste de valor.
  - Ficha do dia (número) para pendurar na chave.
- **Pátio:** cada carro com um botão do próximo passo: Começar a lavar → Ficou pronto → Entregar. Carro atrasado fica vermelho.
- **Ficou pronto:** abre o WhatsApp com o aviso escrito.
- **Entregar:** mostra o total e pergunta a forma de pagamento.
- **Cliente novo entregue:** oferece pedir avaliação no Google (uma vez só por cliente).
- Corrigir engano: voltar etapa, trocar serviço, cancelar, desfazer entrega.
- **Serviço fora da tabela:** botão "Outro serviço" para escrever o nome e o valor na hora (ex.: polimento de farol).
- **Serviço "a combinar":** serviço sem preço na tabela pergunta o valor quando é marcado. Na volta do cliente, já vem com o valor que ele pagou da última vez.
- **Entrega em outro dia:** polimento, vitrificação e outros serviços longos já sugerem o dia seguinte. Dá para escolher dia e hora.

### Agenda (para quem trabalha com hora marcada)

- Marcar horário: nome (o aplicativo sugere quem já é cliente e preenche telefone, carro e placa), dia, hora, serviço (da tabela ou escrito), valor combinado, observação.
- Lista por dia (hoje, amanhã, próximos). Horário passado sem resposta fica em destaque.
- **Lembrar:** WhatsApp com o lembrete do horário já escrito.
- **Chegou:** abre a entrada do carro já preenchida com cliente, carro e serviço combinados. O horário fica marcado como "chegou".
- Também: mudar dia/hora, "não veio" e cancelar.
- Aparece no balcão (faixa "Agenda de hoje"), no menu do funcionário e no Início do dono.
- Ajuda em 5 passos e instruções para instalar no celular.

### Fidelidade

- Cada lavagem vale 1 ponto. Padrão: 10 lavagens = 10% de desconto; quem guardar até 20 ganha 30%. O dono muda os números.
- Na chegada da lavagem que completa os pontos, aparece o aviso com a frase para o funcionário perguntar: usar agora ou guardar.
- Os pontos são contados pelo banco a partir das lavagens. Ninguém consegue "se dar" pontos.

### Cliente do lava (sem login)

- Link no WhatsApp com a situação do carro (Recebido → Lavando → Pronto → Entregue), previsão, total e o cartão fidelidade com os selos.
- Depois da entrega, botão para avaliar no Google.

### Dono

- **Início:** recebido hoje, a receber, carros, pátio ao vivo, caixa por forma de pagamento, clientes com prêmio e sumidos, primeiros passos.
- **Resultados:** hoje, 7 dias, mês, mês passado, 90 dias, com comparação. Frases prontas ("sábado é o dia mais forte"), movimento por dia, serviços mais vendidos, horários de pico, dias da semana, formas de pagamento, tamanho dos veículos, quem lavou.
- **Financeiro:** entrou, saiu, sobrou. Despesas, movimento dia a dia e planilha do mês.
- **Clientes:** busca por nome, telefone ou placa; filtros Com prêmio, Quase lá, Sumidos, Novos; ficha com histórico; chamar de volta pelo WhatsApp.
- **Ajustes:** marca (nome, logo, cor, barra do alto clara, preta ou na cor da marca, telefone, link do Google), serviços e preços, fidelidade, textos das mensagens, equipe e acessos, formas de pagamento, etapas.

### Administrador (quem vende)

- Cadastra o lava com o login do dono; o lava nasce com serviços de exemplo.
- Em cada lava: cria acessos (dono ou funcionário), troca senha de quem esqueceu e copia o link.
- Vê uso de cada lava (carros em 30 dias, último movimento).
- Assinatura: plano, pago até, ativa ou suspensa. Suspenso, o lava consulta mas não registra.

### Para não dar problema

- **Carro que fica vários dias:** o carro conta no dia em que chegou e o dinheiro conta no dia em que foi entregue. “Entregues hoje” e “Recebido hoje” mostram o que saiu hoje, mesmo que tenha chegado antes. O cartão do pátio mostra a data de chegada.
- **Aparência clara, escura ou automática:** cada aparelho escolhe a sua (menu do funcionário, Mais ou Ajustes). A marca do lava continua valendo nas duas.

- **Sem internet:** continua funcionando. O que foi registrado fica no aparelho e é enviado sozinho quando o sinal volta. O topo da tela mostra quantos faltam enviar.
- **Vários aparelhos:** o pátio se atualiza a cada 8 segundos.
- **Toque duplo:** botões respondem uma vez só.
- **Nada é apagado** pelo aplicativo: atendimento é cancelado, cadastro é desativado. O histórico fica.
- **Aparelho fica conectado:** o funcionário entra uma vez.

## Segurança testada

Conferências feitas direto no banco, todas aprovadas: 46 em 02/10/2026 e, em 04/10/2026, mais 32 usando os quatro logins reais (administrador, dono e funcionário da Garagem Z, dono do lava de teste), dentro de uma transação desfeita. Principais:

- Um lava não lê nem altera nada de outro lava.
- Funcionário não vê despesas nem o faturamento antigo (só o pátio e as últimas 36 horas), não altera preços, marca ou acessos.
- Contadores de fidelidade não aceitam alteração de fora.
- Dono não altera a própria assinatura.
- Sem login, só funcionam a marca do lava e o acompanhamento por link.
- Lava suspenso lê mas não grava. Acesso bloqueado não lê nada.
- Funcionário entrega e cancela carro que entrou há vários dias (corrigido em 04/10/2026: antes o banco recusava depois de 36 horas).

## O que NÃO está pronto (e por quê)

| Ideia | Situação | O que precisa |
|---|---|---|
| **Puxar o modelo pela placa** | Não existe consulta gratuita e legal no Brasil. | Contratar um serviço pago de consulta de placas (cobrado por consulta) e ligar numa função do banco. O aplicativo já está pronto para receber. |
| **Ler a placa por foto** | Não feito. Digitar 7 caracteres no teclado próprio é mais rápido e não erra. | Leitura por IA (custo por foto) numa função do banco. |
| **WhatsApp 100% automático** (sem tocar em enviar) | Hoje abre com a mensagem pronta e a pessoa toca em enviar: grátis e sem risco de bloqueio do número. | API oficial do WhatsApp (Meta), paga por mensagem e com aprovação. |
| **Fotos do carro na chegada** (prova de risco e amassado) | Não feito; hoje é anotação em texto. | Armazenamento de imagens no banco. |
| **Ícone e nome próprios de cada lava no celular** | O app instalado se chama "Lava Rápido"; dentro dele aparecem nome, logo e cor do lava. | Uma pasta de entrada por cliente (pequena, gerada por script). |
| **Aviso sonoro de carro novo** para o dono | Não feito. | Notificação push. |
| **Mensalistas / fiado, comissão por lavador** | Não feito. | Definir com os primeiros clientes. |
| **Lembrete automático da agenda** (sem tocar em enviar) | Hoje é um toque no botão Lembrar. | Mesma API paga do WhatsApp. |
| **Logo em alta resolução da Garagem Z** | Está a imagem pequena que veio (79 px). | Pedir o arquivo original ao Flávio; o dono troca em Ajustes → Meu lava-rápido. |

## Custos

| Item | Hoje | Quando cresce |
|---|---|---|
| Hospedagem do site (GitHub Pages) | R$ 0, publicações ilimitadas | R$ 0 |
| Banco (Supabase, plano grátis) | R$ 0 | Pro: US$ 25/mês para todos os lavas juntos |
| Domínio próprio (opcional) | — | cerca de R$ 40/ano |

Limites do plano grátis do banco: 500 MB, sem cópia de segurança automática, e o projeto pausa depois de cerca de 7 dias sem nenhum uso. Com lavas usando todo dia não pausa. **Antes de ter clientes pagando, vale passar para o Pro**, por causa da cópia de segurança diária.

Cada organização grátis do Supabase tem 2 projetos ativos: `painel-upgrade` e `lava-rapido` já ocupam os dois.

## Decisões tomadas

- **Um banco e um site para todos os lavas** (em vez de uma cópia por cliente): corrigir ou melhorar vale para todos na hora, e o custo não cresce por cliente.
- **Login por usuário e senha simples**, criado pelo dono; sem e-mail.
- **Preço por tamanho do veículo**, que é como lava-rápido cobra.
- **Movimento contado pela data de chegada do carro.** Faturamento conta só carro entregue.
