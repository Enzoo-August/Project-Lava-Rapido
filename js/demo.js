/* =========================================================
   Demonstração — um lava-rápido de mentira, com 3 meses de
   movimento, para mostrar o sistema funcionando (e para testar).
   Abre com  ?demo=1  no endereço. Nada daqui vai para o banco.
   Os dados são inventados e recomeçam a cada dia.
   ========================================================= */
(function () {
  const Demo = {};
  window.Demo = Demo;

  // sorteio que dá sempre o mesmo resultado (a demonstração fica igual para todo mundo)
  const sorteador = (semente) => () => { semente |= 0; semente = (semente + 0x6d2b79f5) | 0; let t = Math.imul(semente ^ (semente >>> 15), 1 | semente); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const NOMES = 'Ana,Bruno,Carla,Diego,Eduarda,Felipe,Gabriela,Henrique,Isabela,João,Karina,Lucas,Mariana,Nelson,Olívia,Paulo,Rafaela,Sérgio,Tatiane,Ulisses,Vanessa,Wagner,Yasmin,André,Beatriz,Caio,Daniela,Enzo,Fernanda,Gustavo,Helena,Igor,Juliana,Leandro,Marcos,Natália,Otávio,Patrícia,Rodrigo,Simone,Thiago,Viviane,Alex,Bianca,Cláudio,Débora,Fábio,Lívia,Mateus,Renata'.split(',');
  const SOBRENOMES = 'Silva,Santos,Oliveira,Souza,Lima,Pereira,Ferreira,Costa,Rodrigues,Almeida,Nascimento,Carvalho,Araújo,Ribeiro,Gomes,Martins,Rocha,Barbosa,Alves,Mendes,Cardoso,Teixeira,Moreira,Correia,Augusto'.split(',');
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  Demo.gerar = () => {
    const r = sorteador(20261002);
    const um = (lista) => lista[Math.floor(r() * lista.length)];
    const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
    const pesado = (pares) => { const total = pares.reduce((t, p) => t + p[1], 0); let x = r() * total; for (const p of pares) { x -= p[1]; if (x <= 0) return p[0]; } return pares[0][0]; };
    const id = () => U.uuid();
    const LAVA = 'demo-lava';

    const s = Store.vazio();
    s.dia = U.dia();
    s.lava = {
      id: LAVA, slug: 'demo', nome: 'Lava Rápido Brilho', ativo: true, plano: 'mensal', pago_ate: null,
      marca: { cor: '#0b63ce', logo: '', telefone: '11999990000', endereco: 'Av. das Flores, 1200 · Centro', google: 'https://g.page/r/exemplo/review', instagram: '' },
      config: { lavadores: ['Jonas', 'Wellington', 'Bia'] }
    };
    s.equipe = [
      { user_id: 'demo-dono', lava_id: LAVA, nome: 'Carlos', login: 'dono', perfil: 'dono', ativo: true },
      { user_id: 'demo-func', lava_id: LAVA, nome: 'Jonas', login: 'equipe', perfil: 'funcionario', ativo: true }
    ];
    const SV = [
      ['Lavagem simples', { moto: 20, p: 40, m: 50, g: 60, x: 70 }, 30, 50],
      ['Lavagem completa', { moto: 35, p: 60, m: 70, g: 85, x: 100 }, 50, 26],
      ['Lavagem com cera', { moto: 45, p: 80, m: 95, g: 110, x: 130 }, 70, 12],
      ['Lavagem detalhada', { moto: 80, p: 180, m: 220, g: 260, x: 300 }, 180, 4],
      ['Higienização interna', { moto: 0, p: 200, m: 240, g: 280, x: 320 }, 240, 3],
      ['Lavagem de motor', { moto: 20, p: 50, m: 50, g: 60, x: 70 }, 30, 5]
    ];
    s.servicos = SV.map((x, i) => ({ id: id(), lava_id: LAVA, nome: x[0], precos: x[1], minutos: x[2], ordem: i + 1, ativo: true }));
    const pesosServ = s.servicos.map((sv, i) => [sv, SV[i][3]]);

    // clientes e veículos
    const carros = CAT.modelos.filter((m) => !m.moto), motos = CAT.modelos.filter((m) => m.moto);
    const populares = CAT.POPULARES;
    const placas = new Set();
    const placaNova = () => {
      for (;;) {
        const l = um(LETRAS) + um(LETRAS) + um(LETRAS);
        const p = r() < 0.6 ? l + entre(0, 9) + um(LETRAS) + entre(0, 9) + entre(0, 9) : l + String(entre(0, 9999)).padStart(4, '0');
        if (!placas.has(p)) { placas.add(p); return p; }
      }
    };
    const pesoCliente = [];
    for (let i = 0; i < 150; i++) {
      const c = { id: id(), lava_id: LAVA, nome: `${um(NOMES)} ${um(SOBRENOMES)}`, telefone: '119' + String(entre(60000000, 99999999)), obs: '', visitas: 0, pontos_usados: 0, gasto: 0, primeira_visita: null, ultima_visita: null, avaliacao_pedida_em: null, ativo: true, criado_em: null };
      s.clientes.push(c);
      const n = r() < 0.14 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const m = r() < 0.07 ? um(motos) : r() < 0.55 ? um(populares) : um(carros);
        s.veiculos.push({ lava_id: LAVA, placa: placaNova(), cliente_id: c.id, marca: m.marca, modelo: m.modelo, cor: pesado([['Branco', 28], ['Prata', 24], ['Preto', 18], ['Cinza', 14], ['Vermelho', 8], ['Azul', 6], ['Bege', 2]]), porte: m.porte, obs: '', visitas: 0, ultima_visita: null, ultimos_servicos: null, ativo: true, criado_em: null });
      }
      // uns vêm toda semana, a maioria de vez em quando
      pesoCliente.push([c, r() < 0.12 ? 9 : r() < 0.35 ? 4 : 1]);
    }
    const veicDe = (cid) => s.veiculos.filter((v) => v.cliente_id === cid);

    // movimento dos últimos 90 dias
    const POR_DIA = [9, 12, 12, 14, 16, 22, 30];   // dom … sáb
    const hoje = U.inicioDia(), agora = Date.now();
    const saldo = new Map();
    const novoAtend = (c, v, entrada, st) => {
      const sv = v.porte === 'moto' ? s.servicos[r() < 0.75 ? 0 : 1] : pesado(pesosServ);
      const itens = [{ id: sv.id, nome: sv.nome, valor: sv.precos[v.porte] || 0 }];
      if (v.porte !== 'moto' && sv.ordem <= 2 && r() < 0.08) itens.push({ id: s.servicos[5].id, nome: s.servicos[5].nome, valor: s.servicos[5].precos[v.porte] });
      const valor = itens.reduce((t, i) => t + i.valor, 0);
      const min = itens.reduce((t, i) => t + (s.servicos.find((x) => x.id === i.id).minutos), 0);
      const sal = (saldo.get(c.id) || 0) + 1;
      const usa = sal >= 10 && r() < 0.6;
      saldo.set(c.id, usa ? sal - 10 : sal);
      const desconto = usa ? Math.round(valor * 10) / 100 : 0;
      const inicio = entrada + entre(3, 35) * 60000, pronto = inicio + Math.round(min * (0.8 + r() * 0.5)) * 60000, entregue = pronto + entre(5, 80) * 60000;
      const iso = (t) => new Date(t).toISOString();
      const a = {
        id: id(), lava_id: LAVA, numero: 0, placa: v.placa, veiculo: DB.nomeVeiculo(v), cliente_id: c.id,
        servicos: itens, valor, desconto, total: valor - desconto, pontos_usados: usa ? 10 : 0, premio: usa ? '10% de desconto (fidelidade: 10 lavagens)' : null,
        status: st, pagamento: null, previsao: iso(entrada + (min + 20) * 60000), obs: '', cliente_novo: false, token: U.token(),
        entrada_em: iso(entrada), inicio_em: null, pronto_em: null, entregue_em: null, cancelado_em: null, avisado_em: null,
        atendente: null, atendente_nome: r() < 0.8 ? 'Jonas' : 'Carlos', lavador: null
      };
      if (st !== 'aguardando' && st !== 'cancelado') { a.inicio_em = iso(inicio); a.lavador = um(s.lava.config.lavadores); }
      if (st === 'pronto' || st === 'entregue') a.pronto_em = iso(Math.min(pronto, st === 'pronto' ? agora - 4 * 60000 : pronto));
      if (st === 'entregue') { a.entregue_em = iso(entregue); a.avisado_em = a.pronto_em; a.pagamento = pesado([['Pix', 46], ['Dinheiro', 19], ['Débito', 15], ['Crédito', 20]]); }
      if (st === 'cancelado') a.cancelado_em = iso(entrada + 10 * 60000);
      s.atendimentos.push(a);
      return a;
    };
    const horaEntrada = () => { const h = pesado([[8, 9], [9, 14], [10, 15], [11, 12], [12, 6], [13, 8], [14, 12], [15, 11], [16, 8], [17, 5]]); return h * 60 + entre(0, 59); };

    for (let d = 89; d >= 0; d--) {
      const dia = U.somaDias(hoje, -d);
      const n = Math.max(3, Math.round(POR_DIA[dia.getDay()] * (0.78 + r() * 0.44) * (1 + (89 - d) / 600)));
      const usados = new Set();
      const entradas = Array.from({ length: n }, horaEntrada).sort((a, b) => a - b);
      for (const minuto of entradas) {
        const entrada = dia.getTime() + minuto * 60000;
        if (entrada > agora - 100 * 60000) continue;       // o que chegou há pouco é montado mais abaixo
        let c; do { c = pesado(pesoCliente); } while (usados.has(c.id));
        usados.add(c.id);
        novoAtend(c, um(veicDe(c.id)), entrada, r() < 0.02 ? 'cancelado' : 'entregue');
      }
    }
    // carros no pátio agora (a demonstração sempre tem movimento, a qualquer hora)
    const livres = s.clientes.filter((c) => !s.atendimentos.some((a) => a.cliente_id === c.id && U.dia(a.entrada_em) === s.dia));
    [['pronto', 95], ['lavando', 62], ['lavando', 41], ['aguardando', 24], ['aguardando', 9]].forEach(([st, min], i) => {
      const c = livres[i * 7 + 3];
      novoAtend(c, veicDe(c.id)[0], agora - min * 60000, st);
    });
    // um cliente a uma lavagem do prêmio, para mostrar a fidelidade funcionando
    s.atendimentos.sort((a, b) => (a.entrada_em < b.entrada_em ? -1 : 1));
    const fiel = pesoCliente.map((p) => p[0]).find((c) => !s.atendimentos.some((a) => a.cliente_id === c.id && a.status !== 'entregue' && a.status !== 'cancelado')
      && s.atendimentos.filter((a) => a.cliente_id === c.id && a.status === 'entregue').length > 12);
    if (fiel) {
      const dele = s.atendimentos.filter((a) => a.cliente_id === fiel.id && a.status !== 'cancelado');
      dele.forEach((a) => { a.pontos_usados = 0; a.desconto = 0; a.total = a.valor; a.premio = null; });
      dele[0].pontos_usados = dele.length - 9;    // fica com 9 lavagens guardadas: a próxima é a 10ª
      s.dica = { placa: veicDe(fiel.id)[0].placa, nome: fiel.nome };
    }

    // despesas dos últimos 4 meses
    for (let m = 0; m < 4; m++) {
      const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
      const em = (d) => U.dia(new Date(base.getFullYear(), base.getMonth(), d));
      [['Aluguel', 'Aluguel do ponto', 2600, 5], ['Salários', 'Jonas', 1900, 5], ['Salários', 'Wellington', 1800, 5], ['Salários', 'Bia', 1800, 5],
        ['Água', 'Conta de água', entre(780, 1050), 10], ['Luz', 'Conta de luz', entre(380, 520), 12], ['Produtos', 'Shampoo, cera e pretinho', entre(420, 690), 8],
        ['Produtos', 'Panos e esponjas', entre(90, 180), 19], ['Outros', 'Internet', 110, 15]]
        .forEach(([categoria, descricao, valor, d]) => { if (em(d) <= s.dia) s.despesas.push({ id: id(), lava_id: LAVA, data: em(d), categoria, descricao, valor, excluido: false }); });
    }

    Demo.recalcular(s);
    return s;
  };

  // refaz ficha do dia, "cliente novo" e os contadores de cliente/veículo (o que o banco faz sozinho)
  Demo.recalcular = (s) => {
    const cli = new Map(s.clientes.map((c) => [c.id, Object.assign(c, { visitas: 0, pontos_usados: 0, gasto: 0, primeira_visita: null, ultima_visita: null })]));
    const vei = new Map(s.veiculos.map((v) => [v.placa, Object.assign(v, { visitas: 0, ultima_visita: null, ultimos_servicos: null })]));
    const ficha = {};
    for (const a of s.atendimentos) {
      const d = U.dia(a.entrada_em);
      a.numero = ficha[d] = (ficha[d] || 0) + 1;
      if (a.status === 'cancelado') continue;
      const c = cli.get(a.cliente_id), v = vei.get(a.placa);
      if (c) {
        a.cliente_novo = c.visitas === 0;
        c.visitas++; c.pontos_usados += a.pontos_usados || 0;
        if (a.status === 'entregue') c.gasto += a.total;
        if (!c.primeira_visita) { c.primeira_visita = a.entrada_em; c.criado_em = a.entrada_em; }
        c.ultima_visita = a.entrada_em;
      }
      if (v) { v.visitas++; v.ultima_visita = a.entrada_em; v.ultimos_servicos = a.servicos; if (!v.criado_em) v.criado_em = a.entrada_em; }
    }
    // metade dos clientes antigos já recebeu o pedido de avaliação
    s.clientes.forEach((c, i) => { if (c.visitas > 1 && i % 2 === 0) c.avaliacao_pedida_em = c.primeira_visita; });
  };

  // estado da demonstração: o de hoje guardado no aparelho, ou um novo
  Demo.abrir = () => {
    let s = Store.lerDemo();
    if (!s || s.dia !== U.dia()) { s = Demo.gerar(); }
    Store.usar(s);
    Store.salvar();
  };
  Demo.recomecar = () => { Store.apagarDemo(); Store.usar(Demo.gerar()); Store.salvar(); };
  Demo.usuario = (perfil) => { const p = Store.s.equipe.find((e) => e.perfil === perfil); return { id: p.user_id, nome: p.nome, login: p.login, perfil: p.perfil, lava_id: p.lava_id, ativo: true }; };
})();
