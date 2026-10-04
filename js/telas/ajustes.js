/* =========================================================
   Ajustes (só o dono): a cara do lava-rápido, serviços e
   preços, fidelidade, mensagens do WhatsApp, equipe e opções.
   ========================================================= */
(function () {
  const DEMO = Store.modo === 'demo';
  const SECOES = [
    ['marca', 'loja', 'Meu lava-rápido', 'Nome, logo, cor, telefone e link do Google'],
    ['servicos', 'gota', 'Serviços e preços', 'O que você oferece e quanto custa por tamanho'],
    ['fidelidade', 'presente', 'Fidelidade', 'Quantas lavagens dão desconto'],
    ['mensagens', 'zap', 'Mensagens do WhatsApp', 'O texto que o cliente recebe'],
    ['equipe', 'pessoas', 'Equipe e acessos', 'Quem pode entrar no sistema e quem lava'],
    ['opcoes', 'ajustes', 'Opções', 'Formas de pagamento e etapas'],
    ['conta', 'chave', 'Minha senha', 'Trocar a senha deste acesso']
  ];
  const CORES = ['#0b63ce', '#0f8a5f', '#d32f2f', '#f07b1f', '#7b3fc4', '#0e7c86', '#c2185b', '#1b1d21', '#e0a800', '#3949ab'];
  const salvo = () => { U.toast('Salvo'); App.render(); };
  const pe = (txt) => `<div class="pe-fixo"><button class="btn btn-marca btn-g btn-bloco" type="submit">${txt || 'Salvar'}</button></div>`;

  // ---------------- meu lava-rápido ----------------
  function marca(el) {
    const l = DB.lava(), m = DB.marca();
    let logo = m.logo, cor = m.cor, topo = m.topo || 'claro';
    el.innerHTML = `<form id="f" class="form">
      <label class="campo"><span>Nome do lava-rápido</span><input name="nome" value="${U.esc(l.nome)}" required></label>
      <div class="campo"><span>Logo</span>
        <div class="logo-escolha"><div id="logoVer">${App.logoHtml({ logo }, l.nome, 'grande')}</div>
          <div><label class="btn">${U.icon('camera')}<span>Escolher imagem</span><input type="file" id="logoArq" accept="image/*" hidden></label>
          ${logo ? '<button type="button" class="link" id="logoTirar">Tirar a logo</button>' : ''}<p class="mudo pequeno">Aparece na entrada, no topo e na página que o cliente acompanha.</p></div></div>
      </div>
      <div class="campo"><span>Cor do aplicativo</span>
        <div class="cores-marca" id="cores">${CORES.map((c) => `<button type="button" data-cor="${c}" style="background:${c}" class="${c === cor ? 'sel' : ''}" aria-label="Cor ${c}"></button>`).join('')}
          <label class="cor-livre" title="Outra cor"><input type="color" id="corLivre" value="${U.esc(cor)}">${U.icon('editar')}</label></div>
      </div>
      <div class="campo"><span>Barra do alto</span>
        <div class="seg seg-g" id="topoSel">${[['claro', 'Clara'], ['escuro', 'Preta'], ['marca', 'Na cor']].map(([id, t]) => `<button type="button" data-topo="${id}" class="${topo === id ? 'ativo' : ''}">${t}</button>`).join('')}</div>
        <small class="mudo">Preta combina com logos escuras (ex.: verde e preto).</small></div>
      <label class="campo"><span>WhatsApp do lava-rápido (com DDD)</span><input name="telefone" inputmode="tel" value="${U.esc(U.telFmt(m.telefone))}" placeholder="(11) 99999-9999"></label>
      <label class="campo"><span>Endereço</span><input name="endereco" value="${U.esc(m.endereco)}" placeholder="Rua, número, bairro"></label>
      <label class="campo"><span>Link de avaliação do Google</span><input name="google" value="${U.esc(m.google)}" placeholder="https://g.page/r/…/review" inputmode="url" autocapitalize="none"></label>
      <details class="como"><summary>Como achar esse link?</summary><p>No celular, abra o <b>Google Maps</b>, procure o seu lava-rápido e toque no nome. Em <b>Avaliações</b>, toque em <b>“Receber mais avaliações”</b> (ou “Pedir avaliações”) e copie o link. Cole aqui. Sem esse link o sistema não pede avaliação aos clientes novos.</p></details>
      <label class="campo"><span>Instagram (opcional)</span><input name="instagram" value="${U.esc(m.instagram)}" placeholder="@seulavarapido" autocapitalize="none"></label>
      ${pe()}
    </form>`;
    const pintarLogo = () => { el.querySelector('#logoVer').innerHTML = App.logoHtml({ logo }, l.nome, 'grande'); };
    el.querySelector('#logoArq').onchange = async (e) => { const a = e.target.files[0]; if (!a) return; try { logo = await U.imagemPequena(a); pintarLogo(); } catch (x) { U.toast(x.message, 'bad'); } };
    const tirar = el.querySelector('#logoTirar'); if (tirar) tirar.onclick = () => { logo = ''; pintarLogo(); };
    const escolherCor = (c) => { cor = c; el.querySelectorAll('#cores [data-cor]').forEach((b) => b.classList.toggle('sel', b.dataset.cor === c)); App.aplicarMarca({ ...m, cor, topo }, l.nome); };
    el.querySelector('#topoSel').onclick = (e) => { const b = e.target.closest('[data-topo]'); if (!b) return; topo = b.dataset.topo; el.querySelectorAll('#topoSel button').forEach((x) => x.classList.toggle('ativo', x === b)); App.aplicarMarca({ ...m, cor, topo }, l.nome); };
    el.querySelector('#cores').onclick = (e) => { const b = e.target.closest('[data-cor]'); if (b) escolherCor(b.dataset.cor); };
    el.querySelector('#corLivre').oninput = (e) => escolherCor(e.target.value);
    const tel = el.querySelector('[name=telefone]'); tel.oninput = () => { tel.value = U.telFmt(tel.value); };
    el.querySelector('#f').onsubmit = (e) => {
      e.preventDefault();
      const f = U.campos(e.target);
      if (f.telefone && !U.telOk(f.telefone)) return U.toast('Confira o telefone: DDD + número.', 'bad');
      if (f.google && !/^https?:\/\//i.test(f.google)) f.google = 'https://' + f.google;
      DB.salvarLava({ nome: f.nome, marca: { ...(l.marca || {}), logo, cor, topo, telefone: U.telDig(f.telefone), endereco: f.endereco, google: f.google, instagram: f.instagram } });
      salvo();
    };
    App.aoSairDaTela = () => App.aplicarMarca();
  }

  // ---------------- serviços e preços ----------------
  const formServico = (s) => U.modal({
    titulo: s ? 'Serviço' : 'Novo serviço',
    html: `<label class="campo"><span>Nome do serviço</span><input name="nome" value="${U.esc(s ? s.nome : '')}" placeholder="Ex.: Lavagem completa" autocapitalize="sentences"></label>
      <p class="rotulo">Preço por tamanho do veículo (R$)</p>
      <div class="precos">${CAT.PORTES.map((p) => `<label class="campo"><span>${p.nome}</span><input name="p_${p.id}" inputmode="decimal" value="${s && s.precos[p.id] ? String(s.precos[p.id]).replace('.', ',') : ''}" placeholder="0"></label>`).join('')}</div>
      <p class="mudo pequeno">Deixe em branco o tamanho que você não atende (aparece “a combinar”).</p>
      <label class="campo"><span>Tempo médio (minutos)</span><input name="minutos" inputmode="numeric" value="${s ? s.minutos : 30}"></label>
      ${s ? `<label class="chave"><input type="checkbox" name="ativo" ${s.ativo !== false ? 'checked' : ''}><span>Oferecer este serviço</span></label>` : ''}`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => {
      const f = U.campos(el);
      if (!f.nome) { U.toast('Escreva o nome do serviço.', 'bad'); return false; }
      const precos = {}; CAT.PORTES.forEach((p) => { precos[p.id] = U.num(f['p_' + p.id]); });
      DB.salvarServico(s, { nome: f.nome, precos, minutos: Math.max(5, Math.round(U.num(f.minutos)) || 30), ativo: s ? f.ativo : true });
      return true;
    } }]
  });
  function servicos(el) {
    const lista = Store.s.servicos.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    el.innerHTML = `<p class="mudo">Toque em um serviço para mudar o nome, os preços ou o tempo. O preço certo aparece sozinho para o funcionário conforme o tamanho do carro.</p>
      <div class="lista">${lista.map((s, i) => `<div class="linha${s.ativo === false ? ' apagado' : ''}">
        <button type="button" class="linha-txt" data-s="${s.id}"><b>${U.esc(s.nome)}${s.ativo === false ? ' (desligado)' : ''}</b>
          <small>${CAT.PORTES.map((p) => `${p.nome} ${s.precos[p.id] ? U.brl0(s.precos[p.id]) : '–'}`).join(' · ')} · ${U.duracao(s.minutos)}</small></button>
        <button type="button" class="ic-btn" data-sobe="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir na lista">${U.icon('voltar', 'gira90')}</button>
      </div>`).join('')}</div>
      <button class="btn btn-marca btn-g btn-bloco" id="sNovo">${U.icon('mais')}<span>Novo serviço</span></button>
      ${(DB.lava().config || {}).precosConferidos ? '' : '<button class="btn btn-bloco" id="sOk">Os preços estão certos</button>'}`;
    const conferido = () => { if (!(DB.lava().config || {}).precosConferidos) DB.salvarConfig({ precosConferidos: true }); };
    el.onclick = async (e) => {
      let b;
      if ((b = e.target.closest('[data-s]'))) { if (await formServico(Store.por('servicos', b.dataset.s))) { conferido(); salvo(); } }
      else if ((b = e.target.closest('[data-sobe]')) && !b.disabled) {
        const i = lista.findIndex((s) => s.id === b.dataset.sobe), a = lista[i], c = lista[i - 1];
        [lista[i - 1], lista[i]] = [a, c];
        lista.forEach((s, n) => { if (s.ordem !== n + 1) DB.salvarServico(s, { ordem: n + 1 }); });
        App.render();
      } else if (e.target.closest('#sNovo')) { if (await formServico(null)) { conferido(); salvo(); } }
      else if (e.target.closest('#sOk')) { conferido(); salvo(); }
    };
  }

  // ---------------- fidelidade ----------------
  function fidelidade(el) {
    const f = DB.cfg().fidelidade, n1 = f.niveis[0] || { pontos: 10, desconto: 10 }, n2 = f.niveis[1];
    el.innerHTML = `<form id="f" class="form">
      <label class="chave"><input type="checkbox" name="ativo" ${f.ativo ? 'checked' : ''}><span>Usar o programa de fidelidade</span></label>
      <p class="mudo">Cada lavagem vale 1 ponto. Quando o cliente junta os pontos, o aplicativo avisa o funcionário na hora da chegada, e o cliente escolhe: usar o desconto ou guardar para o prêmio maior.</p>
      <section class="cartao"><div class="cartao-cab"><h3>Prêmio 1</h3></div>
        <div class="lado"><label class="campo"><span>A cada quantas lavagens</span><input name="p1" inputmode="numeric" value="${n1.pontos}"></label>
        <label class="campo"><span>Desconto (%)</span><input name="d1" inputmode="numeric" value="${n1.desconto}"></label></div></section>
      <section class="cartao"><div class="cartao-cab"><h3>Prêmio 2 <span class="mudo">(para quem guardar)</span></h3></div>
        <div class="lado"><label class="campo"><span>Lavagens</span><input name="p2" inputmode="numeric" value="${n2 ? n2.pontos : ''}" placeholder="não usar"></label>
        <label class="campo"><span>Desconto (%)</span><input name="d2" inputmode="numeric" value="${n2 ? n2.desconto : ''}" placeholder="–"></label></div>
        <p class="mudo pequeno">Deixe em branco para ter um prêmio só. Com 100% a lavagem sai de graça.</p></section>
      ${pe()}
    </form>`;
    el.querySelector('#f').onsubmit = (e) => {
      e.preventDefault();
      const x = U.campos(e.target), int = (v) => Math.round(U.num(v));
      const niveis = [{ pontos: int(x.p1), desconto: Math.min(100, int(x.d1)) }];
      if (niveis[0].pontos < 2 || niveis[0].desconto < 1) return U.toast('No prêmio 1, informe as lavagens (2 ou mais) e o desconto.', 'bad');
      if (x.p2 || x.d2) {
        const n = { pontos: int(x.p2), desconto: Math.min(100, int(x.d2)) };
        if (n.pontos <= niveis[0].pontos || n.desconto <= niveis[0].desconto) return U.toast('O prêmio 2 precisa de mais lavagens e de um desconto maior que o prêmio 1.', 'bad');
        niveis.push(n);
      }
      DB.salvarConfig({ fidelidade: { ativo: x.ativo, niveis } });
      salvo();
    };
  }

  // ---------------- mensagens ----------------
  const MSGS = [
    ['entrada', 'Quando o carro chega', '{nome} {carro} {placa} {previsao} {link} {lava}'],
    ['pronto', 'Quando o carro fica pronto', '{nome} {carro} {placa} {valor} {lava}'],
    ['avaliacao', 'Pedido de avaliação (cliente novo)', '{nome} {google} {lava}'],
    ['sumido', 'Para chamar de volta o cliente sumido', '{nome} {carro} {lava}'],
    ['lembrete', 'Lembrete de horário marcado (agenda)', '{nome} {quando} {carro} {lava}']
  ];
  function mensagens(el) {
    const m = DB.cfg().msg;
    el.innerHTML = `<form id="f" class="form">
      <p class="mudo">O WhatsApp abre com o texto pronto e o funcionário só toca em enviar. As palavras entre chaves são trocadas sozinhas (ex.: <b>{nome}</b> vira o primeiro nome do cliente).</p>
      ${MSGS.map(([id, titulo, vars]) => `<label class="campo"><span>${titulo}</span><textarea name="${id}" rows="4">${U.esc(m[id])}</textarea><small class="mudo">Pode usar: ${vars}</small></label>
        <button type="button" class="link" data-padrao="${id}">Voltar ao texto original</button>`).join('')}
      ${pe()}
    </form>`;
    el.onclick = (e) => { const b = e.target.closest('[data-padrao]'); if (b) el.querySelector(`[name=${b.dataset.padrao}]`).value = DB.PADRAO.msg[b.dataset.padrao]; };
    el.querySelector('#f').onsubmit = (e) => {
      e.preventDefault();
      const f = U.campos(e.target), msg = {};
      MSGS.forEach(([id]) => { if (f[id] && f[id] !== DB.PADRAO.msg[id]) msg[id] = f[id]; });
      DB.salvarConfig({ msg });
      salvo();
    };
  }

  // ---------------- equipe e acessos ----------------
  const PERFIL = { dono: 'Dono (vê tudo)', funcionario: 'Funcionário (só o balcão)' };
  const formAcesso = (p) => U.modal({
    titulo: p ? p.nome : 'Novo acesso',
    html: `<label class="campo"><span>Nome da pessoa</span><input name="nome" value="${U.esc(p ? p.nome : '')}" autocapitalize="words"></label>
      ${p ? `<p class="mudo">Usuário: <b>${U.esc(p.login)}</b></p>` : `<label class="campo"><span>Usuário (para entrar)</span><input name="login" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: ${U.esc((DB.lava().slug || 'lava').replace(/-/g, ''))}.equipe"></label>
      <label class="campo"><span>Senha (6 ou mais)</span><input name="senha" type="text" autocapitalize="none" autocomplete="off"></label>`}
      <label class="campo"><span>O que pode fazer</span><select name="perfil">${Object.entries(PERFIL).map(([id, t]) => `<option value="${id}"${(p ? p.perfil : 'funcionario') === id ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${p ? `<label class="chave"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}><span>Acesso liberado</span></label>
        <label class="campo"><span>Nova senha (deixe em branco para não trocar)</span><input name="senha" type="text" autocapitalize="none" autocomplete="off"></label>` : ''}
      <p class="mudo pequeno">Dica: um acesso de funcionário pode ficar aberto no celular do lava-rápido, e todos usam o mesmo.</p>`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: async (el) => {
      const f = U.campos(el);
      if (f.nome.length < 2) { U.toast('Escreva o nome.', 'bad'); return false; }
      if (DEMO) { U.toast('Na demonstração os acessos não são criados de verdade.'); return true; }
      if (p) {
        await Nuvem.editarAcesso(p.user_id, { nome: f.nome, perfil: f.perfil, ativo: f.ativo });
        if (f.senha) await Nuvem.trocarSenha(p.user_id, f.senha);
      } else await Nuvem.criarAcesso(f);
      await Nuvem.puxar();
      return true;
    } }]
  });
  function equipe(el) {
    const lavadores = DB.cfg().lavadores || [];
    el.innerHTML = `<section class="cartao"><div class="cartao-cab"><h3>Quem entra no sistema</h3></div>
        <div class="lista">${Store.s.equipe.map((p) => `<button type="button" class="linha${p.ativo ? '' : ' apagado'}" data-u="${p.user_id}">
          <span class="linha-txt"><b>${U.esc(p.nome)}${p.user_id === App.user.id ? ' (você)' : ''}</b><small>usuário: ${U.esc(p.login)} · ${p.perfil === 'dono' ? 'Dono' : 'Funcionário'}${p.ativo ? '' : ' · bloqueado'}</small></span>${U.icon('editar')}</button>`).join('')}</div>
        <button class="btn btn-marca btn-bloco" id="eNovo">${U.icon('mais')}<span>Novo acesso</span></button></section>
      <section class="cartao"><div class="cartao-cab"><h3>Quem lava os carros</h3></div>
        <p class="mudo">Opcional. Se você cadastrar os nomes, o aplicativo pergunta “quem vai lavar?” e o painel mostra quantos carros cada um lavou.</p>
        <div class="chips">${lavadores.map((n) => `<span class="chip fixo">${U.esc(n)}<button type="button" data-tirar="${U.esc(n)}" aria-label="Tirar ${U.esc(n)}">${U.icon('x')}</button></span>`).join('') || '<span class="mudo">Ninguém cadastrado.</span>'}</div>
        <form id="eLav" class="lado"><label class="campo"><input name="nome" placeholder="Nome de quem lava" autocapitalize="words"></label><button class="btn" type="submit">Adicionar</button></form></section>`;
    el.onclick = async (e) => {
      let b;
      if ((b = e.target.closest('[data-u]'))) { if (await formAcesso(Store.s.equipe.find((p) => p.user_id === b.dataset.u))) salvo(); }
      else if (e.target.closest('#eNovo')) { if (await formAcesso(null)) salvo(); }
      else if ((b = e.target.closest('[data-tirar]'))) { DB.salvarConfig({ lavadores: lavadores.filter((n) => n !== b.dataset.tirar) }); App.render(); }
    };
    el.querySelector('#eLav').onsubmit = (e) => {
      e.preventDefault();
      const n = U.capitalizar(U.campos(e.target).nome);
      if (!n) return;
      if (!lavadores.includes(n)) DB.salvarConfig({ lavadores: [...lavadores, n] });
      App.render();
    };
  }

  // ---------------- opções ----------------
  function opcoes(el) {
    const c = DB.cfg();
    el.innerHTML = `<form id="f" class="form">
      <label class="campo"><span>Formas de pagamento (separe por vírgula)</span><input name="pagamentos" value="${U.esc(c.pagamentos.join(', '))}"></label>
      <label class="chave"><input type="checkbox" name="usarLavando" ${c.usarLavando ? 'checked' : ''}><span>Usar a etapa “Lavando”<small>Desligado, o carro vai direto de “na fila” para “pronto”.</small></span></label>
      <label class="chave"><input type="checkbox" name="funcionarioMudaValor" ${c.funcionarioMudaValor ? 'checked' : ''}><span>Funcionário pode ajustar o valor<small>Desligado, vale sempre o preço da tabela.</small></span></label>
      <label class="campo"><span>Cliente “sumido” depois de quantos dias sem vir</span><input name="sumidoDias" inputmode="numeric" value="${c.sumidoDias}"></label>
      ${pe()}
    </form>
    ${DEMO ? '<button class="btn btn-bloco" id="oDemo">Recomeçar a demonstração</button>' : ''}`;
    el.querySelector('#f').onsubmit = (e) => {
      e.preventDefault();
      const f = U.campos(e.target), pags = f.pagamentos.split(',').map((x) => x.trim()).filter(Boolean);
      if (!pags.length) return U.toast('Informe pelo menos uma forma de pagamento.', 'bad');
      DB.salvarConfig({ pagamentos: pags, usarLavando: f.usarLavando, funcionarioMudaValor: f.funcionarioMudaValor, sumidoDias: Math.max(7, Math.round(U.num(f.sumidoDias)) || 45) });
      salvo();
    };
    const d = el.querySelector('#oDemo'); if (d) d.onclick = async () => { if (await U.confirmar('Recomeçar a demonstração?', 'Volta tudo para os dados de exemplo.', 'Recomeçar')) { Demo.recomecar(); App.aplicarMarca(); salvo(); } };
  }

  // ---------------- minha senha ----------------
  function conta(el) {
    el.innerHTML = `<form id="f" class="form">
      <p class="mudo">Usuário: <b>${U.esc(App.user.login)}</b></p>
      <label class="campo"><span>Nova senha (6 ou mais)</span><input name="senha" type="password" autocomplete="new-password" minlength="6" required></label>
      <label class="campo"><span>Repita a nova senha</span><input name="senha2" type="password" autocomplete="new-password" minlength="6" required></label>
      ${pe('Trocar a senha')}
    </form>`;
    el.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const f = U.campos(e.target);
      if (f.senha !== f.senha2) return U.toast('As duas senhas estão diferentes.', 'bad');
      if (DEMO) return U.toast('Na demonstração a senha não muda.');
      try { await Nuvem.trocarSenha(App.user.id, f.senha); U.toast('Senha trocada'); App.ir(App.user.perfil === 'admin' ? 'admin' : 'ajustes'); } catch (x) { U.toast(x.message || String(x), 'bad'); }
    };
  }

  const TELAS = { marca, servicos, fidelidade, mensagens, equipe, opcoes, conta };
  Telas.ajustes = {
    titulo: (args) => (SECOES.find((s) => s[0] === args[0]) || [0, 0, 'Ajustes'])[2],
    perfis: ['dono', 'admin'], parado: true,
    aoVoltar: () => { location.hash = App.user.perfil === 'admin' ? '#/admin' : App.args[0] ? '#/ajustes' : '#/mais'; },
    render: (el, args) => {
      const admin = App.user.perfil === 'admin';
      if (admin) return conta(el);
      if (TELAS[args[0]]) {
        if (DB.bloqueado() && args[0] !== 'conta') { el.innerHTML = `<div class="vazio">${U.icon('alerta')}<p>Assinatura suspensa</p><p class="mudo">Os ajustes voltam quando a assinatura for regularizada.</p></div>`; return; }
        return TELAS[args[0]](el);
      }
      el.innerHTML = `<div class="lista-menu solta">${SECOES.map(([id, ic, t, sub]) => `<a href="#/ajustes/${id}">${U.icon(ic)}<span>${t}<small>${sub}</small></span>${U.icon('seta', 'fim')}</a>`).join('')}</div>
        ${App.temaHtml()}
        <p class="mudo centro pequeno">Endereço do seu sistema: <b>${U.esc(location.origin + location.pathname)}${DEMO ? '' : '?l=' + U.esc(DB.lava().slug)}</b></p>`;
      App.ligarTema(el);
    }
  };
})();
