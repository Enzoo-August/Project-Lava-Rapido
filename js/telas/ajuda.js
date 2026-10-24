/* =========================================================
   Ajuda — como usar, em passos curtos, e o caminho para a tela
   "Instalar o app". Também mostra as boas-vindas no primeiro acesso.
   ========================================================= */
(function () {
  const passo = (n, titulo, texto) => `<div class="ajuda-passo"><i>${n}</i><div><b>${titulo}</b><p>${texto}</p></div></div>`;

  const BALCAO = [
    ['Chegou um carro', 'Toque em <b>Chegou carro</b> e digite a placa. Se o carro já veio antes, ele aparece: toque nele. Se é novo, escolha o modelo, a cor e anote nome e WhatsApp do cliente.'],
    ['Escolha o serviço', 'Toque no serviço que o cliente quer. O preço aparece sozinho. Toque em <b>Confirmar</b>. O cliente já pode ir embora.'],
    ['Começou a lavar', 'Em <b>No pátio</b>, toque em <b>Começar a lavar</b> no carro.'],
    ['Ficou pronto', 'Toque em <b>Ficou pronto</b>. O WhatsApp abre com o aviso escrito: é só enviar.'],
    ['O cliente buscou', 'Em <b>Prontos</b>, toque em <b>Entregar</b> e escolha como ele pagou. Pronto!']
  ];
  const DONO = [
    ['Início', 'Mostra quanto entrou hoje, quantos carros passaram e o que está no pátio agora, de onde você estiver.'],
    ['Resultados', 'Os gráficos: dias e horários mais fortes, serviços que mais vendem e formas de pagamento.'],
    ['Produtos', 'Cadastre seus produtos com valor e quantidade. Quando faltar, toque em “Pedir” e gere o PDF do pedido com a sua logo para mandar ao fornecedor.'],
    ['Fiado', 'Quem paga depois: na entrega toque em “Fiado”. Em Mais → Fiado você vê quanto cada um deve, manda o resumo no WhatsApp e marca quando recebeu.'],
    ['Backup', 'Toda segunda o sininho lembra: salve uma cópia dos seus dados e clientes no computador, na pasta “Backups Lava Rápido”.'],
    ['Financeiro', 'Lance as despesas do mês (aluguel, água, luz, produtos) para ver quanto sobra de verdade.'],
    ['Clientes', 'Quem tem prêmio de fidelidade, quem está quase lá e quem sumiu, para chamar de volta pelo WhatsApp.'],
    ['Ajustes', 'Sua logo e cor, serviços e preços, regras da fidelidade, textos das mensagens e os acessos da equipe.']
  ];

  const instalar = () => `<section class="cartao"><div class="cartao-cab"><h3>${U.icon('celular')} Instalar o app</h3></div>
      <p class="mudo">Passo a passo para iPhone, Android e computador, com o desenho de cada botão.</p>
      <a class="btn btn-marca btn-bloco" href="#/instalar">${U.icon('celular')}<span>Ver como instalar</span></a></section>`;

  Telas.ajuda = {
    titulo: 'Como usar',
    perfis: ['funcionario', 'dono'],
    aoVoltar: () => { location.hash = App.user.perfil === 'dono' ? '#/mais' : '#/balcao'; },
    render: (el, args) => {
      const dono = App.user.perfil === 'dono', sup = (window.LAVA_CFG || {}).suporte;
      if (args[0] === 'instalar') { location.replace('#/instalar'); return; }   // endereço antigo
      el.innerHTML = `
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('carro')} O dia a dia, em 5 passos</h3></div>${BALCAO.map((p, i) => passo(i + 1, p[0], p[1])).join('')}</section>
        ${dono ? `<section class="cartao"><div class="cartao-cab"><h3>${U.icon('grafico')} O que só o dono vê</h3></div>${DONO.map((p) => passo('•', p[0], p[1])).join('')}</section>` : ''}
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('calendario')} Agenda e serviços especiais</h3></div>
          ${passo('•', 'Marcar horário', 'Em <b>Agenda</b>, toque em <b>Marcar horário</b>. No dia, toque em <b>Chegou</b> e a entrada já vem preenchida. <b>Lembrar</b> manda o lembrete no WhatsApp.')}
          ${passo('•', 'Risco ou amassado', 'Na chegada, toque em <b>Foto de risco ou amassado</b>, tire a foto e escreva onde é. Fica salva no carro: na próxima vez o aplicativo pergunta se ainda está lá. Dá para mandar as fotos para o cliente.')}
          ${passo('•', 'Serviço que não está na lista', 'Na hora de escolher o serviço, toque em <b>Outro serviço</b> e escreva o nome e o valor.')}
          ${passo('•', 'Serviço “a combinar”', 'Se o serviço não tem preço na tabela, o aplicativo pergunta o valor quando você marca.')}
          ${passo('•', 'Carro que fica mais de um dia', 'Em <b>Fica pronto quando?</b>, toque em <b>Outro dia</b> e escolha o dia e a hora.')}</section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('presente')} Fidelidade</h3></div>
          <p class="mudo">Cada lavagem vale 1 ponto. Quando o cliente completa os pontos, o aplicativo avisa na hora da chegada. Pergunte se ele quer <b>usar o desconto agora</b> ou <b>guardar</b> para um desconto maior.</p></section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('nuvem')} E se a internet cair?</h3></div>
          <p class="mudo">Pode continuar usando. O que você registrar fica guardado no aparelho e é enviado sozinho quando o sinal voltar. No alto da tela aparece quantos registros faltam enviar.</p></section>
        ${instalar()}
        ${sup ? `<a class="btn btn-zap btn-g btn-bloco" href="${U.zapLink(sup, 'Olá! Preciso de ajuda com o sistema do ' + DB.lava().nome)}" target="_blank" rel="noopener">${U.icon('zap')}<span>Falar com o suporte</span></a>` : ''}`;
    },

    // primeiro acesso neste aparelho: explica em uma tela só
    boasVindas: () => {
      const u = App.user;
      if (!u || u.perfil === 'admin' || Store.pref('visto.' + u.perfil)) return;
      Store.pref('visto.' + u.perfil, true);
      const lista = u.perfil === 'dono'
        ? [['casa', 'Início mostra o dia de hoje: quanto entrou e o que está no pátio.'], ['mais', 'O botão “Chegou carro” registra a entrada em poucos toques.'], ['ajustes', 'Em Ajustes você coloca sua logo, seus preços e cria o acesso do funcionário.']]
        : [['mais', 'Chegou carro? Toque em “Chegou carro” e digite a placa.'], ['gota', 'No pátio, cada carro tem um botão grande com o próximo passo.'], ['zap', 'Quando ficar pronto, o WhatsApp abre com o aviso já escrito.']];
      U.modal({
        titulo: `Olá, ${U.primeiroNome(u.nome)}!`,
        html: `<div class="boas">${lista.map(([ic, t]) => `<p>${U.icon(ic)}<span>${t}</span></p>`).join('')}</div>`,
        acoes: [{ txt: 'Ver como usar', valor: 'ajuda' }, { txt: 'Começar', cls: 'btn-marca', valor: true }]
      }).then((v) => { if (v === 'ajuda') App.ir('ajuda'); });
    }
  };
})();
