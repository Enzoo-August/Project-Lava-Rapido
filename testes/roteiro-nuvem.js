/* =========================================================
   Roteiro de teste da sincronização (banco simulado).
   1. Sirva a pasta (python -m http.server 5318) e abra  /testes/nuvem.html
   2. No console:   await import('./testes/roteiro-nuvem.js'); await testeFuncionario()
   3. Para o dono:  localStorage.setItem('lr.teste.perfil','dono'); recarregue; await import('./testes/roteiro-nuvem.js'); await testeDono()
   Tudo tem de sair "ok". Nada disto toca no banco de verdade.
   (nuvem.html é o index.html com o banco simulado: gere de novo se o index mudar.)
   ========================================================= */
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const carimbo = (ms) => new Date(Date.now() + ms).toISOString().replace('Z', '000+00:00');
const novoLog = () => { const log = []; return { log, ok: (nome, cond, extra) => log.push((cond ? 'ok    ' : 'FALHA ') + nome + (extra !== undefined ? ' → ' + extra : '')) }; };

window.testeFuncionario = async () => {
  const { log, ok } = novoLog(), sv = Store.s.servicos;
  // 1. chegada com internet
  const a = DB.entrada({ placa: 'ABC1D23', veiculo: { marca: 'Ford', modelo: 'Fiesta', cor: 'Prata', porte: 'p' }, cliente: { nome: 'enzo augusto', telefone: '11987654321' }, itens: DB.itens([sv[0].id], 'p'), previsaoMin: 30 });
  ok('vale na tela na hora', DB.abertos().length === 1 && Nuvem.fila.length === 3);
  await esp(1500);
  ok('fila enviada', Nuvem.fila.length === 0 && FAKE.t.atendimentos.length === 1 && FAKE.t.clientes.length === 1 && FAKE.t.veiculos.length === 1);
  ok('ficha e "cliente novo" vindos do banco', a.numero === 1 && a.cliente_novo === true);
  ok('contadores do cliente vindos do banco', DB.cliente(a.cliente_id).visitas === 1);
  // 2. sem internet
  FAKE.offline = true;
  DB.status(a, 'lavando', { lavador: 'Zé' });
  const b = DB.entrada({ placa: 'XYZ9876', veiculo: { marca: 'Fiat', modelo: 'Uno', cor: 'Branco', porte: 'p' }, cliente: { nome: 'Maria Sem Sinal', telefone: '' }, itens: DB.itens([sv[1].id], 'p'), previsaoMin: 60 });
  await esp(1300);
  ok('sem internet: vale na tela', a.status === 'lavando' && DB.abertos().length === 2);
  ok('sem internet: fila guardada', Nuvem.fila.length === 4 && FAKE.t.atendimentos.length === 1, 'fila ' + Nuvem.fila.length);
  ok('sem internet: aviso no topo', /para enviar/.test(document.getElementById('nuvemSt').innerText));
  const cache = JSON.parse(localStorage.getItem('lr.cache'));
  ok('sem internet: fila gravada no aparelho', cache && cache.fila.length === 4);
  DB.status(a, 'pronto');
  ok('mesma ficha não duplica na fila', Nuvem.fila.filter((o) => o.k === a.id).length === 1);
  // 3. internet volta
  FAKE.offline = false; await Nuvem.enviar(); await esp(300);
  ok('voltou: fila zerada e banco em ordem', Nuvem.fila.length === 0 && FAKE.t.atendimentos.length === 2 && FAKE.t.atendimentos[0].status === 'pronto' && b.numero === 2);
  // 4. outro aparelho
  const fa = FAKE.t.atendimentos.find((x) => x.id === b.id); fa.status = 'lavando'; fa.atualizado_em = carimbo(5000);
  await Nuvem.puxar(['atendimentos']);
  ok('mudança de outro aparelho aparece', b.status === 'lavando');
  const cli = { id: U.uuid(), lava_id: Store.s.lava.id, nome: 'Carlos Outro Aparelho', telefone: '11911112222', visitas: 1, pontos_usados: 0, gasto: 0, ativo: true, atualizado_em: carimbo(6000) };
  FAKE.t.clientes.push(cli);
  FAKE.t.veiculos.push({ lava_id: Store.s.lava.id, placa: 'QQQ1Q11', cliente_id: cli.id, modelo: 'Gol', cor: 'Preto', porte: 'p', visitas: 1, ativo: true, atualizado_em: carimbo(6000) });
  FAKE.t.atendimentos.push({ id: U.uuid(), lava_id: Store.s.lava.id, numero: 3, placa: 'QQQ1Q11', veiculo: 'Gol preto', cliente_id: cli.id, servicos: [], valor: 40, desconto: 0, total: 40, pontos_usados: 0, status: 'aguardando', entrada_em: new Date().toISOString(), token: 'x', atualizado_em: carimbo(7000) });
  await Nuvem.puxar(['atendimentos']); await esp(200);
  ok('carro de outro aparelho traz cliente e veículo', DB.abertos().length === 3 && !!DB.cliente(cli.id) && DB.buscarVeiculos('QQQ').length === 1);
  // 5. o banco recusa uma alteração: o resto da fila segue
  FAKE.recusar = (tab) => tab === 'servicos';
  DB.salvarServico(sv[0], { nome: 'Sem permissão' }); DB.status(b, 'pronto');
  await esp(1500);
  ok('recusa do banco não trava a fila', Nuvem.fila.length === 0 && Nuvem.falhas.length === 1 && FAKE.t.atendimentos.find((x) => x.id === b.id).status === 'pronto');
  FAKE.recusar = null;
  // 6. agenda
  const g = DB.salvarAgendamento(null, { nome: 'cliente agenda', telefone: '11955554444', quando: new Date(Date.now() + 864e5).toISOString(), servico: 'Polimento', valor: 300 });
  await esp(1500);
  ok('horário marcado chega ao banco', FAKE.t.agendamentos.length === 1 && FAKE.t.agendamentos[0].nome === 'Cliente Agenda' && FAKE.t.agendamentos[0].valor === 300);
  const fg = FAKE.t.agendamentos[0]; fg.status = 'cancelado'; fg.atualizado_em = carimbo(8000);
  await Nuvem.puxar(['agendamentos']);
  ok('horário cancelado em outro aparelho some da agenda', g.status === 'cancelado' && !DB.agenda().length);
  // 7. carro que entrou há 4 dias (outro aparelho registrou) e é entregue hoje pelo funcionário
  const velho = { id: U.uuid(), lava_id: Store.s.lava.id, numero: 1, placa: 'QQQ1Q11', veiculo: 'Gol preto', cliente_id: cli.id, servicos: [{ id: 'livre-1', nome: 'Polimento', valor: 500 }], valor: 500, desconto: 0, total: 500, pontos_usados: 0, status: 'pronto', entrada_em: new Date(Date.now() - 4 * 864e5).toISOString(), pronto_em: new Date().toISOString(), token: 'velho', atualizado_em: carimbo(9000) };
  FAKE.t.atendimentos.push(velho); await Nuvem.puxar(['atendimentos']);
  const meu = Store.por('atendimentos', velho.id);
  ok('carro de 4 dias atrás aparece no pátio', !!meu && DB.abertos().includes(meu));
  DB.status(meu, 'entregue', { pagamento: 'Dinheiro' }); await esp(1500);
  ok('funcionário entrega carro de vários dias: salvo no banco e conta em “Entregues hoje”', Nuvem.falhas.length === 1 && FAKE.t.atendimentos.find((x) => x.id === velho.id).status === 'entregue' && DB.entreguesHoje().includes(meu), 'falhas ' + Nuvem.falhas.length);
  // 8. entrega
  DB.status(a, 'entregue', { pagamento: 'Pix' }); await esp(1500);
  ok('entrega: gasto conferido pelo banco', DB.cliente(a.cliente_id).gasto === 40 && FAKE.t.atendimentos[0].pagamento === 'Pix');
  location.hash = '#/resultados'; await esp(300);
  ok('funcionário não abre Resultados', location.hash === '#/balcao');
  return log.join('\n');
};

window.testeDono = async () => {
  const { log, ok } = novoLog(), sv = Store.s.servicos;
  ok('dono entra no Início', App.user.perfil === 'dono' && location.hash === '#/inicio');
  const cid = U.uuid();
  FAKE.t.clientes.push({ id: cid, lava_id: Store.s.lava.id, nome: 'Cliente Antigo', telefone: '11900001111', visitas: 0, pontos_usados: 0, gasto: 0, ativo: true, atualizado_em: carimbo(-9 * 864e5) });
  for (let d = 10; d >= 4; d--) FAKE.t.atendimentos.push({ id: U.uuid(), lava_id: Store.s.lava.id, numero: 1, placa: 'OLD1A11', veiculo: 'Gol', cliente_id: cid, servicos: [{ id: sv[0].id, nome: sv[0].nome, valor: 40 }], valor: 40, desconto: 0, total: 40, pontos_usados: 0, status: 'entregue', pagamento: 'Pix', cliente_novo: d === 10, entrada_em: new Date(Date.now() - d * 864e5).toISOString(), pronto_em: new Date(Date.now() - d * 864e5 + 30e5).toISOString(), entregue_em: new Date(Date.now() - d * 864e5 + 36e5).toISOString(), token: 't' + d, atualizado_em: carimbo(-d * 864e5) });
  localStorage.removeItem('lr.cache'); Nuvem.ultimo = {}; Store.usar(Store.vazio()); await Nuvem.puxar(); await esp(200);
  ok('primeira carga não traz o histórico antigo', Store.s.atendimentos.length === 0 && Store.s.clientes.length === 1);
  await Nuvem.puxar(['atendimentos']);
  ok('busca seguinte também não', Store.s.atendimentos.length === 0);
  const p = await DB.periodo(U.somaDias(U.inicioDia(), -89), U.somaDias(U.inicioDia(), 1)), r = An.resumo(p);
  ok('Resultados buscam o período no banco', p.length === 7 && r.faturamento === 280);
  location.hash = '#/resultados'; await esp(900); document.querySelector('[data-p="90d"]').click(); await esp(900);
  ok('tela Resultados desenha', /R\$\s280,00/.test(document.querySelector('#rCorpo').innerText) && document.querySelectorAll('.graf').length >= 3);
  DB.salvarLava({ nome: 'Lava Teste 2', marca: { ...Store.s.lava.marca, cor: '#d32f2f' } }); DB.salvarServico(sv[0], { nome: 'Ducha' });
  DB.salvarDespesa(null, { descricao: 'Luz', valor: 300, data: U.dia(), categoria: 'Luz' }); DB.salvarConfig({ lavadores: ['Zé'] });
  await esp(1800);
  ok('marca, serviço, despesa e opções chegam ao banco', Nuvem.fila.length === 0 && Nuvem.falhas.length === 0 && FAKE.t.lavas[0].nome === 'Lava Teste 2' && FAKE.t.lavas[0].config.lavadores[0] === 'Zé' && FAKE.t.servicos[0].nome === 'Ducha' && FAKE.t.despesas.length === 1);
  location.hash = '#/financeiro'; await esp(900);
  ok('Financeiro desenha', /300,00/.test(document.querySelector('#fCorpo').innerText));
  location.hash = '#/cliente/' + cid; await esp(900);
  ok('histórico do cliente vem do banco', document.querySelectorAll('#hist .linha').length === 7);
  FAKE.t.lavas[0].ativo = false; FAKE.t.lavas[0].atualizado_em = carimbo(9000); await Nuvem.puxar(); location.hash = '#/entrada'; await esp(400);
  ok('assinatura suspensa bloqueia a chegada', /suspensa/.test(document.getElementById('tela').innerText) && /suspensa/.test(document.getElementById('faixa').innerText));
  localStorage.removeItem('lr.teste.perfil'); localStorage.removeItem('lr.cache'); localStorage.removeItem('lr.marca');
  return log.join('\n');
};
