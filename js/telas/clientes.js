/* =========================================================
   Clientes — busca, cartão de fidelidade, histórico e
   "clientes sumidos" (para chamar de volta pelo WhatsApp).
   ========================================================= */
(function () {
  let filtro = 'todos', busca = '';

  const selos = (f) => {
    const meta = f.proximo ? f.proximo.pontos : f.meta;
    return `<div class="selos">${Array.from({ length: Math.min(meta, 20) }, (_, i) => `<i class="${i < f.saldo ? 'cheio' : ''}">${i < f.saldo ? U.icon('gota') : ''}</i>`).join('')}</div>`;
  };
  const sumido = (c) => { const d = U.diasDesde(c.ultima_visita); return d != null && d >= DB.cfg().sumidoDias && c.visitas >= 2; };

  const FILTROS = [
    ['todos', 'Todos', () => true],
    ['premio', 'Com prêmio', (c) => DB.fidelidade(c).alcancados.length > 0],
    ['quase', 'Quase lá', (c) => { const f = DB.fidelidade(c); return f.ativo && f.proximo && f.faltam <= 2 && f.saldo > 0; }],
    ['sumidos', 'Sumidos', sumido],
    ['novos', 'Novos', (c) => c.primeira_visita && U.diasDesde(c.primeira_visita) <= 30]
  ];

  const linha = (c) => {
    const vs = DB.veiculosDe(c.id), f = DB.fidelidade(c);
    const carros = vs.map((v) => DB.nomeVeiculo(v)).join(', ');
    return `<a class="linha" href="#/cliente/${c.id}">
      <span class="linha-txt"><b>${U.esc(c.nome)}</b>
        <small>${U.esc(carros || 'sem veículo')}${c.ultima_visita ? ' · veio ' + U.haQuanto(c.ultima_visita) : ''}</small></span>
      ${f.ativo ? `<span class="pontos${f.alcancados.length ? ' tem' : ''}">${f.alcancados.length ? U.icon('presente') : ''}${f.saldo}/${f.proximo ? f.proximo.pontos : f.meta}</span>` : `<span class="pontos">${c.visitas}×</span>`}
      ${U.icon('seta', 'fim')}
    </a>`;
  };

  const listaHtml = () => {
    const dono = DB.ehDono();
    let lista = DB.buscarClientes(busca, 400);
    const f = FILTROS.find((x) => x[0] === filtro) || FILTROS[0];
    if (dono) lista = lista.filter(f[2]);
    if (filtro === 'sumidos') lista.sort((a, b) => (b.gasto || 0) - (a.gasto || 0));
    const total = lista.length;
    lista = lista.slice(0, 60);
    if (!lista.length) return `<div class="vazio">${U.icon('pessoas')}<p>${busca ? 'Ninguém encontrado' : 'Nenhum cliente aqui ainda'}</p><p class="mudo">${busca ? 'Confira o nome, o telefone ou a placa.' : 'Os clientes entram sozinhos quando você registra a chegada do carro.'}</p></div>`;
    const dicaSumidos = filtro === 'sumidos' ? `<p class="aviso-caixa">${U.icon('zap')}<span>Clientes que vieram mais de uma vez e não aparecem há ${DB.cfg().sumidoDias} dias ou mais. Abra o cliente e toque em <b>Chamar de volta</b>.</span></p>` : '';
    return `${dicaSumidos}<div class="lista">${lista.map(linha).join('')}</div>${total > lista.length ? `<p class="mudo centro pequeno">Mostrando ${lista.length} de ${total}. Use a busca para achar os outros.</p>` : `<p class="mudo centro pequeno">${total} cliente${total === 1 ? '' : 's'}</p>`}`;
  };

  Telas.clientes = {
    titulo: 'Clientes', perfis: ['funcionario', 'dono'],
    render: (el) => {
      const dono = DB.ehDono();
      el.innerHTML = `
        <label class="campo busca">${U.icon('busca')}<input id="cBusca" placeholder="Nome, telefone ou placa" value="${U.esc(busca)}" autocomplete="off"></label>
        ${dono ? `<div class="chips rolar" id="cFiltros">${FILTROS.map(([id, txt]) => `<button type="button" class="chip${id === filtro ? ' ativo' : ''}" data-f="${id}">${txt}</button>`).join('')}</div>` : ''}
        <div id="cLista">${listaHtml()}</div>`;
      const inp = el.querySelector('#cBusca');
      inp.oninput = () => { busca = inp.value; el.querySelector('#cLista').innerHTML = listaHtml(); };
      const fs = el.querySelector('#cFiltros');
      if (fs) fs.onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filtro = b.dataset.f; fs.querySelectorAll('.chip').forEach((x) => x.classList.toggle('ativo', x === b)); el.querySelector('#cLista').innerHTML = listaHtml(); };
    }
  };

  // ---------------- ficha do cliente ----------------
  const editarCliente = (c) => U.modal({
    titulo: 'Editar cliente',
    html: `<label class="campo"><span>Nome</span><input name="nome" value="${U.esc(c.nome)}" autocapitalize="words"></label>
      <label class="campo"><span>WhatsApp (com DDD)</span><input name="telefone" inputmode="tel" value="${U.esc(U.telFmt(c.telefone))}"></label>
      <label class="campo"><span>Anotação sobre o cliente</span><textarea name="obs" rows="3" placeholder="Ex.: prefere pretinho no pneu, paga por mês…">${U.esc(c.obs || '')}</textarea></label>`,
    aoAbrir: (el) => { const t = el.querySelector('[name=telefone]'); t.oninput = () => { t.value = U.telFmt(t.value); }; },
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => {
      const f = U.campos(el);
      if (f.nome.length < 2) { U.toast('Escreva o nome.', 'bad'); return false; }
      if (f.telefone && !U.telOk(f.telefone)) { U.toast('Confira o telefone: DDD + número.', 'bad'); return false; }
      DB.salvarCliente(c, f); return true;
    } }]
  });

  const editarVeiculo = (v) => U.modal({
    titulo: U.placaFmt(v.placa),
    html: `<label class="campo"><span>Modelo</span><input name="modelo" value="${U.esc(v.modelo || '')}" autocapitalize="words"></label>
      <label class="campo"><span>Cor</span><select name="cor">${CAT.CORES.map(([n]) => `<option${n === v.cor ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo"><span>Tamanho (define o preço)</span><select name="porte">${CAT.PORTES.map((p) => `<option value="${p.id}"${p.id === v.porte ? ' selected' : ''}>${p.nome} · ${p.ex}</option>`).join('')}</select></label>
      <label class="campo"><span>Anotação sobre o carro</span><textarea name="obs" rows="2" placeholder="Ex.: risco na porta do motorista">${U.esc(v.obs || '')}</textarea></label>`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => { const f = U.campos(el); if (!f.modelo) { U.toast('Escreva o modelo.', 'bad'); return false; } DB.salvarVeiculo(v, f); return true; } }]
  });

  Telas.cliente = {
    titulo: 'Cliente', perfis: ['funcionario', 'dono'], voltar: '#/clientes',
    render: (el, args) => {
      const c = DB.cliente(args[0]);
      if (!c) { el.innerHTML = `<div class="vazio">${U.icon('pessoas')}<p>Cliente não encontrado</p><a class="btn" href="#/clientes">Ver clientes</a></div>`; return; }
      const f = DB.fidelidade(c), vs = DB.veiculosDe(c.id), dono = DB.ehDono(), bloqueado = DB.bloqueado();
      const tel = U.telOk(c.telefone), dias = U.diasDesde(c.ultima_visita);
      const maior = f.alcancados[f.alcancados.length - 1];
      el.innerHTML = `
        <section class="cartao ficha-cli">
          <h2>${U.esc(c.nome)}</h2>
          <p class="mudo">${tel ? U.esc(U.telFmt(c.telefone)) : 'sem telefone'}${c.obs ? ' · ' + U.esc(c.obs) : ''}</p>
          <div class="acoes-linha">
            ${tel ? `<button class="btn btn-zap" data-acao="zap">${U.icon('zap')}<span>WhatsApp</span></button><a class="btn" href="tel:+55${U.telDig(c.telefone)}">${U.icon('fone')}<span>Ligar</span></a>` : ''}
            ${bloqueado ? '' : `<button class="btn" data-acao="editar">${U.icon('editar')}<span>Editar</span></button>`}
          </div>
          ${tel && sumido(c) ? `<button class="btn btn-zap btn-bloco" data-acao="sumido">${U.icon('zap')}<span>Chamar de volta (não vem há ${dias} dias)</span></button>` : ''}
        </section>

        ${f.ativo ? `<section class="cartao cartao-fidel">
          <div class="cartao-cab"><h3>${U.icon('presente')} Cartão fidelidade</h3><b>${f.saldo} de ${f.proximo ? f.proximo.pontos : f.meta}</b></div>
          ${selos(f)}
          <p class="mudo">${maior ? `Tem <b>${maior.desconto}% de desconto</b> para usar na próxima lavagem.` : `${f.faltam === 1 ? 'Falta <b>1</b> lavagem' : 'Faltam <b>' + f.faltam + '</b> lavagens'} para ganhar ${f.proximo.desconto}% de desconto.`}</p>
        </section>` : ''}

        <section class="cartao">
          <div class="cartao-cab"><h3>Veículos</h3></div>
          <div class="lista">${vs.map((v) => `<div class="linha veic">
              ${U.placaHtml(v.placa)}
              <span class="linha-txt"><b>${U.esc(DB.nomeVeiculo(v))}</b><small>${CAT.porteNome(v.porte)}${v.visitas ? ' · ' + v.visitas + ' lavagens' : ''}${v.obs ? ' · ' + U.esc(v.obs) : ''}</small></span>
              ${bloqueado ? '' : `<span class="veic-acoes"><button class="btn btn-p" data-acao="veiculo" data-placa="${v.placa}">${U.icon('editar')}<span>Editar</span></button>
              <a class="btn btn-marca btn-p" href="#/entrada/p/${v.placa}">${U.icon('mais')}<span>Chegou</span></a></span>`}
            </div>`).join('') || '<p class="mudo">Nenhum veículo.</p>'}</div>
          ${bloqueado ? '' : `<a class="link" href="#/entrada/c/${c.id}">+ Chegou com outro carro</a>`}
        </section>

        <section class="cartao">
          <div class="cartao-cab"><h3>Histórico</h3><span class="mudo">${c.visitas} lavage${c.visitas === 1 ? 'm' : 'ns'}${dono ? ' · ' + U.brl(c.gasto) : ''}</span></div>
          <div id="hist" class="lista"><p class="mudo">Carregando…</p></div>
        </section>`;

      el.onclick = async (e) => {
        const b = e.target.closest('[data-acao]'); if (!b) return;
        const acao = b.dataset.acao;
        if (acao === 'zap') return U.zap(c.telefone, `Olá, ${U.primeiroNome(c.nome)}! Aqui é do ${DB.lava().nome}.`);
        if (acao === 'sumido') return U.zap(c.telefone, DB.msg('sumido', null, c));
        if (acao === 'editar' && await editarCliente(c)) { U.toast('Cliente atualizado'); App.render(); }
        if (acao === 'veiculo' && await editarVeiculo(DB.veiculo(b.dataset.placa))) { U.toast('Veículo atualizado'); App.render(); }
      };

      DB.historico(c.id).then((lista) => {
        const h = el.querySelector('#hist'); if (!h) return;
        h.innerHTML = lista.length ? lista.map((a) => `<div class="linha">
          <span class="linha-txt"><b>${U.dataBR(a.entrada_em)} · ${U.esc((a.servicos || []).map((s) => s.nome).join(' + '))}</b>
            <small>${U.esc(a.veiculo || '')} ${U.esc(U.placaFmt(a.placa))}${a.premio ? ' · usou prêmio' : ''}</small></span>
          <span class="tag ${a.status}">${a.status === 'entregue' ? U.brl(a.total) : DB.STATUS[a.status]}</span>
        </div>`).join('') : '<p class="mudo">Nenhuma lavagem ainda.</p>';
        if (!dono && c.visitas > lista.length) h.insertAdjacentHTML('beforeend', '<p class="mudo pequeno">O histórico completo aparece no acesso do dono.</p>');
      });
    }
  };
})();
