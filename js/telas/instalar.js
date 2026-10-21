/* =========================================================
   Instalar o app — passo a passo para iPhone/iPad, Android,
   computador (Chrome/Edge) e Mac com Safari.
   - Abre já na aba do aparelho que a pessoa está usando.
   - Onde o navegador deixa (Android e computador com Chrome/Edge),
     tem o botão "Instalar agora", de um toque.
   - Funciona também antes do login (link na tela de entrada).
   ========================================================= */
(function () {
  const I = {};
  window.Instalar = I;

  // o Chrome/Edge avisa quando dá para instalar com um toque: guarda o aviso para o botão "Instalar agora"
  let pedido = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; document.querySelectorAll('[data-instalar-agora]').forEach((b) => { b.hidden = false; }); });
  window.addEventListener('appinstalled', () => { pedido = null; try { Store.pref('instalado', true); } catch (e) {} U.toast('Aplicativo instalado!'); });

  const ua = navigator.userAgent;
  I.instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ehIOS = () => /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // iPad novo diz que é Mac
  const ehAndroid = () => /android/i.test(ua);
  const ehSafariMac = () => /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua) && navigator.maxTouchPoints <= 1;
  const dentroDeApp = () => /Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|wv\)/i.test(ua);   // navegador de dentro do WhatsApp/Instagram não instala
  const abaDoAparelho = () => (ehIOS() ? 'iphone' : ehAndroid() ? 'android' : ehSafariMac() ? 'mac' : 'pc');

  // desenhos pequenos dos botões que a pessoa vai procurar na tela
  const SVG = (d) => `<svg class="ic-ins" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    compartilhar: SVG('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>'),
    maisQuadrado: SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'),
    tresPontos: SVG('<circle cx="12" cy="5" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="19" r="1.300" fill="currentColor"/>'),
    tresPontosH: SVG('<circle cx="5" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="19" cy="12" r="1.300" fill="currentColor"/>'),
    instalarPc: SVG('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 7v6M9.500 10.500L12 13l2.500-2.500"/>'),
    dock: SVG('<rect x="3" y="15" width="18" height="5" rx="2"/><path d="M12 3v8M8.500 7.500L12 11l3.500-3.500"/>')
  };
  const botao = (ic, txt) => `<span class="ins-botao">${ICO[ic]}${txt ? `<span>${txt}</span>` : ''}</span>`;
  const passo = (n, titulo, texto) => `<div class="ajuda-passo"><i>${n}</i><div><b>${titulo}</b><p>${texto}</p></div></div>`;
  const passos = (l) => l.map((p, i) => passo(i + 1, p[0], p[1])).join('');
  const caixa = (tipo, titulo, linhas) => `<details class="ins-duvida ${tipo || ''}"><summary>${U.icon(tipo === 'remover' ? 'apagar' : 'ajuda')}<span>${titulo}</span></summary><ul>${linhas.map((l) => `<li>${l}</li>`).join('')}</ul></details>`;
  const endereco = () => (window.LAVA_CFG || {}).sitePrincipal || location.origin;
  const enderecoTxt = () => endereco().replace(/^https?:\/\//, '');

  const ABAS = [['iphone', 'iPhone e iPad'], ['android', 'Android'], ['pc', 'Computador'], ['mac', 'Mac (Safari)']];
  const CONTEUDO = {
    iphone: () => `
      <p class="mudo">No iPhone e no iPad, a instalação é feita pelo <b>Safari</b>, o navegador da Apple (a bússola azul).</p>
      ${passos([
        ['Abra o Safari', `Toque no ícone da bússola azul. Na barra de endereço, digite <b>${U.esc(enderecoTxt())}</b> e toque em <b>Ir</b>.`],
        ['Toque no botão Compartilhar', `É o quadrado com uma seta para cima: ${botao('compartilhar')}. No iPhone fica na <b>barra de baixo</b>, no meio. No iPad fica <b>no alto</b>, à direita do endereço. Se a barra sumiu, toque uma vez no rodapé da tela para ela voltar.`],
        ['Escolha “Adicionar à Tela de Início”', `Abre uma lista. <b>Role para baixo</b> até achar ${botao('maisQuadrado', 'Adicionar à Tela de Início')}. Se não aparecer, toque em <b>Editar Ações…</b> no fim da lista e ligue essa opção.`],
        ['Toque em “Adicionar”', 'No canto de cima, à direita. O nome já vem preenchido (pode trocar se quiser).'],
        ['Pronto: abra pelo ícone novo', 'O ícone do app aparece na tela de início, junto dos outros aplicativos. <b>Abra sempre por ele</b>. Na primeira vez, entre com o seu usuário e senha: ele fica conectado depois.']
      ])}
      ${caixa('', 'Não achei a opção / deu errado', [
        'Confira se está no <b>Safari</b>. Se o link foi aberto <b>de dentro do WhatsApp ou do Instagram</b>, toque nos três pontinhos ou no ícone da bússola e escolha <b>Abrir no Safari</b>.',
        'No iPhone com iOS 16.4 ou mais novo, também dá pelo Chrome: botão Compartilhar (no alto, à direita do endereço) → Adicionar à Tela de Início.',
        'Se estiver navegando em <b>aba privada</b>, a opção não aparece: abra numa aba normal.',
        'O login do app instalado é separado do Safari: entre uma vez dentro do app.'
      ])}
      ${caixa('remover', 'Como tirar o app', ['Na tela de início, <b>segure o dedo</b> sobre o ícone até abrir o menu e toque em <b>Remover App</b> → <b>Apagar da Tela de Início</b>. Os dados do lava continuam guardados no sistema.'])}`,

    android: () => `
      <p class="mudo">No Android, use o <b>Google Chrome</b> (o círculo colorido: vermelho, amarelo e verde).</p>
      <button type="button" class="btn btn-marca btn-g btn-bloco" data-instalar-agora hidden>${U.icon('celular')}<span>Instalar agora</span></button>
      ${passos([
        ['Abra o Chrome', `Toque no ícone do Chrome. Na barra de endereço, digite <b>${U.esc(enderecoTxt())}</b> e toque em <b>Ir</b> (ou na setinha do teclado).`],
        ['Toque nos três pontinhos', `Ficam no <b>canto de cima, à direita</b>: ${botao('tresPontos')}.`],
        ['Toque em “Instalar app”', `Na lista, toque em ${botao('instalarPc', 'Instalar app')}. Em alguns celulares o nome é <b>Adicionar à tela inicial</b>. Depois toque em <b>Instalar</b> (ou <b>Adicionar</b>).`],
        ['Confirme', 'Se aparecer a pergunta “Adicionar à tela inicial?”, toque em <b>Adicionar</b> ou <b>Adicionar automaticamente</b>.'],
        ['Pronto: abra pelo ícone novo', 'O ícone aparece na tela inicial ou na gaveta de aplicativos (onde ficam todos os apps). Abra sempre por ele. Na primeira vez, entre com seu usuário e senha.']
      ])}
      ${caixa('', 'Não achei a opção / deu errado', [
        'Se o link foi aberto <b>de dentro do WhatsApp ou do Instagram</b>, toque nos três pontinhos e escolha <b>Abrir no Chrome</b> (ou “Abrir no navegador”).',
        'No celular <b>Samsung</b> com o navegador <b>Samsung Internet</b>: toque nas três linhas (☰) embaixo, à direita → <b>Adicionar página a</b> → <b>Tela inicial</b>.',
        'Se aparecer “Instalando…” e nada acontecer, espere alguns segundos: o ícone aparece sozinho na tela inicial.',
        'Não aparece em aba anônima: use uma aba normal.'
      ])}
      ${caixa('remover', 'Como tirar o app', ['<b>Segure o dedo</b> sobre o ícone e toque em <b>Desinstalar</b> (ou arraste até “Remover”). Os dados do lava continuam guardados no sistema.'])}`,

    pc: () => `
      <p class="mudo">No computador (Windows ou Mac), use o <b>Google Chrome</b> ou o <b>Microsoft Edge</b>. Instalado, ele abre numa janela própria, sem barra de endereço, com ícone na área de trabalho e na barra de tarefas.</p>
      <button type="button" class="btn btn-marca btn-g btn-bloco" data-instalar-agora hidden>${U.icon('loja')}<span>Instalar agora neste computador</span></button>
      ${passos([
        ['Abra o site no Chrome ou no Edge', `Na barra de endereço, digite <b>${U.esc(enderecoTxt())}</b> e aperte <b>Enter</b>.`],
        ['Clique no ícone de instalar', `Fica <b>no fim da barra de endereço</b>, à direita: é um monitor com uma setinha para baixo ${botao('instalarPc')}.`],
        ['Clique em “Instalar”', 'Abre uma janelinha com o nome do app. Clique em <b>Instalar</b>. O app abre na hora, numa janela só dele.'],
        ['Deixe fácil de achar', 'No <b>Windows</b>: clique com o botão direito no ícone do app na barra de tarefas (embaixo) → <b>Fixar na barra de tarefas</b>. No <b>Mac</b>: clique com o botão direito no ícone do Dock → <b>Opções</b> → <b>Manter no Dock</b>.'],
        ['Pronto', 'Abra sempre pelo ícone (área de trabalho, menu Iniciar ou barra de tarefas). Na primeira vez, entre com seu usuário e senha.']
      ])}
      ${caixa('', 'Não aparece o ícone na barra de endereço', [
        `<b>Chrome:</b> clique nos três pontinhos ${botao('tresPontos')} no canto de cima, à direita → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app…</b> (em versões antigas: <b>Instalar Lava Rápido…</b>).`,
        `<b>Edge:</b> clique nos três pontinhos ${botao('tresPontosH')} no canto de cima, à direita → <b>Aplicativos</b> → <b>Instalar este site como um aplicativo</b>.`,
        'No <b>Firefox</b> não dá para instalar: use o Chrome ou o Edge (já vem no Windows).',
        'Não funciona em janela anônima/InPrivate.'
      ])}
      ${caixa('remover', 'Como tirar o app', ['Abra o app, clique nos três pontinhos no alto da janela dele → <b>Desinstalar</b>. Os dados do lava continuam guardados no sistema.'])}`,

    mac: () => `
      <p class="mudo">No Mac com o <b>Safari</b> (macOS Sonoma ou mais novo), o app vai para o Dock. Com o Chrome no Mac, use a aba <b>Computador</b>.</p>
      ${passos([
        ['Abra o site no Safari', `Digite <b>${U.esc(enderecoTxt())}</b> na barra de endereço e aperte <b>Enter</b>.`],
        ['Menu Arquivo', 'No alto da tela, clique em <b>Arquivo</b> (ao lado do menu Safari).'],
        ['Adicionar ao Dock', `Clique em ${botao('dock', 'Adicionar ao Dock…')} e depois em <b>Adicionar</b>.`],
        ['Pronto', 'O ícone aparece no Dock (a barra de baixo). Abra sempre por ele e, na primeira vez, entre com seu usuário e senha.']
      ])}
      ${caixa('', 'Não tem “Adicionar ao Dock”', ['Essa opção existe só no macOS Sonoma (14) ou mais novo. Em Macs mais antigos, instale pelo <b>Google Chrome</b> (aba <b>Computador</b>).'])}
      ${caixa('remover', 'Como tirar o app', ['Clique com o botão direito no ícone do Dock → <b>Opções</b> → <b>Remover do Dock</b>. Para apagar de vez, apague o app na pasta <b>Aplicativos</b> do seu usuário.'])}`
  };

  // conteúdo completo (tela e janela da entrada usam o mesmo)
  let escolhida = null;   // aba que a pessoa tocou (vale até sair do app)
  I.html = (aba) => {
    aba = aba || escolhida || abaDoAparelho();
    const inst = I.instalado();
    return `${inst ? `<p class="aviso-caixa bom">${U.icon('check')}<span><b>Já está instalado neste aparelho.</b> Para instalar em outro aparelho, abra este endereço nele e siga o passo a passo.</span></p>` : ''}
      ${!inst && dentroDeApp() ? `<p class="aviso-caixa toque">${U.icon('alerta')}<span><b>Você abriu o link de dentro de outro aplicativo</b> (WhatsApp, Instagram…). Assim não dá para instalar: toque nos três pontinhos e escolha <b>Abrir no navegador</b> (Safari no iPhone, Chrome no Android).</span></p>` : ''}
      <p class="mudo">Instalado, o sistema abre <b>como um aplicativo</b>, pelo ícone, sem digitar endereço, e entra direto no seu lava. Não ocupa quase nada de espaço e se atualiza sozinho.</p>
      <div class="ins-end"><span>Endereço</span><b>${U.esc(enderecoTxt())}</b><button type="button" class="btn btn-p" data-copiar-end>${U.icon('lista')}<span>Copiar</span></button></div>
      <div class="opcoes ins-abas" role="tablist">${ABAS.map(([id, t]) => `<button type="button" role="tab" data-ins="${id}" class="${id === aba ? 'ativo' : ''}">${t}${id === abaDoAparelho() ? ' <small>(este)</small>' : ''}</button>`).join('')}</div>
      <div class="ins-corpo" data-ins-corpo>${CONTEUDO[aba]()}</div>`;
  };
  I.ligar = (el) => {
    const mostrarBotao = () => el.querySelectorAll('[data-instalar-agora]').forEach((b) => { b.hidden = !pedido; });
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-ins]');
      if (t) { escolhida = t.dataset.ins; el.querySelectorAll('[data-ins]').forEach((x) => x.classList.toggle('ativo', x === t)); el.querySelector('[data-ins-corpo]').innerHTML = CONTEUDO[t.dataset.ins](); mostrarBotao(); return; }
      if (e.target.closest('[data-instalar-agora]') && pedido) {
        const p = pedido; p.prompt();
        try { const r = await p.userChoice; if (r && r.outcome === 'accepted') { pedido = null; mostrarBotao(); } } catch (x) {}
        return;
      }
      if (e.target.closest('[data-copiar-end]')) { try { await navigator.clipboard.writeText(endereco()); U.toast('Endereço copiado'); } catch (x) { U.toast(endereco()); } }
    });
    mostrarBotao();
  };
  // janela (usada na tela de entrada, antes do login)
  I.janela = () => U.modal({ titulo: 'Instalar o app', largo: true, html: I.html(), aoAbrir: (el) => I.ligar(el) });

  Telas.instalar = {
    titulo: 'Instalar o app',
    perfis: ['funcionario', 'dono', 'admin'], parado: true,   // não redesenha sozinha (a aba escolhida continua)
    aoVoltar: () => { location.hash = App.user.perfil === 'dono' ? '#/mais' : App.user.perfil === 'admin' ? '#/admin' : '#/balcao'; },
    render: (el) => {
      if (I.instalado()) Store.pref('instalado', true);
      el.innerHTML = `<section class="cartao">${I.html()}</section>`;
      I.ligar(el);
    }
  };
})();
