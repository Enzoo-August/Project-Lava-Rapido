/* =========================================================
   Nuvem (Supabase) — login real e dados compartilhados

   Como funciona:
   - Ao entrar, o app usa a cópia guardada no aparelho (abre na hora)
     e busca no banco o que mudou.
   - Tudo que a pessoa faz vale na tela imediatamente e entra numa
     FILA. A fila é enviada ao banco em ordem; sem internet ela
     fica guardada no aparelho e segue sozinha quando o sinal volta.
   - A cada poucos segundos busca o que os outros aparelhos fizeram.
   - Nada é apagado do banco pelo app (só desativado/cancelado).
   ========================================================= */
(function () {
  const CFG = window.LAVA_CFG || {};
  const N = { ativo: Store.modo === 'nuvem', sb: null, fila: [], falhas: [], ultimo: {}, enviando: false, puxando: false, erro: null, pronto: false };
  window.Nuvem = N;
  if (!N.ativo) { N.guardar = () => {}; N.pendentes = () => 0; return; }

  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const CACHE = 'lr.cache';
  const PAG = 1000;

  // colunas que o aparelho envia (o resto é calculado pelo banco)
  const COLS = {
    lavas: ['nome', 'marca', 'config'],
    servicos: ['id', 'lava_id', 'nome', 'precos', 'minutos', 'ordem', 'ativo'],
    clientes: ['id', 'lava_id', 'nome', 'telefone', 'obs', 'avaliacao_pedida_em', 'ativo'],
    veiculos: ['lava_id', 'placa', 'cliente_id', 'marca', 'modelo', 'cor', 'porte', 'obs', 'ativo'],
    atendimentos: ['id', 'lava_id', 'placa', 'veiculo', 'cliente_id', 'servicos', 'valor', 'desconto', 'pontos_usados', 'premio', 'status', 'pagamento',
      'previsao', 'obs', 'token', 'entrada_em', 'inicio_em', 'pronto_em', 'entregue_em', 'cancelado_em', 'avisado_em', 'atendente_nome', 'lavador'],
    agendamentos: ['id', 'lava_id', 'cliente_id', 'nome', 'telefone', 'placa', 'veiculo', 'servico', 'valor', 'quando', 'obs', 'status', 'atendimento_id', 'criado_por'],
    despesas: ['id', 'lava_id', 'data', 'categoria', 'descricao', 'valor', 'excluido']
  };
  const CONFLITO = { servicos: 'id', clientes: 'id', veiculos: 'lava_id,placa', atendimentos: 'id', agendamentos: 'id', despesas: 'id' };
  const TABELAS = ['servicos', 'clientes', 'veiculos', 'atendimentos', 'agendamentos', 'despesas'];

  const erroTxt = (e) => (e && (e.message || e.error_description || e.details)) || String(e);
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  // erro definitivo = o banco recusou (permissão, dado inválido); o resto (sem sinal, servidor fora, sessão vencida) tenta de novo
  const definitivo = (e) => !!(e && e.code && /^(22|23|42|P0|PGRST1|PGRST2)/.test(e.code) && e.code !== 'PGRST301');

  // ---------------- conexão ----------------
  const carregarLib = () => new Promise((res, rej) => {
    if (window.LAVA_TESTE_SB || (window.supabase && window.supabase.createClient)) return res();   // LAVA_TESTE_SB: banco simulado dos testes
    const s = document.createElement('script'); s.src = LIB; s.onload = res;
    s.onerror = () => rej(new Error('Sem internet para conectar. Verifique o sinal e tente de novo.'));
    document.head.appendChild(s);
  });
  N.iniciar = async () => {
    await carregarLib();
    N.sb = window.LAVA_TESTE_SB || window.supabase.createClient(CFG.url, CFG.chave, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'lr.auth' } });
    addEventListener('online', () => { status(); N.agendar(0); });
    addEventListener('offline', () => status());
    document.addEventListener('visibilitychange', () => { if (!document.hidden && App.user) { N.agendar(0); N.puxar(); } });
    // o pátio a cada 8 s; o resto a cada ~1 min
    let volta = 0;
    setInterval(() => {
      if (!App.user || document.hidden) return;
      volta++;
      if (N.fila.length) N.enviar();
      N.puxar(volta % 8 === 0 ? null : volta % 4 === 0 ? ['atendimentos', 'agendamentos'] : ['atendimentos']);
    }, 8000);
  };

  N.email = (login) => U.norm(login).replace(/\s+/g, '') + '@' + (CFG.dominioLogin || 'lava.local');

  const paraUser = (p) => ({ id: p.user_id, nome: p.nome, login: p.login, perfil: p.perfil, lava_id: p.lava_id, ativo: p.ativo });
  N.usuarioAtual = async () => {
    const { data } = await N.sb.auth.getSession();
    const s = data && data.session; if (!s) return null;
    try {
      const p = ok(await N.sb.from('perfis').select('*').eq('user_id', s.user.id).maybeSingle());
      return p && p.ativo ? paraUser(p) : { semPerfil: true };
    } catch (e) {
      const c = lerCache();   // sem internet: usa o último usuário guardado
      return c && c.user && c.user.id === s.user.id ? c.user : null;
    }
  };
  N.entrar = async (login, senha) => {
    const r = await N.sb.auth.signInWithPassword({ email: N.email(login), password: senha });
    if (r.error) return { erro: /invalid/i.test(r.error.message) ? 'Usuário ou senha incorretos.' : /fetch|network|load failed/i.test(r.error.message) ? 'Sem internet. Verifique o sinal e tente de novo.' : erroTxt(r.error) };
    const user = await N.usuarioAtual();
    if (!user || user.semPerfil) { await N.sb.auth.signOut(); return { erro: 'Este acesso está desativado. Fale com o dono do lava-rápido.' }; }
    return { user };
  };
  N.sair = async () => {
    try { localStorage.removeItem(CACHE); } catch (e) {}
    N.fila = []; N.falhas = []; N.ultimo = {}; N.pronto = false;
    try { await N.sb.auth.signOut(); } catch (e) {}
  };

  // ---------------- funções do banco ----------------
  const rpc = async (nome, args) => ok(await N.sb.rpc(nome, args));
  N.marca = (slug) => rpc('marca', { p_slug: slug });
  N.haAdmin = () => rpc('ha_admin');
  N.primeiroAdmin = (o) => rpc('primeiro_admin', { p_login: o.login, p_senha: o.senha, p_nome: o.nome });
  N.criarAcesso = (o) => rpc('criar_acesso', { p_login: o.login, p_senha: o.senha, p_nome: o.nome, p_perfil: o.perfil });
  N.editarAcesso = (id, o) => rpc('editar_acesso', { p_user: id, p_nome: o.nome, p_perfil: o.perfil, p_ativo: o.ativo });
  N.trocarSenha = (id, senha) => rpc('trocar_senha_acesso', { p_user: id, p_senha: senha });
  N.adminLavas = () => rpc('admin_lavas');
  N.adminCriarLava = (o) => rpc('admin_criar_lava', { p_nome: o.nome, p_slug: o.slug, p_dono_nome: o.dono, p_login: o.login, p_senha: o.senha, p_pago_ate: o.pago_ate || null });
  N.adminCriarAcesso = (lava, o) => rpc('admin_criar_acesso', { p_lava: lava, p_login: o.login, p_senha: o.senha, p_nome: o.nome, p_perfil: o.perfil });
  N.adminAcessos = async (lava) => ok(await N.sb.from('perfis').select('*').eq('lava_id', lava).order('nome'));
  N.adminEditarLava = (id, o) => rpc('admin_editar_lava', { p_id: id, p_nome: o.nome, p_ativo: o.ativo, p_plano: o.plano, p_pago_ate: o.pago_ate || null });

  // ---------------- leitura ----------------
  const pendente = (t, k) => N.fila.some((op) => op.t === t && op.k === k);
  const lavaId = () => (App.user || {}).lava_id;

  const buscar = async (t) => {
    const chave = Store.CHAVE[t], desde = N.ultimo[t];
    const out = [];
    for (let i = 0; ; i += PAG) {
      let q = N.sb.from(t).select('*').eq('lava_id', lavaId());
      if (desde) q = q.gt('atualizado_em', desde);
      else if (t === 'atendimentos') { const d = U.somaDias(U.inicioDia(), -2).toISOString(); q = q.or(`status.in.(aguardando,lavando,pronto),entrada_em.gte."${d}",entregue_em.gte."${d}",cancelado_em.gte."${d}"`); }
      else if (t === 'agendamentos') q = q.gte('quando', U.somaDias(U.inicioDia(), -7).toISOString());
      else if (t === 'despesas') q = q.gte('data', U.dia(U.somaDias(new Date(), -400)));
      const rows = ok(await q.order('atualizado_em').order(chave).range(i, i + PAG - 1));
      out.push(...rows);
      if (rows.length < PAG) break;
    }
    return out;
  };

  // busca o que mudou desde a última vez (so = lista de tabelas; vazio = tudo, incluindo marca e equipe)
  N.puxar = async (so) => {
    if (N.puxando || N.enviando || !App.user || !lavaId() || !navigator.onLine) return false;
    N.puxando = true;
    let mudou = false;
    try {
      if (!so) {
        if (!pendente('lavas', lavaId())) {
          const l = ok(await N.sb.from('lavas').select('*').eq('id', lavaId()).maybeSingle());
          if (l && l.atualizado_em !== Store.s.lava.atualizado_em) { Store.s.lava = l; mudou = true; }
        }
        const eq = ok(await N.sb.from('perfis').select('*').eq('lava_id', lavaId()).order('nome'));
        if (JSON.stringify(eq) !== JSON.stringify(Store.s.equipe)) { Store.s.equipe = eq; Store.reindex(); mudou = true; }
      }
      for (const t of so || TABELAS) {
        if (t === 'despesas' && App.user.perfil !== 'dono') continue;
        // Primeira carga de atendimentos/despesas traz só o recente. O ponto de partida das próximas buscas
        // é a última alteração que existe no banco (e não a do que veio), senão a busca seguinte traria o histórico inteiro.
        let topo = null;
        if (!N.ultimo[t] && (t === 'atendimentos' || t === 'despesas' || t === 'agendamentos')) {
          const u = ok(await N.sb.from(t).select('atualizado_em').eq('lava_id', lavaId()).order('atualizado_em', { ascending: false }).limit(1));
          topo = u.length ? u[0].atualizado_em : null;
        }
        const rows = await buscar(t);
        let ultimo = N.ultimo[t] || '1970-01-01T00:00:00+00:00';
        for (const r of rows) {
          if (r.atualizado_em > ultimo) ultimo = r.atualizado_em;
          if (pendente(t, r[Store.CHAVE[t]])) continue;
          Store.mesclar(t, r); mudou = true;
        }
        N.ultimo[t] = topo || ultimo;
        // chegou carro novo de outro aparelho: o cliente/veículo dele também é novo → busca já
        if (t === 'atendimentos' && so && rows.some((r) => !Store.por('veiculos', r.placa) || (r.cliente_id && !Store.por('clientes', r.cliente_id)))) {
          N.puxando = false; await N.puxar(['clientes', 'veiculos']); N.puxando = true;
        }
      }
      N.erro = null;
    } catch (e) { N.erro = erroTxt(e); }
    finally { N.puxando = false; }
    if (mudou) { Store.rev++; N.guardar(); App.aoMudar(); }
    status();
    return mudou;
  };

  // movimento de um período (painel do dono): direto do banco, sem guardar tudo no aparelho
  const memo = new Map();
  N.periodo = async (deIso, ateIso) => {
    const k = deIso + '|' + ateIso, m = memo.get(k);
    if (m && Date.now() - m.em < 20000) return m.rows;
    const out = [];
    for (let i = 0; ; i += PAG) {
      // chegou no período OU foi entregue no período (o dinheiro conta no dia da entrega)
      const rows = ok(await N.sb.from('atendimentos').select('*').eq('lava_id', lavaId())
        .or(`and(entrada_em.gte."${deIso}",entrada_em.lt."${ateIso}"),and(entregue_em.gte."${deIso}",entregue_em.lt."${ateIso}")`).order('entrada_em').order('id').range(i, i + PAG - 1));
      out.push(...rows);
      if (rows.length < PAG) break;
    }
    // o que ainda está na fila deste aparelho vale mais do que a cópia do banco
    const rows = out.map((r) => (pendente('atendimentos', r.id) ? Store.por('atendimentos', r.id) || r : r));
    memo.set(k, { em: Date.now(), rows });
    return rows;
  };
  N.historicoCliente = async (clienteId) => ok(await N.sb.from('atendimentos').select('*').eq('lava_id', lavaId()).eq('cliente_id', clienteId).order('entrada_em', { ascending: false }).limit(60));

  // ---------------- gravação (fila) ----------------
  const limpar = (t, linha) => { const o = {}; for (const c of COLS[t]) if (linha[c] !== undefined) o[c] = linha[c]; return o; };
  N.enfileirar = (t, linha) => {
    const k = t === 'lavas' ? linha.id : linha[Store.CHAVE[t]];
    const row = limpar(t, linha);
    const ja = N.fila.find((op) => op.t === t && op.k === k);
    if (ja) ja.row = row; else N.fila.push({ t, k, row });
    memo.clear();
    N.guardar(); status(); N.agendar();
  };
  N.pendentes = () => N.fila.length;

  let timer = null;
  N.agendar = (ms = 400) => { clearTimeout(timer); timer = setTimeout(() => N.enviar(), ms); };

  N.enviar = async () => {
    if (N.enviando || !N.fila.length || !App.user) return;
    if (!navigator.onLine) { status(); return; }
    N.enviando = true; status();
    try {
      while (N.fila.length) {
        const op = N.fila[0];
        const enviado = JSON.stringify(op.row);
        const r = op.t === 'lavas'
          ? await N.sb.from('lavas').update(op.row).eq('id', op.k).select().single()
          : await N.sb.from(op.t).upsert(op.row, { onConflict: CONFLITO[op.t] }).select().single();
        if (r.error) {
          if (!definitivo(r.error)) throw r.error;
          // o banco recusou: tira da fila para não travar o resto e avisa
          N.falhas.push({ t: op.t, k: op.k, erro: erroTxt(r.error), em: new Date().toISOString() });
          N.fila.shift();
          U.toast(/row-level security|permission/i.test(erroTxt(r.error)) ? 'Uma alteração não foi salva: este acesso não tem permissão.' : 'Uma alteração não foi salva: ' + erroTxt(r.error), 'bad');
          continue;
        }
        // mudou de novo enquanto enviava? fica na fila para ir a versão mais nova
        if (JSON.stringify(op.row) !== enviado) continue;
        N.fila.shift();
        if (op.t === 'lavas') Store.s.lava = { ...Store.s.lava, ...r.data };
        // do atendimento voltam a ficha do dia e o "cliente novo" conferidos pelo banco;
        // cliente e veículo ficam como estão: seus contadores chegam certos na busca logo depois da fila
        else if (op.t === 'atendimentos' || op.t === 'servicos' || op.t === 'despesas' || op.t === 'agendamentos') Store.mesclar(op.t, r.data);
      }
      N.erro = null;
    } catch (e) {
      N.erro = erroTxt(e);
      if (/jwt|token/i.test(N.erro)) { try { await N.sb.auth.refreshSession(); } catch (e2) {} }
      setTimeout(() => N.agendar(0), 10000);
    } finally {
      N.enviando = false;
      Store.rev++; N.guardar(); status();
    }
    if (!N.fila.length) { await N.puxar(); App.aoMudar(); }
  };

  // ---------------- cópia no aparelho ----------------
  let cacheTimer = null;
  N.guardar = () => {
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => {
      if (!App.user || !Store.s) return;
      try { localStorage.setItem(CACHE, JSON.stringify({ v: 1, user: App.user, s: Store.s, fila: N.fila, falhas: N.falhas.slice(-20), ultimo: N.ultimo })); } catch (e) {}
    }, 300);
  };
  const lerCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.v === 1 ? c : null; } catch (e) { return null; } };

  // Ao abrir: usa a cópia do aparelho, envia o que ficou pendente e busca o que mudou
  N.abrir = async (user) => {
    const c = lerCache();
    if (c && c.user && c.user.id === user.id && c.s) {
      // atendimentos antigos já encerrados saem da cópia (o histórico fica no banco)
      const corte = U.somaDias(U.inicioDia(), -3).toISOString();
      c.s.atendimentos = (c.s.atendimentos || []).filter((a) => ['aguardando', 'lavando', 'pronto'].includes(a.status) || a.entrada_em > corte || (a.entregue_em && a.entregue_em > corte) || (a.cancelado_em && a.cancelado_em > corte) || (c.fila || []).some((op) => op.k === a.id));
      Store.usar(c.s); N.fila = c.fila || []; N.falhas = c.falhas || []; N.ultimo = c.ultimo || {};
    } else { Store.usar(Store.vazio()); N.fila = []; N.falhas = []; N.ultimo = {}; }
    N.pronto = true;
    if (!user.lava_id) return;   // admin: não tem lava
    const temCopia = !!(c && Store.s.lava.id);
    const primeira = (async () => { await N.puxar(); if (N.fila.length) await N.enviar(); })();
    if (!temCopia) { await primeira; if (!Store.s.lava.id) throw new Error(N.erro || 'Sem internet para carregar os dados pela primeira vez.'); }
  };

  // ---------------- indicador "Salvo / Enviando / Sem internet" ----------------
  function status() {
    const el = document.getElementById('nuvemSt'); if (!el) return;
    const p = N.fila.length;
    let txt, cls, ic;
    if (!navigator.onLine) { txt = p ? `Sem internet · ${p} para enviar` : 'Sem internet'; cls = 'aviso'; ic = 'alerta'; }
    else if (N.enviando) { txt = 'Salvando…'; cls = ''; ic = 'relogio'; }
    else if (p && N.erro) { txt = `Sem sinal · ${p} para enviar`; cls = 'aviso'; ic = 'alerta'; }
    else if (p) { txt = `${p} para enviar`; cls = 'aviso'; ic = 'relogio'; }
    else { txt = 'Salvo'; cls = 'bom'; ic = 'check'; }
    el.hidden = false;
    el.className = 'chip-st ' + cls;
    el.innerHTML = `${U.icon(ic)}<span>${txt}</span>`;
    el.title = N.erro ? 'Detalhe: ' + N.erro : 'Tudo guardado no banco de dados';
  }
  N.status = status;
})();
