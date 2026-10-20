/* =========================================================
   Banco simulado (só para teste; o app não carrega isto).
   Faz o papel do Firebase (login + Firestore) na memória do
   navegador, com o mesmo "adaptador" que js/nuvem.js usa.
   Dá para simular: sem internet, outro aparelho mexendo e o
   banco recusando uma gravação. Usado por testes/nuvem.html.
   ========================================================= */
(function () {
  const LAVA = 'lava-teste';
  const agora = () => new Date().toISOString();
  const copia = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const docs = new Map();       // caminho → dados
  const ouvintes = [];          // { col, filtros, cb } ou { doc, cb }
  const F = {
    offline: false, recusar: null, gravacoes: 0, docs,
    usuario: localStorage.getItem('lr.teste.perfil') === 'dono' ? 'u-dono' : localStorage.getItem('lr.teste.perfil') === 'admin' ? 'u-admin' : 'u-func',
    logins: { 'func@lava.local': 'u-func', 'dono@lava.local': 'u-dono', 'admin@lava.local': 'u-admin' }
  };
  window.FAKE = F;

  const pai = (p) => p.split('/').slice(0, -1).join('/');
  const casa = (r, filtros) => (filtros || []).every(([c, op, v]) => {
    const x = r[c];
    if (op === '==') return x === v;
    if (op === 'in') return v.includes(x);
    if (x == null) return false;
    return op === '>=' ? x >= v : op === '<' ? x < v : op === '>' ? x > v : op === '<=' ? x <= v : false;
  });
  const avisar = (caminho) => {
    const d = docs.get(caminho);
    for (const o of ouvintes) {
      if (o.doc === caminho && d) o.cb(copia(d));
      if (o.col && o.col === pai(caminho) && d && casa(d, o.filtros)) o.cb([copia(d)]);
    }
  };
  const por = (p, d) => { docs.set(p, d); };
  const esperarRede = () => new Promise((res) => { const t = () => (F.offline ? setTimeout(t, 100) : res()); setTimeout(t, 20); });

  // dados iniciais: um lava com dois serviços, um dono, um funcionário e o admin
  por('sistema/admin', { uid: 'u-admin' });
  por('lavas/' + LAVA, { id: LAVA, slug: 'teste', nome: 'Lava Teste', marca: { cor: '#0f8a5f' }, config: {}, ativo: true, plano: 'mensal', pago_ate: null, criado_em: agora() });
  por('marcas/teste', { lava_id: LAVA, slug: 'teste', nome: 'Lava Teste', marca: { cor: '#0f8a5f' } });
  por('usuarios/u-admin', { user_id: 'u-admin', lava_id: null, nome: 'Admin', login: 'admin', perfil: 'admin', ativo: true });
  por('usuarios/u-dono', { user_id: 'u-dono', lava_id: LAVA, nome: 'Dona Maria', login: 'dono', perfil: 'dono', ativo: true });
  por('usuarios/u-func', { user_id: 'u-func', lava_id: LAVA, nome: 'Zé Funcionário', login: 'func', perfil: 'funcionario', ativo: true });
  [['Lavagem simples', 40, 30], ['Lavagem completa', 60, 50]].forEach(([nome, p, minutos], i) => {
    const id = 'sv' + i;
    por(`lavas/${LAVA}/servicos/${id}`, { id, lava_id: LAVA, nome, precos: { moto: p / 2, p, m: p + 10, g: p + 20, x: p + 30 }, minutos, ordem: i + 1, ativo: true });
  });

  // "outro aparelho" grava direto no banco simulado
  F.gravarComoOutro = (caminho, dados) => { docs.set(caminho, { ...(docs.get(caminho) || {}), ...copia(dados) }); avisar(caminho); };
  F.ler = (caminho) => copia(docs.get(caminho));
  F.lista = (col) => Array.from(docs.entries()).filter(([k]) => pai(k) === col).map(([, v]) => copia(v));

  const gravarUm = (caminho, dados) => {
    if (F.recusar && F.recusar(caminho, dados)) return Promise.reject(Object.assign(new Error('sem permissão'), { code: 'permission-denied' }));
    docs.set(caminho, { ...(docs.get(caminho) || {}), ...copia(dados) });   // vale na hora (como o Firestore faz no aparelho)
    avisar(caminho);
    F.gravacoes++;
    return esperarRede();                                                  // a confirmação do servidor só vem com internet
  };

  window.LAVA_TESTE_API = {
    entrar: async (email, senha) => { const uid = F.logins[email]; if (!uid || String(senha).length < 6) throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' }); F.usuario = uid; return uid; },
    sair: async () => { F.usuario = null; },
    uidAtual: async () => F.usuario,
    criarLoginProprio: async (email) => { const uid = 'u-' + Math.random().toString(36).slice(2, 8); F.logins[email] = uid; F.usuario = uid; return uid; },
    criarLogin: async (email) => { if (F.logins[email]) throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }); const uid = 'u-' + Math.random().toString(36).slice(2, 8); F.logins[email] = uid; return uid; },
    trocarMinhaSenha: async () => {},
    ler: async (p) => { if (F.offline && !docs.has(p)) throw Object.assign(new Error('x'), { code: 'unavailable' }); return copia(docs.get(p)) || null; },
    gravar: (p, d) => gravarUm(p, d),
    lote: (ops) => Promise.all(ops.map(([p, d]) => gravarUm(p, d))),
    buscar: async (col, filtros) => { if (F.offline) throw Object.assign(new Error('x'), { code: 'unavailable' }); return F.lista(col).filter((r) => casa(r, filtros)); },
    ouvir: (col, filtros, cb) => { const o = { col, filtros, cb }; ouvintes.push(o); setTimeout(() => cb(F.lista(col).filter((r) => casa(r, filtros))), 10); return () => ouvintes.splice(ouvintes.indexOf(o), 1); },
    ouvirDoc: (p, cb) => { const o = { doc: p, cb }; ouvintes.push(o); setTimeout(() => docs.has(p) && cb(copia(docs.get(p))), 10); return () => ouvintes.splice(ouvintes.indexOf(o), 1); },
    proximoNumero: async (p) => { if (F.offline) throw new Error('offline'); const n = ((docs.get(p) || {}).n || 0) + 1; docs.set(p, { n }); return n; }
  };
})();
