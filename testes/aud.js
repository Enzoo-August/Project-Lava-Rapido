/* =========================================================
   Verificador de telas (só para teste; o app não carrega isto).
   Abra  ?demo=1 , cole no console:
     await import('./testes/aud.js'); await aud('funcionario', 'ZZZ9Z99'); await aud('dono', 'YYY8Y88')
   Ele passa por todas as telas e janelas e aponta:
   rolagem lateral, coisa fora da tela, alvo de toque pequeno e texto cortado.
   Rode em 360x640, 375x812, 768x1024, 1024x768 e 1366x768.
   ========================================================= */
window.aud = async (perfil, placa) => {
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  Store.pref('demo.perfil', perfil); Store.pref('visto.' + perfil, true);
  App.user = Demo.usuario(perfil);
  document.getElementById('app').dataset.perfil = perfil;
  U.zap = () => {};
  const cid = Store.s.clientes.find((c) => c.visitas > 12).id;
  const rotas = perfil === 'dono'
    ? ['inicio', 'agenda', 'balcao', 'patio', 'patio/pronto', 'patio/entregue', 'clientes', 'cliente/' + cid, 'resultados', 'financeiro', 'ajustes', 'ajustes/marca', 'ajustes/servicos',
      'ajustes/fidelidade', 'ajustes/mensagens', 'ajustes/equipe', 'ajustes/opcoes', 'ajustes/conta', 'ajuda', 'mais', 'entrada']
    : ['balcao', 'agenda', 'patio', 'patio/pronto', 'patio/entregue', 'clientes', 'cliente/' + cid, 'ajuda', 'entrada'];
  const prob = [];

  const medir = (nome) => {
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    if (document.documentElement.scrollWidth > W + 1) prob.push(`${nome}: rolagem lateral (${document.documentElement.scrollWidth} > ${W})`);
    const modal = document.querySelector('.modal');
    if (modal) { const r = modal.getBoundingClientRect(); if (r.top < -1 || r.bottom > H + 1) prob.push(`${nome}: janela maior que a tela`); }
    for (const el of document.querySelectorAll('#app button, #app a, #app input, #app select, #app textarea, #app .placa, #app b, #app h1, #app h2, #app h3, .modal button, .modal a, .modal input')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('.chips.rolar, .tabela-rolar') && !el.closest('.modal')) continue;
      if (getComputedStyle(el).visibility === 'hidden' || el.type === 'file' || el.type === 'color') continue;
      const quem = `${el.tagName}.${String(el.className).split(' ')[0]} "${(el.innerText || el.value || '').slice(0, 18).replace(/\n/g, ' ')}"`;
      if (r.right > W + 1 || r.left < -1) prob.push(`${nome}: fora da tela ${quem}`);
      if (/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) && (r.height < 32 || r.width < 28) && el.type !== 'checkbox') prob.push(`${nome}: alvo pequeno ${Math.round(r.width)}x${Math.round(r.height)} ${quem}`);
      if (el.scrollWidth > el.clientWidth + 2 && /^(BUTTON|A)$/.test(el.tagName) && getComputedStyle(el).overflow !== 'visible') prob.push(`${nome}: texto cortado ${quem}`);
    }
  };
  const clic = async (sel) => { const e = document.querySelector(sel); if (e) { e.click(); await esp(150); } return !!e; };

  for (const rota of rotas) { location.hash = '#/' + rota; await esp(/resultados|financeiro|cliente\//.test(rota) ? 700 : 300); medir(rota); }

  // chegada de um carro novo, passo a passo
  for (const ch of placa) document.querySelector(`.tecla[data-t="${ch}"]`).click();
  await esp(100); medir('entrada/placa cheia');
  await clic('[data-acao=novo]');
  const i = document.querySelector('#eModelo'); i.value = 'hilux'; i.dispatchEvent(new Event('input')); await esp(100); medir('entrada/modelo');
  await clic('[data-modelo]'); medir('entrada/cor');
  await clic('[data-cor="Preto"]');
  const f = document.querySelector('#eForm');
  f.nome.value = 'Teste Auditoria Nome Bem Comprido da Silva'; f.nome.dispatchEvent(new Event('input'));
  f.telefone.value = '119' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); f.telefone.dispatchEvent(new Event('input'));
  medir('entrada/cliente');
  f.requestSubmit(); await esp(150); medir('entrada/servico');
  if (await clic('[data-acao=porte]')) { medir('entrada/janela tamanho'); await clic('.modal [data-fechar]'); }
  if (await clic('[data-acao=valor]')) { medir('entrada/janela valor'); await clic('.modal [data-fechar]'); }
  await clic('[data-acao=confirmar]'); medir('entrada/feito');

  // agenda: marcar horário e ver um horário
  location.hash = '#/agenda'; await esp(300);
  if (await clic('#gNovo')) { medir('agenda/janela marcar'); await clic('.modal [data-fechar]'); await esp(200); }
  if (await clic('.agend [data-acao=ver]')) { medir('agenda/janela horário'); await clic('.modal [data-fechar]'); await esp(200); }

  // janelas do pátio
  location.hash = '#/patio'; await esp(300);
  if (await clic('[data-acao=detalhe]')) { medir('patio/janela ficha'); await clic('.modal [data-fechar]'); await esp(200); }
  if (await clic('[data-acao=lavar]')) { medir('patio/janela quem lava'); await clic('.modal [data-fechar]'); await esp(200); }
  location.hash = '#/patio/pronto'; await esp(300);
  if (await clic('[data-acao=entregar]')) { medir('patio/janela entregar'); await clic('.modal [data-fechar]'); await esp(200); }

  const unicos = [...new Set(prob)];
  return `${innerWidth}x${innerHeight} ${perfil}: ${unicos.length ? unicos.length + ' problemas\n' + unicos.slice(0, 30).join('\n') : 'sem problemas'}`;
};
