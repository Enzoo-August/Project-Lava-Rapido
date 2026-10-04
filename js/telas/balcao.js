/* =========================================================
   Balcão — a tela do funcionário: quatro botões grandes.
   Chegou carro · No pátio · Prontos · Entregues hoje
   ========================================================= */
(function () {
  Telas.balcao = {
    titulo: 'Balcão', perfis: ['funcionario', 'dono'], relogio: true,
    render: (el) => {
      const abertos = DB.abertos();
      const fila = abertos.filter((a) => a.status === 'aguardando').length;
      const lavando = abertos.filter((a) => a.status === 'lavando').length;
      const prontos = abertos.filter((a) => a.status === 'pronto').length;
      const entregues = DB.entreguesHoje().length;
      const atrasados = abertos.filter(DB.atrasado).length;
      const patio = fila + lavando;
      const detalhe = patio === 0 ? 'nenhum carro agora' : [fila ? `${fila} na fila` : '', lavando ? `${lavando} lavando` : ''].filter(Boolean).join(' · ');

      el.innerHTML = `
        <div class="blocos">
          <a class="bloco chegou" href="#/entrada">
            <span class="bloco-ic">${U.icon('mais')}</span>
            <b>Chegou carro</b><small>registrar a entrada</small>
          </a>
          <a class="bloco patio" href="#/patio">
            <span class="bloco-n">${patio}</span>
            <b>No pátio</b><small>${detalhe}</small>
            ${atrasados ? `<span class="bloco-alerta">${U.icon('relogio')}${atrasados} atrasado${atrasados > 1 ? 's' : ''}</span>` : ''}
          </a>
          <a class="bloco prontos" href="#/patio/pronto">
            <span class="bloco-n">${prontos}</span>
            <b>Prontos</b><small>${prontos ? 'esperando o dono buscar' : 'nenhum esperando'}</small>
          </a>
          <a class="bloco entregues" href="#/patio/entregue">
            <span class="bloco-n">${entregues}</span>
            <b>Entregues hoje</b><small>carros que já saíram</small>
          </a>
        </div>
        ${(() => {
          const ag = DB.agendaDoDia(), prox = ag.find((g) => new Date(g.quando).getTime() > Date.now() - 15 * 60000);
          return `<a class="faixa-agenda" href="#/agenda">${U.icon('calendario')}<span><b>${ag.length ? `Agenda de hoje: ${ag.length} horário${ag.length > 1 ? 's' : ''}` : 'Agenda: nenhum horário hoje'}</b>
            <small>${prox ? `próximo: ${U.hora(prox.quando)} · ${U.esc(prox.nome)}${prox.servico ? ' · ' + U.esc(prox.servico) : ''}` : 'toque para marcar um horário'}</small></span>${U.icon('seta', 'fim')}</a>`;
        })()}
        ${DB.bloqueado() ? '' : `<a class="atalho" href="#/clientes">${U.icon('busca')}<span>Procurar cliente pelo nome ou telefone</span></a>`}`;
    }
  };
})();
