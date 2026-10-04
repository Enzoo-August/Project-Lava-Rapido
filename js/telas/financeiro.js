/* =========================================================
   Financeiro — o mês do dono: quanto entrou, quanto saiu,
   quanto sobrou. Despesas lançadas à mão, movimento dia a dia
   e planilha do mês para o contador.
   ========================================================= */
(function () {
  let mes = null, vez = 0;   // primeiro dia do mês mostrado
  const CATEGORIAS = ['Aluguel', 'Salários', 'Água', 'Luz', 'Produtos', 'Manutenção', 'Impostos', 'Outros'];

  const formDespesa = (d) => U.modal({
    titulo: d ? 'Despesa' : 'Lançar despesa',
    html: `<label class="campo"><span>O que foi</span><input name="descricao" value="${U.esc(d ? d.descricao : '')}" placeholder="Ex.: conta de água" autocapitalize="sentences"></label>
      <div class="lado">
        <label class="campo"><span>Valor (R$)</span><input name="valor" inputmode="decimal" value="${d ? String(d.valor).replace('.', ',') : ''}" placeholder="0,00"></label>
        <label class="campo"><span>Data</span><input name="data" type="date" value="${d ? d.data : U.dia()}"></label>
      </div>
      <label class="campo"><span>Tipo</span><select name="categoria">${CATEGORIAS.map((c) => `<option${d && d.categoria === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>`,
    acoes: [
      ...(d ? [{ txt: 'Excluir', cls: 'btn-perigo', aoTocar: () => { DB.salvarDespesa(d, { excluido: true }); return 'excluida'; } }] : [{ txt: 'Voltar', valor: false }]),
      { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => {
        const f = U.campos(el), valor = U.num(f.valor);
        if (!f.descricao) { U.toast('Escreva o que foi a despesa.', 'bad'); return false; }
        if (valor <= 0) { U.toast('Informe o valor.', 'bad'); return false; }
        if (!f.data) { U.toast('Informe a data.', 'bad'); return false; }
        DB.salvarDespesa(d, { descricao: f.descricao, valor, data: f.data, categoria: f.categoria });
        return 'salva';
      } }
    ]
  });

  // planilha (CSV) do mês: abre no Excel e serve para o contador
  const planilha = (lista, rotulo) => {
    const cel = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const linhas = [['Data', 'Hora', 'Ficha', 'Placa', 'Veículo', 'Cliente', 'Serviços', 'Valor', 'Desconto', 'Total', 'Pagamento', 'Situação', 'Quem lavou'].map(cel).join(';')];
    for (const a of lista) {
      const c = DB.cliente(a.cliente_id);
      linhas.push([U.dataBR(a.entrada_em), U.hora(a.entrada_em), a.numero, U.placaFmt(a.placa), a.veiculo, c ? c.nome : '', (a.servicos || []).map((s) => s.nome).join(' + '),
        String(a.valor).replace('.', ','), String(a.desconto).replace('.', ','), String(a.total).replace('.', ','), a.pagamento || '', DB.STATUS[a.status], a.lavador || ''].map(cel).join(';'));
    }
    const arquivo = new File(['﻿' + linhas.join('\r\n')], `lava-rapido-${rotulo}.csv`, { type: 'text/csv' });
    // no celular usa "compartilhar" (baixar direto trava o aplicativo instalado no iPhone)
    if (navigator.canShare && navigator.canShare({ files: [arquivo] }) && matchMedia('(pointer: coarse)').matches) { navigator.share({ files: [arquivo], title: arquivo.name }).catch(() => {}); return; }
    const url = URL.createObjectURL(arquivo), a = document.createElement('a');
    a.href = url; a.download = arquivo.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  Telas.financeiro = {
    titulo: 'Financeiro', perfis: ['dono'], parado: true,
    render: async (el) => {
      const h = U.inicioDia();
      if (!mes) mes = new Date(h.getFullYear(), h.getMonth(), 1);
      const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 1), atual = mes.getFullYear() === h.getFullYear() && mes.getMonth() === h.getMonth();
      const rotulo = `${U.MESES[mes.getMonth()]} de ${mes.getFullYear()}`, minha = ++vez;
      el.innerHTML = `<div class="mes-nav"><button class="ic-btn" data-m="-1" aria-label="Mês anterior">${U.icon('voltar')}</button><b>${U.capitalizar(rotulo)}</b><button class="ic-btn" data-m="1" aria-label="Próximo mês" ${atual ? 'disabled' : ''}>${U.icon('seta')}</button></div>
        <div id="fCorpo"><div class="vazio"><div class="gira"></div><p class="mudo">Calculando…</p></div></div>`;
      el.querySelector('.mes-nav').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || b.disabled) return; mes = new Date(mes.getFullYear(), mes.getMonth() + Number(b.dataset.m), 1); App.render(); };

      const lista = await DB.periodo(mes, fim);
      const corpo = el.querySelector('#fCorpo'); if (!corpo || minha !== vez) return;
      const r = An.resumo(lista, mes, fim);
      const desp = DB.despesasDe(mes, fim).sort((a, b) => (a.data > b.data ? -1 : 1));
      const saiu = desp.reduce((t, d) => t + (Number(d.valor) || 0), 0), sobra = r.faturamento - saiu;
      const porCat = new Map(); desp.forEach((d) => porCat.set(d.categoria || 'Outros', (porCat.get(d.categoria || 'Outros') || 0) + Number(d.valor)));
      const dias = An.ordenado(r.porDia, 'rot').sort((a, b) => (a.rot > b.rot ? -1 : 1));

      corpo.innerHTML = `
        <div class="kpis tres">
          <div class="kpi"><span>Entrou</span><b>${U.brl(r.faturamento)}</b><small class="delta">${r.entregues} carro${r.entregues === 1 ? '' : 's'} entregue${r.entregues === 1 ? '' : 's'}</small></div>
          <div class="kpi"><span>Saiu</span><b>${U.brl(saiu)}</b><small class="delta">${desp.length} despesa${desp.length === 1 ? '' : 's'}</small></div>
          <div class="kpi principal"><span>Sobrou</span><b>${U.brl(sobra)}</b><small class="delta ${sobra >= 0 ? 'sobe' : 'desce'}">${r.faturamento > 0 ? U.pct((sobra / r.faturamento) * 100) + ' do que entrou' : '&nbsp;'}</small></div>
        </div>

        <section class="cartao">
          <div class="cartao-cab"><h3>Despesas</h3>${DB.bloqueado() ? '' : `<button class="btn btn-marca btn-p" id="fNova">${U.icon('mais')}<span>Lançar</span></button>`}</div>
          ${desp.length ? `${Graf.barras(Array.from(porCat, ([rot, valor]) => ({ rot, valor, txt: U.brl0(valor) })).sort((a, b) => b.valor - a.valor))}
            <div class="lista">${desp.map((d) => `<button type="button" class="linha" data-d="${d.id}"><span class="linha-txt"><b>${U.esc(d.descricao || d.categoria)}</b><small>${U.dataCurta(U.deDia(d.data))} · ${U.esc(d.categoria || '')}</small></span><b>${U.brl(d.valor)}</b></button>`).join('')}</div>`
            : '<p class="mudo">Nenhuma despesa lançada neste mês. Lance aluguel, água, luz, produtos e salários para ver quanto sobra de verdade.</p>'}
        </section>

        <section class="cartao">
          <div class="cartao-cab"><h3>Dia a dia</h3>${lista.length ? `<button class="btn btn-p" id="fPlanilha">${U.icon('lista')}<span>Planilha do mês</span></button>` : ''}</div>
          ${dias.length ? `<div class="tabela-rolar"><table class="tabela"><thead><tr><th>Dia</th><th>Carros</th><th>Recebido</th></tr></thead><tbody>
            ${dias.map((d) => { const dt = U.deDia(d.rot); return `<tr><td>${U.SEMANA[dt.getDay()]} ${U.dataCurta(dt)}</td><td>${d.qtd}</td><td>${U.brl(d.valor)}</td></tr>`; }).join('')}
            </tbody><tfoot><tr><td>Total</td><td>${r.carros}</td><td>${U.brl(r.faturamento)}</td></tr></tfoot></table></div>` : '<p class="mudo">Sem movimento neste mês.</p>'}
        </section>`;

      const nova = corpo.querySelector('#fNova'); if (nova) nova.onclick = async () => { if (await formDespesa(null)) { U.toast('Despesa lançada'); App.render(); } };
      const pl = corpo.querySelector('#fPlanilha'); if (pl) pl.onclick = () => planilha(lista, `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`);
      corpo.querySelectorAll('[data-d]').forEach((b) => { b.onclick = async () => { if (DB.bloqueado()) return; const r2 = await formDespesa(Store.por('despesas', b.dataset.d)); if (r2) { U.toast(r2 === 'excluida' ? 'Despesa excluída' : 'Despesa salva'); App.render(); } }; });
    }
  };
})();
