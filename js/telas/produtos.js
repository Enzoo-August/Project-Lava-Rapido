/* =========================================================
   Produtos — estoque do dono (shampoo, cera, panos…) e pedido
   de compra: põe no pedido o que está faltando e gera um PDF
   com a logo do lava para mandar ao fornecedor.
   O pedido em montagem fica só neste aparelho até virar PDF.
   ========================================================= */
(function () {
  const ABAS = [['estoque', 'Estoque'], ['pedido', 'Pedido'], ['historico', 'Pedidos feitos']];
  const qtdTxt = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace('.', ',');

  // ---------------- pedido em montagem (carrinho) ----------------
  const chave = () => 'pedido.' + (DB.lava().id || 'demo');
  const carrinho = () => (Store.pref(chave()) || []).filter((i) => Store.por('produtos', i.produto_id));
  const guardar = (l) => Store.pref(chave(), l);
  const sugerida = (p) => Math.max(1, Math.ceil((Number(p.minimo) || 0) * 2 - (Number(p.estoque) || 0)));
  const pedir = (p, qtd) => {
    const l = carrinho(), i = l.find((x) => x.produto_id === p.id);
    if (i) i.qtd = qtd != null ? qtd : i.qtd; else l.push({ produto_id: p.id, qtd: qtd != null ? qtd : sugerida(p) });
    guardar(l.filter((x) => x.qtd > 0));
  };

  // ---------------- cadastro do produto ----------------
  const formProduto = (p) => U.modal({
    titulo: p ? 'Produto' : 'Novo produto',
    html: `<label class="campo"><span>Nome do produto</span><input name="nome" value="${U.esc(p ? p.nome : '')}" placeholder="Ex.: Shampoo automotivo" autocapitalize="sentences"></label>
      <div class="lado">
        <label class="campo"><span>Valor (R$)</span><input name="preco" inputmode="decimal" value="${p ? qtdTxt(p.preco) : ''}" placeholder="0,00"></label>
        <label class="campo"><span>Embalagem</span><input name="unidade" value="${U.esc(p ? p.unidade : '')}" placeholder="un, galão 5 L…"></label>
      </div>
      <div class="lado">
        <label class="campo"><span>Tenho agora</span><input name="estoque" inputmode="decimal" value="${p ? qtdTxt(p.estoque) : ''}" placeholder="0"></label>
        <label class="campo"><span>Avisar quando tiver</span><input name="minimo" inputmode="decimal" value="${p ? qtdTxt(p.minimo) : ''}" placeholder="1"></label>
      </div>
      <label class="campo"><span>Fornecedor (opcional)</span><input name="fornecedor" value="${U.esc(p ? p.fornecedor : '')}" placeholder="De quem você compra" autocapitalize="words"></label>
      <p class="mudo pequeno">“Avisar quando tiver”: com essa quantidade ou menos, o produto aparece como acabando.</p>`,
    acoes: [
      ...(p ? [{ txt: 'Excluir', cls: 'btn-perigo', aoTocar: () => { DB.salvarProduto(p, { excluido: true }); return 'excluido'; } }] : [{ txt: 'Voltar', valor: false }]),
      { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => {
        const f = U.campos(el);
        if (f.nome.length < 2) { U.toast('Escreva o nome do produto.', 'bad'); return false; }
        DB.salvarProduto(p, { nome: f.nome, preco: U.num(f.preco), unidade: f.unidade || 'un', estoque: U.num(f.estoque), minimo: f.minimo === '' ? 1 : U.num(f.minimo), fornecedor: f.fornecedor });
        return 'salvo';
      } }
    ]
  });

  // ---------------- PDF do pedido (com a logo do lava) ----------------
  let jsPdf = null;
  const carregarPdf = () => jsPdf || (jsPdf = new Promise((res, rej) => {
    if (window.jspdf) return res(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => res(window.jspdf.jsPDF);
    s.onerror = () => { jsPdf = null; rej(new Error('Sem internet para gerar o PDF. Tente de novo com sinal.')); };
    document.head.appendChild(s);
  }));
  // a logo pode estar em webp: o PDF só aceita PNG/JPEG, então redesenha num canvas
  const logoPng = (src) => new Promise((res) => {
    if (!src) return res(null);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); res({ data: c.toDataURL('image/png'), w: c.width, h: c.height }); } catch (e) { res(null); } };
    img.onerror = () => res(null);
    img.src = src;
  });

  const gerarPdf = async (ped) => {
    const [PDF, logo] = await Promise.all([carregarPdf(), logoPng(DB.marca().logo)]);
    const doc = new PDF({ unit: 'mm', format: 'a4' }), m = DB.marca(), lava = DB.lava().nome;
    const cor = U.hexRgb(m.cor) || [11, 99, 206], L = 15, R = 195;
    let y = 16;
    if (logo) { const h = 22, w = Math.min(50, (logo.w / logo.h) * h); doc.addImage(logo.data, 'PNG', L, y, w, h); }
    const xNome = logo ? L + Math.min(50, (logo.w / logo.h) * 22) + 6 : L;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 24, 30); doc.text(lava, xNome, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(95, 105, 117);
    const contato = [m.telefone, m.endereco].filter(Boolean).join('  ·  ');
    if (contato) doc.text(doc.splitTextToSize(contato, R - xNome), xNome, y + 14);
    y += 30;
    doc.setDrawColor(cor[0], cor[1], cor[2]); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 24, 30); doc.text(`Pedido de compra nº ${ped.numero}`, L, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(60, 68, 78);
    doc.text(`Data: ${U.dataBR(ped.criado_em)}`, R, y, { align: 'right' }); y += 7;
    if (ped.fornecedor) { doc.text(`Para: ${ped.fornecedor}`, L, y); y += 6; }
    doc.text(`Pedido por: ${ped.criado_por || ''}`, L, y); y += 9;

    // tabela
    const col = [L, 112, 140, 165, R];   // produto | qtd | valor un. | subtotal
    const cab = () => {
      doc.setFillColor(cor[0], cor[1], cor[2]); doc.rect(L, y - 5, R - L, 8, 'F');
      const t = U.textoSobre(m.cor || '#0b63ce') === '#ffffff' ? 255 : 20; doc.setTextColor(t, t, t);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Produto', col[0] + 2, y); doc.text('Qtd', col[1] + 12, y, { align: 'right' }); doc.text('Valor un.', col[3] - 2, y, { align: 'right' }); doc.text('Subtotal', col[4] - 2, y, { align: 'right' });
      y += 8; doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 24, 30);
    };
    cab();
    (ped.itens || []).forEach((i, n) => {
      const nome = doc.splitTextToSize(i.nome + (i.unidade && i.unidade !== 'un' ? ` (${i.unidade})` : ''), col[1] - col[0] - 4);
      const alt = Math.max(7, nome.length * 4.6 + 2.4);
      if (y + alt > 270) { doc.addPage(); y = 20; cab(); }
      if (n % 2) { doc.setFillColor(244, 246, 249); doc.rect(L, y - 4.8, R - L, alt, 'F'); }
      doc.text(nome, col[0] + 2, y); doc.text(qtdTxt(i.qtd), col[1] + 12, y, { align: 'right' });
      doc.text(i.preco ? U.brl(i.preco) : '—', col[3] - 2, y, { align: 'right' }); doc.text(i.preco ? U.brl(i.qtd * i.preco) : '—', col[4] - 2, y, { align: 'right' });
      y += alt;
    });
    y += 3; doc.setDrawColor(210, 215, 222); doc.setLineWidth(0.3); doc.line(L, y - 4, R, y - 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Total estimado', col[2] - 20, y + 2); doc.text(U.brl(ped.total), col[4] - 2, y + 2, { align: 'right' }); y += 12;
    if (ped.obs) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(60, 68, 78); doc.text(doc.splitTextToSize('Observações: ' + ped.obs, R - L), L, y); }
    doc.setFontSize(8.5); doc.setTextColor(140, 148, 158); doc.text('Valores estimados pelo último preço cadastrado.', L, 287);

    const nomeArq = `pedido-${ped.numero}-${U.norm(lava).replace(/[^a-z0-9]+/g, '-')}.pdf`, arquivo = new File([doc.output('blob')], nomeArq, { type: 'application/pdf' });
    // no celular abre o "compartilhar" (WhatsApp, e-mail…); no computador baixa o arquivo
    if (navigator.canShare && navigator.canShare({ files: [arquivo] }) && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ files: [arquivo], title: `Pedido nº ${ped.numero}` }); } catch (e) {} return; }
    const url = URL.createObjectURL(arquivo), a = document.createElement('a');
    a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  const pdfComAviso = async (ped, b) => { if (b) b.disabled = true; try { await gerarPdf(ped); } catch (e) { U.toast(e.message || String(e), 'bad'); } if (b) b.disabled = false; };

  // ---------------- abas ----------------
  const estoque = (el) => {
    const l = DB.produtos(), faltam = l.filter(DB.acabando), noPed = new Set(carrinho().map((i) => i.produto_id)), bloq = DB.bloqueado();
    const valorEstoque = l.reduce((t, p) => t + Math.max(0, Number(p.estoque) || 0) * (Number(p.preco) || 0), 0);
    el.innerHTML = `
      ${faltam.length ? `<div class="aviso-caixa toque">${U.icon('alerta')}<span><b>${faltam.length} produto${faltam.length > 1 ? 's' : ''} acabando:</b> ${U.esc(faltam.slice(0, 4).map((p) => p.nome).join(', '))}${faltam.length > 4 ? '…' : ''}</span>${bloq ? '' : `<button type="button" class="btn btn-marca btn-p" id="pFaltam">Pôr no pedido</button>`}</div>` : ''}
      <section class="cartao">
        <div class="cartao-cab"><h3>Meus produtos</h3>${bloq ? '' : `<button class="btn btn-marca btn-p" id="pNovo">${U.icon('mais')}<span>Produto</span></button>`}</div>
        ${l.length ? `<div class="lista">${l.map((p) => `<div class="linha prod${DB.acabando(p) ? ' acabando' : ''}" data-p="${p.id}">
            <button type="button" class="linha-txt" data-editar><b>${U.esc(p.nome)}</b><small>${U.esc([p.preco ? U.brl(p.preco) : '', p.unidade, p.fornecedor].filter(Boolean).join(' · '))}</small></button>
            <div class="qtd" aria-label="Quantidade em estoque">
              <button type="button" class="ic-btn" data-mexe="-1" aria-label="Usei um" ${bloq ? 'disabled' : ''}>−</button>
              <b>${qtdTxt(p.estoque)}</b>
              <button type="button" class="ic-btn" data-mexe="1" aria-label="Chegou um" ${bloq ? 'disabled' : ''}>+</button>
            </div>
            ${bloq ? '' : `<button type="button" class="btn btn-p${noPed.has(p.id) ? ' no-pedido' : ''}" data-pedir>${U.icon(noPed.has(p.id) ? 'check' : 'carrinho')}<span>${noPed.has(p.id) ? 'No pedido' : 'Pedir'}</span></button>`}
          </div>`).join('')}</div>
          <p class="mudo pequeno">Use − quando gastar e + quando chegar. Valor do que tem em estoque: <b>${U.brl(valorEstoque)}</b>.</p>`
        : '<p class="mudo">Cadastre os produtos que você usa (shampoo, cera, pretinho, panos…), com o valor e quanto tem. Quando algum acabar, ponha no pedido e gere o PDF para o fornecedor.</p>'}
      </section>`;
    const nv = el.querySelector('#pNovo'); if (nv) nv.onclick = async () => { if (await formProduto(null)) { U.toast('Produto salvo'); App.render(); } };
    const fl = el.querySelector('#pFaltam'); if (fl) fl.onclick = () => { faltam.forEach((p) => { if (!noPed.has(p.id)) pedir(p); }); U.toast('Produtos acabando no pedido'); App.ir('produtos/pedido'); };
    el.querySelectorAll('[data-p]').forEach((row) => {
      const p = Store.por('produtos', row.dataset.p);
      row.onclick = async (e) => {
        if (e.target.closest('[data-editar]')) { if (bloq) return; const r = await formProduto(p); if (r) { U.toast(r === 'excluido' ? 'Produto excluído' : 'Produto salvo'); App.render(); } return; }
        const mx = e.target.closest('[data-mexe]');
        if (mx) { DB.salvarProduto(p, { estoque: Math.max(0, (Number(p.estoque) || 0) + Number(mx.dataset.mexe)) }); return App.render(); }
        if (e.target.closest('[data-pedir]')) {
          if (noPed.has(p.id)) { guardar(carrinho().filter((i) => i.produto_id !== p.id)); U.toast('Tirado do pedido'); }
          else { pedir(p); U.toast(`${p.nome} no pedido`); }
          App.render();
        }
      };
    });
  };

  const pedido = (el) => {
    const l = carrinho().map((i) => ({ ...i, p: Store.por('produtos', i.produto_id) }));
    const total = l.reduce((t, i) => t + i.qtd * (Number(i.p.preco) || 0), 0);
    const forn = Array.from(new Set(l.map((i) => i.p.fornecedor).filter(Boolean)));
    if (!l.length) {
      el.innerHTML = `<div class="vazio">${U.icon('carrinho')}<p>O pedido está vazio</p><p class="mudo">No Estoque, toque em “Pedir” nos produtos que estão faltando.</p><a class="btn btn-marca btn-g" href="#/produtos">${U.icon('caixa')}<span>Ver estoque</span></a></div>`;
      return;
    }
    el.innerHTML = `
      <section class="cartao">
        <div class="cartao-cab"><h3>Pedido de compra</h3><a class="link" href="#/produtos">+ Adicionar</a></div>
        <div class="lista">${l.map((i) => `<div class="linha prod" data-i="${i.produto_id}">
            <span class="linha-txt"><b>${U.esc(i.p.nome)}</b><small>${U.esc([i.p.unidade, i.p.preco ? U.brl(i.p.preco) + ' cada' : 'sem valor'].filter(Boolean).join(' · '))} · tem ${qtdTxt(i.p.estoque)}</small></span>
            <div class="qtd"><button type="button" class="ic-btn" data-q="-1" aria-label="Menos">−</button><b>${qtdTxt(i.qtd)}</b><button type="button" class="ic-btn" data-q="1" aria-label="Mais">+</button></div>
            <b class="sub">${i.p.preco ? U.brl(i.qtd * i.p.preco) : '—'}</b>
          </div>`).join('')}</div>
        <div class="par total"><span>Total estimado</span><b>${U.brl(total)}</b></div>
      </section>
      <section class="cartao">
        <label class="campo"><span>Para qual fornecedor (opcional)</span><input id="pForn" value="${U.esc(forn.length === 1 ? forn[0] : '')}" placeholder="Nome do fornecedor" autocapitalize="words"></label>
        <label class="campo"><span>Observação (opcional)</span><input id="pObs" placeholder="Ex.: entregar até sexta" autocapitalize="sentences"></label>
        <button type="button" class="btn btn-marca btn-g btn-bloco" id="pGerar">${U.icon('lista')}<span>Gerar PDF do pedido</span></button>
        <button type="button" class="link centro" id="pLimpar">Esvaziar pedido</button>
      </section>`;
    el.querySelectorAll('[data-i]').forEach((row) => {
      row.onclick = (e) => { const b = e.target.closest('[data-q]'); if (!b) return; const it = carrinho().find((x) => x.produto_id === row.dataset.i); pedir(Store.por('produtos', row.dataset.i), Math.max(0, it.qtd + Number(b.dataset.q))); App.render(); };
    });
    el.querySelector('#pLimpar').onclick = async () => { if (await U.confirmar('Esvaziar o pedido?', 'Os produtos continuam cadastrados no estoque.', 'Esvaziar', 'btn-perigo')) { guardar([]); App.render(); } };
    el.querySelector('#pGerar').onclick = async (e) => {
      const itens = l.map((i) => ({ produto_id: i.produto_id, nome: i.p.nome, unidade: i.p.unidade || '', qtd: i.qtd, preco: Number(i.p.preco) || 0 }));
      const ped = DB.salvarPedido(null, { itens, fornecedor: el.querySelector('#pForn').value.trim(), obs: el.querySelector('#pObs').value.trim() });
      guardar([]);
      await pdfComAviso(ped, e.currentTarget);
      U.toast(`Pedido nº ${ped.numero} salvo`);
      App.ir('produtos/historico');
    };
  };

  const historico = (el) => {
    const l = DB.pedidos();
    if (!l.length) { el.innerHTML = `<div class="vazio">${U.icon('lista')}<p>Nenhum pedido feito</p><p class="mudo">Os pedidos que você gerar aparecem aqui, para baixar de novo e marcar quando chegarem.</p></div>`; return; }
    el.innerHTML = `<section class="cartao"><div class="lista">${l.map((p) => `<button type="button" class="linha" data-ped="${p.id}">
        <span class="linha-txt"><b>Pedido nº ${p.numero}${p.fornecedor ? ' · ' + U.esc(p.fornecedor) : ''}</b><small>${U.dataBR(p.criado_em)} · ${(p.itens || []).length} ite${(p.itens || []).length === 1 ? 'm' : 'ns'} · ${U.brl(p.total)}</small></span>
        <span class="chip-st ${p.status === 'recebido' ? 'bom' : 'aviso'}">${p.status === 'recebido' ? 'Chegou' : 'Aguardando'}</span></button>`).join('')}</div></section>`;
    el.querySelectorAll('[data-ped]').forEach((b) => {
      b.onclick = async () => {
        const p = Store.por('pedidos', b.dataset.ped), bloq = DB.bloqueado();
        const r = await U.modal({
          titulo: `Pedido nº ${p.numero}`, empilhar: true,
          html: `${(p.itens || []).map((i) => `<div class="par"><span>${qtdTxt(i.qtd)} × ${U.esc(i.nome)}</span><b>${i.preco ? U.brl(i.qtd * i.preco) : '—'}</b></div>`).join('')}
            <div class="par total"><span>Total estimado</span><b>${U.brl(p.total)}</b></div>
            <p class="mudo pequeno">Feito em ${U.dataBR(p.criado_em)} por ${U.esc(p.criado_por || '')}${p.recebido_em ? ` · chegou em ${U.dataBR(p.recebido_em)}` : ''}.</p>`,
          acoes: [
            { txt: 'Baixar o PDF de novo', icone: 'lista', valor: 'pdf' },
            ...(!bloq && p.status !== 'recebido' ? [{ txt: 'Chegou: somar no estoque', cls: 'btn-marca', icone: 'check', valor: 'chegou' }] : []),
            ...(!bloq ? [{ txt: 'Excluir pedido', cls: 'btn-perigo', valor: 'excluir' }] : [])
          ]
        });
        if (r === 'pdf') pdfComAviso(p);
        if (r === 'chegou') { DB.receberPedido(p); U.toast('Estoque atualizado'); App.render(); }
        if (r === 'excluir' && await U.confirmar('Excluir este pedido?', p.status === 'recebido' ? 'O estoque não muda.' : '', 'Excluir', 'btn-perigo')) { DB.salvarPedido(p, { excluido: true }); App.render(); }
      };
    });
  };

  Telas.produtos = {
    titulo: (args) => ({ pedido: 'Pedido de compra', historico: 'Pedidos feitos' }[args[0]] || 'Produtos'),
    perfis: ['dono'],
    render: (el, args) => {
      const aba = ABAS.some((x) => x[0] === args[0]) ? args[0] : 'estoque';
      const n = { estoque: DB.produtos().length, pedido: carrinho().length, historico: DB.pedidos().filter((p) => p.status !== 'recebido').length };
      el.innerHTML = `<div class="abas">${ABAS.map(([id, txt]) => `<a href="#/produtos/${id === 'estoque' ? '' : id}" class="${id === aba ? 'ativo' : ''}">${txt}${n[id] ? `<span>${n[id]}</span>` : ''}</a>`).join('')}</div><div id="prCorpo"></div>`;
      ({ estoque, pedido, historico })[aba](el.querySelector('#prCorpo'));
    }
  };
})();
