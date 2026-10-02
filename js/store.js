/* =========================================================
   Store — os dados do lava-rápido na memória do aparelho.
   As linhas têm exatamente as mesmas colunas do banco.
   - modo "demo":  tudo fica só neste aparelho (demonstração)
   - modo "nuvem": cópia do banco + fila do que falta enviar
   ========================================================= */
(function () {
  const params = new URLSearchParams(location.search);
  const CFG = window.LAVA_CFG || {};
  const S = {
    modo: params.get('demo') === '1' || !(CFG.url && CFG.chave) ? 'demo' : 'nuvem',
    s: null, rev: 0, idx: {}
  };
  window.Store = S;
  window.Telas = {};   // cada arquivo de js/telas/ se registra aqui

  // coluna que identifica cada linha
  S.CHAVE = { servicos: 'id', clientes: 'id', veiculos: 'placa', atendimentos: 'id', agendamentos: 'id', despesas: 'id', equipe: 'user_id' };

  S.vazio = () => ({
    lava: { id: '', slug: '', nome: 'Lava Rápido', marca: {}, config: {}, ativo: true, plano: 'mensal', pago_ate: null },
    servicos: [], clientes: [], veiculos: [], atendimentos: [], agendamentos: [], despesas: [], equipe: []
  });

  S.usar = (estado) => { S.s = { ...S.vazio(), ...estado }; S.reindex(); S.rev++; };
  S.reindex = () => { for (const t of Object.keys(S.CHAVE)) S.idx[t] = new Map((S.s[t] || []).map((r) => [r[S.CHAVE[t]], r])); };
  S.por = (t, k) => (S.idx[t] ? S.idx[t].get(k) : undefined) || null;

  // põe a linha no lugar (o MESMO objeto continua valendo: uma janela aberta com ele não fica com cópia velha)
  S.mesclar = (t, linha) => {
    const k = linha[S.CHAVE[t]];
    const atual = S.idx[t].get(k);
    if (atual) { if (atual !== linha) Object.assign(atual, linha); return atual; }
    S.s[t].push(linha); S.idx[t].set(k, linha);
    return linha;
  };

  // ---------------- cópia no aparelho ----------------
  const CHAVE_DEMO = 'lr.demo';
  let timer = null;
  S.salvar = () => {
    S.rev++;
    if (S.modo !== 'demo') { if (window.Nuvem) Nuvem.guardar(); return; }
    clearTimeout(timer);
    timer = setTimeout(() => { try { localStorage.setItem(CHAVE_DEMO, JSON.stringify({ v: 1, s: S.s })); } catch (e) {} }, 250);
  };
  S.lerDemo = () => { try { const c = JSON.parse(localStorage.getItem(CHAVE_DEMO) || 'null'); return c && c.v === 1 ? c.s : null; } catch (e) { return null; } };
  S.apagarDemo = () => { try { localStorage.removeItem(CHAVE_DEMO); } catch (e) {} };

  // preferências deste aparelho (não vão para o banco)
  S.pref = (k, v) => {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('lr.pref.' + k) || 'null');
      localStorage.setItem('lr.pref.' + k, JSON.stringify(v));
    } catch (e) {}
    return v === undefined ? null : v;
  };
})();
