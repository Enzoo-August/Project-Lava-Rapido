/* =========================================================
   Banco simulado (só para teste; o app não carrega isto).
   Imita o Supabase na memória do navegador, com as mesmas regras
   automáticas do banco de verdade (ficha do dia, contadores),
   para testar login, fila sem internet e vários aparelhos
   sem digitar senha nem tocar nos dados reais.
   Usado por  testes/nuvem.html
   ========================================================= */
(function () {
  const LAVA = '11111111-1111-4111-8111-111111111111';
  const carimbo = (() => { let n = Date.now(); return () => new Date(++n).toISOString().replace('Z', '000+00:00'); })();
  const F = {
    offline: false, recusar: null, chamadas: 0,
    // para testar como dono:  localStorage.setItem('lr.teste.perfil', 'dono')  e recarregar
    usuario: localStorage.getItem('lr.teste.perfil') === 'dono' ? { id: 'aaaaaaaa-0000-4000-8000-000000000002', perfil: 'dono' } : { id: 'aaaaaaaa-0000-4000-8000-000000000001', perfil: 'funcionario' },
    t: {
      lavas: [{ id: LAVA, slug: 'teste', nome: 'Lava Teste', marca: { cor: '#0f8a5f' }, config: {}, ativo: true, plano: 'mensal', pago_ate: null, atualizado_em: carimbo() }],
      perfis: [
        { user_id: 'aaaaaaaa-0000-4000-8000-000000000001', lava_id: LAVA, nome: 'Zé Funcionário', login: 'ze', perfil: 'funcionario', ativo: true },
        { user_id: 'aaaaaaaa-0000-4000-8000-000000000002', lava_id: LAVA, nome: 'Dona Maria', login: 'maria', perfil: 'dono', ativo: true }
      ],
      servicos: [['Lavagem simples', 40, 30], ['Lavagem completa', 60, 50]].map(([nome, p, minutos], i) => ({ id: 'bbbbbbbb-0000-4000-8000-00000000000' + i, lava_id: LAVA, nome, precos: { moto: p / 2, p, m: p + 10, g: p + 20, x: p + 30 }, minutos, ordem: i + 1, ativo: true, atualizado_em: carimbo() })),
      clientes: [], veiculos: [], atendimentos: [], agendamentos: [], despesas: []
    }
  };
  window.FAKE = F;
  const PK = { lavas: ['id'], perfis: ['user_id'], servicos: ['id'], clientes: ['id'], veiculos: ['lava_id', 'placa'], atendimentos: ['id'], agendamentos: ['id'], despesas: ['id'] };
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const falha = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });

  // o que os gatilhos do banco fazem
  const recalcular = (a) => {
    const c = F.t.clientes.find((x) => x.id === a.cliente_id), dele = F.t.atendimentos.filter((x) => x.cliente_id === a.cliente_id && x.status !== 'cancelado');
    if (c) Object.assign(c, { visitas: dele.length, pontos_usados: dele.reduce((t, x) => t + (x.pontos_usados || 0), 0), gasto: dele.filter((x) => x.status === 'entregue').reduce((t, x) => t + x.total, 0), ultima_visita: dele.length ? dele[dele.length - 1].entrada_em : null, primeira_visita: dele.length ? dele[0].entrada_em : null, atualizado_em: carimbo() });
    const v = F.t.veiculos.find((x) => x.placa === a.placa), doCarro = F.t.atendimentos.filter((x) => x.placa === a.placa && x.status !== 'cancelado');
    if (v) Object.assign(v, { visitas: doCarro.length, ultima_visita: doCarro.length ? doCarro[doCarro.length - 1].entrada_em : null, ultimos_servicos: doCarro.length ? doCarro[doCarro.length - 1].servicos : null, atualizado_em: carimbo() });
  };
  const gravar = (tab, linha) => {
    const lista = F.t[tab], atual = lista.find((x) => PK[tab].every((k) => x[k] === linha[k]));
    if (F.recusar && F.recusar(tab, linha)) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
    let r;
    if (atual) { r = Object.assign(atual, copia(linha)); }
    else {
      r = copia(linha);
      if (tab === 'clientes') Object.assign(r, { visitas: 0, pontos_usados: 0, gasto: 0, primeira_visita: null, ultima_visita: null });
      if (tab === 'veiculos') Object.assign(r, { visitas: 0, ultima_visita: null, ultimos_servicos: null });
      if (tab === 'atendimentos') {
        const dia = String(r.entrada_em).slice(0, 10);
        r.numero = F.t.atendimentos.filter((x) => String(x.entrada_em).slice(0, 10) === dia).reduce((m, x) => Math.max(m, x.numero || 0), 0) + 1;
        r.cliente_novo = !F.t.atendimentos.some((x) => x.cliente_id === r.cliente_id && x.status !== 'cancelado');
        r.atendente = F.usuario.id;
      }
      lista.push(r);
    }
    if (tab === 'atendimentos') r.total = Math.max(0, (r.valor || 0) - (r.desconto || 0));
    r.atualizado_em = carimbo();
    if (tab === 'atendimentos') recalcular(r);
    return { data: copia(r), error: null };
  };

  // consulta encadeada, no estilo do supabase-js
  const consulta = (tab) => {
    const q = { filtros: [], ordens: [], faixa: null, um: false, acao: null };
    const rodar = () => {
      F.chamadas++;
      if (F.offline) return falha();
      if (q.acao) {
        if (q.acao.tipo === 'upsert') return gravar(tab, q.acao.linha);
        const alvo = F.t[tab].find((x) => q.filtros.every((f) => f(x)));
        if (!alvo) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        return gravar(tab, { ...alvo, ...q.acao.linha });
      }
      let rows = F.t[tab].filter((x) => q.filtros.every((f) => f(x)));
      // regra do banco: funcionário só vê atendimento em aberto ou das últimas 36 horas
      if (tab === 'atendimentos' && F.usuario.perfil !== 'dono') rows = rows.filter((a) => ['aguardando', 'lavando', 'pronto'].includes(a.status) || new Date(a.entrada_em) > Date.now() - 36 * 3600e3);
      if (tab === 'despesas' && F.usuario.perfil !== 'dono') rows = [];
      for (const [c, asc] of q.ordens.slice().reverse()) rows.sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)));
      if (q.faixa) rows = rows.slice(q.faixa[0], q.faixa[1] + 1);
      rows = copia(rows);
      return { data: q.um ? rows[0] || null : rows, error: null };
    };
    const api = {
      select: () => api,
      eq: (c, v) => { q.filtros.push((x) => x[c] === v); return api; },
      gt: (c, v) => { q.filtros.push((x) => x[c] > v); return api; },
      gte: (c, v) => { q.filtros.push((x) => x[c] >= v); return api; },
      lt: (c, v) => { q.filtros.push((x) => x[c] < v); return api; },
      or: (txt) => { const m = /entrada_em\.gte\."([^"]+)"/.exec(txt); q.filtros.push((x) => ['aguardando', 'lavando', 'pronto'].includes(x.status) || x.entrada_em >= m[1]); return api; },
      order: (c, o) => { q.ordens.push([c, !(o && o.ascending === false)]); return api; },
      range: (a, b) => { q.faixa = [a, b]; return api; },
      limit: (n) => { q.faixa = [0, n - 1]; return api; },
      maybeSingle: () => { q.um = true; return api; },
      single: () => { q.um = true; return api; },
      upsert: (linha) => { q.acao = { tipo: 'upsert', linha }; return api; },
      update: (linha) => { q.acao = { tipo: 'update', linha }; return api; },
      then: (ok, erro) => new Promise((r) => setTimeout(() => r(rodar()), 15)).then(ok, erro)
    };
    return api;
  };

  window.LAVA_TESTE_SB = {
    from: consulta,
    rpc: (nome) => Promise.resolve(F.offline ? falha() : { data: nome === 'ha_admin' ? true : null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: F.usuario ? { user: { id: F.usuario.id } } : null } }),
      signInWithPassword: () => Promise.resolve({ error: { message: 'Invalid login credentials' } }),
      signOut: () => { F.usuario = null; return Promise.resolve({}); },
      refreshSession: () => Promise.resolve({})
    }
  };
})();
