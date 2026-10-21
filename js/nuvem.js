/* =========================================================
   Nuvem (Firebase) — login real e dados compartilhados

   Como funciona:
   - Login por usuário e senha (o e-mail é "usuario@lava.local").
   - O Firestore fica ouvindo o banco: o que outro aparelho muda
     chega sozinho, na hora.
   - Sem internet: o Firestore guarda as alterações no aparelho e
     envia sozinho quando o sinal volta (fila embutida).
   - Nada é apagado pelo aplicativo (só cancelado/desativado).
   - Quem pode o quê fica nas regras do banco (firestore.rules).

   As telas usam só as funções "N.xxx" daqui; o Firebase em si fica
   num "adaptador" (nos testes, troca-se por um banco simulado).
   ========================================================= */
(function () {
  const CFG = window.LAVA_CFG || {};
  const N = { ativo: Store.modo === 'nuvem', fila: [], falhas: [], erro: null, pronto: false, sb: null };
  window.Nuvem = N;
  if (!N.ativo) { N.guardar = () => {}; N.pendentes = () => 0; return; }

  const VERSAO_SDK = '10.14.1';
  const LIBS = ['app', 'auth', 'firestore'].map((n) => `https://www.gstatic.com/firebasejs/${VERSAO_SDK}/firebase-${n}-compat.js`);
  const CACHE = 'lr.cache';
  const ABERTOS = ['aguardando', 'lavando', 'pronto'];
  let A = null;                       // adaptador
  let ouvintes = [];

  const agoraIso = () => new Date().toISOString();
  const limpo = (o) => JSON.parse(JSON.stringify(o));   // o Firestore não aceita "undefined"
  const lavaId = () => (App.user || {}).lava_id;

  // ---------------- mensagens de erro em português ----------------
  const MSG = {
    'auth/invalid-credential': 'Usuário ou senha incorretos.', 'auth/wrong-password': 'Usuário ou senha incorretos.', 'auth/user-not-found': 'Usuário ou senha incorretos.',
    'auth/invalid-email': 'Usuário inválido: use letras, números, ponto ou traço.', 'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem internet. Verifique o sinal e tente de novo.', 'auth/email-already-in-use': 'Esse usuário já existe. Escolha outro.',
    'auth/weak-password': 'A senha precisa ter 6 caracteres ou mais.', 'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
    'auth/operation-not-allowed': 'O login por usuário e senha ainda não foi ligado no Firebase (Authentication → E-mail/senha).',
    'permission-denied': 'Este acesso não tem permissão para isso.', unavailable: 'Sem internet. Verifique o sinal e tente de novo.'
  };
  const erroTxt = (e) => (e && (MSG[e.code] || e.message)) || String(e);
  N.erroTxt = erroTxt;

  // ---------------- adaptador do Firebase de verdade ----------------
  const carregar = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Sem internet para conectar. Verifique o sinal e tente de novo.')); document.head.appendChild(s); });
  const adaptadorFirebase = () => {
    const app = firebase.initializeApp(CFG.firebase);
    const auth = app.auth(), db = app.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
    const ref = (p) => db.doc(p);
    const montar = (col, filtros) => { let q = db.collection(col); for (const [c, op, v] of filtros || []) q = q.where(c, op, v); return q; };
    // logins da equipe são criados numa segunda "sessão", para quem está cadastrando continuar conectado
    const segunda = () => firebase.apps.find((a) => a.name === 'cadastro') || firebase.initializeApp(CFG.firebase, 'cadastro');
    return {
      entrar: (email, senha) => auth.signInWithEmailAndPassword(email, senha).then((r) => r.user.uid),
      sair: () => auth.signOut(),
      uidAtual: () => new Promise((res) => { const u = auth.onAuthStateChanged((x) => { u(); res(x ? x.uid : null); }); }),
      criarLoginProprio: (email, senha) => auth.createUserWithEmailAndPassword(email, senha).then((r) => r.user.uid),
      criarLogin: async (email, senha) => { const s = segunda().auth(); const r = await s.createUserWithEmailAndPassword(email, senha); const uid = r.user.uid; await s.signOut(); return uid; },
      trocarMinhaSenha: (senha) => auth.currentUser.updatePassword(senha),
      ler: async (p) => { const s = await ref(p).get(); return s.exists ? s.data() : null; },
      gravar: (p, dados) => ref(p).set(dados, { merge: true }),
      lote: (ops) => { const b = db.batch(); for (const [p, d] of ops) b.set(ref(p), d, { merge: true }); return b.commit(); },
      buscar: async (col, filtros) => (await montar(col, filtros).get()).docs.map((d) => d.data()),
      ouvir: (col, filtros, cb, erro) => montar(col, filtros).onSnapshot((s) => cb(s.docChanges().filter((c) => c.type !== 'removed').map((c) => c.doc.data())), erro),
      ouvirDoc: (p, cb, erro) => ref(p).onSnapshot((s) => { if (s.exists) cb(s.data()); }, erro),
      proximoNumero: (p) => db.runTransaction(async (t) => { const s = await t.get(ref(p)); const n = (s.exists ? s.data().n || 0 : 0) + 1; t.set(ref(p), { n }); return n; })
    };
  };

  N.iniciar = async () => {
    if (N.sb) return;
    if (window.LAVA_TESTE_API) A = window.LAVA_TESTE_API;      // testes: banco simulado
    else { if (!window.firebase) for (const l of LIBS) await carregar(l); A = adaptadorFirebase(); }
    N.sb = A;
    addEventListener('online', () => status());
    addEventListener('offline', () => status());
  };

  // ---------------- login ----------------
  N.email = (login) => U.norm(login).replace(/\s+/g, '') + '@' + (CFG.dominioLogin || 'lava.local');
  const loginOk = (l) => /^[a-z0-9._-]{3,30}$/.test(l);
  const validar = (o) => {
    const login = U.norm(o.login).replace(/\s+/g, '');
    if (!loginOk(login)) throw new Error('O usuário deve ter de 3 a 30 letras ou números, sem espaço (pode usar ponto ou traço).');
    if (String(o.senha || '').length < 6) throw new Error('A senha precisa ter 6 caracteres ou mais.');
    if (String(o.nome || '').trim().length < 2) throw new Error('Informe o nome.');
    return login;
  };
  const paraUser = (p) => ({ id: p.user_id, nome: p.nome, login: p.login, perfil: p.perfil, lava_id: p.lava_id, ativo: p.ativo });

  N.usuarioAtual = async () => {
    const uid = await A.uidAtual(); if (!uid) return null;
    try {
      const p = await A.ler('usuarios/' + uid);
      return p && p.ativo ? paraUser(p) : { semPerfil: true };
    } catch (e) {
      const c = lerCache(); return c && c.user && c.user.id === uid ? c.user : null;   // sem internet
    }
  };
  N.entrar = async (login, senha) => {
    try { await A.entrar(N.email(login), senha); } catch (e) { return { erro: erroTxt(e) }; }
    const user = await N.usuarioAtual();
    if (!user || user.semPerfil) { await A.sair(); return { erro: 'Este acesso está desativado. Fale com o dono do lava-rápido.' }; }
    return { user };
  };
  N.sair = async () => {
    parar();
    try { localStorage.removeItem(CACHE); } catch (e) {}
    N.fila = []; N.falhas = []; N.pronto = false;
    try { await A.sair(); } catch (e) {}
  };

  // ---------------- públicas: marca do lava e primeiro acesso ----------------
  N.marca = async (slug) => { const m = await A.ler('marcas/' + U.norm(slug)); return m ? { nome: m.nome, marca: m.marca || {}, slug: m.slug } : null; };
  N.haAdmin = async () => !!(await A.ler('sistema/admin'));
  N.primeiroAdmin = async (o) => {
    const login = validar(o);
    if (await N.haAdmin()) throw new Error('O administrador já foi criado.');
    let uid; try { uid = await A.criarLoginProprio(N.email(login), o.senha); } catch (e) { throw new Error(erroTxt(e)); }
    await A.lote([['sistema/admin', { uid }], ['usuarios/' + uid, { user_id: uid, lava_id: null, nome: o.nome.trim(), login, perfil: 'admin', ativo: true, criado_em: agoraIso() }]]);
    return uid;
  };

  // ---------------- acessos (dono cria os da equipe; admin cria o dono) ----------------
  const novoAcesso = async (lava, o, perfil) => {
    const login = validar(o);
    if (!['dono', 'funcionario'].includes(perfil)) throw new Error('Perfil inválido.');
    let uid; try { uid = await A.criarLogin(N.email(login), o.senha); } catch (e) { throw new Error(erroTxt(e)); }
    try { await A.gravar('usuarios/' + uid, { user_id: uid, lava_id: lava, nome: o.nome.trim(), login, perfil, ativo: true, criado_em: agoraIso() }); }
    catch (e) { throw new Error('O login foi criado, mas não consegui liberar o acesso: ' + erroTxt(e)); }
    return uid;
  };
  N.criarAcesso = (o) => novoAcesso(lavaId(), o, o.perfil);
  N.editarAcesso = async (id, o) => {
    const atual = Store.s.equipe.find((p) => p.user_id === id) || {};
    const donosAtivos = Store.s.equipe.filter((p) => p.perfil === 'dono' && p.ativo).length;
    if (atual.perfil === 'dono' && atual.ativo && (o.perfil !== 'dono' || !o.ativo) && donosAtivos < 2) throw new Error('Precisa existir pelo menos um dono ativo.');
    await A.gravar('usuarios/' + id, { nome: String(o.nome || atual.nome).trim(), perfil: o.perfil, ativo: !!o.ativo, atualizado_em: agoraIso() });
  };
  N.podeTrocarSenhaDeOutro = false;   // no plano grátis do Firebase, só a própria pessoa troca a senha
  N.trocarSenha = async (id, senha) => {
    if (id !== (App.user || {}).id) throw new Error('A senha só pode ser trocada pela própria pessoa (Ajustes → Minha senha). Se alguém esqueceu, crie um acesso novo para ele e bloqueie o antigo.');
    if (String(senha || '').length < 6) throw new Error('A senha precisa ter 6 caracteres ou mais.');
    try { await A.trocarMinhaSenha(senha); } catch (e) { throw new Error(erroTxt(e)); }
  };

  // ---------------- administração ----------------
  let lavasAdmin = [];
  N.adminLavas = async () => {
    const [lavas, donos] = await Promise.all([A.buscar('lavas', []), A.buscar('usuarios', [['perfil', '==', 'dono']])]);
    lavasAdmin = lavas;
    return lavas.map((l) => ({ ...l, dono: donos.filter((d) => d.lava_id === l.id && d.ativo).map((d) => `${d.nome} (${d.login})`).join(', ') }))
      .sort((a, b) => (String(a.criado_em) < String(b.criado_em) ? 1 : -1));
  };
  N.adminCriarLava = async (o) => {
    const slug = U.norm(o.slug);
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) throw new Error('O endereço deve ter de 3 a 40 letras minúsculas, números ou traço.');
    if (String(o.nome || '').trim().length < 2) throw new Error('Informe o nome do lava-rápido.');
    validar({ login: o.login, senha: o.senha, nome: o.dono });
    if (await A.ler('marcas/' + slug)) throw new Error('Já existe um lava-rápido com esse endereço.');
    const id = U.uuid(), agora = agoraIso();
    const ops = [
      ['lavas/' + id, { id, slug, nome: o.nome.trim(), marca: {}, config: {}, ativo: true, plano: 'mensal', pago_ate: o.pago_ate || null, criado_em: agora, atualizado_em: agora }],
      ['marcas/' + slug, { lava_id: id, slug, nome: o.nome.trim(), marca: {}, atualizado_em: agora }]
    ];
    SERVICOS_PADRAO.forEach(([nome, precos, minutos], i) => { const sid = U.uuid(); ops.push([`lavas/${id}/servicos/${sid}`, { id: sid, lava_id: id, nome, precos, minutos, ordem: i + 1, ativo: true, atualizado_em: agora }]); });
    await A.lote(ops);
    await novoAcesso(id, { login: o.login, senha: o.senha, nome: o.dono }, 'dono');
    return id;
  };
  N.adminEditarLava = async (id, o) => {
    const l = lavasAdmin.find((x) => x.id === id) || {};
    const agora = agoraIso();
    const ops = [['lavas/' + id, { nome: String(o.nome || l.nome).trim(), ativo: !!o.ativo, plano: o.plano || l.plano || 'mensal', pago_ate: o.pago_ate || null, atualizado_em: agora }]];
    if (l.slug) ops.push(['marcas/' + l.slug, { nome: String(o.nome || l.nome).trim(), atualizado_em: agora }]);
    await A.lote(ops);
  };
  N.adminCriarAcesso = (lava, o) => novoAcesso(lava, o, o.perfil);
  N.adminAcessos = async (lava) => (await A.buscar('usuarios', [['lava_id', '==', lava]])).sort((a, b) => a.nome.localeCompare(b.nome));

  const SERVICOS_PADRAO = [
    ['Lavagem simples', { moto: 20, p: 40, m: 50, g: 60, x: 70 }, 30], ['Lavagem completa', { moto: 35, p: 60, m: 70, g: 85, x: 100 }, 50],
    ['Lavagem com cera', { moto: 45, p: 80, m: 95, g: 110, x: 130 }, 70], ['Lavagem detalhada', { moto: 80, p: 180, m: 220, g: 260, x: 300 }, 180],
    ['Higienização interna', { moto: 0, p: 200, m: 240, g: 280, x: 320 }, 240], ['Lavagem de motor', { moto: 20, p: 50, m: 50, g: 60, x: 70 }, 30]
  ];

  // ---------------- leitura: ouvintes que recebem tudo que muda ----------------
  const parar = () => { for (const f of ouvintes) { try { f(); } catch (e) {} } ouvintes = []; };
  let tMudou = null;
  const mudou = () => { clearTimeout(tMudou); tMudou = setTimeout(() => { Store.rev++; N.guardar(); status(); App.aoMudar(); }, 120); };
  const falhaLeitura = (e) => { N.erro = erroTxt(e); status(); };
  const receber = (t) => (rows) => { for (const r of rows) Store.mesclar(t, r); if (rows.length) mudou(); };

  N.abrir = async (user) => {
    const c = lerCache();
    const temCopia = !!(c && c.user && c.user.id === user.id && c.s && c.s.lava && c.s.lava.id);
    if (temCopia) {
      const corte = U.somaDias(U.inicioDia(), -3).toISOString();
      c.s.atendimentos = (c.s.atendimentos || []).filter((a) => ABERTOS.includes(a.status) || a.entrada_em > corte || (a.entregue_em && a.entregue_em > corte) || (a.cancelado_em && a.cancelado_em > corte));
      Store.usar(c.s);
    } else Store.usar(Store.vazio());
    N.pronto = true;
    if (!user.lava_id) return;   // admin: não tem lava
    parar();
    const L = 'lavas/' + user.lava_id, col = (t) => L + '/' + t;
    const lavaChegou = new Promise((res) => ouvintes.push(A.ouvirDoc(L, (d) => { Store.s.lava = { ...Store.s.lava, ...d }; App.aplicarMarca(); mudou(); res(); }, (e) => { falhaLeitura(e); res(); })));
    ouvintes.push(A.ouvir('usuarios', [['lava_id', '==', user.lava_id]], receber('equipe'), falhaLeitura));
    // com a cópia do aparelho, só busca o que mudou depois dela (cada documento lido conta na cota grátis do banco)
    const desde = (t) => {
      const ult = temCopia ? (Store.s[t] || []).reduce((m, r) => (r.atualizado_em > m ? r.atualizado_em : m), '') : '';
      return ult ? [['atualizado_em', '>=', new Date(new Date(ult).getTime() - 10 * 60000).toISOString()]] : [];
    };
    for (const t of ['servicos', 'clientes', 'veiculos']) ouvintes.push(A.ouvir(col(t), desde(t), receber(t), falhaLeitura));
    const doisDias = U.somaDias(U.inicioDia(), -2).toISOString();
    ouvintes.push(A.ouvir(col('atendimentos'), [['status', 'in', ABERTOS]], receber('atendimentos'), falhaLeitura));
    ouvintes.push(A.ouvir(col('atendimentos'), [['atualizado_em', '>=', doisDias]], receber('atendimentos'), falhaLeitura));
    ouvintes.push(A.ouvir(col('agendamentos'), [['quando', '>=', U.somaDias(U.inicioDia(), -7).toISOString()]], receber('agendamentos'), falhaLeitura));
    if (user.perfil === 'dono') {
      ouvintes.push(A.ouvir(col('despesas'), [['data', '>=', U.dia(U.somaDias(new Date(), -400))]], receber('despesas'), falhaLeitura));
      ouvintes.push(A.ouvir(col('produtos'), desde('produtos'), receber('produtos'), falhaLeitura));
      ouvintes.push(A.ouvir(col('pedidos'), [['criado_em', '>=', U.somaDias(U.inicioDia(), -120).toISOString()]], receber('pedidos'), falhaLeitura));
    }
    if (!temCopia) {
      await Promise.race([lavaChegou, new Promise((r) => setTimeout(r, 15000))]);
      if (!Store.s.lava.id) throw new Error(N.erro || 'Sem internet para carregar os dados pela primeira vez.');
    }
  };
  N.puxar = async () => false;   // com os ouvintes, o que muda já chega sozinho

  // movimento de um período (painel do dono): chegou OU foi entregue no período
  N.periodo = async (deIso, ateIso) => {
    const c = 'lavas/' + lavaId() + '/atendimentos';
    const [a, b] = await Promise.all([A.buscar(c, [['entrada_em', '>=', deIso], ['entrada_em', '<', ateIso]]), A.buscar(c, [['entregue_em', '>=', deIso], ['entregue_em', '<', ateIso]])]);
    const m = new Map(); for (const r of a.concat(b)) m.set(r.id, Store.por('atendimentos', r.id) || r);
    return Array.from(m.values()).sort((x, y) => (x.entrada_em < y.entrada_em ? -1 : 1));
  };
  N.historicoCliente = async (clienteId) => (await A.buscar('lavas/' + lavaId() + '/atendimentos', [['cliente_id', '==', clienteId]]))
    .map((r) => Store.por('atendimentos', r.id) || r).sort((a, b) => (a.entrada_em > b.entrada_em ? -1 : 1)).slice(0, 60);

  // ---------------- gravação ----------------
  const caminho = (t, linha) => `lavas/${lavaId()}/${t}/${linha[Store.CHAVE[t]]}`;
  const numerando = new Set();
  const enviar = (rotulo, promessa) => {
    const op = { rotulo, em: Date.now() };
    N.fila.push(op); status();
    promessa.then(() => { N.erro = null; }).catch((e) => {
      N.falhas.push({ t: rotulo, erro: erroTxt(e), em: agoraIso() });
      U.toast('Uma alteração não foi salva: ' + erroTxt(e), 'bad');
    }).finally(() => { N.fila = N.fila.filter((x) => x !== op); status(); N.guardar(); });
  };
  // página pública que o cliente acompanha pelo link (só o necessário, sem telefone)
  const acompanhar = (a) => {
    if (!a.token) return;
    const c = DB.cliente(a.cliente_id), f = DB.fidelidade(c);
    enviar('acompanhar', A.gravar('acompanhar/' + a.token, limpo({
      lava_id: lavaId(), lava: DB.lava().nome, marca: DB.marca(), fidelidade: DB.cfg().fidelidade, numero: a.numero, status: a.status,
      veiculo: a.veiculo, placa: a.placa, servicos: (a.servicos || []).map((s) => s.nome), total: a.total, previsao: a.previsao,
      entrada_em: a.entrada_em, pronto_em: a.pronto_em, entregue_em: a.entregue_em, nome: U.primeiroNome(c ? c.nome : ''), saldo: f.saldo, atualizado_em: agoraIso()
    })));
  };
  N.enfileirar = (t, linha) => {
    if (!A || !lavaId()) return;
    const agora = agoraIso();
    if (t === 'lavas') {
      const l = Store.s.lava;
      enviar('marca', A.lote([['lavas/' + l.id, limpo({ nome: l.nome, marca: l.marca || {}, config: l.config || {}, atualizado_em: agora })],
        ['marcas/' + l.slug, limpo({ nome: l.nome, marca: l.marca || {}, atualizado_em: agora })]]));
      return;
    }
    linha.atualizado_em = agora;
    enviar(t, A.gravar(caminho(t, linha), limpo(linha)));
    if (t === 'atendimentos') {
      acompanhar(linha);
      // ficha do dia sem repetir entre aparelhos (só no momento da chegada e com internet)
      const novo = !linha.ficha_ok && Date.now() - new Date(linha.entrada_em).getTime() < 3 * 60000;
      if (novo && navigator.onLine && !numerando.has(linha.id)) {
        numerando.add(linha.id);
        A.proximoNumero(`lavas/${lavaId()}/contadores/${U.dia(linha.entrada_em)}`).then((n) => {
          const a = Store.por('atendimentos', linha.id) || linha;
          a.numero = n; a.ficha_ok = true; Store.salvar(); N.enfileirar('atendimentos', a); App.aoMudar();
        }).catch(() => {});
      }
    }
  };
  N.pendentes = () => N.fila.length;
  N.enviar = async () => {};
  N.agendar = () => {};

  // ---------------- cópia no aparelho (abre na hora, mesmo sem internet) ----------------
  let tCache = null;
  N.guardar = () => {
    clearTimeout(tCache);
    tCache = setTimeout(() => { if (!App.user || !Store.s) return; try { localStorage.setItem(CACHE, JSON.stringify({ v: 2, user: App.user, s: Store.s })); } catch (e) {} }, 300);
  };
  const lerCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.v === 2 ? c : null; } catch (e) { return null; } };

  // ---------------- indicador "Salvo / Salvando / Sem internet" ----------------
  function status() {
    const el = document.getElementById('nuvemSt'); if (!el) return;
    const p = N.fila.length;
    let txt, cls, ic;
    if (!navigator.onLine) { txt = p ? `Sem internet · ${p} para enviar` : 'Sem internet'; cls = 'aviso'; ic = 'alerta'; }
    else if (p) { txt = 'Salvando…'; cls = ''; ic = 'relogio'; }
    else if (N.erro) { txt = 'Sem conexão'; cls = 'aviso'; ic = 'alerta'; }
    else { txt = 'Salvo'; cls = 'bom'; ic = 'check'; }
    el.hidden = false;
    el.className = 'chip-st ' + cls;
    el.innerHTML = `${U.icon(ic)}<span>${txt}</span>`;
    el.title = N.erro ? 'Detalhe: ' + N.erro : 'Tudo guardado no banco de dados';
  }
  N.status = status;
})();
