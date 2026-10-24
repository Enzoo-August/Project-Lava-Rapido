/* =========================================================
   Fiado — clientes e parceiros que pagam depois.
   Na entrega do carro o funcionário toca em "Fiado"; aqui o dono
   vê quanto cada um deve, manda o resumo no WhatsApp e marca
   quando recebeu (com a forma de pagamento).
   ========================================================= */
(function () {
  const dataCurta = (iso) => U.dataBR(iso).slice(0, 5);
  const linhaAtend = (a) => `${dataCurta(a.entregue_em)} · ${a.veiculo || 'Carro'}${U.placaOk(a.placa) ? ' ' + U.placaFmt(a.placa) : ''} · ${(a.servicos || []).map((s) => s.nome).join(' + ')}`;

  // extrato de um cliente: marcar o que recebeu, cobrar no WhatsApp
  const extrato = async (g) => {
    const c = g.cliente || {}, nome = c.nome || 'Cliente', bloq = DB.bloqueado(), pags = DB.cfg().pagamentos;
    const r = await U.modal({
      titulo: nome, largo: true,
      html: `<p class="mudo">Deve <b>${U.brl(g.total)}</b> de ${g.itens.length} serviço${g.itens.length > 1 ? 's' : ''}${g.itens.length ? `, desde ${U.dataBR(g.itens[0].entregue_em)}` : ''}. Desmarque o que ele ainda não vai pagar agora.</p>
        <div class="lista" id="fxLista">${g.itens.map((a) => `<label class="chave fx-item"><input type="checkbox" data-a="${a.id}" checked><span>${U.esc(linhaAtend(a))}<small>${U.brl(a.total)}</small></span></label>`).join('')}</div>
        <div class="par total"><span>Recebendo agora</span><b id="fxTotal">${U.brl(g.total)}</b></div>
        ${bloq ? '' : `<span class="rot">Como pagou?</span><div class="opcoes" id="fxPag">${pags.map((p, i) => `<button type="button" data-pag="${U.esc(p)}" class="${i === 0 ? 'ativo' : ''}">${U.esc(p)}</button>`).join('')}</div>`}`,
      aoAbrir: (el) => {
        const soma = () => { const ids = new Set(Array.from(el.querySelectorAll('[data-a]:checked')).map((x) => x.dataset.a)); el.querySelector('#fxTotal').textContent = U.brl(g.itens.filter((a) => ids.has(a.id)).reduce((t, a) => t + (Number(a.total) || 0), 0)); };
        el.querySelector('#fxLista').onchange = soma;
        const pg = el.querySelector('#fxPag'); if (pg) pg.onclick = (e) => { const b = e.target.closest('[data-pag]'); if (!b) return; pg.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b)); };
      },
      acoes: [
        ...(U.telOk(c.telefone) ? [{ txt: 'Cobrar no WhatsApp', icone: 'zap', aoTocar: () => {
          U.zap(c.telefone, DB.msg('fiado', null, c, { lista: g.itens.map((a) => `• ${linhaAtend(a)}: ${U.brl(a.total)}`).join('\n'), valor: U.brl(g.total) }));
          return false;
        } }] : []),
        ...(bloq ? [] : [{ txt: 'Recebi', cls: 'btn-marca', icone: 'check', aoTocar: (el) => {
          const ids = new Set(Array.from(el.querySelectorAll('[data-a]:checked')).map((x) => x.dataset.a));
          if (!ids.size) { U.toast('Marque o que ele pagou.', 'bad'); return false; }
          const forma = (el.querySelector('#fxPag .ativo') || {}).dataset;
          return { lista: g.itens.filter((a) => ids.has(a.id)), forma: forma ? forma.pag : pags[0] };
        } }])
      ]
    });
    if (r && r.lista) {
      DB.receberFiado(r.lista, r.forma);
      U.toast(`Recebido ${U.brl(r.lista.reduce((t, a) => t + (Number(a.total) || 0), 0))} de ${U.primeiroNome(nome)} · ${r.forma}`);
      App.render();
    }
  };

  Telas.fiado = {
    titulo: 'Fiado', perfis: ['dono'], parado: true,
    render: (el) => {
      const grupos = DB.fiadoPorCliente(), total = grupos.reduce((t, g) => t + g.total, 0);
      const pagos = DB.fiadosPagos(U.somaDias(U.inicioDia(), -30).toISOString());
      const off = DB.cfg().fiado === false;
      el.innerHTML = `
        <section class="hoje"><div class="hoje-num"><span>Fiado a receber</span><b>${U.brl(total)}</b>
          <small>${grupos.length ? `${grupos.length} cliente${grupos.length > 1 ? 's' : ''} · ${grupos.reduce((t, g) => t + g.itens.length, 0)} serviço${grupos.reduce((t, g) => t + g.itens.length, 0) > 1 ? 's' : ''}` : 'ninguém devendo'}</small></div></section>
        ${off ? `<p class="aviso-caixa">${U.icon('alerta')}<span>O fiado está desligado: na entrega não aparece a opção. Para ligar, vá em <a class="link" href="#/ajustes/opcoes">Ajustes → Opções</a>.</span></p>` : ''}
        <section class="cartao"><div class="cartao-cab"><h3>Quem deve</h3></div>
          ${grupos.length ? `<div class="lista">${grupos.map((g, i) => `<button type="button" class="linha" data-gr="${i}">
            <span class="linha-txt"><b>${U.esc((g.cliente || {}).nome || 'Cliente')}</b><small>${g.itens.length} serviço${g.itens.length > 1 ? 's' : ''} · desde ${U.dataBR(g.itens[0].entregue_em)}${U.diasDesde(g.itens[0].entregue_em) >= 30 ? ' · <b class="atraso">há mais de 30 dias</b>' : ''}</small></span>
            <b>${U.brl(g.total)}</b>${U.icon('seta')}</button>`).join('')}</div>`
          : `<p class="mudo">Ninguém devendo. Quando um parceiro ou cliente não pagar na hora, toque em <b>Fiado</b> na entrega do carro: fica anotado aqui, por cliente, até ele pagar.</p>`}
        </section>
        ${pagos.length ? `<section class="cartao"><div class="cartao-cab"><h3>Recebidos nos últimos 30 dias</h3></div>
          <div class="lista">${pagos.slice(0, 40).map((a) => { const c = DB.cliente(a.cliente_id); return `<div class="linha"><span class="linha-txt"><b>${U.esc(c ? c.nome : 'Cliente')}</b><small>Pagou em ${U.dataBR(a.fiado_pago_em)} · ${U.esc(a.fiado_pagamento || '')} · ${U.esc(linhaAtend(a))}</small></span><b>${U.brl(a.total)}</b></div>`; }).join('')}</div></section>` : ''}`;
      el.querySelectorAll('[data-gr]').forEach((b) => { b.onclick = () => extrato(grupos[Number(b.dataset.gr)]); });
    }
  };
})();
