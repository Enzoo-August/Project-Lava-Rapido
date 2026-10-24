/* =========================================================
   DB — as regras do lava-rápido:
   chegada do carro, andamento, entrega, fidelidade e mensagens.
   As telas só chamam estas funções; elas valem igual no modo
   demonstração e com o banco de verdade.
   ========================================================= */
(function () {
  const DB = {};
  window.DB = DB;

  DB.ABERTOS = ['aguardando', 'lavando', 'pronto'];
  DB.STATUS = { aguardando: 'Na fila', lavando: 'Lavando', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' };

  // ---------------- configurações (o que o dono não mexeu usa o padrão) ----------------
  const PADRAO = {
    fidelidade: { ativo: true, niveis: [{ pontos: 10, desconto: 10 }, { pontos: 20, desconto: 30 }] },
    pagamentos: ['Pix', 'Dinheiro', 'Débito', 'Crédito'],
    usarLavando: true,          // etapa "Lavando" entre a fila e o pronto
    lavadores: [],              // nomes de quem lava (para saber quem lavou cada carro)
    sumidoDias: 45,             // depois de quantos dias sem vir o cliente é "sumido"
    funcionarioMudaValor: true,
    perguntarEntrega: true,     // na chegada, perguntar quando o cliente vem buscar (leva e traz, espera, hora)
    fiado: true,                // na entrega, aceitar "Fiado" (o cliente paga depois)
    msg: {
      entrada: 'Olá, {nome}! Recebemos seu {carro} ({placa}). Previsão: {previsao}. Acompanhe por aqui: {link}\n{lava}',
      pronto: 'Olá, {nome}! Seu {carro} ({placa}) está pronto ✅ Pode vir buscar quando quiser. Total: {valor}.\n{lava}',
      prontoLeva: 'Olá, {nome}! Seu {carro} ({placa}) está pronto ✅ Já vamos levar até você. Total: {valor}.\n{lava}',
      fiado: 'Olá, {nome}! Segue o resumo do que ficou para pagar depois:\n{lista}\nTotal: {valor}.\nQualquer dúvida, é só chamar.\n{lava}',
      avaliacao: '{nome}, obrigado pela preferência! Sua opinião ajuda muito a gente. Pode avaliar em 1 minutinho? {google}\n{lava}',
      sumido: 'Oi, {nome}! Faz um tempo que não vemos seu {carro} por aqui. Que tal deixar ele brilhando de novo? Estamos esperando você!\n{lava}',
      lembrete: 'Olá, {nome}! Passando para lembrar do seu horário: {quando}. Se precisar remarcar, é só avisar por aqui.\n{lava}',
      lembreteBusca: 'Olá, {nome}! Passando para lembrar: vamos buscar seu {carro} {quando}. Se precisar mudar, é só avisar por aqui.\n{lava}'
    }
  };
  DB.PADRAO = PADRAO;
  const MARCA_PADRAO = { cor: '#0b63ce', logo: '', telefone: '', endereco: '', google: '', instagram: '' };

  DB.lava = () => Store.s.lava;
  DB.cfg = () => {
    const c = DB.lava().config || {};
    return { ...PADRAO, ...c, fidelidade: { ...PADRAO.fidelidade, ...(c.fidelidade || {}) }, msg: { ...PADRAO.msg, ...(c.msg || {}) } };
  };
  DB.marca = () => ({ ...MARCA_PADRAO, ...(DB.lava().marca || {}) });
  DB.ehDono = () => !!App.user && App.user.perfil === 'dono';
  DB.bloqueado = () => DB.lava().ativo === false;

  // ---------------- consultas ----------------
  DB.cliente = (id) => (id ? Store.por('clientes', id) : null);
  DB.veiculo = (placa) => (placa ? Store.por('veiculos', placa) : null);
  DB.veiculosDe = (clienteId) => Store.s.veiculos.filter((v) => v.cliente_id === clienteId && v.ativo !== false);
  DB.servicos = () => Store.s.servicos.filter((s) => s.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  DB.preco = (s, porte) => Number((s.precos || {})[porte]) || 0;
  DB.nomeVeiculo = (v) => (v.modelo || v.marca || 'Veículo') + (v.cor && v.cor !== 'Outra' ? ' ' + v.cor.toLowerCase() : '');

  DB.abertos = () => Store.s.atendimentos.filter((a) => DB.ABERTOS.includes(a.status)).sort((a, b) => (a.entrada_em < b.entrada_em ? -1 : 1));
  DB.doDia = (dia) => { dia = dia || U.dia(); return Store.s.atendimentos.filter((a) => a.status !== 'cancelado' && U.dia(a.entrada_em) === dia); };
  // entregues hoje = saíram hoje, mesmo que tenham chegado em outro dia
  DB.entreguesHoje = () => { const hoje = U.dia(); return Store.s.atendimentos.filter((a) => a.status === 'entregue' && U.dia(a.entregue_em || a.entrada_em) === hoje); };
  DB.abertoDaPlaca = (placa) => Store.s.atendimentos.find((a) => a.placa === placa && DB.ABERTOS.includes(a.status)) || null;
  DB.atrasado = (a) => !!a.previsao && ['aguardando', 'lavando'].includes(a.status) && new Date(a.previsao).getTime() < Date.now();

  // placa digitada pela metade → carros que combinam (os que vieram há menos tempo primeiro)
  DB.buscarVeiculos = (txt, max = 4) => {
    const p = U.placaLimpa(txt); if (p.length < 2) return [];
    return Store.s.veiculos.filter((v) => v.ativo !== false && v.placa.startsWith(p))
      .sort((a, b) => ((b.ultima_visita || '') > (a.ultima_visita || '') ? 1 : -1)).slice(0, max);
  };
  // busca de cliente por nome (palavras em qualquer ordem), telefone ou placa
  DB.buscarClientes = (txt, max = 30) => {
    const t = U.norm(txt), dig = String(txt || '').replace(/\D/g, ''), placa = U.placaLimpa(txt);
    let lista = Store.s.clientes.filter((c) => c.ativo !== false);
    if (t) {
      const partes = t.split(/\s+/);
      const porPlaca = new Set(placa.length >= 3 ? Store.s.veiculos.filter((v) => v.placa.includes(placa)).map((v) => v.cliente_id) : []);
      lista = lista.filter((c) => {
        const n = U.norm(c.nome);
        return partes.every((p) => n.includes(p)) || (dig.length >= 4 && (c.telefone || '').includes(dig)) || porPlaca.has(c.id);
      });
      const nota = (c) => { const n = U.norm(c.nome); return n === t ? 0 : n.startsWith(t) ? 1 : 2; };
      lista.sort((a, b) => nota(a) - nota(b) || a.nome.localeCompare(b.nome));
    } else lista.sort((a, b) => ((b.ultima_visita || '') > (a.ultima_visita || '') ? 1 : -1));
    return lista.slice(0, max);
  };
  DB.clientePorTelefone = (tel) => { const d = U.telDig(tel); return d.length >= 10 ? Store.s.clientes.find((c) => c.ativo !== false && c.telefone === d) || null : null; };

  // ---------------- fidelidade ----------------
  // saldo = lavagens que ainda não viraram prêmio. "mais" = 1 quando a lavagem de agora ainda não foi registrada.
  DB.fidelidade = (c, mais) => {
    const f = DB.cfg().fidelidade;
    const niveis = (f.niveis || []).filter((n) => n.pontos > 0 && n.desconto > 0).sort((a, b) => a.pontos - b.pontos);
    const saldo = Math.max(0, ((c && c.visitas) || 0) - ((c && c.pontos_usados) || 0)) + (mais || 0);
    const r = { ativo: !!f.ativo && niveis.length > 0, saldo, niveis, alcancados: [], exato: null, proximo: null, faltam: 0, meta: niveis.length ? niveis[niveis.length - 1].pontos : 10 };
    if (!r.ativo) return r;
    r.alcancados = niveis.filter((n) => n.pontos <= saldo);
    r.exato = niveis.find((n) => n.pontos === saldo) || null;
    r.proximo = niveis.find((n) => n.pontos > saldo) || null;
    r.faltam = r.proximo ? r.proximo.pontos - saldo : 0;
    return r;
  };
  DB.faltamTxt = (f) => (f.faltam === 1 ? 'falta 1' : 'faltam ' + f.faltam);
  DB.premioTxt = (n) => `${n.desconto}% de desconto (fidelidade: ${n.pontos} lavagens)`;

  // ---------------- gravação ----------------
  DB.gravar = (t, linha) => {
    const l = Store.mesclar(t, linha);
    if (Store.modo === 'nuvem') Nuvem.enfileirar(t, l);
    Store.salvar();
    return l;
  };
  DB.salvarLava = (mudancas) => {
    const l = Store.s.lava;
    Object.assign(l, mudancas);
    if (Store.modo === 'nuvem') Nuvem.enfileirar('lavas', { id: l.id, nome: l.nome, marca: l.marca, config: l.config });
    Store.salvar();
    App.aplicarMarca();
  };
  DB.salvarConfig = (mudancas) => DB.salvarLava({ config: { ...(DB.lava().config || {}), ...mudancas } });

  const agoraIso = () => new Date().toISOString();
  const lavaId = () => Store.s.lava.id;

  DB.salvarCliente = (c, dados) => {
    if (!c) c = { id: U.uuid(), lava_id: lavaId(), nome: '', telefone: '', obs: '', visitas: 0, pontos_usados: 0, gasto: 0, primeira_visita: null, ultima_visita: null, avaliacao_pedida_em: null, ativo: true, criado_em: agoraIso() };
    Object.assign(c, dados);
    c.nome = U.capitalizar(c.nome); c.telefone = U.telDig(c.telefone);
    return DB.gravar('clientes', c);
  };
  DB.salvarVeiculo = (v, dados) => {
    if (!v) v = { lava_id: lavaId(), placa: dados.placa, cliente_id: null, marca: '', modelo: '', cor: '', porte: 'm', obs: '', visitas: 0, ultima_visita: null, ultimos_servicos: null, ativo: true, criado_em: agoraIso() };
    Object.assign(v, dados);
    return DB.gravar('veiculos', v);
  };

  // monta a lista de serviços escolhidos com o preço do porte do carro
  DB.itens = (ids, porte) => ids.map((id) => Store.por('servicos', id)).filter(Boolean).map((s) => ({ id: s.id, nome: s.nome, valor: DB.preco(s, porte) }));
  DB.minutos = (ids) => ids.map((id) => Store.por('servicos', id)).filter(Boolean).reduce((t, s) => t + (Number(s.minutos) || 0), 0);

  /* CHEGOU CARRO
     o = { placa, veiculo: {marca, modelo, cor, porte}, cliente: {id | nome, telefone}, itens: [{id, nome, valor}],
           valor (se ajustou na mão), nivel (prêmio de fidelidade usado), previsaoMin, obs } */
  DB.entrada = (o) => {
    const agora = agoraIso();
    let c = o.cliente && o.cliente.id ? DB.cliente(o.cliente.id) : null;
    if (!c) c = DB.salvarCliente(null, { nome: o.cliente.nome, telefone: o.cliente.telefone });
    else if ((o.cliente.nome && U.capitalizar(o.cliente.nome) !== c.nome) || (o.cliente.telefone !== undefined && U.telDig(o.cliente.telefone) !== (c.telefone || '')))
      DB.salvarCliente(c, { nome: o.cliente.nome || c.nome, telefone: o.cliente.telefone !== undefined ? o.cliente.telefone : c.telefone });

    let v = DB.veiculo(o.placa);
    const dadosV = { placa: o.placa, cliente_id: c.id, ...o.veiculo };
    if (!v) v = DB.salvarVeiculo(null, dadosV);
    else if (v.cliente_id !== c.id || ['marca', 'modelo', 'cor', 'porte'].some((k) => o.veiculo[k] !== undefined && o.veiculo[k] !== v[k])) DB.salvarVeiculo(v, dadosV);

    const valor = o.valor != null ? Number(o.valor) : o.itens.reduce((t, i) => t + i.valor, 0);
    const desconto = o.nivel ? Math.round(valor * o.nivel.desconto) / 100 : 0;
    const doDia = DB.doDia().concat(Store.s.atendimentos.filter((a) => a.status === 'cancelado' && U.dia(a.entrada_em) === U.dia()));
    const a = {
      id: U.uuid(), lava_id: lavaId(), numero: doDia.reduce((m, x) => Math.max(m, x.numero || 0), 0) + 1,
      placa: o.placa, veiculo: DB.nomeVeiculo(v), cliente_id: c.id,
      servicos: o.itens, valor, desconto, total: Math.max(0, valor - desconto),
      pontos_usados: o.nivel ? o.nivel.pontos : 0, premio: o.nivel ? DB.premioTxt(o.nivel) : null,
      status: 'aguardando', pagamento: null,
      previsao: o.previsao || (o.previsaoMin ? new Date(Date.now() + o.previsaoMin * 60000).toISOString() : null),
      obs: o.obs || '', cliente_novo: (c.visitas || 0) === 0, token: U.token(),
      entrada_em: agora, inicio_em: null, pronto_em: null, entregue_em: null, cancelado_em: null, avisado_em: null,
      atendente: Store.modo === 'nuvem' ? App.user.id : null, atendente_nome: App.user.nome, lavador: null
    };
    // contadores (no banco de verdade quem calcula é o próprio banco; aqui é para valer na hora)
    c.visitas = (c.visitas || 0) + 1; c.pontos_usados = (c.pontos_usados || 0) + a.pontos_usados;
    c.ultima_visita = agora; if (!c.primeira_visita) c.primeira_visita = agora;
    v.visitas = (v.visitas || 0) + 1; v.ultima_visita = agora; v.ultimos_servicos = o.itens;
    DB.gravar('clientes', c); DB.gravar('veiculos', v);   // contadores da fidelidade vão junto
    return DB.gravar('atendimentos', a);
  };

  // muda a etapa do atendimento (para frente ou para trás)
  DB.status = (a, novo, extras) => {
    const antes = a.status, agora = agoraIso(), c = DB.cliente(a.cliente_id);
    if (extras) Object.assign(a, extras);
    if (antes !== novo) {
      if (c) {
        if (antes === 'entregue') c.gasto = (c.gasto || 0) - a.total;
        if (novo === 'entregue') c.gasto = (c.gasto || 0) + a.total;
        if (novo === 'cancelado') { c.visitas = Math.max(0, (c.visitas || 0) - 1); c.pontos_usados = Math.max(0, (c.pontos_usados || 0) - a.pontos_usados); }
        if (antes === 'cancelado') { c.visitas = (c.visitas || 0) + 1; c.pontos_usados = (c.pontos_usados || 0) + a.pontos_usados; }
      }
      a.status = novo;
      if (antes === 'entregue') { a.fiado_aberto = false; a.fiado_pago_em = null; a.fiado_pagamento = null; }   // desfez a entrega: fiado some junto
      if (novo === 'aguardando') { a.inicio_em = null; a.pronto_em = null; a.entregue_em = null; a.cancelado_em = null; a.pagamento = null; a.avisado_em = null; }
      if (novo === 'lavando') { a.inicio_em = a.inicio_em || agora; a.pronto_em = null; a.entregue_em = null; a.pagamento = null; a.avisado_em = null; }
      if (novo === 'pronto') { a.inicio_em = a.inicio_em || a.entrada_em; a.pronto_em = a.pronto_em && antes === 'entregue' ? a.pronto_em : agora; a.entregue_em = null; a.pagamento = null; }
      if (novo === 'entregue') { a.inicio_em = a.inicio_em || a.entrada_em; a.pronto_em = a.pronto_em || agora; a.entregue_em = agora; a.fiado_aberto = a.pagamento === 'Fiado'; }
      if (novo === 'cancelado') a.cancelado_em = agora;
      if (c && [antes, novo].some((s) => s === 'entregue' || s === 'cancelado')) DB.gravar('clientes', c);
    }
    return DB.gravar('atendimentos', a);
  };

  // altera serviços, valor, observação ou previsão de um atendimento em aberto
  DB.editarAtend = (a, m) => {
    const c = DB.cliente(a.cliente_id);
    if (m.itens) { a.servicos = m.itens; if (m.valor == null) m.valor = m.itens.reduce((t, i) => t + i.valor, 0); }
    if (m.valor != null) {
      const pct = a.pontos_usados && a.valor ? a.desconto / a.valor : 0;   // mantém o desconto da fidelidade na mesma proporção
      if (c && a.status === 'entregue') c.gasto = (c.gasto || 0) - a.total;
      a.valor = Number(m.valor); a.desconto = m.desconto != null ? Number(m.desconto) : Math.round(a.valor * pct * 100) / 100;
      a.total = Math.max(0, a.valor - a.desconto);
      if (c && a.status === 'entregue') { c.gasto += a.total; DB.gravar('clientes', c); }
    }
    for (const k of ['obs', 'previsao', 'lavador', 'pagamento', 'avisado_em']) if (m[k] !== undefined) a[k] = m[k];
    return DB.gravar('atendimentos', a);
  };

  DB.salvarDespesa = (d, dados) => {
    if (!d) d = { id: U.uuid(), lava_id: lavaId(), data: U.dia(), categoria: '', descricao: '', valor: 0, excluido: false };
    Object.assign(d, dados);
    return DB.gravar('despesas', d);
  };
  // ---------------- avarias (riscos e amassados com foto, presos à placa) ----------------
  DB.avariasDe = (placa) => Store.s.avarias.filter((a) => a.placa === placa && !a.excluido).sort((a, b) => (a.criada_em < b.criada_em ? -1 : 1));
  DB.avariasAtivas = (placa) => DB.avariasDe(placa).filter((a) => a.status !== 'resolvida');
  // na nuvem busca as do carro no banco (fotos não ficam no aparelho); na demonstração já estão aqui
  DB.carregarAvarias = async (placa) => { if (Store.modo === 'nuvem' && placa) { try { await Nuvem.avarias(placa); } catch (e) {} } return DB.avariasDe(placa); };
  DB.salvarAvaria = (av, dados) => {
    if (!av) av = { id: U.uuid(), lava_id: lavaId(), placa: '', cliente_id: null, atendimento_id: null, descricao: '', foto: '', status: 'ativa', criada_em: agoraIso(), criada_por: App.user.nome, confirmada_em: null, resolvida_em: null, excluido: false };
    Object.assign(av, dados);
    return DB.gravar('avarias', av);
  };

  // ---------------- fiado (o cliente paga depois) ----------------
  DB.fiados = () => Store.s.atendimentos.filter((a) => a.status === 'entregue' && a.fiado_aberto);
  DB.fiadoPorCliente = () => {
    const m = new Map();
    for (const a of DB.fiados()) { const k = a.cliente_id || 'sem'; if (!m.has(k)) m.set(k, { id: k, cliente: DB.cliente(a.cliente_id), itens: [], total: 0 }); const x = m.get(k); x.itens.push(a); x.total += Number(a.total) || 0; }
    for (const x of m.values()) x.itens.sort((a, b) => (a.entregue_em < b.entregue_em ? -1 : 1));
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  };
  DB.receberFiado = (lista, forma) => { const agora = agoraIso(); for (const a of lista) { a.fiado_aberto = false; a.fiado_pago_em = agora; a.fiado_pagamento = forma; DB.gravar('atendimentos', a); } };
  DB.fiadosPagos = (desde) => Store.s.atendimentos.filter((a) => a.fiado_pago_em && a.fiado_pago_em >= desde).sort((a, b) => (a.fiado_pago_em < b.fiado_pago_em ? 1 : -1));

  // ---------------- produtos (estoque) e pedidos de compra ----------------
  DB.produtos = () => Store.s.produtos.filter((p) => !p.excluido).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  DB.acabando = (p) => Number(p.estoque) <= Number(p.minimo || 0);
  DB.salvarProduto = (p, dados) => {
    if (!p) p = { id: U.uuid(), lava_id: lavaId(), nome: '', unidade: 'un', preco: 0, estoque: 0, minimo: 0, fornecedor: '', excluido: false, criado_em: agoraIso() };
    Object.assign(p, dados);
    return DB.gravar('produtos', p);
  };
  DB.pedidos = () => Store.s.pedidos.filter((p) => !p.excluido).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  DB.salvarPedido = (p, dados) => {
    if (!p) p = { id: U.uuid(), lava_id: lavaId(), numero: Store.s.pedidos.reduce((m, x) => Math.max(m, x.numero || 0), 0) + 1, itens: [], fornecedor: '', fone: '', pagamento: '', condicao: '', frete_tipo: 'gratis', frete: 0, desconto: 0, entrega: '', obs: '', status: 'aberto', criado_por: App.user.nome, criado_em: agoraIso(), recebido_em: null, despesa_id: null, excluido: false };
    Object.assign(p, dados);
    p.subtotal = (p.itens || []).reduce((t, i) => t + (Number(i.qtd) || 0) * (Number(i.preco) || 0), 0);
    p.total = Math.max(0, p.subtotal - Math.min(p.subtotal, Number(p.desconto) || 0) + (p.frete_tipo === 'pago' ? Number(p.frete) || 0 : 0));
    return DB.gravar('pedidos', p);
  };
  // pedido chegou: soma as quantidades no estoque (uma vez só); produto novo marcado entra no estoque;
  // com { despesa: true }, o total vai para as despesas do mês (Produtos)
  DB.receberPedido = (p, o) => {
    if (p.status === 'recebido') return p;
    o = o || {};
    const itens = (p.itens || []).map((i) => {
      const pr = i.produto_id ? Store.por('produtos', i.produto_id) : null;
      if (pr) { DB.salvarProduto(pr, { estoque: (Number(pr.estoque) || 0) + (Number(i.qtd) || 0), excluido: false }); return i; }
      if (i.cadastrar) { const novo = DB.salvarProduto(null, { nome: i.nome, unidade: i.unidade || 'un', preco: Number(i.preco) || 0, estoque: Number(i.qtd) || 0, minimo: 1, fornecedor: p.fornecedor || '' }); return { ...i, produto_id: novo.id }; }
      return i;
    });
    let despesa_id = p.despesa_id || null;
    if (o.despesa && !despesa_id && p.total > 0) despesa_id = DB.salvarDespesa(null, { descricao: `Pedido de compra nº ${p.numero}${p.fornecedor ? ' — ' + p.fornecedor : ''}`, valor: p.total, data: U.dia(), categoria: 'Produtos' }).id;
    return DB.salvarPedido(p, { itens, status: 'recebido', recebido_em: agoraIso(), despesa_id });
  };
  DB.salvarServico = (s, dados) => {
    if (!s) s = { id: U.uuid(), lava_id: lavaId(), nome: '', precos: {}, minutos: 30, ordem: Store.s.servicos.reduce((m, x) => Math.max(m, x.ordem || 0), 0) + 1, ativo: true };
    Object.assign(s, dados);
    return DB.gravar('servicos', s);
  };

  // ---------------- agenda (horários marcados) ----------------
  DB.agenda = () => Store.s.agendamentos.filter((g) => g.status === 'marcado').sort((a, b) => (a.quando < b.quando ? -1 : 1));
  DB.agendaDoDia = (dia) => { dia = dia || U.dia(); return DB.agenda().filter((g) => U.dia(g.quando) === dia); };
  DB.salvarAgendamento = (g, dados) => {
    if (!g) g = { id: U.uuid(), lava_id: lavaId(), cliente_id: null, nome: '', telefone: '', placa: '', veiculo: '', servico: '', valor: 0, quando: null, obs: '', tipo: 'traz', endereco: '', avisar_min: 10, status: 'marcado', atendimento_id: null, criado_por: App.user.nome, criado_em: agoraIso() };
    Object.assign(g, dados);
    if (dados.nome !== undefined) g.nome = U.capitalizar(g.nome);
    if (dados.telefone !== undefined) g.telefone = U.telDig(g.telefone);
    return DB.gravar('agendamentos', g);
  };
  DB.quandoTxt = (d) => { const dias = U.diasDesde(d); return (dias === 0 ? 'hoje' : dias === -1 ? 'amanhã' : `${U.SEMANA_LONGA[new Date(d).getDay()]}, ${U.dataCurta(d)}`) + ' às ' + U.hora(d); };
  DB.msgAgenda = (g) => String(DB.cfg().msg[g.tipo === 'buscar' ? 'lembreteBusca' : 'lembrete'] || '').replace(/\{(\w+)\}/g, (m, k) => ({ nome: U.primeiroNome(g.nome), lava: DB.lava().nome, quando: DB.quandoTxt(g.quando), carro: g.veiculo || 'carro' }[k] ?? m));

  // ---------------- períodos (painel do dono) ----------------
  // atendimentos com entrada entre "de" (inclusive) e "ate" (exclusive)
  DB.periodo = async (de, ate) => {
    const dentro = (iso) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= de.getTime() && t < ate.getTime(); };
    const local = () => Store.s.atendimentos.filter((a) => dentro(a.entrada_em) || dentro(a.entregue_em));
    if (Store.modo !== 'nuvem') return local();
    try { return await Nuvem.periodo(de.toISOString(), ate.toISOString()); }
    catch (e) { U.toast('Sem internet: mostrando só o que está guardado no aparelho.', 'bad'); return local(); }
  };
  DB.despesasDe = (de, ate) => { const a = U.dia(de), b = U.dia(ate); return Store.s.despesas.filter((d) => !d.excluido && d.data >= a && d.data < b); };
  DB.historico = async (clienteId) => {
    const local = () => Store.s.atendimentos.filter((a) => a.cliente_id === clienteId).sort((a, b) => (a.entrada_em > b.entrada_em ? -1 : 1)).slice(0, 60);
    if (Store.modo !== 'nuvem' || !DB.ehDono()) return local();
    try { return await Nuvem.historicoCliente(clienteId); } catch (e) { return local(); }
  };

  // ---------------- mensagens do WhatsApp ----------------
  DB.linkAcompanhar = (a) => new URL('c/?t=' + a.token + (Store.modo === 'demo' ? '&demo=1' : ''), location.origin + '/').href;
  DB.LEVA = 'Leva e traz';
  DB.ehLeva = (a) => !!(a && a.obs && a.obs.split(' · ').includes(DB.LEVA));
  DB.msg = (tipo, a, c, extra) => {
    c = c || DB.cliente(a && a.cliente_id) || {};
    if (tipo === 'pronto' && DB.ehLeva(a)) tipo = 'prontoLeva';
    const v = a ? null : DB.veiculosDe(c.id)[0];
    const vars = {
      nome: U.primeiroNome(c.nome), lava: DB.lava().nome, google: DB.marca().google || '',
      carro: a ? a.veiculo || 'carro' : v ? DB.nomeVeiculo(v) : 'carro',
      placa: a ? U.placaFmt(a.placa) : '', valor: a ? U.brl(a.total) : '',
      previsao: a && a.previsao ? (U.dia(a.previsao) === U.dia() ? 'hoje às ' : U.dataCurta(a.previsao) + ' às ') + U.hora(a.previsao) : 'avisamos quando ficar pronto',
      link: a ? DB.linkAcompanhar(a) : '',
      ...(extra || {})
    };
    return String(DB.cfg().msg[tipo] || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)).replace(/ \(\)/g, '').replace(/^\s+$/gm, '').trim();
  };
})();
