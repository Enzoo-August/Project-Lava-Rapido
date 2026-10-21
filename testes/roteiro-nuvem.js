/* =========================================================
   Roteiro de teste da ligação com o Firebase (banco simulado).
   1. Sirva a pasta (python -m http.server 5318) e abra /testes/nuvem.html
   2. No console:   await import('./testes/roteiro-nuvem.js'); await testeFuncionario()
   3. Dono:  localStorage.setItem('lr.teste.perfil','dono'); recarregue; ...; await testeDono()
   4. Admin: localStorage.setItem('lr.teste.perfil','admin'); recarregue; ...; await testeAdmin()
   Tudo tem de sair "ok". Nada disto toca no banco de verdade.
   (nuvem.html é o index.html com o banco simulado: gere de novo se o index mudar.)
   ========================================================= */
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const novoLog = () => { const log = []; return { log, ok: (nome, cond, extra) => log.push((cond ? 'ok    ' : 'FALHA ') + nome + (extra !== undefined && !cond ? ' → ' + extra : '')) }; };
const L = 'lavas/lava-teste';

window.testeFuncionario = async () => {
  const { log, ok } = novoLog(), sv = Store.s.servicos;
  ok('entra como funcionário e carrega o lava e os serviços', App.user.perfil === 'funcionario' && DB.lava().nome === 'Lava Teste' && sv.length === 2 && Store.s.equipe.length === 2, `${DB.lava().nome} ${sv.length} ${Store.s.equipe.length}`);
  // 1. chegada com internet
  const a = DB.entrada({ placa: 'ABC1D23', veiculo: { marca: 'Ford', modelo: 'Fiesta', cor: 'Prata', porte: 'p' }, cliente: { nome: 'enzo augusto', telefone: '11987654321' }, itens: DB.itens([sv[0].id], 'p'), previsaoMin: 30 });
  await esp(400);
  const noBanco = FAKE.ler(`${L}/atendimentos/${a.id}`), c = DB.cliente(a.cliente_id);
  ok('chegada: atendimento, cliente e veículo gravados no banco', !!noBanco && !!FAKE.ler(`${L}/clientes/${c.id}`) && !!FAKE.ler(`${L}/veiculos/ABC1D23`) && Nuvem.pendentes() === 0, 'pendentes ' + Nuvem.pendentes());
  ok('chegada: contadores da fidelidade gravados junto', FAKE.ler(`${L}/clientes/${c.id}`).visitas === 1 && FAKE.ler(`${L}/veiculos/ABC1D23`).visitas === 1);
  ok('chegada: ficha do dia dada pelo contador do banco', a.numero === 1 && a.ficha_ok === true && FAKE.ler(`${L}/contadores/${U.dia()}`).n === 1, `${a.numero} ${a.ficha_ok}`);
  const ac = FAKE.ler('acompanhar/' + a.token);
  ok('chegada: página do cliente gravada sem o telefone', !!ac && ac.lava_id === 'lava-teste' && ac.nome === 'Enzo' && ac.status === 'aguardando' && !JSON.stringify(ac).includes('987654321'));
  // 2. sem internet
  FAKE.offline = true;
  DB.status(a, 'lavando', { lavador: 'Zé' });
  const b = DB.entrada({ placa: 'XYZ9876', veiculo: { marca: 'Fiat', modelo: 'Uno', cor: 'Branco', porte: 'p' }, cliente: { nome: 'Maria Sem Sinal', telefone: '' }, itens: DB.itens([sv[1].id], 'p'), previsaoMin: 60 });
  await esp(300);
  ok('sem internet: vale na tela na hora', a.status === 'lavando' && DB.abertos().length === 2);
  ok('sem internet: alterações esperando para enviar', Nuvem.pendentes() > 0 && /para enviar|Salvando/.test(document.getElementById('nuvemSt').innerText), document.getElementById('nuvemSt').innerText);
  ok('sem internet: ficha sai pela conta do aparelho', b.numero === 2 && !b.ficha_ok, b.numero);
  FAKE.offline = false; await esp(500);
  ok('voltou a internet: tudo confirmado', Nuvem.pendentes() === 0 && FAKE.ler(`${L}/atendimentos/${a.id}`).status === 'lavando' && !!FAKE.ler(`${L}/atendimentos/${b.id}`), 'pendentes ' + Nuvem.pendentes());
  // 3. outro aparelho
  FAKE.gravarComoOutro(`${L}/atendimentos/${b.id}`, { status: 'pronto', pronto_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
  await esp(300);
  ok('mudança feita em outro aparelho chega sozinha', b.status === 'pronto');
  const cid = 'c-outro';
  FAKE.gravarComoOutro(`${L}/clientes/${cid}`, { id: cid, lava_id: 'lava-teste', nome: 'Carlos Outro Aparelho', telefone: '11911112222', visitas: 1, pontos_usados: 0, gasto: 0, ativo: true });
  FAKE.gravarComoOutro(`${L}/veiculos/QQQ1Q11`, { lava_id: 'lava-teste', placa: 'QQQ1Q11', cliente_id: cid, modelo: 'Gol', cor: 'Preto', porte: 'p', visitas: 1, ativo: true });
  const velho = U.uuid();
  FAKE.gravarComoOutro(`${L}/atendimentos/${velho}`, { id: velho, lava_id: 'lava-teste', numero: 1, placa: 'QQQ1Q11', veiculo: 'Gol preto', cliente_id: cid, servicos: [{ id: 'livre-1', nome: 'Polimento', valor: 500 }], valor: 500, desconto: 0, total: 500, pontos_usados: 0, status: 'pronto', entrada_em: new Date(Date.now() - 4 * 864e5).toISOString(), pronto_em: new Date().toISOString(), token: 'tokvelho1234567', atualizado_em: new Date().toISOString() });
  await esp(300);
  const meu = Store.por('atendimentos', velho);
  ok('carro de 4 dias atrás registrado em outro aparelho aparece com cliente e veículo', !!meu && !!DB.cliente(cid) && DB.buscarVeiculos('QQQ').length === 1);
  DB.status(meu, 'entregue', { pagamento: 'Dinheiro' }); await esp(300);
  ok('entrega de carro de vários dias: salva e conta em “Entregues hoje”', FAKE.ler(`${L}/atendimentos/${velho}`).status === 'entregue' && DB.entreguesHoje().includes(meu));
  ok('entrega: gasto do cliente gravado', FAKE.ler(`${L}/clientes/${cid}`).gasto === 500);
  // 4. banco recusa: não trava o resto
  FAKE.recusar = (p) => p.includes('/servicos/');
  DB.salvarServico(sv[0], { nome: 'Sem permissão' }); DB.status(b, 'entregue', { pagamento: 'Pix' });
  await esp(400);
  ok('recusa do banco avisa e não trava o resto', Nuvem.falhas.length === 1 && FAKE.ler(`${L}/atendimentos/${b.id}`).status === 'entregue' && Nuvem.pendentes() === 0, 'falhas ' + Nuvem.falhas.length);
  FAKE.recusar = null;
  // 5. agenda
  const g = DB.salvarAgendamento(null, { nome: 'cliente agenda', telefone: '11955554444', quando: new Date(Date.now() + 864e5).toISOString(), servico: 'Polimento', valor: 300 });
  await esp(300);
  ok('horário marcado chega ao banco', FAKE.ler(`${L}/agendamentos/${g.id}`).nome === 'Cliente Agenda');
  FAKE.gravarComoOutro(`${L}/agendamentos/${g.id}`, { status: 'cancelado' }); await esp(300);
  ok('horário cancelado em outro aparelho some da agenda', g.status === 'cancelado' && !DB.agenda().includes(g));
  location.hash = '#/resultados'; await esp(300);
  ok('funcionário não abre Resultados', location.hash === '#/balcao');
  ok('funcionário não recebe despesas', Store.s.despesas.length === 0);
  location.hash = '#/produtos'; await esp(500);
  ok('funcionário não abre Produtos', App.rota !== 'produtos');
  return log.join('\n');
};

window.testeDono = async () => {
  const { log, ok } = novoLog(), sv = Store.s.servicos;
  ok('dono entra no Início', App.user.perfil === 'dono' && location.hash === '#/inicio');
  for (let d = 10; d >= 4; d--) {
    const id = U.uuid(), e = new Date(Date.now() - d * 864e5).toISOString();
    FAKE.gravarComoOutro(`${L}/atendimentos/${id}`, { id, lava_id: 'lava-teste', numero: 1, placa: 'OLD1A11', veiculo: 'Gol', cliente_id: 'c-antigo', servicos: [{ id: sv[0].id, nome: sv[0].nome, valor: 40 }], valor: 40, desconto: 0, total: 40, status: 'entregue', pagamento: 'Pix', entrada_em: e, entregue_em: e, pronto_em: e, token: 't' + d + 'xxxxxxxxxxxx', atualizado_em: e });
  }
  await esp(300);
  ok('histórico antigo não é carregado inteiro no aparelho', Store.s.atendimentos.filter((a) => a.placa === 'OLD1A11').length === 0);
  const p = await DB.periodo(U.somaDias(U.inicioDia(), -89), U.somaDias(U.inicioDia(), 1)), r = An.resumo(p, U.somaDias(U.inicioDia(), -89), U.somaDias(U.inicioDia(), 1));
  ok('Resultados buscam o período no banco', p.length === 7 && r.faturamento === 280, `${p.length} ${r.faturamento}`);
  location.hash = '#/resultados'; await esp(900); document.querySelector('[data-p="90d"]').click(); await esp(900);
  ok('tela Resultados desenha', /R\$\s280,00/.test(document.querySelector('#rCorpo').innerText) && document.querySelectorAll('.graf').length >= 3);
  DB.salvarLava({ nome: 'Lava Teste 2', marca: { ...Store.s.lava.marca, cor: '#d32f2f' } });
  DB.salvarServico(sv[0], { nome: 'Ducha' });
  DB.salvarDespesa(null, { descricao: 'Luz', valor: 300, data: U.dia(), categoria: 'Luz' });
  DB.salvarConfig({ lavadores: ['Zé'] });
  await esp(500);
  ok('marca vai para o lava e para a página pública', FAKE.ler(L).nome === 'Lava Teste 2' && FAKE.ler(L).config.lavadores[0] === 'Zé' && FAKE.ler('marcas/teste').nome === 'Lava Teste 2' && FAKE.ler('marcas/teste').marca.cor === '#d32f2f');
  ok('serviço e despesa gravados', FAKE.ler(`${L}/servicos/${sv[0].id}`).nome === 'Ducha' && FAKE.lista(`${L}/despesas`).length === 1);
  ok('dono não mexe na própria assinatura (a gravação nem leva esses campos)', FAKE.ler(L).ativo === true && FAKE.ler(L).plano === 'mensal');
  location.hash = '#/financeiro'; await esp(900);
  ok('Financeiro desenha com a despesa', /300,00/.test(document.querySelector('#fCorpo').innerText));
  // produtos e pedido de compra, tocando no menu como o dono faz
  window.__semRecarregar = 1; document.querySelector('#lateral a[href="#/produtos"]').click(); await esp(700);
  ok('menu → Produtos abre (sem recarregar a página)', App.rota === 'produtos' && window.__semRecarregar === 1 && /Meus produtos/.test(document.querySelector('#tela').innerText), location.href);
  const prod = DB.salvarProduto(null, { nome: 'Cera', preco: 30, unidade: 'un', estoque: 1, minimo: 2, fornecedor: '' }); App.render(); await esp(400);
  ok('produto gravado no banco e tela continua em Produtos', FAKE.ler(`${L}/produtos/${prod.id}`).nome === 'Cera' && App.rota === 'produtos' && /Cera/.test(document.querySelector('#tela').innerText));
  document.querySelector(`[data-p="${prod.id}"] [data-mexe="1"]`).click(); await esp(400);
  ok('+ no estoque gravado no banco', FAKE.ler(`${L}/produtos/${prod.id}`).estoque === 2);
  const ped = DB.salvarPedido(null, { itens: [{ produto_id: prod.id, nome: 'Cera', unidade: 'un', qtd: 4, preco: 30 }, { produto_id: null, nome: 'Escova nova', unidade: 'un', qtd: 3, preco: 10, cadastrar: true }], pagamento: 'Boleto', condicao: '28 dias', frete_tipo: 'pago', frete: 20, desconto: 5 }); await esp(300);
  ok('pedido gravado com pagamento, frete e desconto (total = 150 − 5 + 20)', FAKE.ler(`${L}/pedidos/${ped.id}`).total === 165 && FAKE.ler(`${L}/pedidos/${ped.id}`).pagamento === 'Boleto' && FAKE.ler(`${L}/pedidos/${ped.id}`).frete === 20);
  DB.receberPedido(ped, { despesa: true }); await esp(400);
  const esc = FAKE.lista(`${L}/produtos`).find((x) => x.nome === 'Escova nova');
  ok('chegou: soma no estoque do banco e produto novo entra no estoque', FAKE.ler(`${L}/pedidos/${ped.id}`).status === 'recebido' && FAKE.ler(`${L}/produtos/${prod.id}`).estoque === 6 && !!esc && esc.estoque === 3);
  ok('chegou: despesa de R$ 165 gravada no banco', FAKE.lista(`${L}/despesas`).some((d) => d.valor === 165 && d.categoria === 'Produtos'));
  FAKE.gravarComoOutro(`${L}/produtos/outro1`, { id: 'outro1', lava_id: 'lava-teste', nome: 'Pretinho', preco: 20, unidade: 'un', estoque: 5, minimo: 1, excluido: false, atualizado_em: new Date().toISOString() }); await esp(400);
  ok('produto cadastrado em outro aparelho aparece', !!Store.por('produtos', 'outro1'));
  // acessos
  await Nuvem.criarAcesso({ login: 'Nova.Func', senha: 'senha123', nome: 'Nova Func', perfil: 'funcionario' }); await esp(200);
  const nova = Store.s.equipe.find((e) => e.login === 'nova.func');
  ok('cria acesso de funcionário no próprio lava', !!nova && nova.lava_id === 'lava-teste' && nova.perfil === 'funcionario');
  let erro = ''; try { await Nuvem.criarAcesso({ login: 'nova.func', senha: 'senha123', nome: 'Repetido', perfil: 'funcionario' }); } catch (e) { erro = e.message; }
  ok('usuário repetido é recusado com mensagem clara', /já existe/.test(erro), erro);
  erro = ''; try { await Nuvem.editarAcesso('u-dono', { nome: 'Dona Maria', perfil: 'funcionario', ativo: true }); } catch (e) { erro = e.message; }
  ok('não deixa ficar sem nenhum dono', /pelo menos um dono/.test(erro), erro);
  await Nuvem.editarAcesso(nova.user_id, { nome: 'Nova Func', perfil: 'funcionario', ativo: false }); await esp(200);
  ok('bloquear acesso', FAKE.ler('usuarios/' + nova.user_id).ativo === false);
  erro = ''; try { await Nuvem.trocarSenha(nova.user_id, 'outra123'); } catch (e) { erro = e.message; }
  ok('senha de outra pessoa: explica o que fazer', /própria pessoa/.test(erro), erro);
  FAKE.gravarComoOutro(L, { ativo: false }); await esp(300); location.hash = '#/entrada'; await esp(400);
  ok('assinatura suspensa bloqueia a chegada', /suspensa/.test(document.getElementById('tela').innerText));
  FAKE.gravarComoOutro(L, { ativo: true });
  localStorage.removeItem('lr.teste.perfil'); localStorage.removeItem('lr.cache'); localStorage.removeItem('lr.marca');
  return log.join('\n');
};

window.testeAdmin = async () => {
  const { log, ok } = novoLog();
  ok('admin entra na Administração', App.user.perfil === 'admin' && location.hash === '#/admin');
  await Nuvem.adminCriarLava({ nome: 'Lava Novo', slug: 'lava-novo', dono: 'Maria', login: 'maria', senha: 'senha123', pago_ate: '2026-11-10' });
  const novo = FAKE.lista('lavas').find((l) => l.slug === 'lava-novo');
  ok('cria lava com a marca pública', !!novo && FAKE.ler('marcas/lava-novo').lava_id === novo.id);
  ok('lava novo nasce com 6 serviços de exemplo', FAKE.lista(`lavas/${novo.id}/servicos`).length === 6);
  ok('lava novo nasce com o login do dono', FAKE.lista('usuarios').some((u) => u.login === 'maria' && u.perfil === 'dono' && u.lava_id === novo.id));
  let erro = ''; try { await Nuvem.adminCriarLava({ nome: 'Outro', slug: 'lava-novo', dono: 'Xavier', login: 'xx.x', senha: 'senha123' }); } catch (e) { erro = e.message; }
  ok('endereço repetido é recusado', /Já existe/.test(erro), erro);
  const lista = await Nuvem.adminLavas();
  ok('lista os lavas com o dono', lista.length === 2 && lista.find((l) => l.id === novo.id).dono.includes('maria'));
  await Nuvem.adminEditarLava(novo.id, { nome: 'Lava Novo 2', ativo: false, plano: 'anual', pago_ate: '2027-01-01' });
  ok('muda nome e assinatura (e a marca pública acompanha)', FAKE.ler('lavas/' + novo.id).ativo === false && FAKE.ler('lavas/' + novo.id).plano === 'anual' && FAKE.ler('marcas/lava-novo').nome === 'Lava Novo 2');
  await Nuvem.adminCriarAcesso(novo.id, { login: 'joao.func', senha: 'senha123', nome: 'João', perfil: 'funcionario' });
  ok('cria acesso em lava que já existe', (await Nuvem.adminAcessos(novo.id)).length === 2);
  location.hash = '#/admin'; App.render(); await esp(500);
  ok('tela de administração desenha', /Lava Novo 2/.test(document.getElementById('tela').innerText) && !/NaN|undefined/.test(document.getElementById('tela').innerText));
  localStorage.removeItem('lr.teste.perfil'); localStorage.removeItem('lr.cache');
  return log.join('\n');
};
