// =========================================================
// Teste das regras de segurança (firestore.rules) no testador
// oficial do Google: simula cada pessoa e cada pedido, sem
// criar login nem tocar nos dados.
//   node testes/regras.mjs <arquivo-do-token-do-google>
// (o token vem do login do firebase-tools: ver testes/LEIAME)
// =========================================================
import fs from 'node:fs';
const PROJETO = 'lava-rapido-enzo';
const regras = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const tok = process.env.TOKEN_GOOGLE;
const D = '/databases/(default)/documents/';

// quem existe no "banco" do teste
const usuarios = {
  adm: { perfil: 'admin', ativo: true, lava_id: null },
  dono: { perfil: 'dono', ativo: true, lava_id: 'L' },
  func: { perfil: 'funcionario', ativo: true, lava_id: 'L' },
  bloq: { perfil: 'funcionario', ativo: false, lava_id: 'L' },
  outro: { perfil: 'dono', ativo: true, lava_id: 'L2' },
  fsusp: { perfil: 'funcionario', ativo: true, lava_id: 'S' }
};
const lavas = { L: { id: 'L', ativo: true, nome: 'Lava L' }, L2: { id: 'L2', ativo: true }, S: { id: 'S', ativo: false } };
const mocks = (extra = []) => {
  const m = [];
  for (const [uid, d] of Object.entries(usuarios)) {
    m.push({ function: 'get', args: [{ exactValue: D + 'usuarios/' + uid }], result: { value: { data: d } } });
    m.push({ function: 'exists', args: [{ exactValue: D + 'usuarios/' + uid }], result: { value: true } });
  }
  for (const [id, d] of Object.entries(lavas)) {
    m.push({ function: 'get', args: [{ exactValue: D + 'lavas/' + id }], result: { value: { data: d } } });
    m.push({ function: 'exists', args: [{ exactValue: D + 'lavas/' + id }], result: { value: true } });
  }
  for (const uid of ['novo', 'x']) m.push({ function: 'exists', args: [{ exactValue: D + 'usuarios/' + uid }], result: { value: false } });
  m.push({ function: 'exists', args: [{ exactValue: D + 'lavas/NAOEXISTE' }], result: { value: false } });
  return m.concat(extra);
};
const casos = [];
const caso = (nome, esperado, uid, metodo, caminho, novo, atual, extra) => casos.push({ nome, t: {
  expectation: esperado,
  request: { ...(uid ? { auth: { uid } } : {}), path: D + caminho, method: metodo, ...(novo ? { resource: { data: novo } } : {}) },
  ...(atual ? { resource: { data: atual } } : {}),
  functionMocks: mocks(extra)
} });
const atend = (l) => ({ id: 'a1', lava_id: l, status: 'aguardando', placa: 'ABC1D23' });

// sem login
caso('sem login: vê se já existe administrador', 'ALLOW', null, 'get', 'sistema/admin', null, { uid: 'adm' });
caso('sem login: vê a marca do lava', 'ALLOW', null, 'get', 'marcas/garagem-z', null, { lava_id: 'L', nome: 'X' });
caso('sem login: abre o link de acompanhamento', 'ALLOW', null, 'get', 'acompanhar/abc123abc123abc1', null, { lava_id: 'L' });
caso('sem login: NÃO lista todos os acompanhamentos', 'DENY', null, 'list', 'acompanhar/abc123abc123abc1', null, { lava_id: 'L' });
caso('sem login: NÃO lê o lava', 'DENY', null, 'get', 'lavas/L', null, lavas.L);
caso('sem login: NÃO lê clientes', 'DENY', null, 'get', 'lavas/L/clientes/c1', null, { lava_id: 'L' });
caso('sem login: NÃO grava acompanhamento', 'DENY', null, 'create', 'acompanhar/zzz', { lava_id: 'L' });
// primeiro acesso
caso('primeiro admin: cria sistema/admin com o próprio uid', 'ALLOW', 'novo', 'create', 'sistema/admin', { uid: 'novo' });
caso('primeiro admin: NÃO cria sistema/admin com uid de outro', 'DENY', 'novo', 'create', 'sistema/admin', { uid: 'adm' });
caso('primeiro admin: NÃO troca o admin depois (update)', 'DENY', 'novo', 'update', 'sistema/admin', { uid: 'novo' }, { uid: 'adm' });
caso('primeiro admin: cria o próprio perfil de admin junto', 'ALLOW', 'novo', 'create', 'usuarios/novo', { perfil: 'admin', ativo: true, lava_id: null }, null,
  [{ function: 'getAfter', args: [{ exactValue: D + 'sistema/admin' }], result: { value: { data: { uid: 'novo' } } } }]);
caso('qualquer um: NÃO vira admin se o admin já é outro', 'DENY', 'x', 'create', 'usuarios/x', { perfil: 'admin', ativo: true }, null,
  [{ function: 'getAfter', args: [{ exactValue: D + 'sistema/admin' }], result: { value: { data: { uid: 'adm' } } } }]);
// funcionário
caso('funcionário: lê o próprio lava', 'ALLOW', 'func', 'get', 'lavas/L', null, lavas.L);
caso('funcionário: NÃO lê outro lava', 'DENY', 'func', 'get', 'lavas/L2', null, lavas.L2);
caso('funcionário: registra chegada de carro', 'ALLOW', 'func', 'create', 'lavas/L/atendimentos/a1', atend('L'));
caso('funcionário: avança a etapa', 'ALLOW', 'func', 'update', 'lavas/L/atendimentos/a1', { ...atend('L'), status: 'lavando' }, atend('L'));
caso('funcionário: cadastra cliente, veículo e horário', 'ALLOW', 'func', 'create', 'lavas/L/clientes/c1', { id: 'c1', lava_id: 'L', nome: 'A' });
caso('funcionário: marca horário na agenda', 'ALLOW', 'func', 'create', 'lavas/L/agendamentos/g1', { id: 'g1', lava_id: 'L', nome: 'A' });
caso('funcionário: NÃO grava com lava_id de outro', 'DENY', 'func', 'create', 'lavas/L/atendimentos/a1', atend('L2'));
caso('funcionário: NÃO grava em outro lava', 'DENY', 'func', 'create', 'lavas/L2/clientes/c9', { id: 'c9', lava_id: 'L2' });
caso('funcionário: NÃO vê despesas', 'DENY', 'func', 'get', 'lavas/L/despesas/d1', null, { lava_id: 'L', valor: 10 });
caso('funcionário: NÃO lança despesa', 'DENY', 'func', 'create', 'lavas/L/despesas/d1', { lava_id: 'L', valor: 10 });
caso('funcionário: NÃO muda preço', 'DENY', 'func', 'update', 'lavas/L/servicos/s1', { nome: 'X', precos: { p: 1 } }, { nome: 'Lavagem' });
caso('funcionário: NÃO muda a marca do lava', 'DENY', 'func', 'update', 'lavas/L', { ...lavas.L, nome: 'Hack' }, lavas.L);
caso('funcionário: NÃO cria acesso', 'DENY', 'func', 'create', 'usuarios/x', { perfil: 'funcionario', ativo: true, lava_id: 'L' });
caso('funcionário: NÃO se promove a dono', 'DENY', 'func', 'update', 'usuarios/func', { ...usuarios.func, perfil: 'dono' }, usuarios.func);
caso('funcionário: grava a página de acompanhamento', 'ALLOW', 'func', 'create', 'acompanhar/tok1', { lava_id: 'L', status: 'aguardando' });
caso('funcionário: NÃO sequestra acompanhamento de outro lava', 'DENY', 'func', 'update', 'acompanhar/tok2', { lava_id: 'L' }, { lava_id: 'L2' });
caso('funcionário: usa o contador da ficha do dia', 'ALLOW', 'func', 'update', 'lavas/L/contadores/2026-10-20', { n: 3 }, { n: 2 });
caso('funcionário: NÃO apaga atendimento', 'DENY', 'func', 'delete', 'lavas/L/atendimentos/a1', null, atend('L'));
caso('acesso bloqueado: NÃO lê nada', 'DENY', 'bloq', 'get', 'lavas/L/clientes/c1', null, { lava_id: 'L' });
caso('lava suspenso: NÃO registra carro', 'DENY', 'fsusp', 'create', 'lavas/S/atendimentos/a1', atend('S'));
caso('lava suspenso: ainda consulta', 'ALLOW', 'fsusp', 'get', 'lavas/S/clientes/c1', null, { lava_id: 'S' });
// dono
caso('dono: muda nome, logo e configurações', 'ALLOW', 'dono', 'update', 'lavas/L', { ...lavas.L, nome: 'Novo', marca: { cor: '#000000' } }, lavas.L);
caso('dono: NÃO mexe na própria assinatura', 'DENY', 'dono', 'update', 'lavas/L', { ...lavas.L, ativo: false, pago_ate: '2099-01-01' }, lavas.L);
caso('dono: muda a marca pública', 'ALLOW', 'dono', 'update', 'marcas/lava-l', { lava_id: 'L', nome: 'Novo', marca: {} }, { lava_id: 'L', nome: 'Velho', marca: {} });
caso('dono: NÃO muda a marca de outro lava', 'DENY', 'dono', 'update', 'marcas/lava-l2', { lava_id: 'L2', nome: 'Hack' }, { lava_id: 'L2', nome: 'B' });
caso('dono: muda preços', 'ALLOW', 'dono', 'update', 'lavas/L/servicos/s1', { nome: 'X', precos: { p: 50 } }, { nome: 'X', precos: { p: 40 } });
caso('dono: vê e lança despesas', 'ALLOW', 'dono', 'create', 'lavas/L/despesas/d1', { lava_id: 'L', valor: 300 });
caso('dono: cria acesso de funcionário no lava dele', 'ALLOW', 'dono', 'create', 'usuarios/x', { perfil: 'funcionario', ativo: true, lava_id: 'L' });
caso('dono: NÃO cria admin', 'DENY', 'dono', 'create', 'usuarios/x', { perfil: 'admin', ativo: true, lava_id: 'L' });
caso('dono: NÃO cria acesso em outro lava', 'DENY', 'dono', 'create', 'usuarios/x', { perfil: 'dono', ativo: true, lava_id: 'L2' });
caso('dono: bloqueia funcionário', 'ALLOW', 'dono', 'update', 'usuarios/func', { ...usuarios.func, ativo: false }, usuarios.func);
caso('dono: NÃO move funcionário para outro lava', 'DENY', 'dono', 'update', 'usuarios/func', { ...usuarios.func, lava_id: 'L2' }, usuarios.func);
caso('dono de outro lava: NÃO lê clientes daqui', 'DENY', 'outro', 'get', 'lavas/L/clientes/c1', null, { lava_id: 'L' });
caso('dono de outro lava: NÃO bloqueia funcionário daqui', 'DENY', 'outro', 'update', 'usuarios/func', { ...usuarios.func, ativo: false }, usuarios.func);
// admin
caso('admin: cria lava novo', 'ALLOW', 'adm', 'create', 'lavas/N', { id: 'N', ativo: true, nome: 'Novo' });
caso('admin: cria a marca do lava novo', 'ALLOW', 'adm', 'create', 'marcas/novo-lava', { slug: 'novo-lava', lava_id: 'N' });
caso('admin: muda a assinatura', 'ALLOW', 'adm', 'update', 'lavas/L', { ...lavas.L, ativo: false, pago_ate: '2026-11-10' }, lavas.L);
caso('admin: cria serviços de exemplo', 'ALLOW', 'adm', 'create', 'lavas/N/servicos/s1', { nome: 'Lavagem', lava_id: 'N' });
caso('admin: cria o acesso do dono', 'ALLOW', 'adm', 'create', 'usuarios/x', { perfil: 'dono', ativo: true, lava_id: 'L' });
caso('admin: NÃO cria acesso em lava que não existe', 'DENY', 'adm', 'create', 'usuarios/x', { perfil: 'dono', ativo: true, lava_id: 'NAOEXISTE' });
caso('admin: NÃO lê os clientes dos lavas', 'DENY', 'adm', 'get', 'lavas/L/clientes/c1', null, { lava_id: 'L' });

const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJETO}:test`, {
  method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'x-goog-user-project': PROJETO },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: regras }] }, testSuite: { testCases: casos.map((c) => c.t) } })
});
const j = await r.json();
if (!r.ok) { console.log(r.status, JSON.stringify(j).slice(0, 1500)); process.exit(1); }
if (j.issues && j.issues.length) console.log('Avisos das regras:', JSON.stringify(j.issues).slice(0, 800));
let falhas = 0;
(j.testResults || []).forEach((t, i) => {
  const ok = t.state === 'SUCCESS'; if (!ok) falhas++;
  console.log((ok ? 'ok    ' : 'FALHA ') + casos[i].nome + (ok ? '' : ' → ' + JSON.stringify(t.debugMessages || t.errorPosition || t.functionCalls || '').slice(0, 300)));
});
console.log(`\n${casos.length} casos, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
