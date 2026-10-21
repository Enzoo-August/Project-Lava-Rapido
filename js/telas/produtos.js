/* =========================================================
   Produtos — estoque do dono (shampoo, cera, panos…) e pedido
   de compra ao fornecedor.
   - Estoque: valor, embalagem, quanto tem, aviso de acabando.
   - Pedido: itens do estoque ou produtos novos, fornecedor,
     forma de pagamento (parcelas no cartão, vencimento no boleto),
     frete e prazo. Vira PDF com a
     logo do lava (salvar como, imprimir, mandar no WhatsApp).
   - Chegou: soma no estoque (produto novo pode entrar no estoque)
     e lança o valor nas despesas do mês.
   O pedido em montagem fica só neste aparelho até ser salvo.
   ========================================================= */
(function () {
  const ABAS = [['estoque', 'Estoque'], ['pedido', 'Pedido'], ['historico', 'Pedidos feitos']];
  const PAGAMENTOS = ['Pix', 'Boleto', 'Cartão de crédito', 'Dinheiro', 'A combinar'];
  const VENC_BOLETO = ['À vista', '7 dias', '14 dias', '21 dias', '28 dias', '30 dias', '30/60 dias', '30/60/90 dias'];
  const FRETES = [['gratis', 'Grátis'], ['pago', 'Pago'], ['retirar', 'Vou buscar']];
  const qtdTxt = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace('.', ',');
  const toque = () => matchMedia('(pointer: coarse)').matches;

  // ---------------- pedido em montagem (rascunho neste aparelho) ----------------
  const chave = () => 'pedido.' + (DB.lava().id || 'demo');
  const novoRascunho = () => ({ itens: [], fornecedor: '', fone: '', pagamento: 'Pix', parcelas: 1, boleto: 'À vista', condicao: '', frete_tipo: 'gratis', frete: 0, desconto: 0, entrega: '', obs: '', editando: null });
  const rascunho = () => {
    let r = Store.pref(chave());
    if (Array.isArray(r)) r = { itens: r };   // formato antigo: só a lista
    r = { ...novoRascunho(), ...(r || {}) };
    r.itens = (r.itens || []).map((i) => {
      const p = i.produto_id ? Store.por('produtos', i.produto_id) : null;
      if (i.produto_id && (!p || p.excluido)) return null;
      return { produto_id: i.produto_id || null, nome: i.nome || (p ? p.nome : ''), unidade: i.unidade != null ? i.unidade : (p ? p.unidade : ''), qtd: Number(i.qtd) || 0, preco: i.preco != null ? Number(i.preco) : (p ? Number(p.preco) || 0 : 0), cadastrar: !!i.cadastrar };
    }).filter((i) => i && i.qtd > 0);
    if (!PAGAMENTOS.includes(r.pagamento)) r.pagamento = 'A combinar';   // rascunho antigo (débito, transferência)
    return r;
  };
  // texto da condição: só o cartão (parcelas) e o boleto (vencimento) têm
  const condicaoDe = (r) => {
    if (r.pagamento === 'Cartão de crédito') { const n = Number(r.parcelas) || 1; return n > 1 ? `${n}x de ${U.brl(contas(r).total / n)}` : 'à vista'; }
    if (r.pagamento === 'Boleto') return String(r.boleto || 'À vista').toLowerCase();
    return '';
  };
  const guardar = (r) => Store.pref(chave(), r);
  const sugerida = (p) => Math.max(1, Math.ceil((Number(p.minimo) || 0) * 2 - (Number(p.estoque) || 0)));
  const noPedido = (r, id) => r.itens.find((i) => i.produto_id === id);
  const pedir = (p, qtd) => {
    const r = rascunho(), i = noPedido(r, p.id);
    if (i) i.qtd = qtd != null ? qtd : i.qtd;
    else r.itens.push({ produto_id: p.id, nome: p.nome, unidade: p.unidade || '', qtd: qtd != null ? qtd : sugerida(p), preco: Number(p.preco) || 0, cadastrar: false });
    r.itens = r.itens.filter((x) => x.qtd > 0);
    if (!r.fornecedor && p.fornecedor) r.fornecedor = p.fornecedor;
    guardar(r);
  };
  const contas = (r) => {
    const sub = (r.itens || []).reduce((t, i) => t + (Number(i.qtd) || 0) * (Number(i.preco) || 0), 0);
    const frete = r.frete_tipo === 'pago' ? Number(r.frete) || 0 : 0, desc = Math.min(sub, Number(r.desconto) || 0);
    return { sub, frete, desc, total: Math.max(0, sub - desc + frete) };
  };
  const freteTxt = (p) => (p.frete_tipo === 'pago' ? (p.frete ? U.brl(p.frete) : 'a pagar') : p.frete_tipo === 'retirar' ? 'vou buscar' : 'grátis');
  // fornecedores já usados (sugestão ao digitar), com o último WhatsApp de cada um
  const fornecedores = () => {
    const m = new Map();
    for (const p of DB.produtos()) if (p.fornecedor && !m.has(p.fornecedor)) m.set(p.fornecedor, '');
    for (const p of DB.pedidos().slice().reverse()) if (p.fornecedor) m.set(p.fornecedor, p.fone || m.get(p.fornecedor) || '');
    return m;
  };
  // quanto de cada produto já está pedido e ainda não chegou
  const aCaminho = () => { const m = new Map(); for (const p of DB.pedidos()) if (p.status === 'aberto') for (const i of p.itens || []) if (i.produto_id) m.set(i.produto_id, (m.get(i.produto_id) || 0) + (Number(i.qtd) || 0)); return m; };

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
      <label class="campo"><span>Fornecedor (opcional)</span><input name="fornecedor" list="listaForn" value="${U.esc(p ? p.fornecedor : '')}" placeholder="De quem você compra" autocapitalize="words"></label>
      <datalist id="listaForn">${Array.from(fornecedores().keys()).map((f) => `<option value="${U.esc(f)}">`).join('')}</datalist>
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

  // ---------------- item do pedido (do estoque ou produto novo) ----------------
  const formItem = (it, nomeInicial) => U.modal({
    titulo: it ? 'Item do pedido' : 'Produto novo no pedido',
    html: `${it && it.produto_id ? `<p class="txt"><b>${U.esc(it.nome)}</b></p>` : `<label class="campo"><span>Nome do produto</span><input name="nome" value="${U.esc(it ? it.nome : nomeInicial || '')}" placeholder="Ex.: Cera de carnaúba" autocapitalize="sentences"></label>`}
      <div class="lado">
        <label class="campo"><span>Quantidade</span><input name="qtd" inputmode="decimal" value="${it ? qtdTxt(it.qtd) : '1'}"></label>
        <label class="campo"><span>Valor de cada (R$)</span><input name="preco" inputmode="decimal" value="${it && it.preco ? qtdTxt(it.preco) : ''}" placeholder="0,00"></label>
      </div>
      <label class="campo"><span>Embalagem (opcional)</span><input name="unidade" value="${U.esc(it ? it.unidade : '')}" placeholder="un, galão 5 L, caixa com 12…"></label>
      ${it && it.produto_id ? '' : `<label class="chave"><input type="checkbox" name="cadastrar" ${!it || it.cadastrar ? 'checked' : ''}><span>Pôr no meu estoque quando chegar<small>O produto entra na lista do Estoque com a quantidade que chegou.</small></span></label>`}`,
    acoes: [
      ...(it ? [{ txt: 'Tirar do pedido', cls: 'btn-perigo', valor: 'tirar' }] : [{ txt: 'Voltar', valor: false }]),
      { txt: it ? 'Salvar' : 'Pôr no pedido', cls: 'btn-marca', aoTocar: (el) => {
        const f = U.campos(el), nome = it && it.produto_id ? it.nome : f.nome, qtd = U.num(f.qtd);
        if (!nome || nome.length < 2) { U.toast('Escreva o nome do produto.', 'bad'); return false; }
        if (qtd <= 0) { U.toast('Informe a quantidade.', 'bad'); return false; }
        return { nome, qtd, preco: U.num(f.preco), unidade: f.unidade, cadastrar: it && it.produto_id ? false : !!f.cadastrar };
      } }
    ]
  });

  // escolher o que pôr no pedido: busca no estoque ou digita um produto novo
  const adicionar = () => U.modal({
    titulo: 'Pôr no pedido',
    html: `<label class="campo busca">${U.icon('busca')}<input id="adBusca" placeholder="Procurar no estoque ou digitar um novo" autocapitalize="sentences"></label>
      <div class="lista" id="adLista"></div>
      <button type="button" class="btn btn-bloco" id="adNovo">${U.icon('mais')}<span>Produto que não está no estoque</span></button>`,
    aoAbrir: (el, fechar) => {
      const busca = el.querySelector('#adBusca'), lista = el.querySelector('#adLista');
      const pintar = () => {
        const r = rascunho(), q = U.norm(busca.value), l = DB.produtos().filter((p) => !q || U.norm(p.nome + ' ' + (p.fornecedor || '')).includes(q)).slice(0, 30);
        lista.innerHTML = l.length ? l.map((p) => `<button type="button" class="linha" data-add="${p.id}"><span class="linha-txt"><b>${U.esc(p.nome)}</b><small>${U.esc([p.unidade, p.preco ? U.brl(p.preco) : '', 'tem ' + qtdTxt(p.estoque)].filter(Boolean).join(' · '))}</small></span>${noPedido(r, p.id) ? `<span class="chip-st bom">${U.icon('check')}<span>no pedido</span></span>` : U.icon('mais')}</button>`).join('')
          : `<p class="mudo">${q ? 'Nada no estoque com esse nome. Toque abaixo para pôr como produto novo.' : 'Nenhum produto no estoque ainda.'}</p>`;
      };
      pintar(); busca.oninput = pintar; setTimeout(() => { if (!toque()) busca.focus(); }, 50);
      lista.onclick = (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const p = Store.por('produtos', b.dataset.add); if (!noPedido(rascunho(), p.id)) pedir(p); U.toast(`${p.nome} no pedido`); fechar('ok'); };
      el.querySelector('#adNovo').onclick = async () => {
        const nome = busca.value.trim(); fechar(); const f = await formItem(null, nome);
        if (f && typeof f === 'object') { const r = rascunho(); r.itens.push({ produto_id: null, ...f }); guardar(r); U.toast(`${f.nome} no pedido`); App.render(); }
      };
    }
  });

  // ---------------- PDF do pedido (com a logo do lava) ----------------
  let jsPdf = null;
  const carregarPdf = () => jsPdf || (jsPdf = new Promise((res, rej) => {
    if (window.jspdf) return res(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => res(window.jspdf.jsPDF);
    s.onerror = () => { jsPdf = null; s.remove(); rej(new Error('Sem internet para gerar o PDF. Tente de novo com sinal.')); };
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
  const nomeArquivo = (ped) => `Pedido de compra ${ped.numero}${ped.fornecedor ? ' - ' + ped.fornecedor.replace(/[\\/:*?"<>|]+/g, ' ').trim() : ''}.pdf`;

  const gerarPdf = async (ped) => {
    const [PDF, logo] = await Promise.all([carregarPdf(), logoPng(App.urlLogo(DB.marca().logo))]);
    const doc = new PDF({ unit: 'mm', format: 'a4' }), m = DB.marca(), lava = DB.lava().nome, c = contas(ped);
    const cor = U.hexRgb(m.cor) || [11, 99, 206], L = 15, R = 195;
    const cinza = () => doc.setTextColor(95, 105, 117), preto = () => doc.setTextColor(20, 24, 30);
    let y = 16;
    const lw = logo ? Math.min(50, (logo.w / logo.h) * 22) : 0;
    if (logo) doc.addImage(logo.data, 'PNG', L, y, lw, 22);
    const xNome = logo ? L + lw + 6 : L;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); preto(); doc.text(lava, xNome, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); cinza();
    const contato = [m.telefone ? U.telFmt(m.telefone) : '', m.endereco].filter(Boolean).join('  ·  ');
    if (contato) doc.text(doc.splitTextToSize(contato, R - xNome), xNome, y + 14);
    y += 30;
    doc.setDrawColor(cor[0], cor[1], cor[2]); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); preto(); doc.text(`Pedido de compra nº ${ped.numero}`, L, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); cinza(); doc.text(`Data: ${U.dataBR(ped.criado_em)}`, R, y, { align: 'right' }); y += 8;
    // quadro: fornecedor à esquerda, pagamento e entrega à direita
    const info = (rot, txt, x, yy) => { doc.setFont('helvetica', 'bold'); preto(); doc.text(rot, x, yy); const w = doc.getTextWidth(rot) + 2; doc.setFont('helvetica', 'normal'); cinza(); const t = doc.splitTextToSize(txt, 85 - w); doc.text(t, x + w, yy); return yy + 5.2 * t.length + 0.8; };
    doc.setFontSize(10.5);
    let yE = y, yD = y;
    yE = info('Fornecedor:', ped.fornecedor || '—', L, yE);
    if (ped.fone) yE = info('WhatsApp:', U.telFmt(ped.fone), L, yE);
    yE = info('Pedido por:', ped.criado_por || '', L, yE);
    yD = info('Pagamento:', [ped.pagamento, ped.condicao].filter(Boolean).join(' · ') || 'a combinar', 108, yD);
    yD = info('Frete:', freteTxt(ped), 108, yD);
    if (ped.entrega) yD = info('Entregar até:', U.dataBR(ped.entrega), 108, yD);
    y = Math.max(yE, yD) + 4;

    // tabela
    const col = [L, 112, 140, 165, R];
    const cab = () => {
      doc.setFillColor(cor[0], cor[1], cor[2]); doc.rect(L, y - 5, R - L, 8, 'F');
      const t = U.textoSobre(m.cor || '#0b63ce') === '#ffffff' ? 255 : 20; doc.setTextColor(t, t, t);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Produto', col[0] + 2, y); doc.text('Qtd', col[1] + 12, y, { align: 'right' }); doc.text('Valor un.', col[3] - 2, y, { align: 'right' }); doc.text('Subtotal', col[4] - 2, y, { align: 'right' });
      y += 8; doc.setFont('helvetica', 'normal'); preto();
    };
    cab();
    (ped.itens || []).forEach((i, n) => {
      const nome = doc.splitTextToSize(i.nome + (i.unidade && i.unidade !== 'un' ? ` (${i.unidade})` : ''), col[1] - col[0] - 4);
      const alt = Math.max(7, nome.length * 4.6 + 2.4);
      if (y + alt > 262) { doc.addPage(); y = 20; cab(); }
      if (n % 2) { doc.setFillColor(244, 246, 249); doc.rect(L, y - 4.8, R - L, alt, 'F'); }
      doc.text(nome, col[0] + 2, y); doc.text(qtdTxt(i.qtd), col[1] + 12, y, { align: 'right' });
      doc.text(i.preco ? U.brl(i.preco) : '—', col[3] - 2, y, { align: 'right' }); doc.text(i.preco ? U.brl(i.qtd * i.preco) : '—', col[4] - 2, y, { align: 'right' });
      y += alt;
    });
    if (y > 240) { doc.addPage(); y = 20; }
    y += 2; doc.setDrawColor(210, 215, 222); doc.setLineWidth(0.3); doc.line(L, y - 4, R, y - 4);
    const soma = (rot, val, forte) => { doc.setFont('helvetica', forte ? 'bold' : 'normal'); doc.setFontSize(forte ? 12.5 : 10.5); if (forte) preto(); else cinza(); doc.text(rot, col[2] - 20, y); doc.text(val, col[4] - 2, y, { align: 'right' }); y += forte ? 8 : 6; };
    if (c.desc || c.frete) soma('Produtos', U.brl(c.sub));
    if (c.desc) soma('Desconto', '- ' + U.brl(c.desc));   // a fonte do PDF não tem o sinal “−”
    if (c.frete) soma('Frete', U.brl(c.frete));
    soma('Total', U.brl(c.total), true);
    y += 4;
    if (ped.obs) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); cinza(); doc.text(doc.splitTextToSize('Observações: ' + ped.obs, R - L), L, y); }
    doc.setFontSize(8.5); doc.setTextColor(140, 148, 158); doc.text('Valores pelo último preço cadastrado; o fornecedor confirma os valores finais.', L, 287);
    return new File([doc.output('blob')], nomeArquivo(ped), { type: 'application/pdf' });
  };

  // ---------------- o que fazer com o PDF ----------------
  const baixar = (arq) => { const url = URL.createObjectURL(arq), a = document.createElement('a'); a.href = url; a.download = arq.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000); };
  const podeCompartilhar = (arq) => !!(navigator.canShare && navigator.canShare({ files: [arq] }));
  const compartilhar = async (arq, titulo) => { try { await navigator.share({ files: [arq], title: titulo }); return true; } catch (e) { return !!e && e.name === 'AbortError'; } };
  // computador: janela "Salvar como" para escolher a pasta (Chrome/Edge); nos outros, baixa
  const salvarComo = async (arqP, nome) => {
    if (typeof window.showSaveFilePicker !== 'function' || toque()) { baixar(await arqP); U.toast('PDF baixado'); return; }
    let h;
    try { h = await window.showSaveFilePicker({ suggestedName: nome, id: 'lava-pedidos', startIn: 'documents', types: [{ description: 'Documento em PDF', accept: { 'application/pdf': ['.pdf'] } }] }); }
    catch (e) { if (e && e.name === 'AbortError') return; baixar(await arqP); U.toast('PDF baixado'); return; }
    try { const w = await h.createWritable(); await w.write(await arqP); await w.close(); U.toast('PDF salvo na pasta escolhida'); }
    catch (e) { baixar(await arqP); U.toast('PDF baixado'); }
  };
  const imprimir = (arq) => {
    const url = URL.createObjectURL(arq), fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
    fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(url, '_blank'); } };
    fr.src = url; document.body.appendChild(fr);
    setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 120000);
  };
  // no celular o "compartilhar" só abre num toque, sem espera no meio: se o PDF não estava pronto, pede um toque novo
  const pdfPronto = (arq, titulo) => U.modal({ titulo: 'PDF pronto', html: '<p class="txt">Toque em “Abrir agora” e escolha WhatsApp, e-mail ou “Salvar em Arquivos”.</p>', acoes: [{ txt: 'Abrir agora', cls: 'btn-marca', aoTocar: async () => { if (!(await compartilhar(arq, titulo))) baixar(arq); return true; } }] });

  // ---------------- janela do pedido salvo ----------------
  const verPedido = async (p) => {
    const titulo = `Pedido de compra nº ${p.numero}`, c = contas(p), bloq = DB.bloqueado();
    let arq = null, erro = null;
    const preparo = gerarPdf(p).then((f) => { arq = f; }).catch((e) => { erro = e; });
    const pegar = async () => { await preparo; if (!arq) throw erro || new Error('Não consegui gerar o PDF.'); return arq; };
    const st = p.status === 'recebido' ? ['bom', 'Chegou' + (p.recebido_em ? ' em ' + U.dataBR(p.recebido_em) : '')] : p.status === 'cancelado' ? ['', 'Cancelado'] : ['aviso', 'Aguardando chegar'];
    const fone = U.telOk(p.fone) ? p.fone : '';
    const comPdf = (fn) => async () => { try { await fn(); } catch (e) { U.toast(e.message || String(e), 'bad'); } return false; };
    const r = await U.modal({
      titulo, largo: true, classe: 'modal-pedido',
      html: `<p><span class="chip-st ${st[0]}">${st[1]}</span></p>
        <div class="par"><span>Fornecedor</span><b>${U.esc(p.fornecedor || '—')}${fone ? ' · ' + U.esc(U.telFmt(fone)) : ''}</b></div>
        <div class="par"><span>Pagamento</span><b>${U.esc([p.pagamento, p.condicao].filter(Boolean).join(' · ') || 'a combinar')}</b></div>
        <div class="par"><span>Frete</span><b>${U.esc(freteTxt(p))}</b></div>
        ${p.entrega ? `<div class="par"><span>Entregar até</span><b>${U.dataBR(p.entrega)}</b></div>` : ''}
        <h3 class="sub-tit">Itens</h3>
        ${(p.itens || []).map((i) => `<div class="par"><span>${qtdTxt(i.qtd)} × ${U.esc(i.nome)}${i.unidade && i.unidade !== 'un' ? ` <small class="mudo">(${U.esc(i.unidade)})</small>` : ''}${!i.produto_id ? ' <small class="mudo">· novo</small>' : ''}</span><b>${i.preco ? U.brl(i.qtd * i.preco) : '—'}</b></div>`).join('')}
        ${c.desc ? `<div class="par"><span>Desconto</span><b>− ${U.brl(c.desc)}</b></div>` : ''}
        ${c.frete ? `<div class="par"><span>Frete</span><b>${U.brl(c.frete)}</b></div>` : ''}
        <div class="par total"><span>Total</span><b>${U.brl(c.total)}</b></div>
        ${p.obs ? `<p class="mudo pequeno">Observações: ${U.esc(p.obs)}</p>` : ''}
        <p class="mudo pequeno">Feito em ${U.dataBR(p.criado_em)} por ${U.esc(p.criado_por || '')}.${p.despesa_id ? ' Valor lançado nas despesas.' : ''}</p>`,
      acoes: [
        toque()
          ? { txt: 'Enviar ou salvar o PDF', cls: 'btn-marca', icone: 'zap', aoTocar: comPdf(async () => {
            if (arq && podeCompartilhar(arq)) { if (!(await compartilhar(arq, titulo))) baixar(arq); return; }
            const f = await pegar();
            if (podeCompartilhar(f)) pdfPronto(f, titulo); else baixar(f);
          }) }
          : { txt: 'Salvar PDF como…', cls: 'btn-marca', icone: 'lista', aoTocar: comPdf(() => salvarComo(pegar(), nomeArquivo(p))) },
        ...(!toque() ? [{ txt: 'Imprimir', icone: 'lista', aoTocar: comPdf(async () => imprimir(await pegar())) }] : []),
        ...(!toque() && fone ? [{ txt: 'WhatsApp do fornecedor', icone: 'zap', aoTocar: comPdf(async () => {
          baixar(await pegar());
          window.open(U.zapLink(fone, `Olá! Segue o pedido de compra nº ${p.numero} da ${DB.lava().nome} em PDF.`), '_blank', 'noopener');
          U.toast('PDF baixado: arraste o arquivo para a conversa do WhatsApp.');
        }) }] : []),
        ...(!bloq && p.status === 'aberto' ? [{ txt: 'Chegou', cls: 'btn-marca', icone: 'check', valor: 'chegou' }] : []),
        ...(!bloq && p.status === 'aberto' ? [{ txt: 'Editar pedido', icone: 'editar', valor: 'editar' }] : []),
        ...(!bloq ? [{ txt: 'Pedir de novo', icone: 'carrinho', valor: 'copiar' }] : []),
        ...(!bloq && p.status === 'aberto' ? [{ txt: 'Cancelar pedido', cls: 'btn-perigo', valor: 'cancelar' }] : []),
        ...(!bloq && p.status !== 'aberto' ? [{ txt: 'Excluir da lista', cls: 'btn-perigo', valor: 'excluir' }] : [])
      ]
    });
    if (r === 'chegou') return chegou(p);
    if (r === 'editar' || r === 'copiar') {
      const atual = rascunho();
      if (atual.itens.length && !(await U.confirmar('Trocar o pedido em montagem?', 'Já tem itens no pedido que você está montando. Eles serão trocados por este.', 'Trocar'))) return;
      const base = novoRascunho(), copia = {};
      for (const k of ['itens', 'fornecedor', 'fone', 'pagamento', 'parcelas', 'boleto', 'condicao', 'frete_tipo', 'frete', 'desconto', 'obs']) copia[k] = JSON.parse(JSON.stringify(p[k] != null ? p[k] : base[k]));
      guardar({ ...base, ...copia, entrega: r === 'editar' ? p.entrega || '' : '', editando: r === 'editar' ? p.id : null });
      U.toast(r === 'editar' ? `Editando o pedido nº ${p.numero}` : 'Itens copiados para um pedido novo');
      return App.ir('produtos/pedido');
    }
    if (r === 'cancelar' && await U.confirmar('Cancelar este pedido?', 'Ele continua na lista como cancelado. O estoque não muda.', 'Cancelar pedido', 'btn-perigo')) { DB.salvarPedido(p, { status: 'cancelado' }); U.toast('Pedido cancelado'); App.render(); }
    if (r === 'excluir' && await U.confirmar('Tirar este pedido da lista?', 'O estoque e as despesas não mudam.', 'Excluir', 'btn-perigo')) { DB.salvarPedido(p, { excluido: true }); App.render(); }
  };

  // chegou: confirma, soma no estoque e (se quiser) lança nas despesas
  const chegou = async (p) => {
    const c = contas(p), novos = (p.itens || []).filter((i) => !i.produto_id && i.cadastrar);
    const r = await U.modal({
      titulo: `Chegou o pedido nº ${p.numero}?`,
      html: `<p class="txt">As quantidades do pedido entram no estoque.${novos.length ? ` ${novos.length === 1 ? 'O produto novo' : `Os ${novos.length} produtos novos`} (${U.esc(novos.map((i) => i.nome).join(', '))}) ${novos.length === 1 ? 'entra' : 'entram'} na lista do Estoque.` : ''}</p>
        <label class="chave"><input type="checkbox" id="chDesp" ${c.total > 0 ? 'checked' : 'disabled'}><span>Lançar ${U.brl(c.total)} nas despesas<small>Entra no Financeiro do mês como “Produtos”.</small></span></label>`,
      acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Chegou', cls: 'btn-marca', aoTocar: (el) => ({ despesa: el.querySelector('#chDesp').checked }) }]
    });
    if (!r) return;
    DB.receberPedido(p, r);
    U.toast('Estoque atualizado' + (r.despesa && c.total > 0 ? ' e despesa lançada' : ''));
    App.render();
  };

  // ---------------- abas ----------------
  const estoque = (el) => {
    const l = DB.produtos(), faltam = l.filter(DB.acabando), r = rascunho(), bloq = DB.bloqueado(), vindo = aCaminho();
    const valorEstoque = l.reduce((t, p) => t + Math.max(0, Number(p.estoque) || 0) * (Number(p.preco) || 0), 0);
    const semPedido = faltam.filter((p) => !noPedido(r, p.id) && !vindo.has(p.id));
    el.innerHTML = `
      ${faltam.length ? `<div class="aviso-caixa toque">${U.icon('alerta')}<span><b>${faltam.length} produto${faltam.length > 1 ? 's' : ''} acabando:</b> ${U.esc(faltam.slice(0, 4).map((p) => p.nome).join(', '))}${faltam.length > 4 ? '…' : ''}</span>${bloq || !semPedido.length ? '' : `<button type="button" class="btn btn-marca btn-p" id="pFaltam">Pôr no pedido</button>`}</div>` : ''}
      <section class="cartao">
        <div class="cartao-cab"><h3>Meus produtos</h3>${bloq ? '' : `<button class="btn btn-marca btn-p" id="pNovo">${U.icon('mais')}<span>Produto</span></button>`}</div>
        ${l.length ? `<div class="lista">${l.map((p) => `<div class="linha prod${DB.acabando(p) ? ' acabando' : ''}" data-p="${p.id}">
            <button type="button" class="linha-txt" data-editar><b>${U.esc(p.nome)}</b><small>${U.esc([p.preco ? U.brl(p.preco) : '', p.unidade, p.fornecedor].filter(Boolean).join(' · '))}${vindo.has(p.id) ? ` · <span class="vindo">+${qtdTxt(vindo.get(p.id))} a caminho</span>` : ''}</small></button>
            <div class="qtd" aria-label="Quantidade em estoque">
              <button type="button" class="ic-btn" data-mexe="-1" aria-label="Usei um" ${bloq ? 'disabled' : ''}>−</button>
              <b>${qtdTxt(p.estoque)}</b>
              <button type="button" class="ic-btn" data-mexe="1" aria-label="Chegou um" ${bloq ? 'disabled' : ''}>+</button>
            </div>
            ${bloq ? '' : `<button type="button" class="btn btn-p${noPedido(r, p.id) ? ' no-pedido' : ''}" data-pedir>${U.icon(noPedido(r, p.id) ? 'check' : 'carrinho')}<span>${noPedido(r, p.id) ? 'No pedido' : 'Pedir'}</span></button>`}
          </div>`).join('')}</div>
          <p class="mudo pequeno">Use − quando gastar e + quando chegar. Valor do que tem em estoque: <b>${U.brl(valorEstoque)}</b>.</p>`
        : '<p class="mudo">Cadastre os produtos que você usa (shampoo, cera, pretinho, panos…), com o valor e quanto tem. Quando algum acabar, ponha no pedido e gere o PDF para o fornecedor.</p>'}
      </section>`;
    const nv = el.querySelector('#pNovo'); if (nv) nv.onclick = async () => { if (await formProduto(null)) { U.toast('Produto salvo'); App.render(); } };
    const fl = el.querySelector('#pFaltam'); if (fl) fl.onclick = () => { semPedido.forEach((p) => pedir(p)); U.toast('Produtos acabando no pedido'); App.ir('produtos/pedido'); };
    el.querySelectorAll('[data-p]').forEach((row) => {
      const p = Store.por('produtos', row.dataset.p);
      row.onclick = async (e) => {
        if (e.target.closest('[data-editar]')) { if (bloq) return; const x = await formProduto(p); if (x) { U.toast(x === 'excluido' ? 'Produto excluído' : 'Produto salvo'); App.render(); } return; }
        const mx = e.target.closest('[data-mexe]');
        if (mx) { DB.salvarProduto(p, { estoque: Math.max(0, (Number(p.estoque) || 0) + Number(mx.dataset.mexe)) }); return App.render(); }
        if (e.target.closest('[data-pedir]')) {
          const rr = rascunho();
          if (noPedido(rr, p.id)) { rr.itens = rr.itens.filter((i) => i.produto_id !== p.id); guardar(rr); U.toast('Tirado do pedido'); }
          else { pedir(p); U.toast(`${p.nome} no pedido`); }
          App.render();
        }
      };
    });
  };

  const pedido = (el) => {
    const r = rascunho(), bloq = DB.bloqueado(), editando = r.editando ? Store.por('pedidos', r.editando) : null, forn = fornecedores();
    if (!r.itens.length) {
      el.innerHTML = `<div class="vazio">${U.icon('carrinho')}<p>${editando ? `O pedido nº ${editando.numero} ficou sem itens` : 'O pedido está vazio'}</p><p class="mudo">Ponha produtos do estoque ou produtos novos que você ainda não tem.</p>
        ${bloq ? '' : `<button type="button" class="btn btn-marca btn-g" id="pAdd">${U.icon('mais')}<span>Pôr no pedido</span></button>`}
        ${editando ? '<button type="button" class="link centro" id="pLimpar">Desistir de editar</button>' : '<a class="link centro" href="#/produtos">Ver o estoque</a>'}</div>`;
      const a = el.querySelector('#pAdd'); if (a) a.onclick = async () => { if (await adicionar()) App.render(); };
      const lp = el.querySelector('#pLimpar'); if (lp) lp.onclick = () => { guardar(novoRascunho()); App.render(); };
      return;
    }
    el.innerHTML = `
      ${editando ? `<div class="aviso-caixa">${U.icon('editar')}<span>Editando o <b>pedido nº ${editando.numero}</b>. Ao salvar, ele continua com o mesmo número.</span></div>` : ''}
      <section class="cartao">
        <div class="cartao-cab"><h3>Itens</h3>${bloq ? '' : `<button type="button" class="btn btn-p" id="pAdd">${U.icon('mais')}<span>Pôr no pedido</span></button>`}</div>
        <div class="lista">${r.itens.map((i, n) => `<div class="linha prod" data-i="${n}">
            <button type="button" class="linha-txt" data-item><b>${U.esc(i.nome)}${!i.produto_id ? ' <span class="chip-st">novo</span>' : ''}</b><small>${U.esc([i.unidade && i.unidade !== 'un' ? i.unidade : '', i.preco ? U.brl(i.preco) + ' cada' : 'sem valor: toque para pôr'].filter(Boolean).join(' · '))}</small></button>
            <div class="qtd"><button type="button" class="ic-btn" data-q="-1" aria-label="Menos">−</button><b>${qtdTxt(i.qtd)}</b><button type="button" class="ic-btn" data-q="1" aria-label="Mais">+</button></div>
            <b class="sub">${i.preco ? U.brl(i.qtd * i.preco) : '—'}</b>
          </div>`).join('')}</div>
      </section>

      <section class="cartao">
        <div class="cartao-cab"><h3>Fornecedor</h3></div>
        <div class="lado">
          <label class="campo"><span>Nome</span><input id="pForn" list="listaForn2" value="${U.esc(r.fornecedor)}" placeholder="De quem vai comprar" autocapitalize="words"></label>
          <label class="campo"><span>WhatsApp (opcional)</span><input id="pFone" inputmode="tel" value="${U.esc(r.fone ? U.telFmt(r.fone) : '')}" placeholder="(11) 99999-9999"></label>
        </div>
        <datalist id="listaForn2">${Array.from(forn.keys()).map((f) => `<option value="${U.esc(f)}">`).join('')}</datalist>
      </section>

      <section class="cartao">
        <div class="cartao-cab"><h3>Pagamento</h3></div>
        <div class="opcoes" id="pPag">${PAGAMENTOS.map((x) => `<button type="button" data-pag="${U.esc(x)}" class="${r.pagamento === x ? 'ativo' : ''}">${U.esc(x)}</button>`).join('')}</div>
        <div id="pCondBox"></div>
      </section>

      <section class="cartao">
        <div class="cartao-cab"><h3>Frete</h3></div>
        <div class="opcoes" id="pFrete">${FRETES.map(([id, t]) => `<button type="button" data-frete="${id}" class="${r.frete_tipo === id ? 'ativo' : ''}">${t}</button>`).join('')}</div>
        <label class="campo" id="pFreteV" ${r.frete_tipo === 'pago' ? '' : 'hidden'}><span>Valor do frete (R$)</span><input id="pFreteN" inputmode="decimal" value="${r.frete ? qtdTxt(r.frete) : ''}" placeholder="0,00"></label>
      </section>

      <section class="cartao">
        <div class="cartao-cab"><h3>Entrega</h3></div>
        <label class="campo"><span>Entregar até (opcional)</span><input id="pEntrega" type="date" value="${U.esc(r.entrega)}" min="${U.dia()}"></label>
        <label class="campo"><span>Observação (opcional)</span><input id="pObs" value="${U.esc(r.obs)}" placeholder="Ex.: entregar pela manhã" autocapitalize="sentences"></label>
      </section>

      <section class="cartao">
        <div id="pTotais"></div>
        <label class="campo" id="pDescV" ${r.desconto ? '' : 'hidden'}><span>Desconto que o fornecedor deu (R$)</span><input id="pDesc" inputmode="decimal" value="${r.desconto ? qtdTxt(r.desconto) : ''}" placeholder="0,00"></label>
        <button type="button" class="link" id="pDescL" ${r.desconto ? 'hidden' : ''}>+ O fornecedor deu desconto</button>
        ${bloq ? '' : `<button type="button" class="btn btn-marca btn-g btn-bloco" id="pGerar">${U.icon('check')}<span>${editando ? `Salvar o pedido nº ${editando.numero}` : 'Salvar pedido e gerar PDF'}</span></button>`}
        <button type="button" class="link centro" id="pLimpar">${editando ? 'Desistir de editar' : 'Esvaziar pedido'}</button>
      </section>`;

    const totais = () => {
      const x = rascunho(), c = contas(x);
      el.querySelector('#pTotais').innerHTML = `${c.desc || x.frete_tipo === 'pago' ? `<div class="par"><span>Produtos</span><b>${U.brl(c.sub)}</b></div>` : ''}${c.desc ? `<div class="par"><span>Desconto</span><b>− ${U.brl(c.desc)}</b></div>` : ''}${x.frete_tipo === 'pago' ? `<div class="par"><span>Frete</span><b>${c.frete ? U.brl(c.frete) : 'a pagar'}</b></div>` : ''}<div class="par total"><span>Total</span><b>${U.brl(c.total)}</b></div>`;
    };
    // condição do pagamento: parcelas no cartão de crédito, vencimento no boleto
    const pintarCond = () => {
      const x = rascunho(), box = el.querySelector('#pCondBox'), t = contas(x).total;
      if (x.pagamento === 'Cartão de crédito') {
        box.innerHTML = `<label class="campo"><span>Parcelas</span><select id="pParc">${Array.from({ length: 12 }, (_, k) => k + 1).map((n) => `<option value="${n}" ${Number(x.parcelas) === n ? 'selected' : ''}>${n === 1 ? `À vista (${U.brl(t)})` : `${n}x de ${U.brl(t / n)}`}</option>`).join('')}</select></label>`;
        box.querySelector('#pParc').onchange = (e) => muda('parcelas', Number(e.target.value));
      } else if (x.pagamento === 'Boleto') {
        box.innerHTML = `<span class="rot">Vencimento</span><div class="opcoes" id="pBol">${VENC_BOLETO.map((v) => `<button type="button" data-bol="${v}" class="${x.boleto === v ? 'ativo' : ''}">${v}</button>`).join('')}</div>`;
        box.querySelector('#pBol').onclick = (e) => { const b = e.target.closest('[data-bol]'); if (!b) return; muda('boleto', b.dataset.bol); box.querySelectorAll('[data-bol]').forEach((y) => y.classList.toggle('ativo', y === b)); };
      } else box.innerHTML = '';
    };
    totais();
    // campos: guardam no rascunho enquanto digita (sem redesenhar, para não perder o teclado)
    const muda = (k, v) => {
      const x = rascunho(); x[k] = v; guardar(x); totais();
      const pc = el.querySelector('#pParc'); if (pc && k !== 'parcelas') { const t = contas(x).total; Array.from(pc.options).forEach((o, i) => { o.textContent = i ? `${i + 1}x de ${U.brl(t / (i + 1))}` : `À vista (${U.brl(t)})`; }); }
    };
    pintarCond();
    el.querySelector('#pForn').oninput = (e) => { const v = e.target.value.trim(); muda('fornecedor', v); const f = forn.get(v), fo = el.querySelector('#pFone'); if (f && !fo.value) { fo.value = U.telFmt(f); muda('fone', U.telDig(f)); } };
    el.querySelector('#pFone').oninput = (e) => muda('fone', U.telDig(e.target.value));
    el.querySelector('#pFreteN').oninput = (e) => muda('frete', U.num(e.target.value));
    el.querySelector('#pDesc').oninput = (e) => muda('desconto', U.num(e.target.value));
    el.querySelector('#pDescL').onclick = (e) => { e.currentTarget.hidden = true; el.querySelector('#pDescV').hidden = false; el.querySelector('#pDesc').focus(); };
    el.querySelector('#pEntrega').onchange = (e) => muda('entrega', e.target.value);
    el.querySelector('#pObs').oninput = (e) => muda('obs', e.target.value.trim());
    el.querySelector('#pPag').onclick = (e) => { const b = e.target.closest('[data-pag]'); if (!b) return; muda('pagamento', b.dataset.pag); el.querySelectorAll('#pPag button').forEach((x) => x.classList.toggle('ativo', x === b)); pintarCond(); };
    el.querySelector('#pFrete').onclick = (e) => { const b = e.target.closest('[data-frete]'); if (!b) return; muda('frete_tipo', b.dataset.frete); if (b.dataset.frete !== 'pago') { muda('frete', 0); el.querySelector('#pFreteN').value = ''; } el.querySelectorAll('#pFrete button').forEach((x) => x.classList.toggle('ativo', x === b)); el.querySelector('#pFreteV').hidden = b.dataset.frete !== 'pago'; totais(); };

    const a = el.querySelector('#pAdd'); if (a) a.onclick = async () => { if (await adicionar()) App.render(); };
    el.querySelectorAll('[data-i]').forEach((row) => {
      row.onclick = async (e) => {
        const x = rascunho(), n = Number(row.dataset.i), it = x.itens[n];
        const b = e.target.closest('[data-q]');
        if (b) { it.qtd = Math.max(0, it.qtd + Number(b.dataset.q)); x.itens = x.itens.filter((i) => i.qtd > 0); guardar(x); return App.render(); }
        if (e.target.closest('[data-item]')) {
          const f = await formItem(it);
          if (f === 'tirar') { x.itens.splice(n, 1); guardar(x); App.render(); }
          else if (f && typeof f === 'object') { Object.assign(it, f); guardar(x); App.render(); }
        }
      };
    });
    el.querySelector('#pLimpar').onclick = async () => {
      if (editando) { guardar(novoRascunho()); return App.ir('produtos/historico'); }
      if (await U.confirmar('Esvaziar o pedido?', 'Os produtos continuam cadastrados no estoque.', 'Esvaziar', 'btn-perigo')) { guardar(novoRascunho()); App.render(); }
    };
    const g = el.querySelector('#pGerar');
    if (g) g.onclick = async () => {
      const x = rascunho();
      if (x.frete_tipo === 'pago' && !x.frete && !(await U.confirmar('Frete sem valor', 'Você marcou frete pago, mas não pôs o valor. Salvar assim mesmo (o PDF mostra “a pagar”)?', 'Salvar assim'))) return;
      const dados = { itens: x.itens, fornecedor: x.fornecedor, fone: x.fone, pagamento: x.pagamento, parcelas: x.pagamento === 'Cartão de crédito' ? Number(x.parcelas) || 1 : null, boleto: x.pagamento === 'Boleto' ? x.boleto : '', condicao: condicaoDe(x), frete_tipo: x.frete_tipo, frete: x.frete_tipo === 'pago' ? x.frete : 0, desconto: x.desconto, entrega: x.entrega, obs: x.obs };
      const ped = DB.salvarPedido(editando && editando.status === 'aberto' ? editando : null, dados);
      // o valor de cada produto do estoque acompanha o último preço pedido
      for (const i of ped.itens) { const pr = i.produto_id && Store.por('produtos', i.produto_id); if (pr && i.preco && Number(pr.preco) !== Number(i.preco)) DB.salvarProduto(pr, { preco: i.preco }); }
      guardar(novoRascunho());
      U.toast(editando ? `Pedido nº ${ped.numero} atualizado` : `Pedido nº ${ped.numero} salvo`);
      App.ir('produtos/historico');
      setTimeout(() => verPedido(ped), 250);
    };
  };

  const historico = (el, filtro) => {
    const todos = DB.pedidos(), f = filtro || 'aberto';
    const l = f === 'todos' ? todos : todos.filter((p) => p.status === f);
    const abertos = todos.filter((p) => p.status === 'aberto');
    if (!todos.length) { el.innerHTML = `<div class="vazio">${U.icon('lista')}<p>Nenhum pedido feito</p><p class="mudo">Os pedidos que você salvar aparecem aqui, para mandar de novo ao fornecedor e marcar quando chegarem.</p></div>`; return; }
    el.innerHTML = `${abertos.length ? `<p class="mudo">${abertos.length} pedido${abertos.length > 1 ? 's' : ''} aguardando chegar, somando <b>${U.brl(abertos.reduce((t, p) => t + contas(p).total, 0))}</b>.</p>` : ''}
      <div class="opcoes" id="hFiltro">${[['aberto', 'Aguardando'], ['recebido', 'Chegaram'], ['cancelado', 'Cancelados'], ['todos', 'Todos']].map(([id, t]) => `<button type="button" data-f="${id}" class="${f === id ? 'ativo' : ''}">${t}</button>`).join('')}</div>
      <section class="cartao">${l.length ? `<div class="lista">${l.map((p) => `<button type="button" class="linha" data-ped="${p.id}">
        <span class="linha-txt"><b>Pedido nº ${p.numero}${p.fornecedor ? ' · ' + U.esc(p.fornecedor) : ''}</b><small>${U.dataBR(p.criado_em)} · ${(p.itens || []).length} ite${(p.itens || []).length === 1 ? 'm' : 'ns'} · ${U.brl(contas(p).total)}${p.pagamento ? ' · ' + U.esc(p.pagamento) : ''}</small></span>
        <span class="chip-st ${p.status === 'recebido' ? 'bom' : p.status === 'cancelado' ? '' : 'aviso'}">${p.status === 'recebido' ? 'Chegou' : p.status === 'cancelado' ? 'Cancelado' : 'Aguardando'}</span></button>`).join('')}</div>` : '<p class="mudo">Nenhum pedido aqui.</p>'}</section>`;
    el.querySelector('#hFiltro').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) historico(el, b.dataset.f); };
    el.querySelectorAll('[data-ped]').forEach((b) => { b.onclick = () => verPedido(Store.por('pedidos', b.dataset.ped)); });
  };

  Telas.produtos = {
    titulo: (args) => ({ pedido: 'Pedido de compra', historico: 'Pedidos feitos' }[args[0]] || 'Produtos'),
    perfis: ['dono'], parado: true,
    render: (el, args) => {
      const aba = ABAS.some((x) => x[0] === args[0]) ? args[0] : 'estoque';
      const n = { estoque: DB.produtos().length, pedido: rascunho().itens.length, historico: DB.pedidos().filter((p) => p.status === 'aberto').length };
      el.innerHTML = `<div class="abas">${ABAS.map(([id, txt]) => `<a href="#/produtos/${id === 'estoque' ? '' : id}" class="${id === aba ? 'ativo' : ''}">${txt}${n[id] ? `<span>${n[id]}</span>` : ''}</a>`).join('')}</div><div id="prCorpo"></div>`;
      ({ estoque, pedido, historico })[aba](el.querySelector('#prCorpo'));
    }
  };
  Telas.produtos.verPedido = verPedido;
})();
