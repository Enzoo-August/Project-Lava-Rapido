/* =========================================================
   Chegou carro — uma pergunta por tela, botões grandes.
   Carro que já veio:  placa → serviço → pronto   (3 toques)
   Carro novo:         placa → modelo → cor → cliente → serviço
   ========================================================= */
(function () {
  let E = null;          // o que já foi respondido
  let tela = null;       // elemento da tela

  const novo = () => ({ passo: 'placa', placa: '', veic: null, existente: false, cli: null, cliNovo: { nome: '', telefone: '' }, ids: [], extras: [], vals: {}, valor: null, nivel: null, previsao: null, previsaoEm: null, obs: '', busca: '', porteLivre: null, feito: null, ag: null });
  const TECLAS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const OBS_RAPIDAS = ['Já tem risco ou amassado', 'Objetos de valor no carro', 'Cliente espera no local', 'Chave fica no lava-rápido'];
  const PREVISOES = [[30, '30 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas'], [180, '3 horas'], [300, '5 horas']];

  const ir = (passo) => { E.passo = passo; desenhar(); window.scrollTo(0, 0); };
  const ordem = () => (E.existente ? ['placa', 'servico'] : E.cli ? ['placa', 'modelo', 'cor', 'servico'] : ['placa', 'modelo', 'cor', 'cliente', 'servico']);

  const cab = (pergunta, dica) => {
    const o = ordem(), i = Math.max(0, o.indexOf(E.passo));
    return `<div class="passos">${o.map((_, n) => `<i class="${n <= i ? 'feito' : ''}"></i>`).join('')}</div>
      <h2 class="pergunta">${pergunta}</h2>${dica ? `<p class="mudo centro">${dica}</p>` : ''}`;
  };
  const resumoCarro = () => {
    const v = E.veic || {}, c = E.cli;
    return `<div class="resumo-carro">${U.placaHtml(E.placa)}<div><b>${U.esc(v.modelo ? DB.nomeVeiculo(v) : 'Carro novo')}</b><small>${U.esc(c ? c.nome : E.cliNovo.nome || '')}</small></div></div>`;
  };

  // ---------------- 1. placa ----------------
  function passoPlaca() {
    const p = E.placa, tipo = p.length < 7 ? U.placaPos(p.length) : '';
    const achados = DB.buscarVeiculos(p, 3);
    const completa = U.placaOk(p), exato = completa ? DB.veiculo(p) : null;
    const visor = Array.from({ length: 7 }, (_, i) => `<span class="${i === p.length ? 'vez' : ''}">${p[i] || ''}</span>`).join('');
    const dica = Store.modo === 'demo' && Store.s.dica && !p ? `<p class="dica-demo">${U.icon('presente')}<span>Demonstração: digite <b>${U.placaFmt(Store.s.dica.placa)}</b> para ver um cliente ganhando o prêmio de fidelidade.</span></p>` : '';
    const lista = achados.map((v) => {
      const c = DB.cliente(v.cliente_id), aberto = DB.abertoDaPlaca(v.placa);
      return `<button type="button" class="achado" data-placa="${v.placa}">
        ${U.placaHtml(v.placa)}
        <span><b>${U.esc(DB.nomeVeiculo(v))}</b><small>${U.esc(c ? c.nome : '')}${aberto ? ' · <em>já está no pátio</em>' : v.ultima_visita ? ' · veio ' + U.haQuanto(v.ultima_visita) : ''}</small></span>
        ${U.icon('seta')}
      </button>`;
    }).join('');
    tela.innerHTML = `<div class="passo passo-placa">
      ${cab(E.cli ? `Placa do carro de ${U.esc(U.primeiroNome(E.cli.nome))}` : 'Qual é a placa?')}
      <div class="placa-visor" aria-label="Placa digitada">${visor}</div>
      <div class="achados">${lista}${completa && !exato ? `<button type="button" class="btn btn-marca btn-g btn-bloco" data-acao="novo">${U.icon('mais')}<span>Carro novo: continuar</span></button>` : ''}${dica}</div>
      <div class="teclado" aria-label="Teclado da placa">
        ${TECLAS.map((linha, n) => `<div class="tlinha">${linha.split('').map((t) => `<button type="button" class="tecla${(n === 0 ? tipo === 'L' : tipo === 'N') || !tipo ? ' off' : ''}" data-t="${t}">${t}</button>`).join('')}${n === 3 ? `<button type="button" class="tecla larga" data-t="apagar" aria-label="Apagar">${U.icon('voltar')}</button>` : ''}</div>`).join('')}
      </div>
      <div class="sob-teclado">
        <button type="button" class="link" data-acao="semplaca">Carro sem placa</button>
        ${E.cli ? '' : '<button type="button" class="link" data-acao="pelonome">Procurar pelo nome</button>'}
      </div>
    </div>`;
  }
  const tecla = (t) => {
    if (t === 'apagar') E.placa = E.placa.slice(0, -1);
    else if (E.placa.length < 7) {
      const tipo = U.placaPos(E.placa.length), letra = /[A-Z]/.test(t);
      if ((tipo === 'L' && !letra) || (tipo === 'N' && letra)) return;
      E.placa += t;
    }
    desenhar();
  };
  const escolherVeiculo = (placa) => {
    const aberto = DB.abertoDaPlaca(placa);
    if (aberto) { U.toast('Este carro já está no pátio.', 'bad'); App.ir(aberto.status === 'pronto' ? 'patio/pronto' : 'patio'); return; }
    const v = DB.veiculo(placa);
    E.placa = placa; E.veic = { marca: v.marca, modelo: v.modelo, cor: v.cor, porte: v.porte }; E.existente = true;
    E.cli = DB.cliente(v.cliente_id) || E.cli;
    if (!E.cli) { E.existente = false; return ir('cliente'); }
    const ativos = DB.servicos().map((s) => s.id);
    E.ids = (v.ultimos_servicos || []).map((s) => s.id).filter((id) => ativos.includes(id));
    // serviço "a combinar" da última vez: já vem com o valor que o cliente pagou
    (v.ultimos_servicos || []).forEach((s) => { if (E.ids.includes(s.id) && !DB.preco(Store.por('servicos', s.id), v.porte) && s.valor > 0) E.vals[s.id] = s.valor; });
    if (E.ag) servicoDoAgendamento();
    if (!E.ids.length && !E.extras.length) { const s = DB.servicos().find((x) => DB.preco(x, v.porte) > 0); if (s) E.ids = [s.id]; }
    ir('servico');
  };

  // ---------------- procurar pelo nome ----------------
  function passoNome() {
    const lista = E.busca.trim().length >= 2 ? DB.buscarClientes(E.busca, 8) : [];
    tela.innerHTML = `<div class="passo">
      <h2 class="pergunta">Quem é o cliente?</h2>
      <label class="campo busca">${U.icon('busca')}<input id="eBusca" placeholder="Nome ou telefone" value="${U.esc(E.busca)}" autocomplete="off"></label>
      <div class="achados" id="eLista">${listaNome(lista)}</div>
    </div>`;
    const inp = tela.querySelector('#eBusca');
    inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.oninput = () => { E.busca = inp.value; tela.querySelector('#eLista').innerHTML = listaNome(E.busca.trim().length >= 2 ? DB.buscarClientes(E.busca, 8) : []); };
  }
  const listaNome = (lista) => (lista.length ? lista.map((c) => {
    const vs = DB.veiculosDe(c.id);
    return `<div class="achado-cli"><b>${U.esc(c.nome)}</b><small>${U.esc(U.telFmt(c.telefone))}</small>
      ${vs.map((v) => `<button type="button" class="achado" data-placa="${v.placa}">${U.placaHtml(v.placa)}<span><b>${U.esc(DB.nomeVeiculo(v))}</b></span>${U.icon('seta')}</button>`).join('')}
      <button type="button" class="link" data-outro="${c.id}">+ Outro carro de ${U.esc(U.primeiroNome(c.nome))}</button></div>`;
  }).join('') : E.busca.trim().length >= 2 ? '<p class="mudo centro">Ninguém com esse nome. Volte e digite a placa para cadastrar.</p>' : '<p class="mudo centro">Digite o nome ou o telefone.</p>');

  // ---------------- 2. modelo ----------------
  function passoModelo() {
    tela.innerHTML = `<div class="passo">
      ${cab('Qual é o carro?', 'Digite o modelo. Ex.: Fiesta, Onix, CG 160')}
      <label class="campo busca">${U.icon('busca')}<input id="eModelo" placeholder="Modelo do carro ou da moto" value="${U.esc(E.busca)}" autocomplete="off" autocapitalize="words"></label>
      <div id="eSug"></div>
    </div>`;
    const inp = tela.querySelector('#eModelo'), sug = tela.querySelector('#eSug');
    const pintar = () => {
      const txt = inp.value.trim();
      E.busca = inp.value; E.porteLivre = null;
      if (!txt) { sug.innerHTML = `<p class="rotulo">Mais comuns</p><div class="chips">${CAT.POPULARES.map((m) => `<button type="button" class="chip" data-modelo="${U.esc(m.marca + '|' + m.modelo)}">${U.esc(m.modelo)}</button>`).join('')}</div>`; return; }
      const lista = CAT.buscar(txt, 7);
      sug.innerHTML = `<div class="achados">${lista.map((m) => `<button type="button" class="achado" data-modelo="${U.esc(m.marca + '|' + m.modelo)}"><span><b>${U.esc(m.modelo)}</b><small>${m.moto ? 'Moto' + (m.marca !== 'Moto' ? ' ' + U.esc(m.marca) : '') : U.esc(m.marca) + ' · ' + CAT.porteNome(m.porte)}</small></span>${U.icon('seta')}</button>`).join('')}</div>
        ${txt.length >= 2 ? `<div class="livre"><p class="rotulo">${lista.length ? 'Não é nenhum desses?' : 'Não achei na lista.'} Usar “${U.esc(U.capitalizar(txt))}” e escolher o tamanho:</p>
          <div class="portes">${CAT.PORTES.map((p) => `<button type="button" class="porte" data-porte="${p.id}"><b>${p.nome}</b><small>${p.ex}</small></button>`).join('')}</div></div>` : ''}`;
    };
    inp.oninput = pintar; pintar(); inp.focus();
  }

  // ---------------- 3. cor ----------------
  function passoCor() {
    tela.innerHTML = `<div class="passo">
      ${cab('Qual é a cor?')}
      ${resumoCarro()}
      <div class="cores">${CAT.CORES.map(([nome, hex]) => `<button type="button" class="cor" data-cor="${nome}"><i style="${hex ? 'background:' + hex : ''}" class="${hex ? '' : 'outra'}"></i><span>${nome}</span></button>`).join('')}</div>
    </div>`;
  }

  // ---------------- 4. cliente ----------------
  function passoCliente() {
    tela.innerHTML = `<form class="passo" id="eForm" autocomplete="off">
      ${cab('Quem é o dono do carro?')}
      ${resumoCarro()}
      <label class="campo grande"><span>Nome do cliente</span><input name="nome" value="${U.esc(E.cliNovo.nome)}" autocapitalize="words" enterkeyhint="next" required></label>
      <label class="campo grande"><span>WhatsApp (com DDD)</span><input name="telefone" value="${U.esc(U.telFmt(E.cliNovo.telefone))}" inputmode="tel" placeholder="(11) 99999-9999" enterkeyhint="done"></label>
      <div id="eJa"></div>
      <p class="mudo pequeno">O telefone é para avisar quando o carro ficar pronto. Sem ele, não dá para avisar.</p>
      <div class="pe-fixo"><button class="btn btn-marca btn-g btn-bloco" type="submit"><span>Continuar</span>${U.icon('seta')}</button></div>
    </form>`;
    const f = tela.querySelector('#eForm'), tel = f.telefone, ja = tela.querySelector('#eJa');
    const conferir = () => {
      const c = DB.clientePorTelefone(tel.value);
      ja.innerHTML = c ? `<button type="button" class="aviso-caixa toque" data-usar="${c.id}">${U.icon('pessoas')}<span>Esse telefone já é de <b>${U.esc(c.nome)}</b>${DB.veiculosDe(c.id)[0] ? ' (' + U.esc(DB.nomeVeiculo(DB.veiculosDe(c.id)[0])) + ')' : ''}. <u>Toque para usar esse cadastro</u>.</span></button>` : '';
    };
    tel.oninput = () => { tel.value = U.telFmt(tel.value); E.cliNovo.telefone = tel.value; conferir(); };
    f.nome.oninput = () => { E.cliNovo.nome = f.nome.value; };
    conferir();
    if (!E.cliNovo.nome) f.nome.focus();
    f.onsubmit = (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim();
      if (nome.length < 2) { U.toast('Escreva o nome do cliente.', 'bad'); f.nome.focus(); return; }
      if (tel.value && !U.telOk(tel.value)) { U.toast('Confira o telefone: precisa do DDD + número.', 'bad'); tel.focus(); return; }
      E.cliNovo = { nome: U.capitalizar(nome), telefone: U.telDig(tel.value) };
      prepararServico(); ir('servico');
    };
  }
  const prepararServico = () => {
    if (E.ag) servicoDoAgendamento();
    // já deixa marcado o primeiro serviço que tem preço (o "a combinar" precisa perguntar o valor)
    if (!E.ids.length && !E.extras.length) { const s = DB.servicos().find((x) => DB.preco(x, E.veic.porte) > 0); if (s) E.ids = [s.id]; }
  };
  // veio da agenda: já entra com o serviço (e o valor) combinado
  const servicoDoAgendamento = () => {
    const ag = E.ag; if (!ag.servico || E.agUsado) return;
    E.agUsado = true; E.ids = []; E.extras = [];
    const s = DB.servicos().find((x) => x.nome === ag.servico);
    if (s) { E.ids = [s.id]; if (Number(ag.valor) > 0) E.vals[s.id] = Number(ag.valor); }
    else E.extras = [{ id: 'livre-' + U.uuid().slice(0, 8), nome: ag.servico, valor: Number(ag.valor) || 0 }];
    if (ag.obs) E.obs = ag.obs;
  };

  // ---------------- 5. serviço ----------------
  const totais = () => {
    const itens = DB.itens(E.ids, E.veic.porte).map((i) => (E.vals[i.id] != null ? { ...i, valor: E.vals[i.id] } : i)).concat(E.extras);
    const soma = itens.reduce((t, i) => t + i.valor, 0);
    const valor = E.valor != null ? E.valor : soma;
    const desconto = E.nivel ? Math.round(valor * E.nivel.desconto) / 100 : 0;
    return { itens, soma, valor, desconto, total: Math.max(0, valor - desconto), minutos: DB.minutos(E.ids) };
  };
  const amanha18 = () => { const d = U.somaDias(U.inicioDia(), 1); d.setHours(18, 0, 0, 0); return d.toISOString(); };
  const quandoFica = () => (E.previsaoEm ? new Date(E.previsaoEm) : new Date(Date.now() + E.previsao * 60000));
  const quandoTxt = (d) => (U.dia(d) === U.dia() ? 'às ' + U.hora(d) : `${U.SEMANA[new Date(d).getDay()].toLowerCase()} ${U.dataCurta(d)} às ${U.hora(d)}`);
  const previsaoPadrao = (min) => (PREVISOES.find((p) => p[0] >= min + 10 + DB.abertos().filter((a) => a.status !== 'pronto').length * 10) || PREVISOES[PREVISOES.length - 1])[0];

  function fidelidadeHtml() {
    const f = DB.fidelidade(E.cli, 1);
    if (!f.ativo) return '';
    const meta = f.proximo ? f.proximo.pontos : f.meta;
    const selos = `<div class="selos">${Array.from({ length: Math.min(meta, 20) }, (_, i) => `<i class="${i < f.saldo ? 'cheio' : ''}">${i < f.saldo ? U.icon('gota') : ''}</i>`).join('')}</div>`;
    const maior = f.alcancados[f.alcancados.length - 1];
    if (maior) {
      const nome = U.esc(U.primeiroNome(E.cli ? E.cli.nome : E.cliNovo.nome));
      return `<div class="premio${f.exato ? ' festa' : ''}">
        <div class="premio-cab">${U.icon('presente')}<div><b>${f.exato ? `${f.saldo}ª lavagem de ${nome}!` : `${nome} tem prêmio guardado`}</b>
          <small>${f.exato ? 'Ganhou' : 'Pode usar'} <b>${maior.desconto}% de desconto</b>.${f.proximo ? ` Se guardar, com ${f.proximo.pontos} lavagens ganha ${f.proximo.desconto}%.` : ''}</small></div></div>
        <p class="premio-fala">Pergunte: “Quer usar o desconto agora ou guardar?”</p>
        <div class="premio-botoes">
          ${f.alcancados.slice().reverse().map((n) => `<button type="button" class="btn ${E.nivel && E.nivel.pontos === n.pontos ? 'btn-marca' : ''}" data-nivel="${n.pontos}">Usar ${n.desconto}% agora</button>`).join('')}
          <button type="button" class="btn ${E.nivel ? '' : 'btn-marca'}" data-nivel="0">Guardar</button>
        </div>
      </div>`;
    }
    return `<div class="fidel"><div class="fidel-txt">${U.icon('presente')}<span><b>${f.saldo}ª lavagem</b> · ${DB.faltamTxt(f)} para ganhar ${f.proximo.desconto}% de desconto</span></div>${selos}</div>`;
  }

  function passoServico() {
    // serviço demorado (polimento, vitrificação…) já sugere entregar no dia seguinte
    if (E.previsao == null && !E.previsaoEm) { if (DB.minutos(E.ids) > 300) E.previsaoEm = amanha18(); else E.previsao = previsaoPadrao(DB.minutos(E.ids)); }
    const t = totais(), c = E.cli, temServico = E.ids.length + E.extras.length > 0;
    const podeValor = DB.ehDono() || DB.cfg().funcionarioMudaValor;
    tela.innerHTML = `<div class="passo passo-servico">
      ${cab('Qual serviço?')}
      <div class="resumo-carro grande">${U.placaHtml(E.placa)}
        <div><b>${U.esc(DB.nomeVeiculo(E.veic))}</b><small>${U.esc(c ? c.nome : E.cliNovo.nome)}${c && c.visitas ? ` · já veio ${c.visitas} ${c.visitas === 1 ? 'vez' : 'vezes'}` : ' · <em>cliente novo</em>'}</small></div>
        <button type="button" class="link" data-acao="porte">${CAT.porteNome(E.veic.porte)} ${U.icon('editar')}</button>
      </div>
      ${fidelidadeHtml()}
      <div class="servs">${Atend.servicosHtml(E.veic.porte, E.ids, E.vals)}${Atend.extrasHtml(E.extras)}
        <button type="button" class="serv livre" data-acao="extra">${U.icon('mais')}<span class="serv-nome"><b>Outro serviço</b><small>escrever o nome e o valor</small></span></button></div>
      <p class="rotulo">Fica pronto quando?</p>
      <div class="chips previsoes">${PREVISOES.map(([m, txt]) => `<button type="button" class="chip${!E.previsaoEm && E.previsao === m ? ' ativo' : ''}" data-prev="${m}">${txt}</button>`).join('')}
        <button type="button" class="chip${E.previsaoEm ? ' ativo' : ''}" data-acao="outrodia">${E.previsaoEm ? U.capitalizar(quandoTxt(E.previsaoEm)) : 'Outro dia'}</button></div>
      <p class="rotulo">Observação <span class="mudo">(se precisar)</span></p>
      <div class="chips">${OBS_RAPIDAS.map((o) => `<button type="button" class="chip${E.obs.includes(o) ? ' ativo' : ''}" data-obs="${U.esc(o)}">${o}</button>`).join('')}</div>
      <div class="pe-fixo">
        <div class="pe-total">
          <span>${t.desconto ? `<s>${U.brl(t.valor)}</s> ` : ''}<b>${U.brl(t.total)}</b>${t.desconto ? ` <em>−${E.nivel.desconto}%</em>` : ''}</span>
          <small>pronto ${quandoTxt(quandoFica())}</small>
          ${podeValor ? '<button type="button" class="link" data-acao="valor">ajustar valor</button>' : ''}
        </div>
        <button class="btn btn-ok btn-g" type="button" data-acao="confirmar" ${temServico ? '' : 'disabled'}>${U.icon('check')}<span>Confirmar</span></button>
      </div>
    </div>`;
  }

  const confirmar = () => {
    if (!E.ids.length && !E.extras.length) return;
    const t = totais();
    const a = DB.entrada({
      placa: E.placa, veiculo: E.veic,
      cliente: E.cli ? { id: E.cli.id } : E.cliNovo,
      itens: t.itens, valor: E.valor != null ? E.valor : null, nivel: E.nivel,
      previsaoMin: E.previsao, previsao: E.previsaoEm, obs: E.obs
    });
    if (E.ag) DB.salvarAgendamento(E.ag, { status: 'chegou', atendimento_id: a.id, cliente_id: a.cliente_id, placa: a.placa });
    E.feito = a; E.cli = DB.cliente(a.cliente_id);
    ir('feito');
  };

  // ---------------- 6. feito ----------------
  function passoFeito() {
    const a = E.feito, c = E.cli, f = DB.fidelidade(c);
    const fid = !f.ativo ? '' : a.pontos_usados ? `Usou o prêmio: ${U.esc(a.premio)}` : f.proximo ? `${f.saldo}ª lavagem · ${DB.faltamTxt(f)} para ${f.proximo.desconto}% de desconto` : `${f.saldo} lavagens guardadas`;
    tela.innerHTML = `<div class="passo feito">
      <div class="feito-ic">${U.icon('check')}</div>
      <h2 class="pergunta">Entrada registrada!</h2>
      <div class="feito-ficha"><small>Ficha</small><b>${a.numero}</b></div>
      <div class="resumo-carro grande centro">${U.placaHtml(a.placa)}<div><b>${U.esc(a.veiculo)}</b><small>${U.esc(c.nome)}</small></div></div>
      <p class="centro">${U.esc(a.servicos.map((s) => s.nome).join(' + '))} · <b>${U.brl(a.total)}</b><br>Previsão: <b>${quandoTxt(a.previsao)}</b></p>
      ${fid ? `<p class="fidel-linha">${U.icon('presente')}<span>${fid}</span></p>` : ''}
      <p class="fala">Pode dizer: “Pronto, ${U.esc(U.primeiroNome(c.nome))}! Aviso no WhatsApp quando terminar.”</p>
      <div class="pilha">
        ${U.telOk(c.telefone) ? `<button type="button" class="btn btn-zap btn-g btn-bloco" data-acao="comprovante">${U.icon('zap')}<span>Enviar confirmação no WhatsApp</span></button>` : ''}
        <button type="button" class="btn btn-marca btn-g btn-bloco" data-acao="outro">${U.icon('mais')}<span>Chegou outro carro</span></button>
        <a class="btn btn-g btn-bloco" href="#/${App.user.perfil === 'dono' ? 'inicio' : 'balcao'}">Voltar ao início</a>
      </div>
    </div>`;
  }

  // ---------------- desenho e toques ----------------
  function desenhar() {
    ({ placa: passoPlaca, nome: passoNome, modelo: passoModelo, cor: passoCor, cliente: passoCliente, servico: passoServico, feito: passoFeito })[E.passo]();
  }

  async function toque(e) {
    const alvo = (sel) => e.target.closest(sel);
    let b;
    if ((b = alvo('[data-t]'))) return tecla(b.dataset.t);
    if ((b = alvo('[data-placa]'))) return escolherVeiculo(b.dataset.placa);
    if ((b = alvo('[data-outro]'))) { E.cli = DB.cliente(b.dataset.outro); E.busca = ''; return ir('placa'); }
    if ((b = alvo('[data-modelo]'))) {
      const [marca, modelo] = b.dataset.modelo.split('|'), m = CAT.modelos.find((x) => x.marca === marca && x.modelo === modelo);
      E.veic = { marca: m.marca, modelo: m.modelo, porte: m.porte, cor: '' }; E.busca = '';
      return ir('cor');
    }
    if ((b = alvo('[data-porte]')) && E.passo === 'modelo') { E.veic = { marca: '', modelo: U.capitalizar(E.busca), porte: b.dataset.porte, cor: '' }; E.busca = ''; return ir('cor'); }
    if ((b = alvo('[data-cor]'))) { E.veic.cor = b.dataset.cor; if (E.cli) prepararServico(); return ir(E.cli ? 'servico' : 'cliente'); }
    if ((b = alvo('[data-usar]'))) { E.cli = DB.cliente(b.dataset.usar); prepararServico(); return ir('servico'); }
    if ((b = alvo('[data-serv]'))) {
      const id = b.dataset.serv, s = Store.por('servicos', id);
      if (E.ids.includes(id)) { E.ids = E.ids.filter((x) => x !== id); delete E.vals[id]; }
      else {
        // serviço "a combinar": pergunta o valor na hora
        if (!DB.preco(s, E.veic.porte)) { const v = await Atend.pedirValor(s.nome); if (v == null) return; E.vals[id] = v; }
        E.ids = [...E.ids, id];
      }
      E.valor = null; E.previsao = null; E.previsaoEm = null; return desenhar();
    }
    if ((b = alvo('[data-tirar-extra]'))) { E.extras = E.extras.filter((x) => x.id !== b.dataset.tirarExtra); E.valor = null; return desenhar(); }
    if ((b = alvo('[data-prev]'))) { E.previsao = Number(b.dataset.prev); E.previsaoEm = null; return desenhar(); }
    if ((b = alvo('[data-obs]'))) { const o = b.dataset.obs, l = E.obs ? E.obs.split(' · ') : []; E.obs = (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]).join(' · '); return desenhar(); }
    if ((b = alvo('[data-nivel]'))) { const n = Number(b.dataset.nivel); E.nivel = n ? DB.fidelidade(E.cli, 1).alcancados.find((x) => x.pontos === n) || null : null; return desenhar(); }
    if (!(b = alvo('[data-acao]')) || b.disabled) return;
    const acao = b.dataset.acao;
    if (acao === 'novo') return ir('modelo');
    if (acao === 'semplaca') { E.placa = 'SEM-' + Math.random().toString(36).slice(2, 6).toUpperCase(); return ir('modelo'); }
    if (acao === 'pelonome') return ir('nome');
    if (acao === 'confirmar') { b.disabled = true; return confirmar(); }
    if (acao === 'outro') { E = novo(); return ir('placa'); }
    if (acao === 'extra') { const x = await Atend.pedirServicoLivre(); if (x) { E.extras = [...E.extras, x]; E.valor = null; desenhar(); } return; }
    if (acao === 'outrodia') {
      const d = new Date(E.previsaoEm || amanha18());
      const r = await U.modal({
        titulo: 'Fica pronto quando?',
        html: `<div class="lado"><label class="campo"><span>Dia</span><input name="dia" type="date" value="${U.dia(d)}" min="${U.dia()}"></label><label class="campo"><span>Hora</span><input name="hora" type="time" value="${U.hora(d)}"></label></div>`,
        acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => { const f = U.campos(el); if (!f.dia || !f.hora) { U.toast('Informe o dia e a hora.', 'bad'); return false; } const q = U.deDia(f.dia); q.setHours(Number(f.hora.slice(0, 2)), Number(f.hora.slice(3, 5)), 0, 0); return q.toISOString(); } }]
      });
      if (r) { E.previsaoEm = r; desenhar(); }
      return;
    }
    if (acao === 'comprovante') return U.zap(E.cli.telefone, DB.msg('entrada', E.feito, E.cli));
    if (acao === 'porte') {
      const p = await U.modal({ titulo: 'Tamanho do veículo', empilhar: true, html: '<p class="mudo">O preço da lavagem muda com o tamanho.</p>', acoes: CAT.PORTES.map((x) => ({ txt: `${x.nome} (${x.ex})`, cls: x.id === E.veic.porte ? 'btn-marca' : '', valor: x.id })) });
      if (p) { E.veic.porte = p; E.valor = null; desenhar(); }
    }
    if (acao === 'valor') {
      const t = totais();
      await U.modal({
        titulo: 'Ajustar o valor',
        html: `<label class="campo grande"><span>Valor desta lavagem (R$)</span><input name="valor" inputmode="decimal" value="${String(t.valor).replace('.', ',')}"></label><p class="mudo pequeno">Pela tabela: ${U.brl(t.soma)}</p>`,
        aoAbrir: (el) => { const i = el.querySelector('input'); i.focus(); i.select(); },
        acoes: [{ txt: 'Usar a tabela', aoTocar: () => { E.valor = null; return true; } }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: (el) => { E.valor = Math.max(0, U.num(U.campos(el).valor)); return true; } }]
      });
      desenhar();
    }
  }

  const voltarPasso = () => {
    if (E.passo === 'feito') return App.voltar();
    if (E.passo === 'nome') return ir('placa');
    const o = ordem(), i = o.indexOf(E.passo);
    if (i <= 0) return App.voltar();
    if (o[i - 1] === 'placa') { const cli = E.existente && !E.ag ? null : E.cli, placa = U.semPlaca(E.placa) ? '' : E.placa, ag = E.ag, cliNovo = E.ag ? E.cliNovo : null; E = novo(); E.cli = cli; E.placa = placa; E.ag = ag; if (cliNovo) E.cliNovo = cliNovo; }
    ir(o[i - 1]);
  };

  Telas.entrada = {
    titulo: 'Chegou carro', perfis: ['funcionario', 'dono'], parado: true,
    aoVoltar: () => voltarPasso(),
    render: (el, args) => {
      tela = el;
      if (DB.bloqueado()) { el.innerHTML = `<div class="vazio">${U.icon('alerta')}<p>Assinatura suspensa</p><p class="mudo">Não é possível registrar carros agora. Fale com o dono do lava-rápido.</p></div>`; return; }
      E = novo();
      if (args[0] === 'c' && DB.cliente(args[1])) E.cli = DB.cliente(args[1]);
      // veio da agenda: cliente, placa e serviço já entram preenchidos
      const ag = args[0] === 'a' ? Store.por('agendamentos', args[1]) : null;
      if (ag && ag.status === 'marcado') {
        E.ag = ag; E.cli = DB.cliente(ag.cliente_id);
        if (!E.cli) E.cliNovo = { nome: ag.nome || '', telefone: ag.telefone || '' };
        if (U.placaOk(ag.placa)) E.placa = ag.placa;
      }
      el.addEventListener('click', toque);
      // teclado do computador também digita a placa
      const tecladoFisico = (e) => {
        if (E.passo !== 'placa' || U.modalAberto() || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Backspace') { e.preventDefault(); tecla('apagar'); }
        else if (/^[a-zA-Z0-9]$/.test(e.key)) tecla(e.key.toUpperCase());
      };
      document.addEventListener('keydown', tecladoFisico);
      App.aoSairDaTela = () => document.removeEventListener('keydown', tecladoFisico);
      desenhar();
      if (args[0] === 'p' && DB.veiculo(args[1])) escolherVeiculo(args[1]);
      if (E.ag && E.placa && DB.veiculo(E.placa) && !DB.abertoDaPlaca(E.placa)) escolherVeiculo(E.placa);
    }
  };
})();
