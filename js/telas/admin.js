/* =========================================================
   Administração — só para quem vende o sistema.
   Cadastra cada lava-rápido (com o login do dono), acompanha
   o uso e controla a assinatura (em dia / suspensa).
   ========================================================= */
(function () {
  const slugDe = (nome) => U.norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const enderecoDe = (slug) => location.origin + location.pathname + '?l=' + slug;

  const formNovo = () => U.modal({
    titulo: 'Novo lava-rápido', largo: true,
    html: `<label class="campo"><span>Nome do lava-rápido</span><input name="nome" placeholder="Ex.: Lava Rápido do João" autocapitalize="words"></label>
      <label class="campo"><span>Endereço (só letras minúsculas, números e traço)</span><input name="slug" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="lava-do-joao"></label>
      <p class="mudo pequeno" id="aEnd"></p>
      <div class="lado"><label class="campo"><span>Nome do dono</span><input name="dono" autocapitalize="words"></label>
        <label class="campo"><span>Usuário do dono</span><input name="login" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: joao"></label></div>
      <div class="lado"><label class="campo"><span>Senha inicial (6 ou mais)</span><input name="senha" type="text" autocapitalize="none" autocomplete="off"></label>
        <label class="campo"><span>Pago até (opcional)</span><input name="pago_ate" type="date"></label></div>
      <p class="mudo pequeno">O lava já nasce com os serviços de exemplo. O dono troca a senha em Ajustes → Minha senha.</p>`,
    aoAbrir: (el) => {
      const nome = el.querySelector('[name=nome]'), slug = el.querySelector('[name=slug]'), end = el.querySelector('#aEnd');
      let mexeu = false;
      const pintar = () => { end.textContent = slug.value ? 'Link que o cliente vai usar: ' + enderecoDe(slug.value) : ''; };
      nome.oninput = () => { if (!mexeu) { slug.value = slugDe(nome.value); pintar(); } };
      slug.oninput = () => { mexeu = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); pintar(); };
    },
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Criar', cls: 'btn-marca', aoTocar: async (el) => { const f = U.campos(el); await Nuvem.adminCriarLava(f); return f; } }]
  });

  // acessos (logins) de um lava: criar dono/funcionário e trocar senha
  const formAcesso = (l) => U.modal({
    titulo: 'Novo acesso · ' + l.nome,
    html: `<label class="campo"><span>Nome da pessoa</span><input name="nome" autocapitalize="words"></label>
      <div class="lado"><label class="campo"><span>Usuário</span><input name="login" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: flavio"></label>
        <label class="campo"><span>Senha inicial (6 ou mais)</span><input name="senha" type="text" autocapitalize="none" autocomplete="off"></label></div>
      <label class="campo"><span>Perfil</span><select name="perfil"><option value="dono">Dono (vê tudo)</option><option value="funcionario">Funcionário (só o balcão)</option></select></label>`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Criar', cls: 'btn-marca', aoTocar: async (el) => { const f = U.campos(el); await Nuvem.adminCriarAcesso(l.id, f); return f; } }]
  });
  const formSenha = (p) => U.modal({
    titulo: 'Nova senha · ' + p.nome,
    html: `<p class="mudo">Usuário: <b>${U.esc(p.login)}</b></p><label class="campo"><span>Nova senha (6 ou mais)</span><input name="senha" type="text" autocapitalize="none" autocomplete="off"></label>`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Trocar', cls: 'btn-marca', aoTocar: async (el) => { await Nuvem.trocarSenha(p.user_id, U.campos(el).senha); return true; } }]
  });
  const pintarAcessos = async (el, l) => {
    const caixa = el.querySelector('#aAcessos');
    try {
      const lista = await Nuvem.adminAcessos(l.id);
      caixa.innerHTML = lista.map((p) => `<div class="linha${p.ativo ? '' : ' apagado'}"><span class="linha-txt"><b>${U.esc(p.nome)}</b><small>usuário: ${U.esc(p.login)} · ${p.perfil === 'dono' ? 'Dono' : 'Funcionário'}${p.ativo ? '' : ' · bloqueado'}</small></span>
        <button type="button" class="btn btn-p" data-senha="${p.user_id}">${U.icon('chave')}<span>Senha</span></button></div>`).join('') || '<p class="mudo">Nenhum acesso ainda. Crie o do dono.</p>';
      caixa.onclick = async (e) => { const b = e.target.closest('[data-senha]'); if (!b) return; if (await formSenha(lista.find((p) => p.user_id === b.dataset.senha))) U.toast('Senha trocada'); };
    } catch (e) { caixa.innerHTML = `<p class="erro">${U.esc(e.message || e)}</p>`; }
  };

  const formEditar = (l) => U.modal({
    titulo: l.nome, largo: true,
    html: `<label class="campo"><span>Nome</span><input name="nome" value="${U.esc(l.nome)}"></label>
      <div class="lado"><label class="campo"><span>Plano</span><select name="plano">${['mensal', 'anual', 'vitalicio', 'teste'].map((p) => `<option${p === l.plano ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="campo"><span>Pago até</span><input name="pago_ate" type="date" value="${l.pago_ate || ''}"></label></div>
      <label class="chave"><input type="checkbox" name="ativo" ${l.ativo ? 'checked' : ''}><span>Assinatura ativa<small>Desligado, o lava só consulta: não registra carros até regularizar.</small></span></label>
      <p class="mudo pequeno">Link: ${U.esc(enderecoDe(l.slug))}</p>
      <button type="button" class="btn btn-bloco" id="aCopiar">${U.icon('lista')}<span>Copiar o link</span></button>
      <p class="rotulo">Acessos deste lava-rápido</p>
      <div class="lista" id="aAcessos"><p class="mudo">Carregando…</p></div>
      <button type="button" class="btn btn-bloco" id="aNovoAcesso">${U.icon('mais')}<span>Novo acesso (dono ou funcionário)</span></button>`,
    aoAbrir: (el) => {
      pintarAcessos(el, l);
      el.querySelector('#aNovoAcesso').onclick = async () => { const f = await formAcesso(l); if (f) { U.toast(`Acesso criado: ${f.login.toLowerCase()}`); pintarAcessos(el, l); } };
      el.querySelector('#aCopiar').onclick = async () => { try { await navigator.clipboard.writeText(enderecoDe(l.slug)); U.toast('Link copiado'); } catch (e) { U.toast(enderecoDe(l.slug)); } };
    },
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: async (el) => { await Nuvem.adminEditarLava(l.id, U.campos(el)); return true; } }]
  });

  Telas.admin = {
    titulo: 'Administração', perfis: ['admin'], parado: true,
    render: async (el) => {
      el.innerHTML = `<div class="vazio"><div class="gira"></div><p class="mudo">Carregando…</p></div>`;
      let lavas;
      try { lavas = await Nuvem.adminLavas(); } catch (e) { el.innerHTML = `<div class="vazio">${U.icon('alerta')}<p>Não consegui carregar</p><p class="mudo">${U.esc(e.message || e)}</p></div>`; return; }
      const ativos = lavas.filter((l) => l.ativo).length;
      el.innerHTML = `
        <div class="kpis tres">
          <div class="kpi"><span>Lava-rápidos</span><b>${lavas.length}</b><small class="delta">${ativos} ativo${ativos === 1 ? '' : 's'}</small></div>
          <div class="kpi"><span>Carros (30 dias)</span><b>${lavas.reduce((t, l) => t + Number(l.carros_30d), 0)}</b><small class="delta">em todos os lavas</small></div>
          <div class="kpi"><span>Clientes cadastrados</span><b>${lavas.reduce((t, l) => t + Number(l.clientes), 0)}</b><small class="delta">em todos os lavas</small></div>
        </div>
        <button class="btn btn-marca btn-g btn-bloco" id="aNovo">${U.icon('mais')}<span>Novo lava-rápido</span></button>
        <div class="lista">${lavas.map((l) => {
          const venc = l.pago_ate ? U.diasDesde(U.deDia(l.pago_ate)) : null;
          const sit = !l.ativo ? '<span class="tag cancelado">suspenso</span>' : venc != null && venc > 0 ? '<span class="tag aguardando">vencido</span>' : '<span class="tag pronto">em dia</span>';
          return `<button type="button" class="linha" data-l="${l.id}">
            <span class="linha-txt"><b>${U.esc(l.nome)}</b>
              <small>${U.esc(l.dono || 'sem dono')} · ${l.carros_30d} carros em 30 dias · ${l.clientes} clientes${l.ultimo_movimento ? ' · último ' + U.haQuanto(l.ultimo_movimento) : ' · nunca usou'}</small>
              <small>${U.esc(l.plano)}${l.pago_ate ? ' · pago até ' + U.dataBR(l.pago_ate) : ''} · ?l=${U.esc(l.slug)}</small></span>
            ${sit}</button>`;
        }).join('') || '<p class="mudo centro">Nenhum lava-rápido cadastrado ainda.</p>'}</div>
        <a class="link centro" href="#/ajustes/conta">Trocar a minha senha</a>`;
      el.onclick = async (e) => {
        const b = e.target.closest('[data-l]');
        if (e.target.closest('#aNovo')) {
          const f = await formNovo();
          if (f) { await U.modal({ titulo: 'Lava-rápido criado', html: `<p class="txt">Envie para o dono:</p><div class="par"><span>Link</span><b class="quebra">${U.esc(enderecoDe(f.slug))}</b></div><div class="par"><span>Usuário</span><b>${U.esc(f.login.toLowerCase())}</b></div><p class="mudo pequeno">A senha é a que você acabou de definir. Peça para ele trocar no primeiro acesso.</p>`, acoes: [{ txt: 'Entendi', cls: 'btn-marca', valor: true }] }); App.render(); }
        } else if (b) { if (await formEditar(lavas.find((l) => l.id === b.dataset.l))) { U.toast('Salvo'); App.render(); } }
      };
    }
  };
})();
