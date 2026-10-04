/* =========================================================
   Início do dono — o dia de hoje em uma olhada:
   quanto entrou, quantos carros, o que está no pátio agora.
   (Os gráficos ficam em Resultados.)
   ========================================================= */
(function () {
  // primeiros passos: somem conforme o dono vai fazendo
  const passos = () => {
    const m = DB.marca(), l = DB.lava();
    return [
      { ok: !!m.logo || (m.cor && m.cor !== '#0b63ce'), txt: 'Colocar a logo e a cor do seu lava-rápido', r: 'ajustes/marca' },
      { ok: !!(l.config || {}).precosConferidos, txt: 'Conferir os serviços e os preços', r: 'ajustes/servicos' },
      { ok: !!m.google, txt: 'Colar o link de avaliação do Google', r: 'ajustes/marca' },
      { ok: Store.s.equipe.some((e) => e.perfil === 'funcionario' && e.ativo), txt: 'Criar o acesso do funcionário', r: 'ajustes/equipe' },
      { ok: !!Store.pref('instalado') || window.matchMedia('(display-mode: standalone)').matches, txt: 'Instalar no celular (vira um aplicativo)', r: 'ajuda/instalar' }
    ];
  };

  Telas.inicio = {
    titulo: 'Início', perfis: ['dono'], relogio: true,
    render: (el) => {
      const h0 = U.inicioDia(), abertos = DB.abertos();
      const r = An.resumo(Store.s.atendimentos, h0, U.somaDias(h0, 1)), ontem = An.resumo(Store.s.atendimentos, U.somaDias(h0, -1), h0);
      const aReceber = abertos.reduce((t, a) => t + (Number(a.total) || 0), 0);   // tudo que está no pátio, de qualquer dia
      const atrasados = abertos.filter(DB.atrasado).length, prontos = abertos.filter((a) => a.status === 'pronto').length;
      const pag = An.ordenado(r.porPagamento, 'valor');
      const ps = passos(), faltam = ps.filter((p) => !p.ok);
      const comPremio = Store.s.clientes.filter((c) => c.ativo !== false && DB.fidelidade(c).alcancados.length).length;
      const lim = DB.cfg().sumidoDias;
      const sumidos = Store.s.clientes.filter((c) => c.ativo !== false && c.visitas >= 2 && U.diasDesde(c.ultima_visita) >= lim).length;

      el.innerHTML = `
        ${faltam.length && !Store.pref('passosOcultos') && Store.modo !== 'demo' ? `<section class="cartao passos-ini">
          <div class="cartao-cab"><h3>Primeiros passos <span class="mudo">(${ps.length - faltam.length} de ${ps.length})</span></h3><button class="link" id="iOcultar">Ocultar</button></div>
          ${ps.map((p) => `<a class="passo-ini${p.ok ? ' ok' : ''}" href="#/${p.r}"><i>${p.ok ? U.icon('check') : ''}</i><span>${p.txt}</span>${p.ok ? '' : U.icon('seta', 'fim')}</a>`).join('')}
        </section>` : ''}

        <section class="hoje">
          <div class="hoje-num"><span>Recebido hoje</span><b>${U.brl(r.faturamento)}</b>
            <small>${aReceber ? `+ ${U.brl(aReceber)} a receber dos carros no pátio` : 'nenhum carro pendente'}${ontem.faturamento ? ` · ontem: ${U.brl(ontem.faturamento)}` : ''}</small></div>
          <a class="btn btn-marca btn-g so-celular" href="#/entrada">${U.icon('mais')}<span>Chegou carro</span></a>
        </section>

        <div class="kpis">
          <a class="kpi" href="#/patio/entregue"><span>Chegaram hoje</span><b>${r.carros}</b><small class="delta">${ontem.carros ? 'ontem: ' + ontem.carros : '&nbsp;'}</small></a>
          <a class="kpi" href="#/patio"><span>No pátio agora</span><b>${abertos.length - prontos}</b><small class="delta ${atrasados ? 'desce' : ''}">${atrasados ? `${atrasados} atrasado${atrasados > 1 ? 's' : ''}` : 'sem atraso'}</small></a>
          <a class="kpi" href="#/patio/pronto"><span>Prontos, esperando</span><b>${prontos}</b><small class="delta">&nbsp;</small></a>
          <div class="kpi"><span>Valor médio por carro</span><b>${U.brl(r.ticket)}</b><small class="delta">${r.novos ? `${r.novos} cliente${r.novos > 1 ? 's' : ''} novo${r.novos > 1 ? 's' : ''} hoje` : '&nbsp;'}</small></div>
        </div>

        ${(() => {
          const ag = DB.agendaDoDia(), am = DB.agendaDoDia(U.dia(U.somaDias(new Date(), 1)));
          if (!ag.length && !am.length) return '';
          return `<section class="cartao"><div class="cartao-cab"><h3>${U.icon('calendario')} Agenda</h3><a class="link" href="#/agenda">Ver agenda</a></div>
            ${ag.slice(0, 5).map((g) => `<div class="par"><span>${U.hora(g.quando)} · ${U.esc(g.nome)}</span><b>${U.esc(g.servico || 'a combinar')}</b></div>`).join('') || '<p class="mudo">Nada marcado para hoje.</p>'}
            ${am.length ? `<p class="mudo pequeno">Amanhã: ${am.length} horário${am.length > 1 ? 's' : ''} marcado${am.length > 1 ? 's' : ''}.</p>` : ''}</section>`;
        })()}

        <section class="cartao">
          <div class="cartao-cab"><h3>No lava-rápido agora</h3>${abertos.length ? '<a class="link" href="#/patio">Ver pátio</a>' : ''}</div>
          ${abertos.length ? `<div class="atends compacto">${abertos.slice().sort((a, b) => (a.status === 'pronto') - (b.status === 'pronto')).slice(0, 8).map(Atend.cartao).join('')}</div>${abertos.length > 8 ? `<a class="link" href="#/patio">e mais ${abertos.length - 8}…</a>` : ''}`
            : '<p class="mudo">Nenhum carro no pátio neste momento.</p>'}
        </section>

        <div class="grade2">
          <section class="cartao">
            <div class="cartao-cab"><h3>Caixa de hoje</h3></div>
            ${pag.length ? pag.map((p) => `<div class="par"><span>${U.esc(p.rot)} <small class="mudo">(${p.qtd})</small></span><b>${U.brl(p.valor)}</b></div>`).join('') + `<div class="par total"><span>Total</span><b>${U.brl(r.faturamento)}</b></div>` : '<p class="mudo">Nenhum carro entregue hoje ainda.</p>'}
          </section>
          <section class="cartao">
            <div class="cartao-cab"><h3>Clientes</h3><a class="link" href="#/clientes">Ver todos</a></div>
            <div class="par"><span>Cadastrados</span><b>${Store.s.clientes.filter((c) => c.ativo !== false).length}</b></div>
            <div class="par"><span>Com prêmio de fidelidade para usar</span><b>${comPremio}</b></div>
            <div class="par"><span>Sumidos (${lim} dias ou mais sem vir)</span><b>${sumidos}</b></div>
            ${sumidos ? `<p class="mudo pequeno">Em Clientes → Sumidos dá para chamar cada um de volta pelo WhatsApp.</p>` : ''}
          </section>
        </div>`;
      Atend.ligar(el);
      const oc = el.querySelector('#iOcultar'); if (oc) oc.onclick = () => { Store.pref('passosOcultos', true); App.render(); };
    }
  };
})();
