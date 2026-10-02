/* =========================================================
   Pátio — os carros que estão no lava-rápido, cada um com UM
   botão grande para o próximo passo:
   Na fila → Lavando → Pronto (avisa no WhatsApp) → Entregue
   ========================================================= */
(function () {
  const Atend = {};
  window.Atend = Atend;

  const nomeCli = (a) => { const c = DB.cliente(a.cliente_id); return c ? c.nome : 'Cliente'; };
  const servTxt = (a) => (a.servicos || []).map((s) => s.nome).join(' + ') || 'Sem serviço';

  // linha de tempo: quando chegou e a previsão
  const tempoTxt = (a) => {
    if (a.status === 'entregue') return `Entregue ${U.hora(a.entregue_em)} · ${U.esc(a.pagamento || 'sem pagamento')}`;
    if (a.status === 'pronto') return `Pronto ${U.haQuanto(a.pronto_em)}${a.avisado_em ? ' · cliente avisado' : ''}`;
    const prev = a.previsao ? (DB.atrasado(a) ? `<b class="atraso">atrasado (era ${U.hora(a.previsao)})</b>` : `previsão ${U.hora(a.previsao)}`) : '';
    return `Chegou ${U.hora(a.entrada_em)} (${U.haQuanto(a.entrada_em)})${prev ? ' · ' + prev : ''}`;
  };

  const botao = (a) => {
    if (DB.bloqueado()) return '';
    const usarLavando = DB.cfg().usarLavando;
    if (a.status === 'aguardando') return usarLavando
      ? `<button class="btn btn-marca btn-g" data-acao="lavar">${U.icon('gota')}<span>Começar a lavar</span></button>`
      : `<button class="btn btn-ok btn-g" data-acao="pronto">${U.icon('check')}<span>Ficou pronto</span></button>`;
    if (a.status === 'lavando') return `<button class="btn btn-ok btn-g" data-acao="pronto">${U.icon('check')}<span>Ficou pronto</span></button>`;
    if (a.status === 'pronto') {
      const c = DB.cliente(a.cliente_id);
      const avisar = c && U.telOk(c.telefone) && !a.avisado_em ? `<button class="btn btn-zap btn-g" data-acao="avisar">${U.icon('zap')}<span>Avisar</span></button>` : '';
      return `${avisar}<button class="btn btn-marca btn-g" data-acao="entregar">${U.icon('chave')}<span>Entregar</span></button>`;
    }
    return '';
  };

  Atend.cartao = (a) => `
    <article class="atend st-${a.status}${DB.atrasado(a) ? ' atrasado' : ''}" data-id="${a.id}">
      <button class="atend-info" data-acao="detalhe" type="button">
        <span class="atend-cab">
          <span class="ficha" title="Ficha do dia">${a.numero || '–'}</span>
          ${U.placaHtml(a.placa)}
          <span class="tag ${a.status}">${DB.STATUS[a.status]}</span>
        </span>
        <b class="atend-carro">${U.esc(a.veiculo || 'Veículo')} <span>· ${U.esc(U.primeiroNome(nomeCli(a)))}</span></b>
        <small>${U.esc(servTxt(a))} · <b>${U.brl(a.total)}</b>${a.premio ? ' · com prêmio' : ''}</small>
        <small class="tempo">${tempoTxt(a)}${a.lavador && a.status === 'lavando' ? ' · ' + U.esc(a.lavador) : ''}</small>
        ${a.obs ? `<small class="obs">${U.icon('alerta')}${U.esc(a.obs)}</small>` : ''}
      </button>
      ${botao(a) ? `<div class="atend-acoes">${botao(a)}</div>` : ''}
    </article>`;

  // liga os toques dos cartões dentro de "el"
  Atend.ligar = (el) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      const card = b.closest('[data-id]'); if (!card) return;
      const a = Store.por('atendimentos', card.dataset.id); if (!a) return;
      if (b.disabled) return;
      const fn = Atend[b.dataset.acao];
      if (fn) fn(a, b);
    });
  };

  const redesenhar = () => App.render();

  // ---------------- passos ----------------
  Atend.lavar = async (a) => {
    const nomes = DB.cfg().lavadores || [];
    let lavador = null;
    if (nomes.length) {
      const r = await U.modal({
        titulo: 'Quem vai lavar?', empilhar: true,
        html: `<p class="txt">${U.placaHtml(a.placa)} ${U.esc(a.veiculo || '')}</p>`,
        acoes: [...nomes.map((n) => ({ txt: n, cls: 'btn-g', valor: n })), { txt: 'Não informar', cls: 'btn-claro', valor: '' }]
      });
      if (r === undefined) return;
      lavador = r || null;
    }
    DB.status(a, 'lavando', { lavador });
    U.toast(`${a.veiculo || 'Carro'}: lavando`);
    redesenhar();
  };

  Atend.pronto = async (a) => {
    DB.status(a, 'pronto');
    redesenhar();
    const c = DB.cliente(a.cliente_id);
    if (!c || !U.telOk(c.telefone)) { U.toast(`${a.veiculo || 'Carro'} pronto`); return; }
    await U.modal({
      titulo: 'Carro pronto!', empilhar: true,
      html: `<p class="txt">Avisar <b>${U.esc(U.primeiroNome(c.nome))}</b> que o ${U.esc(a.veiculo || 'carro')} está pronto?</p><p class="mudo pequeno">O WhatsApp abre com a mensagem escrita. É só tocar em enviar.</p>`,
      acoes: [
        { txt: 'Avisar no WhatsApp', icone: 'zap', cls: 'btn-zap btn-g', aoTocar: () => { Atend.enviarAviso(a, c); return true; } },
        { txt: 'Depois', cls: 'btn-claro', valor: false }
      ]
    });
    redesenhar();
  };

  Atend.enviarAviso = (a, c) => {
    c = c || DB.cliente(a.cliente_id);
    U.zap(c.telefone, DB.msg('pronto', a, c));
    DB.editarAtend(a, { avisado_em: new Date().toISOString() });
  };
  Atend.avisar = (a) => { Atend.enviarAviso(a); redesenhar(); };

  Atend.entregar = async (a) => {
    const c = DB.cliente(a.cliente_id), cfg = DB.cfg();
    const pagamento = await U.modal({
      titulo: 'Entregar o carro',
      html: `<div class="entrega-resumo">${U.placaHtml(a.placa, 'grande')}<b>${U.esc(a.veiculo || '')}</b><span>${U.esc(c ? c.nome : '')}</span></div>
        <div class="total-grande"><small>Total a receber</small><b>${U.brl(a.total)}</b>${a.desconto ? `<small>já com ${U.brl(a.desconto)} de desconto</small>` : ''}</div>
        <p class="rotulo">Como o cliente pagou?</p>
        <div class="grade-pag">${cfg.pagamentos.map((p) => `<button type="button" class="btn btn-g" data-pag="${U.esc(p)}">${U.esc(p)}</button>`).join('')}</div>`,
      aoAbrir: (el, fechar) => { let foi = false; el.querySelector('.grade-pag').onclick = (e) => { const b = e.target.closest('[data-pag]'); if (!b || foi) return; foi = true; fechar(b.dataset.pag); }; }
    });
    if (!pagamento) return;
    DB.status(a, 'entregue', { pagamento });
    redesenhar();
    U.toast(`${a.veiculo || 'Carro'} entregue · ${pagamento}`);

    // cliente novo → pedir avaliação no Google (uma vez só)
    const google = DB.marca().google;
    if (c && a.cliente_novo && google && U.telOk(c.telefone) && !c.avaliacao_pedida_em) {
      await U.modal({
        titulo: 'Cliente novo!', empilhar: true,
        html: `<p class="txt">É a primeira vez de <b>${U.esc(U.primeiroNome(c.nome))}</b> aqui. Pedir uma avaliação no Google?</p><p class="mudo pequeno">Avaliações trazem clientes novos. A mensagem já vai com o link.</p>`,
        acoes: [
          { txt: 'Pedir avaliação no WhatsApp', icone: 'estrela', cls: 'btn-zap btn-g', aoTocar: () => { Atend.pedirAvaliacao(c, a); return true; } },
          { txt: 'Agora não', cls: 'btn-claro', valor: false }
        ]
      });
    }
  };
  Atend.pedirAvaliacao = (c, a) => {
    U.zap(c.telefone, DB.msg('avaliacao', a || null, c));
    DB.salvarCliente(c, { avaliacao_pedida_em: new Date().toISOString() });
  };

  // ---------------- detalhe do atendimento ----------------
  Atend.detalhe = async (a) => {
    const c = DB.cliente(a.cliente_id), v = DB.veiculo(a.placa), bloqueado = DB.bloqueado();
    const f = c ? DB.fidelidade(c) : null;
    const aberto = DB.ABERTOS.includes(a.status);
    const podeValor = DB.ehDono() || DB.cfg().funcionarioMudaValor;
    const voltarPara = { lavando: ['aguardando', 'Voltar para a fila'], pronto: [DB.cfg().usarLavando ? 'lavando' : 'aguardando', 'Ainda não está pronto'], entregue: ['pronto', 'Desfazer a entrega'], cancelado: ['aguardando', 'Reativar (voltar para a fila)'] }[a.status];
    const linha = (rot, val) => (val ? `<div class="par"><span>${rot}</span><b>${val}</b></div>` : '');
    const acao = await U.modal({
      titulo: `Ficha ${a.numero || ''}`,
      html: `<div class="entrega-resumo">${U.placaHtml(a.placa, 'grande')}<b>${U.esc(a.veiculo || '')}</b><span class="tag ${a.status}">${DB.STATUS[a.status]}</span></div>
        <div class="pares">${linha('Cliente', U.esc(c ? c.nome : '—') + (a.cliente_novo ? ' <span class="tag novo">novo</span>' : ''))}
        ${linha('Telefone', c && c.telefone ? U.esc(U.telFmt(c.telefone)) : '')}
        ${linha('Porte', v ? CAT.porteNome(v.porte) : '')}
        ${linha('Serviços', U.esc(servTxt(a)))}
        ${linha('Valor', U.brl(a.valor))}
        ${linha('Desconto', a.desconto ? '− ' + U.brl(a.desconto) + (a.premio ? ' · ' + U.esc(a.premio) : '') : '')}
        ${linha('Total', `<span class="destaque">${U.brl(a.total)}</span>`)}
        ${linha('Chegou', U.dataHora(a.entrada_em))}
        ${linha('Previsão', a.previsao ? U.dataHora(a.previsao) : '')}
        ${linha('Lavou', U.esc(a.lavador || ''))}
        ${linha('Pronto', a.pronto_em ? U.dataHora(a.pronto_em) : '')}
        ${linha('Entregue', a.entregue_em ? U.dataHora(a.entregue_em) + (a.pagamento ? ' · ' + U.esc(a.pagamento) : '') : '')}
        ${linha('Recebeu o carro', U.esc(a.atendente_nome || ''))}
        ${linha('Observação', U.esc(a.obs || ''))}
        ${f && f.ativo ? linha('Fidelidade', `${f.saldo} de ${f.proximo ? f.proximo.pontos : f.meta} lavagens`) : ''}</div>
        <div class="lista-menu">
          ${c && U.telOk(c.telefone) ? `<button type="button" data-v="zap">${U.icon('zap')}<span>Chamar no WhatsApp</span></button><a href="tel:+55${U.telDig(c.telefone)}" data-fechar>${U.icon('fone')}<span>Ligar para ${U.esc(U.primeiroNome(c.nome))}</span></a>` : ''}
          ${c && U.telOk(c.telefone) && aberto ? `<button type="button" data-v="comprovante">${U.icon('olho')}<span>Enviar link de acompanhamento</span></button>` : ''}
          ${!bloqueado && a.status !== 'cancelado' && (aberto || DB.ehDono()) ? `<button type="button" data-v="servicos">${U.icon('editar')}<span>Trocar serviços${podeValor ? ' ou valor' : ''}</span></button>` : ''}
          ${!bloqueado && aberto ? `<button type="button" data-v="obs">${U.icon('alerta')}<span>${a.obs ? 'Alterar' : 'Anotar'} observação</span></button>` : ''}
          ${c ? `<a href="#/cliente/${c.id}" data-fechar>${U.icon('pessoas')}<span>Ver cadastro e histórico do cliente</span></a>` : ''}
          ${!bloqueado && voltarPara ? `<button type="button" data-v="voltar">${U.icon('voltar')}<span>${voltarPara[1]}</span></button>` : ''}
          ${!bloqueado && aberto ? `<button type="button" class="perigo" data-v="cancelar">${U.icon('x')}<span>Cancelar este atendimento</span></button>` : ''}
        </div>`,
      aoAbrir: (el, fechar) => { el.querySelector('.lista-menu').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'zap') U.zap(c.telefone, `Olá, ${U.primeiroNome(c.nome)}! Aqui é ${DB.lava().nome}.`); if (b.dataset.v === 'comprovante') U.zap(c.telefone, DB.msg('entrada', a, c)); fechar(b.dataset.v); }); }
    });
    if (acao === 'voltar') { DB.status(a, voltarPara[0]); U.toast('Feito'); }
    if (acao === 'cancelar' && await U.confirmar('Cancelar este atendimento?', `${a.veiculo || 'Carro'} ${U.placaFmt(a.placa)} sai do pátio e não conta como lavagem.`, 'Cancelar atendimento', 'btn-perigo')) { DB.status(a, 'cancelado'); U.toast('Atendimento cancelado'); }
    if (acao === 'obs') await Atend.editarObs(a);
    if (acao === 'servicos') await Atend.editarServicos(a);
    redesenhar();
  };

  Atend.editarObs = (a) => U.modal({
    titulo: 'Observação',
    html: `<label class="campo"><span>Riscos, amassados, objetos no carro, combinado com o cliente…</span><textarea name="obs" rows="4">${U.esc(a.obs || '')}</textarea></label>`,
    acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => { DB.editarAtend(a, { obs: U.campos(el).obs }); return true; } }]
  });

  // lista de serviços para marcar (usada aqui e na chegada do carro)
  Atend.servicosHtml = (porte, marcados, vals) => DB.servicos().map((s) => {
    const p = vals && vals[s.id] != null ? vals[s.id] : DB.preco(s, porte);
    return `<button type="button" class="serv${marcados.includes(s.id) ? ' sel' : ''}" data-serv="${s.id}">
      <span class="serv-check">${U.icon('check')}</span>
      <span class="serv-nome"><b>${U.esc(s.nome)}</b><small>${U.duracao(s.minutos)}</small></span>
      <span class="serv-preco">${p ? U.brl0(p) : 'a combinar'}</span>
    </button>`;
  }).join('');

  // serviços escritos na hora (não estão na tabela de preços)
  Atend.extrasHtml = (extras) => extras.map((x) => `<button type="button" class="serv sel" data-tirar-extra="${x.id}">
      <span class="serv-check">${U.icon('check')}</span>
      <span class="serv-nome"><b>${U.esc(x.nome)}</b><small>toque para tirar</small></span>
      <span class="serv-preco">${U.brl0(x.valor)}</span>
    </button>`).join('');
  Atend.pedirValor = (nome, atual) => U.modal({
    titulo: nome,
    html: `<label class="campo grande"><span>Quanto vai custar? (R$)</span><input name="valor" inputmode="decimal" value="${atual ? String(atual).replace('.', ',') : ''}" placeholder="0,00"></label>`,
    aoAbrir: (el) => el.querySelector('input').focus(),
    acoes: [{ txt: 'Voltar', valor: null }, { txt: 'Confirmar', cls: 'btn-marca', aoTocar: (el) => { const v = U.num(U.campos(el).valor); if (v <= 0) { U.toast('Informe o valor.', 'bad'); return false; } return v; } }]
  }).then((v) => (typeof v === 'number' ? v : null));
  Atend.pedirServicoLivre = () => U.modal({
    titulo: 'Outro serviço',
    html: `<label class="campo grande"><span>Qual serviço?</span><input name="nome" placeholder="Ex.: Polimento de farol" autocapitalize="sentences"></label>
      <label class="campo grande"><span>Valor (R$)</span><input name="valor" inputmode="decimal" placeholder="0,00"></label>`,
    aoAbrir: (el) => el.querySelector('input').focus(),
    acoes: [{ txt: 'Voltar', valor: null }, { txt: 'Adicionar', cls: 'btn-marca', aoTocar: (el) => {
      const f = U.campos(el), valor = U.num(f.valor);
      if (f.nome.length < 2) { U.toast('Escreva o nome do serviço.', 'bad'); return false; }
      if (valor <= 0) { U.toast('Informe o valor.', 'bad'); return false; }
      return { id: 'livre-' + U.uuid().slice(0, 8), nome: f.nome.charAt(0).toUpperCase() + f.nome.slice(1), valor };
    } }]
  }).then((x) => (x && x.nome ? x : null));

  Atend.editarServicos = (a) => {
    const v = DB.veiculo(a.placa), porte = v ? v.porte : 'm';
    let ids = (a.servicos || []).map((s) => s.id).filter((id) => Store.por('servicos', id));
    let extras = (a.servicos || []).filter((s) => !Store.por('servicos', s.id));
    const vals = {}; (a.servicos || []).forEach((s) => { if (Store.por('servicos', s.id)) vals[s.id] = Number(s.valor) || 0; });
    const podeValor = DB.ehDono() || DB.cfg().funcionarioMudaValor;
    const itens = () => DB.itens(ids, porte).map((i) => (vals[i.id] != null ? { ...i, valor: vals[i.id] } : i)).concat(extras);
    const soma = () => itens().reduce((t, i) => t + i.valor, 0);
    const lista = () => `${Atend.servicosHtml(porte, ids, vals)}${Atend.extrasHtml(extras)}<button type="button" class="serv livre" data-extra>${U.icon('mais')}<span class="serv-nome"><b>Outro serviço</b><small>escrever o nome e o valor</small></span></button>`;
    return U.modal({
      titulo: 'Serviços e valor',
      html: `<div class="servs">${lista()}</div>
        ${podeValor ? `<label class="campo"><span>Valor (sem o desconto)</span><input name="valor" inputmode="decimal" value="${String(a.valor).replace('.', ',')}"></label>` : ''}`,
      aoAbrir: (el) => {
        const caixa = el.querySelector('.servs');
        const pintar = () => { caixa.innerHTML = lista(); const campo = el.querySelector('[name=valor]'); if (campo) campo.value = String(soma()).replace('.', ','); };
        caixa.onclick = async (e) => {
          let b;
          if ((b = e.target.closest('[data-serv]'))) {
            const id = b.dataset.serv;
            if (ids.includes(id)) { ids = ids.filter((x) => x !== id); delete vals[id]; }
            else {
              if (!DB.preco(Store.por('servicos', id), porte)) { const val = await Atend.pedirValor(Store.por('servicos', id).nome); if (val == null) return; vals[id] = val; }
              ids = [...ids, id];
            }
            pintar();
          } else if ((b = e.target.closest('[data-tirar-extra]'))) { extras = extras.filter((x) => x.id !== b.dataset.tirarExtra); pintar(); }
          else if (e.target.closest('[data-extra]')) { const x = await Atend.pedirServicoLivre(); if (x) { extras = [...extras, x]; pintar(); } }
        };
      },
      acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => {
        if (!ids.length && !extras.length) { U.toast('Escolha pelo menos um serviço.', 'bad'); return false; }
        const campo = el.querySelector('[name=valor]');
        DB.editarAtend(a, { itens: itens(), valor: campo ? U.num(campo.value) : soma() });
        return true;
      } }]
    });
  };

  // ---------------- tela ----------------
  const ABAS = [['patio', 'No pátio'], ['pronto', 'Prontos'], ['entregue', 'Entregues']];
  Telas.patio = {
    titulo: (args) => ({ pronto: 'Prontos', entregue: 'Entregues hoje' }[args[0]] || 'No pátio'),
    perfis: ['funcionario', 'dono'], relogio: true,
    render: (el, args) => {
      const aba = ABAS.some((x) => x[0] === args[0]) ? args[0] : 'patio';
      const abertos = DB.abertos();
      const listas = {
        patio: abertos.filter((a) => a.status !== 'pronto').sort((a, b) => (a.status === b.status ? (a.entrada_em < b.entrada_em ? -1 : 1) : a.status === 'lavando' ? -1 : 1)),
        pronto: abertos.filter((a) => a.status === 'pronto'),
        entregue: DB.doDia().filter((a) => a.status === 'entregue').sort((a, b) => (a.entregue_em > b.entregue_em ? -1 : 1))
      };
      const lista = listas[aba];
      const vazio = { patio: ['carro', 'Nenhum carro no pátio', 'Quando chegar um carro, toque em “Chegou carro”.'], pronto: ['check', 'Nenhum carro esperando', 'Os carros prontos aparecem aqui até o dono buscar.'], entregue: ['chave', 'Nenhum carro entregue hoje', 'Os carros que já saíram hoje aparecem aqui.'] }[aba];
      const total = aba === 'entregue' && DB.ehDono() ? `<p class="mudo centro">Total recebido hoje: <b>${U.brl(lista.reduce((t, a) => t + a.total, 0))}</b></p>` : '';
      el.innerHTML = `
        <div class="abas">${ABAS.map(([id, txt]) => `<a href="#/patio/${id === 'patio' ? '' : id}" class="${id === aba ? 'ativo' : ''}">${txt}<span>${listas[id].length}</span></a>`).join('')}</div>
        ${lista.length ? `<div class="atends">${lista.map(Atend.cartao).join('')}</div>${total}`
          : `<div class="vazio">${U.icon(vazio[0])}<p>${vazio[1]}</p><p class="mudo">${vazio[2]}</p>${DB.bloqueado() ? '' : `<a class="btn btn-marca btn-g" href="#/entrada">${U.icon('mais')}<span>Chegou carro</span></a>`}</div>`}`;
      Atend.ligar(el);
    }
  };
})();
