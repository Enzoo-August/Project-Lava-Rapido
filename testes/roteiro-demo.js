/* =========================================================
   Roteiro completo de funções (modo demonstração).
   Abra  ?demo=1  e, no console:
     await import('./testes/roteiro-demo.js'); await testeTudo()
   Passa por tudo que o funcionário e o dono fazem, tocando nos
   botões de verdade, e confere os resultados. Tudo tem de sair "ok".
   Não toca no banco: a demonstração fica só neste aparelho.
   ========================================================= */
window.testeTudo = async () => {
  const esp = (ms = 160) => new Promise((r) => setTimeout(r, ms));
  const log = []; let falhas = 0;
  const ok = (nome, cond, extra) => { if (!cond) falhas++; log.push((cond ? 'ok    ' : 'FALHA ') + nome + (extra !== undefined && (!cond || extra === true) ? ' → ' + extra : !cond ? '' : '')); };
  const q = (s, el) => (el || document).querySelector(s), qq = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clic = async (s, el) => { const e = typeof s === 'string' ? q(s, el) : s; if (!e) throw new Error('não achei ' + s); e.click(); await esp(); return e; };
  const ir = async (rota, ms) => { if (location.hash === '#/' + rota) App.render(); else location.hash = '#/' + rota; await esp(ms || 300); };
  const tela = () => q('#tela').innerText;
  const modal = () => q('.modal-fundo:last-child .modal');
  const fecharModais = async () => { for (let i = 0; i < 4 && q('.modal'); i++) { q('.modal-fundo:last-child [data-fechar]').click(); await esp(120); } };
  const entrar = async (perfil) => { Store.pref('demo.perfil', perfil); Store.pref('visto.' + perfil, true); App.user = Demo.usuario(perfil); document.getElementById('app').dataset.perfil = perfil; await ir(perfil === 'dono' ? 'inicio' : 'balcao'); App.render(); await esp(); };
  const ultimo = () => Store.s.atendimentos[Store.s.atendimentos.length - 1];
  const digitar = async (placa) => { for (const ch of placa) q(`.tecla[data-t="${ch}"]`).click(); await esp(80); };
  const campo = (el, nome, valor) => { const i = q(`[name=${nome}]`, el); i.value = valor; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };
  const zap = []; U.zap = (t, m) => zap.push([t, m]);
  const dinheiro = (n) => U.brl(n);
  const E_obs = () => q('.pe-total') ? q('.pe-total').innerText : tela();
  const carrinhoVazio = () => { const r = Store.pref('pedido.' + (DB.lava().id || 'demo')); return !(r && (Array.isArray(r) ? r : r.itens || []).length); };

  Store.pref('visto.funcionario', true); Store.pref('visto.dono', true);
  if (!document.getElementById('login').hidden) { q('[data-perfil=funcionario]').click(); await esp(300); }   // tela de entrada da demonstração
  Demo.recomecar(); await entrar('funcionario');
  const sv = Store.s.servicos;
  const passo = async (nome, fn) => { try { await fn(); } catch (e) { falhas++; log.push('FALHA ' + nome + ' → erro: ' + (e.message || e)); await fecharModais(); } };

  const modeloCorCliente = async (modelo, cor, nome, tel) => {
    const i = q('#eModelo'); i.value = modelo; i.dispatchEvent(new Event('input')); await esp(60);
    await clic('[data-modelo]'); await clic(`[data-cor="${cor}"]`);
    if (nome) { const f = q('#eForm'); f.nome.value = nome; f.nome.dispatchEvent(new Event('input')); f.telefone.value = tel || ''; f.telefone.dispatchEvent(new Event('input')); await esp(60); f.requestSubmit(); await esp(); }
  };

  await passo('1 balcão', async () => {
    const ab = DB.abertos();
    ok('balcão: números dos botões batem com os dados', qq('.bloco-n').map((e) => e.textContent).join() === [ab.filter((a) => a.status !== 'pronto').length, ab.filter((a) => a.status === 'pronto').length, DB.entreguesHoje().length].join());
    ok('balcão: mostra a agenda de hoje', !!q('.faixa-agenda'));
  });

  await passo('2 carro novo (placa nova)', async () => {
    const antes = Store.s.atendimentos.length, fichaAntes = Math.max(0, ...DB.doDia().map((a) => a.numero || 0), ...Store.s.atendimentos.filter((a) => U.dia(a.entrada_em) === U.dia()).map((a) => a.numero || 0));
    await ir('entrada'); await digitar('TST1A23');
    ok('teclado: placa Mercosul completa oferece “Carro novo”', !!q('[data-acao=novo]') && q('.placa-visor').innerText.replace(/\s/g, '') === 'TST1A23');
    await clic('[data-acao=novo]'); await modeloCorCliente('corolla', 'Preto', 'maria teste da silva', '11977776666');
    ok('chegada: chega no passo do serviço com o primeiro serviço marcado', /Qual serviço/.test(tela()) && qq('.serv.sel').length === 1);
    await clic('[data-acao=confirmar]');
    const a = ultimo(), c = DB.cliente(a.cliente_id), v = DB.veiculo('TST1A23');
    ok('chegada: atendimento criado', Store.s.atendimentos.length === antes + 1 && a.status === 'aguardando' && a.numero === fichaAntes + 1, `ficha ${a.numero}, esperado ${fichaAntes + 1}`);
    ok('chegada: cliente com nome arrumado e telefone', c.nome === 'Maria Teste da Silva' && c.telefone === '11977776666' && a.cliente_novo === true, c.nome);
    ok('chegada: veículo com o tamanho do catálogo e preço certo', v.modelo === 'Corolla' && v.porte === 'm' && a.total === DB.preco(sv[0], 'm'), `${v.porte} ${a.total}`);
    ok('chegada: tela final com ficha e botão de confirmação no WhatsApp', /Entrada registrada/.test(tela()) && !!q('[data-acao=comprovante]'));
    await clic('[data-acao=comprovante]');
    ok('WhatsApp de chegada: nome, carro, placa e link', zap.length === 1 && /Maria/.test(zap[0][1]) && /Corolla preto/.test(zap[0][1]) && /c\/\?t=/.test(zap[0][1]) && zap[0][0] === '11977776666', zap[0] && zap[0][1]);
  });

  await passo('3 placa antiga, sem placa, placa repetida', async () => {
    await ir('entrada'); await digitar('ABC1234');
    ok('teclado: placa antiga (ABC-1234) é aceita', !!q('[data-acao=novo]'));
    await digitar('9'); ok('teclado: não passa de 7 caracteres', q('.placa-visor').innerText.replace(/\s/g, '') === 'ABC1234');
    for (let i = 0; i < 7; i++) q('.tecla[data-t=apagar]').click(); await esp(60);
    q('.tecla[data-t="1"]').click(); await esp(60);
    ok('teclado: número na 1ª posição é recusado', q('.placa-visor').innerText.replace(/\s/g, '') === '');
    await digitar('TST'); ok('placa pela metade já acha o carro e avisa que está no pátio', /já está no pátio/.test(tela()));
    await clic('[data-placa="TST1A23"]'); ok('carro que já está no pátio não entra de novo', /^#\/patio/.test(location.hash), location.hash);
    await ir('entrada'); await clic('[data-acao=semplaca]'); await modeloCorCliente('cg 160', 'Vermelho', 'Moto Sem Placa', '');
    await clic('[data-acao=confirmar]');
    const a = ultimo();
    ok('carro sem placa: entra, é moto e usa o preço de moto', U.semPlaca(a.placa) && DB.veiculo(a.placa).porte === 'moto' && a.total === DB.preco(sv[0], 'moto'), a.total);
  });

  await passo('4 cliente que já existe', async () => {
    const c = Store.s.clientes.find((x) => x.visitas >= 3 && DB.veiculosDe(x.id).length === 1 && !DB.abertoDaPlaca(DB.veiculosDe(x.id)[0].placa) && DB.fidelidade(x, 1).alcancados.length === 0);
    const v = DB.veiculosDe(c.id)[0], visitas = c.visitas;
    await ir('entrada'); await digitar(v.placa); await clic(`[data-placa="${v.placa}"]`);
    ok('carro conhecido: vai direto ao serviço, com o serviço da última vez marcado', /Qual serviço/.test(tela()) && qq('.serv.sel').length >= 1 && new RegExp(`já veio ${visitas}`).test(tela()));
    ok('fidelidade: mostra em que lavagem está', /lavagem/.test(q('.fidel') ? q('.fidel').innerText : ''));
    await clic('[data-acao=confirmar]');
    ok('carro conhecido: visita somada ao cliente', c.visitas === visitas + 1 && ultimo().cliente_novo === false);
    // telefone já cadastrado em carro novo
    await ir('entrada'); await digitar('NOV2B34'); await clic('[data-acao=novo]');
    const i = q('#eModelo'); i.value = 'onix'; i.dispatchEvent(new Event('input')); await esp(60); await clic('[data-modelo]'); await clic('[data-cor="Branco"]');
    const f = q('#eForm'); f.nome.value = 'Outro Nome'; f.telefone.value = c.telefone; f.telefone.dispatchEvent(new Event('input')); await esp(80);
    ok('telefone já cadastrado: oferece usar o cadastro', !!q(`[data-usar="${c.id}"]`));
    await clic(`[data-usar="${c.id}"]`); await clic('[data-acao=confirmar]');
    ok('segundo carro fica no mesmo cliente', DB.veiculo('NOV2B34').cliente_id === c.id && DB.veiculosDe(c.id).length === 2);
    // procurar pelo nome
    await ir('entrada'); await clic('[data-acao=pelonome]');
    const b = q('#eBusca'); b.value = c.nome.split(' ')[0]; b.dispatchEvent(new Event('input')); await esp(80);
    ok('procurar pelo nome acha o cliente e os carros dele', !!q(`[data-outro="${c.id}"]`) || qq('.achado-cli').length > 0);
  });

  await passo('5 fidelidade', async () => {
    const d = Store.s.dica, c = Store.s.clientes.find((x) => x.nome === d.nome);
    await ir('entrada'); await digitar(d.placa); await clic(`[data-placa="${d.placa}"]`);
    ok('10ª lavagem: aparece o prêmio com a frase para o funcionário', !!q('.premio.festa') && /usar o desconto agora ou guardar/.test(tela()));
    const cheio = U.num(q('.pe-total b').innerText);
    await clic('[data-nivel="10"]');
    ok('usar 10%: total cai 10%', Math.abs(U.num(q('.pe-total b').innerText) - cheio * 0.9) < 0.01, q('.pe-total').innerText);
    await clic('[data-nivel="0"]'); ok('guardar: volta ao valor cheio', Math.abs(U.num(q('.pe-total b').innerText) - cheio) < 0.01);
    await clic('[data-nivel="10"]'); await clic('[data-acao=confirmar]');
    const a = ultimo();
    ok('prêmio usado: desconto gravado e pontos zerados', a.pontos_usados === 10 && Math.abs(a.desconto - cheio * 0.1) < 0.01 && DB.fidelidade(c).saldo === 0, `saldo ${DB.fidelidade(c).saldo}`);
    DB.status(a, 'cancelado');
    ok('cancelar devolve os pontos do prêmio', DB.fidelidade(c).saldo === 9, DB.fidelidade(c).saldo);
    // prêmio maior: 19 guardadas → a 20ª dá 30%
    c.visitas += 10; await ir('entrada'); await digitar(d.placa); await clic(`[data-placa="${d.placa}"]`);
    ok('20ª lavagem: oferece 30% e também 10%', !!q('[data-nivel="20"]') && !!q('[data-nivel="10"]') && /30%/.test(q('.premio').innerText));
    c.visitas -= 10;
  });

  await passo('6 valor, tamanho, serviço livre, a combinar, outro dia', async () => {
    await ir('entrada'); await digitar('VAL3C45'); await clic('[data-acao=novo]'); await modeloCorCliente('gol', 'Prata', 'Cliente Valor', '11955554444');
    const p = U.num(q('.pe-total b').innerText);
    await clic('[data-acao=porte]'); await clic(qq('.modal-acoes .btn')[3]);   // Grande
    ok('trocar o tamanho muda o preço', U.num(q('.pe-total b').innerText) === DB.preco(sv[0], 'g') && U.num(q('.pe-total b').innerText) !== p, q('.pe-total b').innerText);
    await clic(`[data-serv="${sv[1].id}"]`);
    ok('dois serviços: soma', U.num(q('.pe-total b').innerText) === DB.preco(sv[0], 'g') + DB.preco(sv[1], 'g'));
    await clic('[data-acao=extra]'); campo(modal(), 'nome', 'polimento de farol'); campo(modal(), 'valor', '120'); await clic('.modal-acoes .btn-marca');
    ok('outro serviço: entra na conta', /Polimento de farol/.test(tela()) && U.num(q('.pe-total b').innerText) === DB.preco(sv[0], 'g') + DB.preco(sv[1], 'g') + 120);
    await clic('[data-tirar-extra]'); ok('outro serviço: dá para tirar', !/Polimento de farol/.test(tela()));
    await clic('[data-acao=valor]'); campo(modal(), 'valor', '99,90'); await clic('.modal-acoes .btn-marca');
    ok('ajustar valor: vale o digitado', Math.abs(U.num(q('.pe-total b').innerText) - 99.9) < 0.001, q('.pe-total b').innerText);
    await clic('[data-acao=outrodia]'); campo(modal(), 'dia', U.dia(U.somaDias(new Date(), 2))); campo(modal(), 'hora', '17:30'); await clic('.modal-acoes .btn-marca');
    await clic('[data-obs]'); await clic('[data-acao=confirmar]');
    const a = ultimo();
    ok('confirmado: valor ajustado, previsão em outro dia e observação', Math.abs(a.total - 99.9) < 0.001 && U.dia(a.previsao) === U.dia(U.somaDias(new Date(), 2)) && U.hora(a.previsao) === '17:30' && !!a.obs, `${a.total} ${a.previsao} ${a.obs}`);
    // serviço sem preço pergunta o valor
    DB.salvarServico(sv[3], { precos: { moto: 0, p: 0, m: 0, g: 0, x: 0 }, minutos: 480 });
    await ir('entrada'); await digitar('CMB4D56'); await clic('[data-acao=novo]'); await modeloCorCliente('uno', 'Branco', 'Cliente Combinar', '');
    ok('serviço sem preço aparece “a combinar”', /a combinar/.test(q(`[data-serv="${sv[3].id}"]`).innerText));
    await clic(`[data-serv="${sv[3].id}"]`); ok('ao marcar, pergunta o valor', !!modal() && /Quanto vai custar/.test(modal().innerText));
    campo(modal(), 'valor', '350'); await clic('.modal-acoes .btn-marca'); await clic(`[data-serv="${sv[0].id}"]`); await clic('[data-acao=confirmar]');
    ok('valor combinado gravado no serviço', ultimo().servicos.length === 1 && ultimo().servicos[0].valor === 350 && ultimo().total === 350, JSON.stringify(ultimo().servicos));
    ok('sem hora escolhida, a chegada não inventa horário', ultimo().previsao == null);
    DB.salvarServico(sv[3], { precos: { moto: 80, p: 180, m: 220, g: 260, x: 300 }, minutos: 180 });
  });

  await passo('7 pátio: todas as etapas', async () => {
    zap.length = 0;
    const a = Store.s.atendimentos.find((x) => x.placa === 'TST1A23'), c = DB.cliente(a.cliente_id), card = () => q(`[data-id="${a.id}"]`);
    await ir('patio');
    ok('pátio: carro novo aparece na fila com botão “Começar a lavar”', !!card() && !!q('[data-acao=lavar]', card()));
    await clic(q('[data-acao=lavar]', card())); ok('começar: pergunta quem vai lavar', /Quem vai lavar/.test(modal().innerText));
    await clic('.modal-acoes .btn');
    ok('lavando: etapa, hora de início e quem lava', a.status === 'lavando' && !!a.inicio_em && a.lavador === DB.cfg().lavadores[0]);
    await clic(q('[data-acao=pronto]', card())); ok('pronto: oferece avisar o cliente', a.status === 'pronto' && /Avisar/.test(modal().innerText));
    await clic('.modal-acoes .btn-zap');
    ok('aviso de pronto: mensagem com carro, placa e total', zap.length === 1 && /está pronto/.test(zap[0][1]) && zap[0][1].includes(dinheiro(a.total)) && !!a.avisado_em, zap[0] && zap[0][1]);
    await ir('patio/pronto'); ok('prontos: carro aparece só com “Entregar” (já avisado)', !!q('[data-acao=entregar]', card()) && !q('[data-acao=avisar]', card()));
    // voltar etapa
    await clic(q('[data-acao=detalhe]', card())); await clic('.modal [data-v=voltar]');
    ok('“ainda não está pronto”: volta para lavando', a.status === 'lavando' && !a.pronto_em && !a.avisado_em);
    DB.status(a, 'pronto'); await ir('patio/pronto');
    // observação e troca de serviço
    await clic(q('[data-acao=detalhe]', card())); await clic('.modal [data-v=obs]'); campo(modal(), 'obs', 'risco na porta'); await clic('.modal-acoes .btn-marca');
    ok('observação gravada e aparece no cartão', a.obs === 'risco na porta' && /risco na porta/.test(card().innerText));
    await fecharModais(); await clic(q('[data-acao=detalhe]', card())); await clic('.modal [data-v=servicos]');
    await clic(q(`.modal [data-serv="${sv[1].id}"]`)); await clic('.modal-fundo:last-child .modal-acoes .btn-marca');
    ok('trocar serviços: soma o novo serviço', a.servicos.length === 2 && a.total === DB.preco(sv[0], 'm') + DB.preco(sv[1], 'm'), a.total);
    await fecharModais(); await ir('patio/pronto');
    // entregar
    const gasto = c.gasto, entreguesAntes = DB.entreguesHoje().length;
    await clic(q('[data-acao=entregar]', card())); ok('entregar: mostra o total, as formas de pagamento e o fiado', modal().innerText.includes(dinheiro(a.total)) && qq('.grade-pag [data-pag]').length === DB.cfg().pagamentos.length && !!q('.modal [data-pag="Fiado"]'));
    await clic('[data-pag="Dinheiro"]'); await esp(250);
    ok('entregue: pagamento, hora e gasto do cliente', a.status === 'entregue' && a.pagamento === 'Dinheiro' && !!a.entregue_em && c.gasto === gasto + a.total && DB.entreguesHoje().length === entreguesAntes + 1);
    ok('cliente novo: oferece pedir avaliação no Google', !!modal() && /avaliação/.test(modal().innerText));
    await clic('.modal-acoes .btn-zap');
    ok('pedido de avaliação: mensagem com o link e só uma vez por cliente', /g\.page/.test(zap[zap.length - 1][1]) && !!c.avaliacao_pedida_em);
    await fecharModais(); await ir('patio/entregue');
    ok('entregues hoje: carro aparece com a forma de pagamento', !!card() && /Dinheiro/.test(card().innerText));
    await clic(q('[data-acao=detalhe]', card())); await clic('.modal [data-v=voltar]');
    ok('desfazer a entrega: volta para prontos e tira do gasto', a.status === 'pronto' && !a.pagamento && c.gasto === gasto);
    await fecharModais(); await ir('patio/pronto'); await clic(q('[data-acao=detalhe]', card())); await clic('.modal [data-v=cancelar]'); await clic('.modal-fundo:last-child .modal-acoes .btn-perigo');
    ok('cancelar: sai do pátio e não conta como lavagem', a.status === 'cancelado' && c.visitas === 0 && !card());
    await fecharModais();
  });

  await passo('8 carro que fica mais de um dia', async () => {
    const c = Store.s.clientes.find((x) => x.nome === 'Cliente Valor'), antes = DB.entreguesHoje().length;
    const a = Store.s.atendimentos.find((x) => x.cliente_id === c.id);
    a.entrada_em = new Date(Date.now() - 3 * 864e5).toISOString(); Store.salvar();
    await ir('patio'); ok('carro de 3 dias atrás: cartão mostra a data de chegada', new RegExp(U.dataCurta(a.entrada_em)).test(q(`[data-id="${a.id}"]`).innerText), q(`[data-id="${a.id}"]`).innerText.slice(0, 120));
    DB.status(a, 'pronto'); DB.status(a, 'entregue', { pagamento: 'Pix' });
    ok('entregue hoje conta em “Entregues hoje”, mesmo tendo chegado antes', DB.entreguesHoje().length === antes + 1 && DB.entreguesHoje().includes(a));
    const h0 = U.inicioDia(), r = An.resumo(Store.s.atendimentos, h0, U.somaDias(h0, 1));
    ok('dinheiro conta hoje; o carro conta no dia em que chegou', r.porPagamento.get('Pix') && r.faturamento >= a.total && !Store.s.atendimentos.filter((x) => x.status !== 'cancelado' && U.dia(x.entrada_em) === U.dia()).includes(a));
  });

  await passo('9 clientes', async () => {
    const c = Store.s.clientes.find((x) => x.nome === 'Maria Teste da Silva');
    await ir('clientes'); const b = q('#cBusca');
    b.value = 'maria silva'; b.dispatchEvent(new Event('input')); await esp(80); ok('busca por nome (palavras soltas)', !!q(`a[href="#/cliente/${c.id}"]`));
    b.value = '7777-6666'; b.dispatchEvent(new Event('input')); await esp(80); ok('busca por telefone', !!q(`a[href="#/cliente/${c.id}"]`));
    b.value = 'tst1a'; b.dispatchEvent(new Event('input')); await esp(80); ok('busca por placa', !!q(`a[href="#/cliente/${c.id}"]`));
    b.value = ''; b.dispatchEvent(new Event('input'));
    await ir('cliente/' + c.id, 500);
    ok('ficha: nome, telefone, veículo e histórico', /Maria Teste/.test(tela()) && /Corolla/.test(tela()) && qq('#hist .linha').length >= 1);
    await clic('[data-acao=editar]'); campo(modal(), 'nome', 'maria editada'); campo(modal(), 'telefone', '11'); await clic('.modal-acoes .btn-marca');
    ok('editar cliente: telefone errado é recusado', !!modal()); campo(modal(), 'telefone', '(11) 96666-5555'); await clic('.modal-acoes .btn-marca'); await esp(200);
    ok('editar cliente: salva', c.nome === 'Maria Editada' && c.telefone === '11966665555');
    await clic('[data-acao=veiculo]'); campo(modal(), 'modelo', 'Corolla XEi'); q('[name=porte]', modal()).value = 'g'; await clic('.modal-acoes .btn-marca'); await esp(200);
    ok('editar veículo: salva modelo e tamanho', DB.veiculo('TST1A23').modelo === 'Corolla XEi' && DB.veiculo('TST1A23').porte === 'g');
    ok('funcionário não vê quanto o cliente gastou', !/R\$/.test(q('.cartao:last-child .cartao-cab').innerText));
  });

  await passo('10 agenda', async () => {
    zap.length = 0;
    await ir('agenda'); const n = DB.agenda().length;
    await clic('#gNovo'); campo(modal(), 'nome', 'Cliente Da Agenda'); campo(modal(), 'telefone', '11944443333'); campo(modal(), 'dia', U.dia(U.somaDias(new Date(), 1))); campo(modal(), 'hora', '10:00');
    q('[name=servico]', modal()).value = sv[2].nome; campo(modal(), 'veiculo', 'Civic preto'); campo(modal(), 'placa', 'agd5e67'); await clic('.modal-acoes .btn-marca'); await esp(250);
    const g = Store.s.agendamentos[Store.s.agendamentos.length - 1];
    ok('marcar horário: salva e aparece na lista', DB.agenda().length === n + 1 && g.nome === 'Cliente da Agenda' && g.placa === 'AGD5E67' && !!q(`[data-g="${g.id}"]`), g.nome);
    await clic('#gNovo'); campo(modal(), 'nome', 'Outro Cliente'); campo(modal(), 'dia', U.dia(g.quando)); campo(modal(), 'hora', '10:10'); await clic('.modal-acoes .btn-marca');
    ok('horário em cima de outro: avisa antes de marcar', !!modal() && DB.agenda().length === n + 1);
    await clic('.modal-acoes .btn-marca'); await esp(250); ok('tocando de novo, marca assim mesmo', DB.agenda().length === n + 2);
    const g2 = Store.s.agendamentos[Store.s.agendamentos.length - 1];
    await clic(q(`[data-g="${g2.id}"] [data-acao=ver]`)); await clic('.modal [data-v=cancelar]'); await clic('.modal-fundo:last-child .modal-acoes .btn-perigo'); await esp(200);
    ok('cancelar horário: some da agenda', g2.status === 'cancelado' && !q(`[data-g="${g2.id}"]`));
    await clic(q(`[data-g="${g.id}"] [data-acao=lembrar]`)); ok('lembrete: mensagem com o dia e a hora', zap.length === 1 && /amanhã às 10:00/.test(zap[0][1]), zap[0] && zap[0][1]);
    await clic(q(`[data-g="${g.id}"] [data-acao=ver]`)); await clic('.modal [data-v=editar]'); campo(modal(), 'hora', '16:45'); await clic('.modal-fundo:last-child .modal-acoes .btn-marca'); await esp(250);
    ok('mudar a hora: salva', U.hora(g.quando) === '16:45');
    await fecharModais(); await ir('agenda'); await clic(q(`[data-g="${g.id}"] [data-acao=chegou]`)); await esp(300);
    ok('chegou (cliente novo): entrada abre com a placa preenchida', q('.placa-visor').innerText.replace(/\s/g, '') === 'AGD5E67');
    await clic('[data-acao=novo]'); await modeloCorCliente('civic', 'Preto');
    ok('chegou: nome e telefone do agendamento já preenchidos', q('#eForm').nome.value === 'Cliente da Agenda' && /94444-3333/.test(q('#eForm').telefone.value));
    q('#eForm').requestSubmit(); await esp();
    ok('chegou: serviço combinado já marcado', qq('.serv.sel').length === 1 && q('.serv.sel').innerText.includes(sv[2].nome));
    await clic('[data-acao=confirmar]');
    ok('chegou: vira atendimento e o horário sai da agenda', g.status === 'chegou' && g.atendimento_id === ultimo().id && ultimo().placa === 'AGD5E67');
    const g3 = DB.agenda()[0]; await ir('agenda'); await clic(q(`[data-g="${g3.id}"] [data-acao=ver]`)); await clic('.modal [data-v=faltou]'); await esp(200);
    ok('“não veio”: sai da agenda', g3.status === 'faltou');
  });

  await passo('11 o que o funcionário não acessa', async () => {
    for (const r of ['resultados', 'financeiro', 'ajustes', 'inicio', 'admin']) { await ir(r); ok(`funcionário não abre “${r}”`, location.hash === '#/balcao', location.hash); }
    await clic('#btMenu'); ok('menu do funcionário: agenda, clientes, ajuda, aparência e sair', /Agenda/.test(modal().innerText) && /Aparência/.test(modal().innerText) && /Sair/.test(modal().innerText));
    await clic('.modal [data-tema=escuro]'); ok('aparência escura liga', App.escuro() && getComputedStyle(document.body).backgroundColor === 'rgb(14, 18, 22)');
    await clic('.modal [data-tema=claro]'); ok('aparência clara volta', !App.escuro() && getComputedStyle(document.body).backgroundColor === 'rgb(242, 244, 247)');
    await fecharModais();
  });

  // =====================================================================================
  await entrar('dono');
  await passo('12 início do dono', async () => {
    const h0 = U.inicioDia(), r = An.resumo(Store.s.atendimentos, h0, U.somaDias(h0, 1));
    const soma = Store.s.atendimentos.filter((a) => a.status === 'entregue' && U.dia(a.entregue_em) === U.dia()).reduce((t, a) => t + a.total, 0);
    ok('início: “Recebido hoje” = soma dos carros entregues hoje', q('.hoje-num b').innerText === dinheiro(soma) && Math.abs(r.faturamento - soma) < 0.01, q('.hoje-num b').innerText + ' / ' + dinheiro(soma));
    const pag = qq('.grade2 .cartao')[0].innerText;
    ok('início: caixa por forma de pagamento fecha com o recebido', pag.includes(dinheiro(soma)));
    ok('início: “a receber” = tudo que está no pátio', q('.hoje-num small').innerText.includes(dinheiro(DB.abertos().reduce((t, a) => t + a.total, 0))));
    ok('início: pátio ao vivo com botões de etapa', qq('.atend').length > 0 && qq('.atend-acoes .btn').length > 0);
  });

  await passo('13 resultados', async () => {
    for (const p of ['hoje', '7d', 'mes', 'mesp', '90d']) {
      await ir('resultados', 500); await clic(`[data-p="${p}"]`); await esp(500);
      ok(`resultados (${p}): abre com números e gráficos`, qq('.kpi').length === 4 && (qq('.graf').length >= 1 || /Sem movimento/.test(tela())) && !/Não consegui/.test(tela()));
    }
    await clic('[data-p="7d"]'); await esp(500);
    const de = U.somaDias(U.inicioDia(), -6), ate = U.somaDias(U.inicioDia(), 1);
    const soma = Store.s.atendimentos.filter((a) => a.status === 'entregue' && new Date(a.entregue_em) >= de && new Date(a.entregue_em) < ate).reduce((t, a) => t + a.total, 0);
    const carros = Store.s.atendimentos.filter((a) => a.status !== 'cancelado' && new Date(a.entrada_em) >= de && new Date(a.entrada_em) < ate).length;
    ok('7 dias: faturamento e carros conferem com a conta feita à mão', qq('.kpi b')[0].innerText === dinheiro(soma) && qq('.kpi b')[1].innerText === String(carros), qq('.kpi b')[0].innerText + ' / ' + dinheiro(soma) + ' · ' + qq('.kpi b')[1].innerText + ' / ' + carros);
    await clic('[data-m=qtd]'); await esp(500); ok('gráfico troca para “Carros por dia”', /Carros por dia/.test(tela()));
    const col = q('.graf .col'); col.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await esp(60);
    ok('gráfico: tocar na coluna mostra o valor do dia', !q('.graf-dica').hidden && /carro/.test(q('.graf-dica').textContent), q('.graf-dica').textContent);
    ok('gráfico: tem a opção “Ver em tabela”', qq('.ver-tabela').length >= 1);
  });

  await passo('14 financeiro', async () => {
    await ir('financeiro', 600); const n = Store.s.despesas.filter((d) => !d.excluido).length;
    await clic('#fNova'); await clic('.modal-acoes .btn-marca'); ok('despesa sem dados é recusada', !!modal());
    campo(modal(), 'descricao', 'Conta de teste'); campo(modal(), 'valor', '123,45'); await clic('.modal-acoes .btn-marca'); await esp(700);
    const d = Store.s.despesas[Store.s.despesas.length - 1];
    ok('lançar despesa: salva e aparece', d.valor === 123.45 && /Conta de teste/.test(tela()) && Store.s.despesas.filter((x) => !x.excluido).length === n + 1);
    const entrou = U.num(qq('.kpi b')[0].innerText), saiu = U.num(qq('.kpi b')[1].innerText), sobrou = U.num(qq('.kpi b')[2].innerText);
    ok('entrou − saiu = sobrou', Math.abs(entrou - saiu - sobrou) < 0.01, `${entrou} - ${saiu} = ${sobrou}`);
    await clic(`[data-d="${d.id}"]`); campo(modal(), 'valor', '200'); await clic('.modal-acoes .btn-marca'); await esp(700); ok('editar despesa', d.valor === 200);
    await clic(`[data-d="${d.id}"]`); await clic('.modal-acoes .btn-perigo'); await esp(700); ok('excluir despesa: some da lista', d.excluido === true && !/Conta de teste/.test(tela()));
    await clic('[data-m="-1"]'); await esp(700); ok('mês anterior abre com despesas do exemplo', /Aluguel/.test(tela()) && !q('[data-m="1"]').disabled);
    ok('dia a dia e planilha do mês', !!q('.tabela') && !!q('#fPlanilha'));
  });

  await passo('14b produtos e pedido de compra', async () => {
    await ir('inicio'); window.__semRecarregar = 1;
    await clic('#lateral a[href="#/produtos"]'); await esp(300);
    ok('menu → Produtos abre a tela sem recarregar a página', App.rota === 'produtos' && window.__semRecarregar === 1 && /Meus produtos/.test(tela()), location.href);
    ok('links do menu ficam no mesmo endereço', qq('#lateral a[href^="#/"]').every((x) => x.href.startsWith(location.href.split('#')[0])), q('#lateral a[href="#/produtos"]').href);
    const n = DB.produtos().length;
    await clic('#pNovo'); await clic('.modal-acoes .btn-marca'); ok('produto sem nome é recusado', !!modal());
    campo(modal(), 'nome', 'Shampoo de teste'); campo(modal(), 'preco', '45,90'); campo(modal(), 'unidade', 'galão 5 L'); campo(modal(), 'estoque', '3'); campo(modal(), 'minimo', '2'); campo(modal(), 'fornecedor', 'Fornecedor Teste');
    await clic('.modal-acoes .btn-marca'); await esp(300);
    const p = DB.produtos().find((x) => x.nome === 'Shampoo de teste');
    ok('cadastrar produto: salva com valor, embalagem, estoque e mínimo', !!p && p.preco === 45.9 && p.unidade === 'galão 5 L' && p.estoque === 3 && p.minimo === 2 && DB.produtos().length === n + 1, JSON.stringify(p));
    ok('depois de salvar continua em Produtos', App.rota === 'produtos' && /Shampoo de teste/.test(tela()));
    const linha = () => q(`[data-p="${p.id}"]`);
    await clic('[data-mexe="-1"]', linha()); ok('− tira 1 do estoque e fica “acabando”', p.estoque === 2 && linha().classList.contains('acabando'));
    await clic('[data-mexe="1"]', linha()); ok('+ põe 1 no estoque', p.estoque === 3 && !linha().classList.contains('acabando'));
    await clic('[data-editar]', linha()); campo(modal(), 'preco', '50'); await clic('.modal-acoes .btn-marca'); await esp(300); ok('editar produto: muda o valor', p.preco === 50);
    await clic('[data-pedir]', linha()); ok('Pedir: produto vai para o pedido', /No pedido/.test(linha().innerText) && /Pedido\s*1/.test(q('.abas').innerText));
    await clic('#pFaltam'); await esp(300);
    ok('“Pôr no pedido” leva os que estão acabando', App.rota === 'produtos' && App.args[0] === 'pedido' && qq('#prCorpo [data-i]').length === 1 + DB.produtos().filter(DB.acabando).length);
    const itP = () => qq('#prCorpo [data-i]').find((x) => x.innerText.includes('Shampoo de teste'));
    const q0 = Number(itP().querySelector('.qtd b').textContent);
    await clic('[data-q="1"]', itP()); ok('pedido: + aumenta a quantidade', Number(itP().querySelector('.qtd b').textContent) === q0 + 1);
    // produto que não está no estoque
    await clic('#pAdd'); const b = q('#adBusca'); b.value = 'Cera de carnaúba'; b.dispatchEvent(new Event('input')); await esp(100);
    ok('pôr no pedido: busca no estoque e oferece produto novo', /Nada no estoque/.test(modal().innerText) && !!q('#adNovo'));
    await clic('#adNovo'); await esp(200);
    ok('produto novo já vem com o nome digitado', q('[name=nome]', modal()).value === 'Cera de carnaúba' && q('[name=cadastrar]', modal()).checked);
    campo(modal(), 'qtd', '2'); campo(modal(), 'preco', '80'); campo(modal(), 'unidade', 'pote 500 g'); await clic('.modal-acoes .btn-marca'); await esp(300);
    ok('produto novo entra no pedido marcado como “novo”', /Cera de carnaúba/.test(tela()) && /novo/.test(qq('#prCorpo [data-i]').find((x) => x.innerText.includes('Cera')).innerText));
    // pagamento, frete, desconto, prazo
    ok('pagamento: só Pix, Boleto, Cartão de crédito, Dinheiro e A combinar', qq('#pPag [data-pag]').map((x) => x.dataset.pag).join() === 'Pix,Boleto,Cartão de crédito,Dinheiro,A combinar');
    ok('Pix: não pede mais nada', !q('#pCondBox').innerHTML.trim());
    await clic('#pPag [data-pag="Cartão de crédito"]');
    ok('cartão de crédito: pergunta as parcelas (à vista até 12x, com o valor)', qq('#pParc option').length === 12 && /^À vista/.test(q('#pParc option').textContent) && /^3x de R\$/.test(qq('#pParc option')[2].textContent));
    await clic('#pPag [data-pag="Dinheiro"]'); ok('dinheiro: não pede parcelas', !q('#pParc'));
    await clic('#pPag [data-pag="Boleto"]'); ok('boleto: pergunta o vencimento', qq('#pBol [data-bol]').length >= 6 && !q('#pParc'));
    await clic('#pBol [data-bol="28 dias"]');
    ok('frete grátis: não pede valor', q('#pFrete .ativo').dataset.frete === 'gratis' && q('#pFreteV').hidden);
    await clic('#pFrete [data-frete="retirar"]'); ok('vou buscar: não pede valor', q('#pFreteV').hidden);
    await clic('#pFrete [data-frete="pago"]'); ok('frete pago: pede só o valor do frete', !q('#pFreteV').hidden);
    const fr = q('#pFreteN'); fr.value = '25'; fr.dispatchEvent(new Event('input'));
    ok('desconto fica escondido até tocar em “o fornecedor deu desconto”', q('#pDescV').hidden && !q('#pDescL').hidden);
    await clic('#pDescL'); const ds = q('#pDesc'); ds.value = '10'; ds.dispatchEvent(new Event('input'));
    const fo = q('#pForn'); fo.value = 'Distribuidora Teste'; fo.dispatchEvent(new Event('input'));
    const fn = q('#pFone'); fn.value = '11 98765-4321'; fn.dispatchEvent(new Event('input'));
    const en = q('#pEntrega'); en.value = U.dia(U.somaDias(new Date(), 5)); en.dispatchEvent(new Event('change'));
    const ob = q('#pObs'); ob.value = 'Entregar pela manhã'; ob.dispatchEvent(new Event('input')); await esp(100);
    const itens = qq('#prCorpo [data-i]').length, sub = DB.produtos().length >= 0 && JSON.parse(localStorage.getItem('lr.pref.pedido.' + (DB.lava().id || 'demo'))).itens.reduce((t, i) => t + i.qtd * i.preco, 0);
    ok('total = produtos − desconto + frete', U.num(q('#pTotais .par.total b').innerText) === Math.round((sub - 10 + 25) * 100) / 100, q('#pTotais').innerText);
    const nPed = DB.pedidos().length;
    await clic('#pGerar'); await esp(700);
    const ped = DB.pedidos()[0];
    ok('salvar: pedido com pagamento, condição, frete, desconto, prazo e fornecedor', DB.pedidos().length === nPed + 1 && ped.pagamento === 'Boleto' && ped.condicao === '28 dias' && ped.frete_tipo === 'pago' && ped.frete === 25 && ped.desconto === 10 && ped.fone === '11987654321' && ped.fornecedor === 'Distribuidora Teste' && !!ped.entrega && ped.obs === 'Entregar pela manhã' && ped.itens.length === itens, JSON.stringify(ped).slice(0, 300));
    ok('salvar: abre a janela do pedido com as opções do PDF', !!modal() && /Salvar PDF como|Enviar ou salvar/.test(modal().innerText) && /Boleto · 28 dias/.test(modal().innerText) && carrinhoVazio());
    ok('janela do pedido: total confere', U.num(qq('.modal .par.total b').pop().innerText) === ped.total && ped.total === Math.round((ped.subtotal - 10 + 25) * 100) / 100, ped.total);
    // "Salvar como": no computador abre a janela de escolher a pasta
    let gravado = null, nomeSug = '';
    const oPick = window.showSaveFilePicker;
    window.showSaveFilePicker = async (o) => { nomeSug = o.suggestedName; return { createWritable: async () => ({ write: async (b) => { gravado = b; }, close: async () => {} }) }; };
    await clic(qq('.modal-acoes button').find((x) => /Salvar PDF como/.test(x.innerText))); for (let k = 0; k < 40 && !gravado; k++) await esp(200);
    window.showSaveFilePicker = oPick;
    ok('Salvar PDF como…: grava o PDF com o nome do pedido e do fornecedor', !!gravado && gravado.type === 'application/pdf' && gravado.size > 3000 && nomeSug === `Pedido de compra ${ped.numero} - Distribuidora Teste.pdf`, nomeSug + ' ' + (gravado && gravado.size));
    ok('janela tem Imprimir e WhatsApp do fornecedor', qq('.modal-acoes button').some((x) => /Imprimir/.test(x.innerText)) && qq('.modal-acoes button').some((x) => /WhatsApp do fornecedor/.test(x.innerText)));
    // editar mantém o número
    await clic(qq('.modal-acoes button').find((x) => /Editar pedido/.test(x.innerText))); await esp(300);
    ok('editar: volta para o pedido com tudo preenchido', App.args[0] === 'pedido' && /Editando o pedido nº/.test(tela()) && q('#pBol .ativo').dataset.bol === '28 dias' && q('#pFrete .ativo').dataset.frete === 'pago' && !q('#pDescV').hidden);
    await clic('[data-q="1"]', itP()); await clic('#pGerar'); await esp(700); await fecharModais();
    ok('editar: salva no mesmo número, sem criar outro', DB.pedidos().length === nPed + 1 && DB.pedidos()[0].id === ped.id && ped.itens.find((i) => i.produto_id === p.id).qtd === q0 + 2);
    // chegou: estoque, produto novo e despesa
    const est = p.estoque, qtdP = ped.itens.find((i) => i.produto_id === p.id).qtd, nDesp = Store.s.despesas.filter((d) => !d.excluido).length;
    await clic(`[data-ped="${ped.id}"]`); await clic(qq('.modal-acoes button').find((x) => /^Chegou$/.test(x.innerText.trim()))); await esp(200);
    ok('chegou: pergunta se lança nas despesas (já marcado)', !!q('#chDesp') && q('#chDesp').checked);
    await clic(qq('.modal-acoes button').find((x) => /^Chegou$/.test(x.innerText.trim()))); await esp(400);
    const cera = DB.produtos().find((x) => x.nome === 'Cera de carnaúba');
    ok('chegou: soma no estoque', p.estoque === est + qtdP && ped.status === 'recebido', `${est} + ${qtdP} = ${p.estoque}`);
    ok('chegou: produto novo entra no estoque com a quantidade', !!cera && cera.estoque === 2 && cera.preco === 80 && cera.unidade === 'pote 500 g');
    const desp = Store.s.despesas.find((d) => d.id === ped.despesa_id);
    ok('chegou: total lançado nas despesas como Produtos', Store.s.despesas.filter((d) => !d.excluido).length === nDesp + 1 && desp && desp.valor === ped.total && desp.categoria === 'Produtos');
    ok('pedido que chegou sai de “Aguardando”', !q(`[data-ped="${ped.id}"]`));
    await clic('[data-f="recebido"]'); await clic(`[data-ped="${ped.id}"]`); ok('pedido recebido não soma de novo', !qq('.modal-acoes button').some((x) => /Chegou/.test(x.innerText)));
    // pedir de novo
    await clic(qq('.modal-acoes button').find((x) => /Pedir de novo/.test(x.innerText))); await esp(300);
    ok('pedir de novo: copia os itens para um pedido novo', App.args[0] === 'pedido' && !/Editando/.test(tela()) && qq('#prCorpo [data-i]').length === ped.itens.length);
    await clic('#pGerar'); await esp(700); await fecharModais();
    const copia = DB.pedidos()[0];
    ok('pedir de novo: número novo', copia.id !== ped.id && copia.numero === ped.numero + 1);
    await clic('[data-f="aberto"]'); await clic(`[data-ped="${copia.id}"]`); await clic(qq('.modal-acoes button').find((x) => /Cancelar pedido/.test(x.innerText))); await esp(200); await clic('.modal-acoes .btn-perigo'); await esp(300);
    ok('cancelar pedido: fica como cancelado e o estoque não muda', copia.status === 'cancelado' && p.estoque === est + qtdP);
    await clic('[data-f="cancelado"]'); ok('filtro “Cancelados” mostra o pedido', !!q(`[data-ped="${copia.id}"]`));
    await ir('produtos'); await clic('[data-editar]', linha()); await clic('.modal-acoes .btn-perigo'); await esp(300);
    ok('excluir produto: some da lista', p.excluido === true && !/Shampoo de teste/.test(tela()));
    await entrar('funcionario'); await ir('produtos'); ok('funcionário não abre “produtos”', App.rota !== 'produtos'); await entrar('dono');
  });

  await passo('14d instalar o app', async () => {
    await ir('mais'); await clic('a[href="#/instalar"]'); await esp(200);
    ok('Mais → Instalar o app abre a tela', App.rota === 'instalar' && /Instalar o app/.test(q('#topo').innerText));
    ok('quatro abas: iPhone, Android, Computador e Mac', qq('[data-ins]').map((x) => x.dataset.ins).join() === 'iphone,android,pc,mac');
    const conf = { iphone: /Safari[\s\S]*Compartilhar[\s\S]*Adicionar à Tela de Início[\s\S]*Adicionar/, android: /Chrome[\s\S]*três pontinhos[\s\S]*Instalar app/, pc: /Chrome[\s\S]*Edge[\s\S]*Instalar[\s\S]*Fixar na barra de tarefas/, mac: /Arquivo[\s\S]*Adicionar ao Dock/ };
    for (const [id, re] of Object.entries(conf)) { await clic(`[data-ins="${id}"]`); ok(`aba ${id}: passo a passo completo, com dúvidas e como tirar`, re.test(q('[data-ins-corpo]').innerText) && qq('[data-ins-corpo] .ajuda-passo').length >= 4 && qq('[data-ins-corpo] details').length >= 2, q('[data-ins-corpo]').innerText.slice(0, 120)); }
    App.aoMudar(); await esp(100); ok('a aba escolhida continua quando chegam dados novos', q('[data-ins].ativo').dataset.ins === 'mac');
    ok('mostra o endereço para digitar', /lavarapido\.web\.app/.test(q('.ins-end').innerText));
    ok('na tela de entrada também tem o passo a passo', typeof Instalar.janela === 'function');
    await entrar('funcionario'); await clic('#btMenu'); ok('menu do funcionário tem “Instalar o app”', !!q('.modal a[href="#/instalar"]')); await clic('.modal a[href="#/instalar"]'); await esp(200);
    ok('funcionário abre a tela de instalar', App.rota === 'instalar');
    await entrar('dono');
  });

  await passo('14e leva e traz, fiado, agenda de buscar e backup', async () => {
    // chegada: nada marcado sozinho; leva e traz; hora certinha opcional
    await entrar('funcionario'); await ir('entrada'); const pl = 'LVT1A23'; await digitar(pl); await clic('[data-acao=novo]'); await modeloCorCliente('onix', 'Prata', 'Parceiro Teste', '11966665555');
    ok('chegada: nenhuma hora vem marcada sozinha', !qq('.chips .chip.ativo').length && /Sem hora combinada/.test(q('.pe-total').innerText));
    await clic('[data-acao=leva]'); ok('leva e traz: marca e muda a pergunta da hora', !!q('[data-acao=leva].ativo') && /Que horas entregar/.test(tela()) && /Leva e traz/.test(q('.pe-total').innerText));
    await clic('[data-acao=espera]'); ok('“vai esperar” desmarca o leva e traz', !!q('[data-acao=espera].ativo') && !q('[data-acao=leva].ativo'));
    await clic('[data-acao=leva]'); await clic('[data-prev="60"]'); ok('hora: tocar escolhe', !!q('[data-prev="60"].ativo'));
    await clic('[data-prev="60"]'); ok('hora: tocar de novo tira', !q('[data-prev="60"].ativo'));
    await clic('[data-acao=confirmar]'); const lv = ultimo();
    ok('leva e traz gravado, sem hora', DB.ehLeva(lv) && !lv.previsao && /Leva e traz/.test(tela()));
    ok('mensagem de pronto do leva e traz: “vamos levar”', /levar até você/.test(DB.msg('pronto', lv)) && !/Pode vir buscar/.test(DB.msg('pronto', lv)));
    // entrega no fiado
    DB.status(lv, 'pronto'); await ir('patio/pronto'); const cardL = () => q(`.atend[data-id="${lv.id}"]`) || qq('.atend').find((x) => x.innerText.includes(U.placaFmt(pl)));
    ok('pátio: cartão mostra “leva e traz”', /leva e traz/i.test(cardL().innerText));
    await clic(q('[data-acao=entregar]', cardL())); await clic('.modal [data-pag="Fiado"]'); await esp(300); await fecharModais();
    ok('entregue no fiado: fica em aberto', lv.status === 'entregue' && lv.pagamento === 'Fiado' && lv.fiado_aberto === true);
    await entrar('dono'); await ir('inicio');
    ok('início: fiado não entra no “Recebido hoje” e aparece a faixa', /Ficou no fiado hoje/.test(tela()) && !!q('a.faixa-agenda[href="#/fiado"]'));
    await ir('mais'); await clic('a[href="#/fiado"]'); await esp(200);
    const gi = qq('[data-gr]').findIndex((x) => x.innerText.includes('Parceiro Teste'));
    ok('Fiado: aparece quem deve com o valor', App.rota === 'fiado' && gi >= 0 && qq('[data-gr]')[gi].innerText.includes(dinheiro(lv.total)));
    await clic(qq('[data-gr]')[gi]); const z0 = zap.length;
    await clic(qq('.modal-acoes button').find((x) => /Cobrar/.test(x.innerText)));
    ok('cobrar: WhatsApp com a lista e o total', zap.length === z0 + 1 && zap[zap.length - 1][1].includes(dinheiro(lv.total)) && /pagar depois/.test(zap[zap.length - 1][1]));
    await clic('#fxPag [data-pag="Pix"]'); await clic(qq('.modal-acoes button').find((x) => /Recebi/.test(x.innerText))); await esp(300);
    ok('recebi: sai do fiado e fica em “recebidos” com a forma', !lv.fiado_aberto && lv.fiado_pagamento === 'Pix' && !!lv.fiado_pago_em && /Recebidos nos últimos 30 dias/.test(tela()));
    await ir('inicio'); ok('início: fiado recebido hoje entra no caixa', /fiado recebido hoje/.test(tela()));
    const dv = DB.fiados().length; DB.status(Store.s.atendimentos.find((x) => x.fiado_aberto), 'pronto'); ok('desfazer a entrega tira do fiado', DB.fiados().length === dv - 1);
    // opções: desligar a pergunta da volta e o fiado
    DB.salvarConfig({ perguntarEntrega: false, fiado: false });
    await entrar('funcionario'); await ir('entrada'); await digitar('LVT2B34'); await clic('[data-acao=novo]'); await modeloCorCliente('gol', 'Branco', 'Sem Pergunta', '11955554444');
    ok('opção desligada: a chegada não pergunta como o carro volta', !q('[data-acao=leva]') && !/Que horas/.test(tela()));
    await clic('[data-acao=confirmar]'); const sp = ultimo(); DB.status(sp, 'pronto'); await ir('patio/pronto');
    await clic(q('[data-acao=entregar]', q(`.atend[data-id="${sp.id}"]`))); ok('fiado desligado: não aparece na entrega', !q('.modal [data-pag="Fiado"]')); await fecharModais();
    DB.salvarConfig({ perguntarEntrega: true, fiado: true }); await entrar('dono');
    // agenda: vou buscar, endereço e aviso 5 min antes
    await ir('agenda'); await clic('#gNovo'); await clic('#gTipo [data-tipo="buscar"]');
    ok('agenda: “vou buscar” mostra o endereço', !q('#gEnd').hidden);
    campo(modal(), 'nome', 'Busca Teste'); const qd = new Date(Date.now() + 4 * 60000); q('[name=dia]', modal()).value = U.dia(qd); q('[name=hora]', modal()).value = U.hora(qd); campo(modal(), 'endereco', 'Rua Teste, 50');
    await clic('#gAviso [data-av="5"]'); await clic('.modal-acoes .btn-marca'); await esp(300);
    const gb = DB.agenda().find((x) => x.nome === 'Busca Teste');
    ok('agenda: grava tipo, endereço e aviso', gb && gb.tipo === 'buscar' && gb.endereco === 'Rua Teste, 50' && gb.avisar_min === 5);
    let xa = Avisos.lista().find((x) => x.g === gb);
    ok('aviso 5 min antes: “buscar o carro”', !!xa && /^Daqui a \d+ min: buscar o carro de Busca Teste$/.test(xa.titulo) && /Rua Teste, 50/.test(xa.txt), xa && xa.titulo);
    gb.quando = new Date(Date.now() + 8 * 60000).toISOString(); ok('fora do tempo escolhido não avisa', !Avisos.lista().some((x) => x.g === gb));
    gb.quando = new Date(Date.now() - 60000).toISOString(); xa = Avisos.lista().find((x) => x.g === gb);
    ok('na hora: “hora de buscar o carro”', !!xa && /hora de buscar o carro de Busca Teste/.test(xa.titulo));
    ok('lembrete do “vou buscar”: mensagem própria', /vamos buscar seu/.test(DB.msgAgenda(gb)));
    await ir('agenda'); const card = qq('.agend').find((x) => x.innerText.includes('Busca Teste'));
    ok('cartão da agenda: “Buscar” e botão “Busquei”', /Buscar/.test(card.innerText) && /Busquei/.test(card.innerText));
    await clic(q('[data-acao=ver]', card)); ok('janela do horário: calendário do celular e mapa', /calendário do celular/.test(modal().innerText) && !!q('.modal a[href*="google.com/maps"]')); await fecharModais();
    const vb = Store.s.veiculos.find((v) => !DB.abertoDaPlaca(v.placa) && DB.cliente(v.cliente_id) && !U.semPlaca(v.placa)); gb.placa = vb.placa; gb.cliente_id = vb.cliente_id; await ir('agenda');
    await clic(q('[data-acao=chegou]', qq('.agend').find((x) => x.innerText.includes('Busca Teste')))); await esp(300);
    ok('busquei: a entrada já vem como leva e traz', App.rota === 'entrada' && /Leva e traz/.test(E_obs()), E_obs().slice(0, 120));
    DB.salvarAgendamento(gb, { status: 'cancelado' });
    // backup
    await ir('inicio'); Store.pref('backup.ultimo.' + (DB.lava().id || 'demo'), null); DB.salvarConfig({ ultimo_backup: null });
    ok('backup: aviso da semana no sininho', Avisos.lista().some((x) => x.tipo === 'backup'));
    await ir('mais'); await clic('a[href="#/backup"]'); await esp(300);
    ok('tela de backup: explica por que e como, e mostra o que vai', /Por que fazer backup/.test(tela()) && /Backups Lava Rápido/.test(tela()) && /\.csv/.test(tela()));
    const grav = {}; const oPick = window.showDirectoryPicker;
    window.showDirectoryPicker = async () => ({ name: 'Backups Lava Rápido', queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFileHandle: async (n) => ({ createWritable: async () => ({ write: async (b) => { grav[n] = b; }, close: async () => {} }) }) });
    q('#bkFazer').click(); for (let k = 0; k < 30 && Object.keys(grav).length < 2; k++) await esp(200); await esp(300); window.showDirectoryPicker = oPick;
    const nomes = Object.keys(grav), js = nomes.find((n) => n.endsWith('.json')), cs = nomes.find((n) => n.endsWith('.csv'));
    const dados = js ? JSON.parse(await grav[js].text()) : {};
    ok('backup: grava o .json completo e a planilha .csv na pasta', !!js && !!cs && /^Backup .* \d{4}-\d\d-\d\d\.json$/.test(js) && dados.clientes.length === Store.s.clientes.length && dados.atendimentos.length > 0 && (await grav[cs].text()).split('\r\n').length === Store.s.clientes.length + 1, nomes.join(', '));
    ok('backup feito: o aviso some', !Avisos.lista().some((x) => x.tipo === 'backup') && /Backup feito/.test((modal() || {}).innerText || '')); await fecharModais();
  });

  await passo('14c avisos da agenda', async () => {
    const g = DB.agenda().find((x) => x.tipo !== 'buscar'), orig = g.quando, tel = g.telefone; g.telefone = tel || '11977775555';
    g.quando = new Date(Date.now() + 25 * 60000).toISOString();
    let x = Avisos.lista().find((a) => a.g === g);
    ok('30 min antes: avisa que o cliente marcou e não chegou', !!x && x.tipo === 'agenda' && /ainda não chegou/.test(x.titulo) && /Faltam 2[45] min/.test(x.txt), x && x.titulo + ' | ' + x.txt);
    g.quando = new Date(Date.now() - 4 * 60000).toISOString();
    x = Avisos.lista().find((a) => a.g === g);
    ok('na hora marcada: avisa que deu a hora e não chegou', !!x && x.tipo === 'agenda-atraso' && /^Deu .* não chegou$/.test(x.titulo), x && x.titulo);
    let toque = 0; const oT = Avisos.tocar; Avisos.tocar = () => toque++;
    Store.pref('avisos.vistos', []); Avisos.tick(); Avisos.tick(); Avisos.tick(); Avisos.tocar = oT;
    ok('som toca uma vez só por aviso', toque <= 1);
    Avisos.mostrar(x); await esp(100);
    ok('faixa do aviso tem WhatsApp e Ligar', !!q('#alertaAviso [data-zap]') && !!q('#alertaAviso a[href^="tel:"]'));
    const z = zap.length; await clic('#alertaAviso [data-zap]');
    ok('WhatsApp do aviso: mensagem pergunta se ainda vem', zap.length === z + 1 && /Ainda vem hoje/.test(zap[zap.length - 1][1]), zap[zap.length - 1] && zap[zap.length - 1][1]);
    g.status = 'chegou'; ok('cliente chegou: o aviso some', !Avisos.lista().some((a) => a.g === g));
    g.status = 'marcado'; g.quando = orig; g.telefone = tel;
  });

  await passo('15 clientes do dono', async () => {
    await ir('clientes');
    for (const f of ['premio', 'quase', 'sumidos', 'novos', 'todos']) { await clic(`[data-f=${f}]`); ok(`filtro “${f}” abre`, !!q('#cLista') && !/undefined|NaN/.test(q('#cLista').innerText)); }
    const c = Store.s.clientes.find((x) => x.visitas > 5); await ir('cliente/' + c.id, 500);
    ok('dono vê o total gasto do cliente', /R\$/.test(tela()));
  });

  await passo('16 ajustes', async () => {
    await ir('ajustes/marca'); const f = q('#f'); f.nome.value = 'Lava Teste Nome'; await clic('[data-cor="#d32f2f"]'); await clic('[data-topo=escuro]'); f.telefone.value = '(11) 98888-7777'; f.google.value = 'g.page/r/teste/review'; f.requestSubmit(); await esp(300);
    ok('marca: nome, cor, barra preta, telefone e link salvos', DB.lava().nome === 'Lava Teste Nome' && DB.marca().cor === '#d32f2f' && DB.marca().topo === 'escuro' && DB.marca().telefone === '11988887777' && DB.marca().google === 'https://g.page/r/teste/review');
    ok('marca: cor aplicada no aplicativo na hora', getComputedStyle(document.documentElement).getPropertyValue('--marca').trim() === '#d32f2f' && /Lava Teste Nome/.test(q('#topo').innerText + q('#lateral').innerText + document.title));
    await ir('ajustes/servicos'); const n = Store.s.servicos.length;
    await clic('#sNovo'); campo(modal(), 'nome', 'Serviço de teste'); campo(modal(), 'p_p', '33'); campo(modal(), 'minutos', '45'); await clic('.modal-acoes .btn-marca'); await esp(300);
    const novo = Store.s.servicos[Store.s.servicos.length - 1];
    ok('serviço novo: criado com preço e tempo', Store.s.servicos.length === n + 1 && novo.precos.p === 33 && novo.minutos === 45);
    await clic(`[data-s="${sv[0].id}"]`); campo(modal(), 'p_p', '45,50'); await clic('.modal-acoes .btn-marca'); await esp(300); ok('mudar preço de um serviço', sv[0].precos.p === 45.5);
    await clic(`[data-s="${novo.id}"]`); q('[name=ativo]', modal()).checked = false; await clic('.modal-acoes .btn-marca'); await esp(300);
    ok('desligar serviço: some da chegada', novo.ativo === false && !DB.servicos().includes(novo));
    await clic(`[data-sobe="${sv[1].id}"]`); await esp(200); ok('subir serviço na lista', DB.servicos()[0].id === sv[1].id);
    await ir('ajustes/fidelidade'); let ff = q('#f'); ff.p1.value = '5'; ff.d1.value = '15'; ff.p2.value = '3'; ff.d2.value = '20'; ff.requestSubmit(); await esp(200);
    ok('fidelidade: prêmio 2 menor que o 1 é recusado', DB.cfg().fidelidade.niveis[0].pontos === 10);
    ff = q('#f'); ff.p2.value = '12'; ff.d2.value = '40'; ff.requestSubmit(); await esp(300);
    ok('fidelidade: regra nova salva', DB.cfg().fidelidade.niveis[0].pontos === 5 && DB.cfg().fidelidade.niveis[1].desconto === 40);
    await ir('ajustes/mensagens'); let fm = q('#f'); fm.pronto.value = 'Oi {nome}, pronto! {valor}'; fm.requestSubmit(); await esp(300);
    ok('mensagem personalizada salva e usada', DB.msg('pronto', DB.abertos()[0]).startsWith('Oi ') && /R\$/.test(DB.msg('pronto', DB.abertos()[0])));
    await ir('ajustes/mensagens'); await clic('[data-padrao=pronto]'); q('#f').requestSubmit(); await esp(300); ok('voltar ao texto original', /está pronto/.test(DB.msg('pronto', DB.abertos()[0])));
    await ir('ajustes/equipe'); campo(q('#eLav'), 'nome', 'nova lavadora'); q('#eLav').requestSubmit(); await esp(250);
    ok('quem lava: adiciona', DB.cfg().lavadores.includes('Nova Lavadora')); await clic('[data-tirar="Nova Lavadora"]'); ok('quem lava: tira', !DB.cfg().lavadores.includes('Nova Lavadora'));
    ok('acessos: lista o dono e o funcionário', qq('[data-u]').length === 2);
    await ir('ajustes/opcoes'); let fo = q('#f'); fo.pagamentos.value = 'Pix, Dinheiro, Cartão'; fo.usarLavando.checked = false; fo.funcionarioMudaValor.checked = false; fo.requestSubmit(); await esp(300);
    ok('opções salvas', DB.cfg().pagamentos.join() === 'Pix,Dinheiro,Cartão' && DB.cfg().usarLavando === false);
    await ir('patio'); ok('sem a etapa “Lavando”: carro da fila já mostra “Ficou pronto”', !q('[data-acao=lavar]') && !!q('.st-aguardando [data-acao=pronto]'));
    await entrar('funcionario'); await ir('entrada'); const pl = Store.s.veiculos.find((v) => !DB.abertoDaPlaca(v.placa) && DB.cliente(v.cliente_id)).placa; await digitar(pl); await clic(`[data-placa="${pl}"]`);
    ok('funcionário sem permissão não vê “ajustar valor”', !q('[data-acao=valor]'));
    await entrar('dono'); await ir('ajustes'); ok('ajustes: lista as 7 seções e a aparência', qq('.lista-menu a').length === 7 && !!q('[data-tema-sel]'));
    await clic('[data-tema=escuro]'); await ir('inicio'); ok('aparência escura continua ao trocar de tela', App.escuro());
    App.aplicarTema('claro');
  });

  await passo('17 assinatura suspensa', async () => {
    Store.s.lava.ativo = false; await ir('inicio');
    ok('suspensa: aviso no alto e nenhum botão de etapa', /Assinatura suspensa/.test(q('#faixa').innerText) && !q('.atend-acoes'));
    await ir('entrada'); ok('suspensa: não registra chegada', /suspensa/.test(tela()));
    await ir('agenda'); ok('suspensa: não marca horário', !q('#gNovo'));
    Store.s.lava.ativo = true;
  });

  await passo('18 página do cliente', async () => {
    const a = DB.abertos()[0]; Store.salvar(); await esp(400);
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;width:380px;height:700px'; fr.src = DB.linkAcompanhar(a); document.body.appendChild(fr);
    await new Promise((r) => { fr.onload = r; setTimeout(r, 3000); }); await esp(500);
    const t = fr.contentDocument.body.innerText; fr.remove();
    ok('página do cliente: situação, carro, total e cartão fidelidade', /Recebido|Lavando|Pronto/.test(t) && t.includes(a.veiculo) && t.includes(dinheiro(a.total)) && /fidelidade/i.test(t), t.slice(0, 200));
  });

  await fecharModais(); Demo.recomecar(); App.aplicarMarca(); await entrar('funcionario');
  return `${log.length} conferências, ${falhas} falha${falhas === 1 ? '' : 's'}\n` + log.join('\n');
};
