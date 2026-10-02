/* =========================================================
   Ajuda — como usar, em passos curtos, e como instalar no
   celular. Também mostra as boas-vindas no primeiro acesso.
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
    ['Financeiro', 'Lance as despesas do mês (aluguel, água, luz, produtos) para ver quanto sobra de verdade.'],
    ['Clientes', 'Quem tem prêmio de fidelidade, quem está quase lá e quem sumiu, para chamar de volta pelo WhatsApp.'],
    ['Ajustes', 'Sua logo e cor, serviços e preços, regras da fidelidade, textos das mensagens e os acessos da equipe.']
  ];

  const instalar = () => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (instalado) Store.pref('instalado', true);
    return `<section class="cartao"><div class="cartao-cab"><h3>${U.icon('celular')} Instalar no celular</h3></div>
      ${instalado ? '<p class="aviso-caixa bom">' + U.icon('check') + '<span>Já está instalado neste aparelho.</span></p>' : ''}
      <p class="mudo">Instalado, ele abre como um aplicativo, direto da tela inicial, sem digitar endereço.</p>
      ${ios ? passo(1, 'Abra no Safari', 'Tem que ser no Safari (o navegador da Apple).') + passo(2, 'Toque em Compartilhar', 'É o quadrado com a seta para cima, na barra de baixo.') + passo(3, 'Adicionar à Tela de Início', 'Role a lista, toque nessa opção e depois em <b>Adicionar</b>.')
        : passo(1, 'Abra no Chrome', 'No celular Android, use o Chrome.') + passo(2, 'Toque nos três pontinhos', 'No canto de cima, à direita.') + passo(3, 'Instalar aplicativo', 'Toque em <b>Instalar aplicativo</b> (ou “Adicionar à tela inicial”) e confirme.')}
      ${instalado ? '' : '<button class="btn btn-bloco" id="ajInstalei">Já instalei</button>'}
    </section>`;
  };

  Telas.ajuda = {
    titulo: (args) => (args[0] === 'instalar' ? 'Instalar no celular' : 'Como usar'),
    perfis: ['funcionario', 'dono'],
    aoVoltar: () => { location.hash = App.user.perfil === 'dono' ? '#/mais' : '#/balcao'; },
    render: (el, args) => {
      const dono = App.user.perfil === 'dono', sup = (window.LAVA_CFG || {}).suporte;
      const soInstalar = args[0] === 'instalar';
      el.innerHTML = `${soInstalar ? '' : `
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('carro')} O dia a dia, em 5 passos</h3></div>${BALCAO.map((p, i) => passo(i + 1, p[0], p[1])).join('')}</section>
        ${dono ? `<section class="cartao"><div class="cartao-cab"><h3>${U.icon('grafico')} O que só o dono vê</h3></div>${DONO.map((p) => passo('•', p[0], p[1])).join('')}</section>` : ''}
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('presente')} Fidelidade</h3></div>
          <p class="mudo">Cada lavagem vale 1 ponto. Quando o cliente completa os pontos, o aplicativo avisa na hora da chegada. Pergunte se ele quer <b>usar o desconto agora</b> ou <b>guardar</b> para um desconto maior.</p></section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('nuvem')} E se a internet cair?</h3></div>
          <p class="mudo">Pode continuar usando. O que você registrar fica guardado no aparelho e é enviado sozinho quando o sinal voltar. No alto da tela aparece quantos registros faltam enviar.</p></section>`}
        ${instalar()}
        ${sup ? `<a class="btn btn-zap btn-g btn-bloco" href="${U.zapLink(sup, 'Olá! Preciso de ajuda com o sistema do ' + DB.lava().nome)}" target="_blank" rel="noopener">${U.icon('zap')}<span>Falar com o suporte</span></a>` : ''}`;
      const b = el.querySelector('#ajInstalei'); if (b) b.onclick = () => { Store.pref('instalado', true); U.toast('Ótimo!'); App.render(); };
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
