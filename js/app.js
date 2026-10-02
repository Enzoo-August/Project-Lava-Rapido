/* =========================================================
   App — abertura, login, menu e troca de telas.
   Cada tela fica em js/telas/ e se registra em  Telas.nome = {
     titulo, perfis: ['dono','funcionario'], voltar: '#/…', render(el, args) }
   ========================================================= */
(function () {
  const App = { user: null, rota: null, args: [] };
  window.App = App;
  window.Telas = window.Telas || {};

  const $ = (id) => document.getElementById(id);
  const DEMO = Store.modo === 'demo';
  const params = new URLSearchParams(location.search);
  const semDemo = () => location.pathname + (params.get('l') ? '?l=' + encodeURIComponent(params.get('l')) : '');

  // ---------------- marca (nome, logo e cor de cada lava-rápido) ----------------
  App.aplicarMarca = (m, nome) => {
    m = m || (Store.s && Store.s.lava.id ? DB.marca() : null) || lerMarca() || {};
    nome = nome || (Store.s && Store.s.lava.id ? DB.lava().nome : (lerMarca() || {}).nome) || 'Lava Rápido';
    const cor = U.hexRgb(m.cor) ? m.cor : '#0b63ce';
    const st = document.documentElement.style;
    st.setProperty('--marca', cor);
    st.setProperty('--marca-txt', U.textoSobre(cor));
    st.setProperty('--marca-forte', U.misturar(cor, '#000000', 0.18));
    st.setProperty('--marca-clara', U.misturar(cor, '#ffffff', 0.9));
    // cor da marca para textos e traços sobre fundo claro (escurece cores muito claras, como amarelo)
    st.setProperty('--marca-tinta', U.luminancia(cor) > 0.28 ? U.misturar(cor, '#000000', 0.45) : cor);
    // topo do aplicativo: claro (padrão), escuro ou na cor da marca
    const topo = m.topo === 'escuro' ? '#10151c' : m.topo === 'marca' ? cor : '';
    const topoTx = topo ? U.textoSobre(topo) : '#10151c';
    st.setProperty('--topo-bg', topo || '#ffffff');
    st.setProperty('--topo-tx', topoTx);
    st.setProperty('--topo-tx2', !topo ? '#5f6975' : topoTx === '#ffffff' ? 'rgba(255,255,255,.72)' : 'rgba(16,21,28,.68)');
    st.setProperty('--topo-linha', topo ? 'transparent' : '#dde2e8');
    // botão "Chegou carro": com topo escuro fica preto com o círculo na cor da marca
    st.setProperty('--chegou-bg', m.topo === 'escuro' ? '#10151c' : cor);
    st.setProperty('--chegou-tx', m.topo === 'escuro' ? '#ffffff' : U.textoSobre(cor));
    st.setProperty('--chegou-ic', m.topo === 'escuro' ? cor : 'rgba(255,255,255,.22)');
    st.setProperty('--chegou-ic-tx', m.topo === 'escuro' ? U.textoSobre(cor) : 'currentColor');
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = topo || cor;
    document.title = nome;
    const at = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (at) at.content = nome;
    if (Store.s && Store.s.lava.id && !DEMO) { try { localStorage.setItem('lr.marca', JSON.stringify({ ...m, nome, slug: Store.s.lava.slug })); } catch (e) {} }
  };
  const lerMarca = () => { try { return JSON.parse(localStorage.getItem('lr.marca') || 'null'); } catch (e) { return null; } };
  App.logoHtml = (m, nome, cls) => (m && m.logo
    ? `<img class="logo ${cls || ''}" src="${U.esc(m.logo)}" alt="${U.esc(nome)}">`
    : `<span class="logo-letra ${cls || ''}">${U.icon('gota')}</span>`);

  // ---------------- abertura ----------------
  App.iniciar = async () => {
    App.aplicarMarca();
    try {
      if (DEMO) {
        Demo.abrir();
        const perfil = Store.pref('demo.perfil');
        if (perfil) App.user = Demo.usuario(perfil);
      } else {
        await Nuvem.iniciar();
        const u = await Nuvem.usuarioAtual();
        if (u && !u.semPerfil) { App.user = u; await Nuvem.abrir(u); }
        else if (u && u.semPerfil) await Nuvem.sair();
      }
    } catch (e) {
      App.user = null;
      $('abrindo').hidden = true;
      return telaLogin(e.message || String(e));
    }
    $('abrindo').hidden = true;
    if (App.user) mostrarApp(); else telaLogin();
  };

  // ---------------- login ----------------
  async function telaLogin(erroInicial) {
    $('app').hidden = true;
    const el = $('login'); el.hidden = false;
    let m = lerMarca() || {}, nome = m.nome || 'Lava Rápido', primeiro = false;
    if (DEMO) { m = Store.s.lava.marca; nome = Store.s.lava.nome; }
    else if (Nuvem.sb) {
      try {
        const slug = params.get('l') || m.slug;
        if (slug) { const r = await Nuvem.marca(slug); if (r) { m = { ...r.marca, slug: r.slug }; nome = r.nome; try { localStorage.setItem('lr.marca', JSON.stringify({ ...m, nome })); } catch (e) {} } }
        primeiro = !(await Nuvem.haAdmin());
      } catch (e) { erroInicial = erroInicial || 'Sem internet. Verifique o sinal e tente de novo.'; }
    }
    App.aplicarMarca(m, nome);
    const cab = `<div class="login-marca">${App.logoHtml(m, nome, 'grande')}<h1>${U.esc(nome)}</h1></div>`;

    if (DEMO) {
      el.innerHTML = `<div class="login-cartao">${cab}
        <p class="mudo centro">Demonstração com dados de exemplo.<br>Escolha como quer entrar:</p>
        <button class="btn btn-marca btn-g btn-bloco" data-perfil="funcionario">${U.icon('carro')}<span>Entrar como funcionário</span></button>
        <button class="btn btn-g btn-bloco" data-perfil="dono">${U.icon('grafico')}<span>Entrar como dono</span></button>
        ${(window.LAVA_CFG || {}).url ? `<a class="link centro" href="${semDemo()}">Já sou cliente: entrar com meu usuário</a>` : ''}
      </div>`;
      el.onclick = (e) => { const b = e.target.closest('[data-perfil]'); if (!b) return; Store.pref('demo.perfil', b.dataset.perfil); App.user = Demo.usuario(b.dataset.perfil); el.hidden = true; mostrarApp(); };
      return;
    }

    if (primeiro) {
      el.innerHTML = `<form class="login-cartao" autocomplete="off">${cab}
        <p class="aviso-caixa">${U.icon('chave')}<span><b>Primeiro acesso.</b> Crie o usuário do administrador do sistema (quem cadastra os lava-rápidos). Guarde bem essa senha.</span></p>
        <label class="campo"><span>Seu nome</span><input name="nome" required minlength="2" autocomplete="name"></label>
        <label class="campo"><span>Usuário</span><input name="login" required minlength="3" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: enzo"></label>
        <label class="campo"><span>Senha (6 ou mais)</span><input name="senha" type="password" required minlength="6" autocomplete="new-password"></label>
        <p class="erro" hidden></p>
        <button class="btn btn-marca btn-g btn-bloco" type="submit">Criar administrador</button>
      </form>`;
      el.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const f = U.campos(e.target), b = e.target.querySelector('button[type=submit]'), err = e.target.querySelector('.erro');
        b.disabled = true; err.hidden = true;
        try { await Nuvem.primeiroAdmin(f); const r = await Nuvem.entrar(f.login, f.senha); if (r.erro) throw new Error(r.erro); await entrou(r.user); }
        catch (x) { err.textContent = x.message || String(x); err.hidden = false; b.disabled = false; }
      };
      return;
    }

    el.innerHTML = `<form class="login-cartao" autocomplete="on">${cab}
      <label class="campo"><span>Usuário</span><input name="login" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label>
      <label class="campo"><span>Senha</span><input name="senha" type="password" required autocomplete="current-password"></label>
      <p class="erro" ${erroInicial ? '' : 'hidden'}>${U.esc(erroInicial || '')}</p>
      <button class="btn btn-marca btn-g btn-bloco" type="submit">Entrar</button>
      <p class="mudo centro pequeno">Este aparelho fica conectado: só precisa entrar uma vez.</p>
      <a class="link centro" href="?demo=1">Ver uma demonstração</a>
    </form>`;
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = U.campos(e.target), b = e.target.querySelector('button[type=submit]'), err = e.target.querySelector('.erro');
      b.disabled = true; err.hidden = true;
      try {
        if (!Nuvem.sb) await Nuvem.iniciar();
        const r = await Nuvem.entrar(f.login, f.senha);
        if (r.erro) throw new Error(r.erro);
        await entrou(r.user);
      } catch (x) { err.textContent = x.message || String(x); err.hidden = false; b.disabled = false; }
    };
  }
  async function entrou(user) {
    App.user = user;
    await Nuvem.abrir(user);
    $('login').hidden = true;
    mostrarApp();
  }

  App.sair = async () => {
    if (!DEMO && Nuvem.pendentes() > 0 && !(await U.confirmar('Ainda há dados para enviar', `Faltam ${Nuvem.pendentes()} alterações para enviar ao banco (sem internet). Se sair agora, elas se perdem.`, 'Sair mesmo assim', 'btn-perigo'))) return;
    if (DEMO) Store.pref('demo.perfil', null); else await Nuvem.sair();
    App.user = null;
    location.hash = '';
    location.reload();
  };

  // ---------------- menu ----------------
  const MENU = [
    { r: 'inicio', txt: 'Início', ic: 'casa', perfis: ['dono'] },
    { r: 'balcao', txt: 'Balcão', ic: 'carro', perfis: ['dono'], so: 'lateral' },
    { r: 'patio', txt: 'Pátio', ic: 'lista', perfis: ['dono'] },
    { r: 'agenda', txt: 'Agenda', ic: 'calendario', perfis: ['dono'], mais: true },
    { r: 'clientes', txt: 'Clientes', ic: 'pessoas', perfis: ['dono'], mais: true },
    { r: 'resultados', txt: 'Resultados', ic: 'grafico', perfis: ['dono'] },
    { r: 'financeiro', txt: 'Financeiro', ic: 'carteira', perfis: ['dono'], mais: true },
    { r: 'ajustes', txt: 'Ajustes', ic: 'ajustes', perfis: ['dono'], mais: true },
    { r: 'ajuda', txt: 'Ajuda', ic: 'ajuda', perfis: ['dono'], mais: true }
  ];
  App.MENU = MENU;
  const inicial = () => (App.user.perfil === 'admin' ? 'admin' : App.user.perfil === 'dono' ? 'inicio' : 'balcao');

  function mostrarApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    $('app').dataset.perfil = App.user.perfil;
    App.aplicarMarca();
    if (!location.hash || location.hash === '#/') history.replaceState(null, '', location.pathname + location.search + '#/' + inicial());
    window.onhashchange = () => App.render();
    App.render();
    if (!DEMO) Nuvem.status();
    setInterval(() => { if (!document.hidden) App.aoMudar(true); }, 60000);   // atualiza os "há 12 min" da tela
    if (window.Telas.ajuda && Telas.ajuda.boasVindas) Telas.ajuda.boasVindas();
  }

  App.ir = (rota) => { if (location.hash === '#/' + rota) App.render(); else location.hash = '#/' + rota; };
  App.voltar = () => { const t = Telas[App.rota]; location.hash = (t && t.voltar) || '#/' + inicial(); };

  App.render = () => {
    if (!App.user) return;
    const partes = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    let rota = partes[0] || inicial();
    let tela = Telas[rota];
    if (!tela || (tela.perfis && !tela.perfis.includes(App.user.perfil))) { rota = inicial(); tela = Telas[rota]; history.replaceState(null, '', location.pathname + location.search + '#/' + rota); }
    const mudou = App.rota !== rota || JSON.stringify(App.args) !== JSON.stringify(partes.slice(1));
    App.rota = rota; App.args = partes.slice(1);

    if (App.aoSairDaTela) { try { App.aoSairDaTela(); } catch (e) {} App.aoSairDaTela = null; }
    // a tela é recriada a cada troca: os toques da tela anterior morrem junto
    const velha = $('tela'), rolagem = window.scrollY, nova = document.createElement('main');
    nova.id = 'tela'; nova.className = 'tela tela-' + rota; nova.tabIndex = -1;
    velha.replaceWith(nova);
    $('app').dataset.rota = rota;
    desenharTopo(tela, rota);
    desenharMenu(rota);
    desenharFaixa();
    try { tela.render(nova, App.args); }
    catch (e) { console.error(e); nova.innerHTML = `<div class="vazio">${U.icon('alerta')}<p>Não consegui abrir esta tela.</p><p class="mudo pequeno">${U.esc(e.message || e)}</p><a class="btn" href="#/${inicial()}">Voltar ao início</a></div>`; }
    window.scrollTo(0, mudou ? 0 : rolagem);
  };

  // chamado quando chegam dados novos: redesenha só se não for atrapalhar quem está mexendo
  App.aoMudar = (soRelogio) => {
    if (!App.user || $('app').hidden) return;
    const t = Telas[App.rota];
    if (!t || t.parado || U.modalAberto()) return;
    const foco = document.activeElement;
    if (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) return;
    if (soRelogio && !t.relogio) return;
    App.render();
  };

  function desenharTopo(tela, rota) {
    const u = App.user, home = rota === inicial();
    const m = u.perfil === 'admin' ? {} : DB.marca(), nome = u.perfil === 'admin' ? 'Administração' : DB.lava().nome;
    const esquerda = home || (u.perfil === 'dono' && MENU.some((x) => x.r === rota && !x.mais))
      ? `<div class="topo-marca">${App.logoHtml(m, nome)}<div><b>${U.esc(home ? nome : tela.titulo)}</b><small>${U.esc(home ? saudacao() + ', ' + U.primeiroNome(u.nome) : nome)}</small></div></div>`
      : `<button class="ic-btn voltar" id="btVoltar" aria-label="Voltar">${U.icon('voltar')}</button><h1 class="topo-titulo">${U.esc(typeof tela.titulo === 'function' ? tela.titulo(App.args) : tela.titulo)}</h1>`;
    $('topo').innerHTML = `${esquerda}<div class="topo-acoes">
      ${DEMO ? '<span class="chip-st demo">Demonstração</span>' : '<span id="nuvemSt" class="chip-st" hidden></span>'}
      ${u.perfil !== 'dono' ? `<button class="ic-btn" id="btMenu" aria-label="Menu">${U.icon('menu')}</button>` : ''}
    </div>`;
    const bv = $('btVoltar'); if (bv) bv.onclick = () => (tela.aoVoltar ? tela.aoVoltar() : App.voltar());
    const bm = $('btMenu'); if (bm) bm.onclick = menuFuncionario;
    if (!DEMO) Nuvem.status();
  }
  const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

  function desenharMenu(rota) {
    const dono = App.user.perfil === 'dono';
    const lat = $('lateral'), rod = $('rodapeNav');
    if (!dono) { lat.innerHTML = ''; rod.innerHTML = ''; return; }
    const m = DB.marca(), nome = DB.lava().nome;
    const item = (x) => `<a href="#/${x.r}" class="${x.r === rota ? 'ativo' : ''}">${U.icon(x.ic)}<span>${x.txt}</span></a>`;
    lat.innerHTML = `<a class="lateral-marca" href="#/inicio">${App.logoHtml(m, nome)}<b>${U.esc(nome)}</b></a>
      <a class="btn btn-marca btn-bloco" href="#/entrada">${U.icon('mais')}<span>Chegou carro</span></a>
      <nav>${MENU.map(item).join('')}</nav>
      <div class="lateral-pe"><span>${U.esc(App.user.nome)}</span><button class="link" id="btSairLat">${U.icon('sair')} Sair</button></div>`;
    $('btSairLat').onclick = App.sair;
    const naMais = MENU.some((x) => x.mais && x.r === rota) || rota === 'mais' || rota === 'cliente';
    rod.innerHTML = `${item(MENU[0])}${item(MENU[2])}
      <a href="#/entrada" class="central" aria-label="Chegou carro">${U.icon('mais')}</a>
      ${item(MENU[4])}<a href="#/mais" class="${naMais ? 'ativo' : ''}">${U.icon('menu')}<span>Mais</span></a>`;
  }

  function desenharFaixa() {
    const f = $('faixa'), u = App.user;
    if (u.perfil === 'admin') { f.innerHTML = ''; return; }
    const l = DB.lava(), sup = (window.LAVA_CFG || {}).suporte;
    const falar = sup ? ` <a href="${U.zapLink(sup, 'Olá! Preciso de ajuda com o sistema do ' + l.nome)}" target="_blank" rel="noopener">Falar com o suporte</a>` : '';
    if (l.ativo === false) f.innerHTML = `<div class="faixa perigo">${U.icon('alerta')}<span><b>Assinatura suspensa.</b> Dá para consultar, mas não para registrar.${falar}</span></div>`;
    else if (u.perfil === 'dono' && l.pago_ate && U.diasDesde(U.deDia(l.pago_ate)) > -6 && U.diasDesde(U.deDia(l.pago_ate)) <= 0)
      f.innerHTML = `<div class="faixa aviso">${U.icon('relogio')}<span>Sua mensalidade vence em ${U.dataBR(l.pago_ate)}.${falar}</span></div>`;
    else if (u.perfil === 'dono' && l.pago_ate && U.diasDesde(U.deDia(l.pago_ate)) > 0)
      f.innerHTML = `<div class="faixa aviso">${U.icon('alerta')}<span>Mensalidade vencida desde ${U.dataBR(l.pago_ate)}.${falar}</span></div>`;
    else f.innerHTML = '';
  }

  function menuFuncionario() {
    const u = App.user;
    U.modal({
      titulo: u.nome,
      html: `<div class="lista-menu">
        ${u.perfil === 'funcionario' ? `<a href="#/agenda" data-fechar>${U.icon('calendario')}<span>Agenda</span></a><a href="#/clientes" data-fechar>${U.icon('pessoas')}<span>Clientes</span></a><a href="#/ajuda" data-fechar>${U.icon('ajuda')}<span>Como usar</span></a><a href="#/ajuda/instalar" data-fechar>${U.icon('celular')}<span>Instalar no celular</span></a>` : ''}
        <button type="button" id="mSair">${U.icon('sair')}<span>Sair deste aparelho</span></button>
      </div>`,
      aoAbrir: (el, fechar) => { el.querySelector('#mSair').onclick = () => { fechar(); App.sair(); }; }
    });
  }

  // tela "Mais" (celular do dono)
  Telas.mais = {
    titulo: 'Mais', perfis: ['dono'],
    render: (el) => {
      el.innerHTML = `<div class="lista-menu solta">
        ${MENU.filter((x) => x.mais).map((x) => `<a href="#/${x.r}">${U.icon(x.ic)}<span>${x.txt}</span>${U.icon('seta', 'fim')}</a>`).join('')}
        <a href="#/balcao">${U.icon('carro')}<span>Tela do funcionário (balcão)</span>${U.icon('seta', 'fim')}</a>
        <button type="button" id="maisSair">${U.icon('sair')}<span>Sair deste aparelho</span></button>
      </div><p class="mudo centro pequeno">${U.esc(App.user.nome)} · ${U.esc(DB.lava().nome)}</p>`;
      el.querySelector('#maisSair').onclick = App.sair;
    }
  };

  window.addEventListener('DOMContentLoaded', () => App.iniciar());
})();
