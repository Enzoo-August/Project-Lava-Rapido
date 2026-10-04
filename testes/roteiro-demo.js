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
    ok('serviço de 8 horas já sugere o dia seguinte', U.dia(ultimo().previsao) === U.dia(U.somaDias(new Date(), 1)));
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
    await clic(q('[data-acao=entregar]', card())); ok('entregar: mostra o total e as formas de pagamento', modal().innerText.includes(dinheiro(a.total)) && qq('[data-pag]').length === DB.cfg().pagamentos.length);
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
