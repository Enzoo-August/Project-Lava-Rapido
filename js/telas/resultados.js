/* =========================================================
   Resultados — a tela de análise do dono.
   An   = contas (faturamento, ticket, horários de pico…)
   Graf = gráficos simples (colunas e barras), com toque/hover
   ========================================================= */
(function () {
  const An = {}, Graf = {};
  window.An = An; window.Graf = Graf;

  // ---------------- contas ----------------
  const somar = (mapa, k, campo, v) => { const o = mapa.get(k) || mapa.set(k, { rot: k, qtd: 0, valor: 0 }).get(k); o[campo] += v; return o; };
  An.resumo = (lista) => {
    const validos = lista.filter((a) => a.status !== 'cancelado'), entregues = validos.filter((a) => a.status === 'entregue');
    const fat = entregues.reduce((t, a) => t + (Number(a.total) || 0), 0);
    const comPronto = validos.filter((a) => a.pronto_em);
    const r = {
      carros: validos.length, entregues: entregues.length, faturamento: fat,
      ticket: entregues.length ? fat / entregues.length : 0,
      novos: validos.filter((a) => a.cliente_novo).length,
      descontos: entregues.reduce((t, a) => t + (Number(a.desconto) || 0), 0),
      premios: validos.filter((a) => a.pontos_usados > 0).length,
      cancelados: lista.length - validos.length,
      aReceber: validos.filter((a) => a.status !== 'entregue').reduce((t, a) => t + (Number(a.total) || 0), 0),
      tempoMedio: comPronto.length ? comPronto.reduce((t, a) => t + (new Date(a.pronto_em) - new Date(a.entrada_em)) / 60000, 0) / comPronto.length : 0,
      porDia: new Map(), porServico: new Map(), porPagamento: new Map(), porHora: new Map(), porSemana: new Map(), porLavador: new Map(), porPorte: new Map()
    };
    const dias = new Set();
    for (const a of validos) {
      const d = new Date(a.entrada_em), dia = U.dia(d), pago = a.status === 'entregue';
      dias.add(dia);
      somar(r.porDia, dia, 'qtd', 1); if (pago) somar(r.porDia, dia, 'valor', Number(a.total) || 0);
      somar(r.porHora, d.getHours(), 'qtd', 1);
      somar(r.porSemana, d.getDay(), 'qtd', 1); if (pago) somar(r.porSemana, d.getDay(), 'valor', Number(a.total) || 0);
      const fator = a.valor ? (Number(a.total) || 0) / a.valor : 1;   // o desconto é repartido entre os serviços
      for (const s of a.servicos || []) { somar(r.porServico, s.nome, 'qtd', 1); if (pago) somar(r.porServico, s.nome, 'valor', (Number(s.valor) || 0) * fator); }
      if (pago) { somar(r.porPagamento, a.pagamento || 'Não informado', 'qtd', 1); somar(r.porPagamento, a.pagamento || 'Não informado', 'valor', Number(a.total) || 0); }
      if (a.lavador) somar(r.porLavador, a.lavador, 'qtd', 1);
      const v = DB.veiculo(a.placa); if (v) somar(r.porPorte, CAT.porteNome(v.porte), 'qtd', 1);
    }
    r.diasComMovimento = dias.size;
    // quantas vezes cada dia da semana aparece (para a média por dia)
    r.diasDaSemana = new Map(); for (const d of dias) { const k = U.deDia(d).getDay(); r.diasDaSemana.set(k, (r.diasDaSemana.get(k) || 0) + 1); }
    return r;
  };
  An.ordenado = (mapa, campo) => Array.from(mapa.values()).sort((a, b) => b[campo] - a[campo]);
  An.variacao = (agora, antes) => (antes > 0 ? ((agora - antes) / antes) * 100 : null);

  // ---------------- gráficos ----------------
  const eixo = (max) => {            // números redondos para as linhas de referência
    if (max <= 0) return [0, 1];
    const bruto = max / 3, pot = Math.pow(10, Math.floor(Math.log10(bruto))), n = bruto / pot;
    const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot;
    const ticks = []; for (let v = 0; v < max + passo; v += passo) ticks.push(v);
    return ticks;
  };
  const curto = (v, dinheiro) => (dinheiro ? 'R$ ' : '') + (v >= 10000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil' : v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(v).toLocaleString('pt-BR'));

  // colunas (uma série): dados = [{ rot, valor, dica }]
  Graf.colunas = (dados, o) => {
    o = o || {};
    // desenhado no tamanho real da tela, para as letras não encolherem no celular
    const w = window.innerWidth, tela = w >= 900 ? Math.min(1040, w - 250) - 56 : Math.min(760, w) - 32;
    const L = Math.max(280, Math.round(o.meia && w >= 700 ? (tela - 14) / 2 - 32 : tela - 32)), A = L > 700 ? 240 : 200, esq = 44, dir = 8, topo = 16, base = 26;
    const max = Math.max(1, ...dados.map((d) => d.valor)), ticks = eixo(max), teto = ticks[ticks.length - 1];
    const larg = (L - esq - dir) / Math.max(1, dados.length), bw = Math.min(24, Math.max(2, larg - 2));
    const y = (v) => topo + (A - topo - base) * (1 - v / teto);
    const cadaRot = Math.ceil(dados.length / 8), iMax = dados.reduce((m, d, i) => (d.valor > dados[m].valor ? i : m), 0);
    const barras = dados.map((d, i) => {
      const x = esq + larg * i + (larg - bw) / 2, h = Math.max(0, A - base - y(d.valor)), r = Math.min(4, bw / 2, h);
      const caminho = h > 0 ? `M${x},${A - base}v${-(h - r)}q0,${-r} ${r},${-r}h${bw - 2 * r}q${r},0 ${r},${r}v${h - r}z` : '';
      return `<g class="col" data-i="${i}">
        <rect class="alvo" x="${esq + larg * i}" y="${topo}" width="${larg}" height="${A - topo - base}"/>
        ${caminho ? `<path class="marca${o.destaque === i ? ' hoje' : ''}" d="${caminho}"/>` : ''}
        ${i === iMax && d.valor > 0 ? `<text class="valor" x="${x + bw / 2}" y="${y(d.valor) - 5}" text-anchor="middle">${curto(d.valor, o.dinheiro)}</text>` : ''}
        ${i % cadaRot === 0 ? `<text class="rot" x="${x + bw / 2}" y="${A - 8}" text-anchor="middle">${U.esc(d.rot)}</text>` : ''}
      </g>`;
    }).join('');
    const grade = ticks.map((t) => `<line class="${t === 0 ? 'base' : 'grade'}" x1="${esq}" x2="${L - dir}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${esq - 6}" y="${y(t) + 4}" text-anchor="end">${curto(t, o.dinheiro)}</text>`).join('');
    return `<div class="graf" data-dicas='${U.esc(JSON.stringify(dados.map((d) => d.dica || `${d.rot}: ${o.dinheiro ? U.brl(d.valor) : d.valor}`)))}'>
      <svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${U.esc(o.titulo || 'Gráfico')}">${grade}${barras}</svg>
      <div class="graf-dica" hidden></div>
    </div>${Graf.tabela(dados.map((d) => [d.rotLonga || d.rot, o.dinheiro ? U.brl(d.valor) : String(d.valor)]), o.cab || ['', 'Valor'])}`;
  };

  // barras deitadas: lista = [{ rot, valor, txt }]
  Graf.barras = (lista, o) => {
    o = o || {};
    if (!lista.length) return '<p class="mudo">Sem dados neste período.</p>';
    const max = Math.max(1, ...lista.map((d) => d.valor));
    return `<div class="barras">${lista.map((d) => `<div class="barra" title="${U.esc(d.rot + ': ' + d.txt)}">
      <span class="barra-rot">${U.esc(d.rot)}</span>
      <span class="barra-val">${U.esc(d.txt)}</span>
      <span class="barra-trilho"><i style="width:${Math.max(1.5, (d.valor / max) * 100)}%"></i></span>
    </div>`).join('')}</div>`;
  };
  Graf.tabela = (linhas, cab) => `<details class="ver-tabela"><summary>Ver em tabela</summary><table><thead><tr>${cab.map((c) => `<th>${U.esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${U.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;

  // toque/hover nas colunas: mostra o valor do dia
  Graf.ligar = (el) => {
    el.querySelectorAll('.graf').forEach((g) => {
      const dicas = JSON.parse(g.dataset.dicas || '[]'), cx = g.querySelector('.graf-dica');
      const mostrar = (col) => {
        g.querySelectorAll('.col.sobre').forEach((c) => c.classList.remove('sobre'));
        if (!col) { cx.hidden = true; return; }
        col.classList.add('sobre');
        cx.textContent = dicas[Number(col.dataset.i)] || ''; cx.hidden = false;
        const r = col.querySelector('.alvo').getBoundingClientRect(), b = g.getBoundingClientRect();
        const meio = r.left + r.width / 2 - b.left;
        cx.style.left = Math.max(cx.offsetWidth / 2 + 4, Math.min(b.width - cx.offsetWidth / 2 - 4, meio)) + 'px';
      };
      g.addEventListener('pointermove', (e) => mostrar(e.target.closest('.col')));
      g.addEventListener('pointerdown', (e) => mostrar(e.target.closest('.col')));
      g.addEventListener('pointerleave', () => mostrar(null));
    });
  };

  // ---------------- períodos ----------------
  const hoje0 = () => U.inicioDia();
  const PERIODOS = [
    ['hoje', 'Hoje', () => [hoje0(), U.somaDias(hoje0(), 1)], 'ontem'],
    ['7d', '7 dias', () => [U.somaDias(hoje0(), -6), U.somaDias(hoje0(), 1)], '7 dias antes'],
    ['mes', 'Este mês', () => { const h = hoje0(); return [new Date(h.getFullYear(), h.getMonth(), 1), U.somaDias(h, 1)]; }, 'mesmos dias do mês passado'],
    ['mesp', 'Mês passado', () => { const h = hoje0(); return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 1)]; }, 'mês anterior'],
    ['90d', '90 dias', () => [U.somaDias(hoje0(), -89), U.somaDias(hoje0(), 1)], '90 dias antes']
  ];
  const anterior = (id, de, ate) => {
    const dias = Math.round((ate - de) / 86400000);
    if (id === 'mes') { const d = new Date(de.getFullYear(), de.getMonth() - 1, 1); return [d, U.somaDias(d, Math.min(dias, Math.round((de - d) / 86400000)))]; }
    if (id === 'mesp') return [new Date(de.getFullYear(), de.getMonth() - 1, 1), de];
    return [U.somaDias(de, -dias), de];
  };
  let periodo = '7d', medida = 'valor', vez = 0;

  const delta = (agora, antes, rot) => {
    const v = An.variacao(agora, antes);
    if (v == null) return `<small class="delta">sem comparação</small>`;
    const sobe = v >= 0;
    return `<small class="delta ${sobe ? 'sobe' : 'desce'}">${sobe ? '▲' : '▼'} ${U.pct(Math.abs(v))} <span>vs. ${rot}</span></small>`;
  };

  // frases simples com o que os números mostram
  const leitura = (r, ant, desp) => {
    const f = [];
    const semana = Array.from(r.porSemana.values()).map((x) => ({ ...x, media: x.qtd / (r.diasDaSemana.get(x.rot) || 1) })).sort((a, b) => b.media - a.media);
    if (r.diasComMovimento >= 7 && semana.length > 1) f.push(`<b>${U.capitalizar(U.SEMANA_LONGA[semana[0].rot])}</b> é o dia mais forte (média de ${Math.round(semana[0].media)} carros) e <b>${U.SEMANA_LONGA[semana[semana.length - 1].rot]}</b> o mais fraco (${Math.round(semana[semana.length - 1].media)}). Vale uma promoção no dia fraco.`);
    const horas = An.ordenado(r.porHora, 'qtd');
    if (horas.length > 2 && r.carros >= 10) f.push(`O horário de pico é das <b>${horas[0].rot}h às ${horas[0].rot + 1}h</b>. Tenha a equipe completa nesse horário.`);
    const sv = An.ordenado(r.porServico, 'valor');
    if (sv.length > 1 && r.faturamento > 0) f.push(`<b>${U.esc(sv[0].rot)}</b> traz ${U.pct((sv[0].valor / r.faturamento) * 100)} do faturamento.`);
    if (r.carros >= 5) f.push(`<b>${U.pct((1 - r.novos / r.carros) * 100)}</b> dos carros são de clientes que já tinham vindo antes; ${r.novos} ${r.novos === 1 ? 'é de cliente novo' : 'são de clientes novos'}.`);
    if (r.tempoMedio > 0) f.push(`Do carro chegar até ficar pronto: <b>${U.duracao(r.tempoMedio)}</b> em média.`);
    if (r.premios) f.push(`${r.premios} prêmio${r.premios === 1 ? '' : 's'} de fidelidade usado${r.premios === 1 ? '' : 's'} (${U.brl(r.descontos)} em descontos).`);
    if (desp > 0 && r.faturamento > 0) f.push(`Depois das despesas lançadas (${U.brl(desp)}), sobram <b>${U.brl(r.faturamento - desp)}</b>.`);
    return f;
  };

  Telas.resultados = {
    titulo: 'Resultados', perfis: ['dono'], parado: true,
    render: async (el) => {
      const P = PERIODOS.find((p) => p[0] === periodo) || PERIODOS[2];
      const [de, ate] = P[2](), [ade, aate] = anterior(P[0], de, ate);
      const minha = ++vez;
      el.innerHTML = `<div class="chips rolar" id="rPer">${PERIODOS.map(([id, txt]) => `<button type="button" class="chip${id === P[0] ? ' ativo' : ''}" data-p="${id}">${txt}</button>`).join('')}</div>
        <div id="rCorpo"><div class="vazio"><div class="gira"></div><p class="mudo">Calculando…</p></div></div>`;
      el.querySelector('#rPer').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; periodo = b.dataset.p; App.render(); };

      const [lista, antes] = await Promise.all([DB.periodo(de, ate), DB.periodo(ade, aate)]);
      const corpo = el.querySelector('#rCorpo'); if (!corpo || minha !== vez) return;
      const r = An.resumo(lista), ant = An.resumo(antes);
      const desp = DB.despesasDe(de, ate).reduce((t, d) => t + (Number(d.valor) || 0), 0);
      if (!r.carros) { corpo.innerHTML = `<div class="vazio">${U.icon('grafico')}<p>Sem movimento neste período</p><p class="mudo">Os números aparecem conforme os carros são registrados.</p></div>`; return; }

      // colunas por dia (ou por hora, quando o período é um dia só)
      const umDia = P[0] === 'hoje', dinheiro = medida === 'valor';
      let colunas = [];
      if (umDia) for (let h = 7; h <= 19; h++) { const x = r.porHora.get(h) || { qtd: 0 }; colunas.push({ rot: h + 'h', valor: x.qtd, dica: `${h}h às ${h + 1}h: ${x.qtd} carro${x.qtd === 1 ? '' : 's'}` }); }
      else for (let d = new Date(de); d < ate; d = U.somaDias(d, 1)) {
        const k = U.dia(d), x = r.porDia.get(k) || { qtd: 0, valor: 0 };
        colunas.push({ rot: U.dataCurta(d), rotLonga: `${U.SEMANA[d.getDay()]} ${U.dataCurta(d)}`, valor: dinheiro ? x.valor : x.qtd, dica: `${U.SEMANA[d.getDay()]} ${U.dataCurta(d)}: ${x.qtd} carro${x.qtd === 1 ? '' : 's'} · ${U.brl(x.valor)}` });
      }
      const horas = []; for (let h = 7; h <= 19; h++) { const x = r.porHora.get(h) || { qtd: 0 }; horas.push({ rot: h + 'h', valor: x.qtd, dica: `${h}h às ${h + 1}h: ${x.qtd} carros no período` }); }
      const semana = [1, 2, 3, 4, 5, 6, 0].map((k) => { const x = r.porSemana.get(k) || { qtd: 0 }, n = r.diasDaSemana.get(k) || 1, m = Math.round((x.qtd / n) * 10) / 10; return { rot: U.SEMANA[k], valor: m, dica: `${U.capitalizar(U.SEMANA_LONGA[k])}: média de ${m.toLocaleString('pt-BR')} carros por dia` }; });
      const frases = leitura(r, ant, desp);

      corpo.innerHTML = `
        <div class="kpis">
          <div class="kpi principal"><span>Faturamento</span><b>${U.brl(r.faturamento)}</b>${delta(r.faturamento, ant.faturamento, P[3])}</div>
          <div class="kpi"><span>Carros</span><b>${r.carros}</b>${delta(r.carros, ant.carros, P[3])}</div>
          <div class="kpi"><span>Valor médio por carro</span><b>${U.brl(r.ticket)}</b>${delta(r.ticket, ant.ticket, P[3])}</div>
          <div class="kpi"><span>Clientes novos</span><b>${r.novos}</b>${delta(r.novos, ant.novos, P[3])}</div>
        </div>
        ${r.aReceber ? `<p class="mudo pequeno">Ainda no pátio (a receber): ${U.brl(r.aReceber)}.</p>` : ''}

        ${frases.length ? `<section class="cartao leitura"><div class="cartao-cab"><h3>O que os números dizem</h3></div><ul>${frases.map((x) => `<li>${x}</li>`).join('')}</ul></section>` : ''}

        <section class="cartao">
          <div class="cartao-cab"><h3>${umDia ? 'Carros por horário (hoje)' : dinheiro ? 'Faturamento por dia' : 'Carros por dia'}</h3>
            ${umDia ? '' : `<div class="seg" id="rMedida"><button type="button" class="${dinheiro ? 'ativo' : ''}" data-m="valor">R$</button><button type="button" class="${dinheiro ? '' : 'ativo'}" data-m="qtd">Carros</button></div>`}</div>
          ${Graf.colunas(colunas, { dinheiro: !umDia && dinheiro, titulo: 'Movimento por dia', cab: [umDia ? 'Horário' : 'Dia', !umDia && dinheiro ? 'Faturamento' : 'Carros'] })}
        </section>

        <section class="cartao">
          <div class="cartao-cab"><h3>Serviços mais vendidos</h3></div>
          ${Graf.barras(An.ordenado(r.porServico, 'qtd').map((x) => ({ rot: x.rot, valor: x.qtd, txt: `${x.qtd} · ${U.brl0(x.valor)}` })))}
        </section>

        ${umDia ? '' : `<div class="grade2">
          <section class="cartao"><div class="cartao-cab"><h3>Horários de pico</h3></div>${Graf.colunas(horas, { meia: true, titulo: 'Carros por horário', cab: ['Horário', 'Carros'] })}</section>
          <section class="cartao"><div class="cartao-cab"><h3>Média por dia da semana</h3></div>${Graf.colunas(semana, { meia: true, titulo: 'Média de carros por dia da semana', cab: ['Dia', 'Média de carros'] })}</section>
        </div>`}

        <div class="grade2">
          <section class="cartao"><div class="cartao-cab"><h3>Formas de pagamento</h3></div>${Graf.barras(An.ordenado(r.porPagamento, 'valor').map((x) => ({ rot: x.rot, valor: x.valor, txt: `${U.brl0(x.valor)} · ${U.pct((x.valor / (r.faturamento || 1)) * 100)}` })))}</section>
          <section class="cartao"><div class="cartao-cab"><h3>Tamanho dos veículos</h3></div>${Graf.barras(An.ordenado(r.porPorte, 'qtd').map((x) => ({ rot: x.rot, valor: x.qtd, txt: `${x.qtd} · ${U.pct((x.qtd / r.carros) * 100)}` })))}</section>
        </div>

        ${r.porLavador.size ? `<section class="cartao"><div class="cartao-cab"><h3>Quem lavou</h3></div>${Graf.barras(An.ordenado(r.porLavador, 'qtd').map((x) => ({ rot: x.rot, valor: x.qtd, txt: `${x.qtd} carro${x.qtd === 1 ? '' : 's'}` })))}</section>` : ''}

        <section class="cartao">
          <div class="cartao-cab"><h3>Resultado do período</h3><a class="link" href="#/financeiro">Lançar despesas</a></div>
          <div class="par"><span>Faturamento (carros entregues)</span><b>${U.brl(r.faturamento)}</b></div>
          <div class="par"><span>Despesas lançadas</span><b>− ${U.brl(desp)}</b></div>
          <div class="par total"><span>Sobra</span><b>${U.brl(r.faturamento - desp)}</b></div>
          ${r.cancelados ? `<p class="mudo pequeno">${r.cancelados} atendimento${r.cancelados === 1 ? '' : 's'} cancelado${r.cancelados === 1 ? '' : 's'} no período (não entram na conta).</p>` : ''}
        </section>`;
      Graf.ligar(corpo);
      const seg = corpo.querySelector('#rMedida');
      if (seg) seg.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; medida = b.dataset.m; App.render(); };
    }
  };
})();
