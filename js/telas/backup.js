/* =========================================================
   Backup dos dados — uma cópia extra que fica com o dono.
   - Dois arquivos: o backup completo (.json, serve para restaurar)
     e a planilha de clientes (.csv, abre no Excel).
   - No computador (Chrome/Edge): na primeira vez a pessoa escolhe
     (ou cria) a pasta "Backups Lava Rápido"; depois grava direto nela.
   - No celular: abre o "compartilhar" (Arquivos, Drive, WhatsApp…).
   - Toda segunda-feira o sininho lembra de fazer (avisos.js).
   ========================================================= */
(function () {
  const B = {};
  window.Backup = B;
  const PASTA = 'Backups Lava Rápido';

  // ---------------- data do último backup (vale para todos os aparelhos do lava) ----------------
  B.ultimo = () => (DB.lava().config || {}).ultimo_backup || Store.pref('backup.ultimo.' + (DB.lava().id || 'demo')) || null;
  const segundaDestaSemana = () => { const d = U.inicioDia(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  B.atrasado = () => { const u = B.ultimo(); return !u || new Date(u) < segundaDestaSemana(); };
  B.semana = () => U.dia(segundaDestaSemana());

  // ---------------- a pasta escolhida fica guardada no navegador (IndexedDB) ----------------
  const idb = (modo, fn) => new Promise((res, rej) => {
    const r = indexedDB.open('lava-rapido', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('coisas');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { try { const t = r.result.transaction('coisas', modo), q = fn(t.objectStore('coisas')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch (e) { rej(e); } };
  });
  const chavePasta = () => 'pasta-backup.' + (DB.lava().id || 'demo');
  const lerPasta = () => idb('readonly', (s) => s.get(chavePasta())).catch(() => null);
  const guardarPasta = (h) => idb('readwrite', (s) => s.put(h, chavePasta())).catch(() => {});
  B.podePasta = () => typeof window.showDirectoryPicker === 'function' && !matchMedia('(pointer: coarse)').matches;
  B.temPasta = async () => !!(B.podePasta() && await lerPasta());

  // ---------------- montar os arquivos ----------------
  const coletar = async () => {
    if (Store.modo === 'nuvem') return Nuvem.backup();
    const s = Store.s; return { lava: s.lava, servicos: s.servicos, clientes: s.clientes, veiculos: s.veiculos, atendimentos: s.atendimentos, agendamentos: s.agendamentos, despesas: s.despesas, produtos: s.produtos, pedidos: s.pedidos, avarias: s.avarias, equipe: s.equipe.map((u) => ({ nome: u.nome, login: u.login, perfil: u.perfil, ativo: u.ativo })) };
  };
  const nomeLimpo = (t) => String(t || 'Lava').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const arquivos = (d) => {
    const lava = nomeLimpo(DB.lava().nome), dia = U.dia();
    const json = JSON.stringify({ sistema: 'Lava Rápido', versao_backup: 1, gerado_em: new Date().toISOString(), gerado_por: App.user.nome, ...d }, null, 1);
    // planilha de clientes: abre no Excel (separador ; e acentos certos)
    const veic = new Map(); for (const v of d.veiculos || []) { if (!veic.has(v.cliente_id)) veic.set(v.cliente_id, []); veic.get(v.cliente_id).push(v); }
    const cel = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const linhas = [['Nome', 'WhatsApp', 'Carros', 'Placas', 'Visitas', 'Última visita', 'Total gasto', 'Cliente desde', 'Ativo'].map(cel).join(';')];
    for (const c of (d.clientes || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))) {
      const vs = veic.get(c.id) || [];
      linhas.push([c.nome, U.telFmt(c.telefone), vs.map((v) => DB.nomeVeiculo(v)).join(', '), vs.map((v) => (U.semPlaca(v.placa) ? '' : U.placaFmt(v.placa))).filter(Boolean).join(', '),
        c.visitas || 0, c.ultima_visita ? U.dataBR(c.ultima_visita) : '', String(Number(c.gasto) || 0).replace('.', ','), c.criado_em ? U.dataBR(c.criado_em) : '', c.ativo === false ? 'não' : 'sim'].map(cel).join(';'));
    }
    return [new File([json], `Backup ${lava} ${dia}.json`, { type: 'application/json' }), new File(['﻿' + linhas.join('\r\n')], `Clientes ${lava} ${dia}.csv`, { type: 'text/csv' })];
  };
  const baixar = (f) => { const url = URL.createObjectURL(f), a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000); };
  const marcarFeito = () => { const agora = new Date().toISOString(); Store.pref('backup.ultimo.' + (DB.lava().id || 'demo'), agora); if (DB.ehDono()) DB.salvarConfig({ ultimo_backup: agora }); };

  // ---------------- fazer o backup ----------------
  // trocar = escolher outra pasta
  B.fazer = async (trocar) => {
    try {
      if (B.podePasta()) {
        let pasta = trocar ? null : await lerPasta();
        if (pasta && (await pasta.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await pasta.requestPermission({ mode: 'readwrite' })) !== 'granted') pasta = null;
        if (!pasta) {
          try { pasta = await window.showDirectoryPicker({ id: 'lava-backup', mode: 'readwrite', startIn: 'documents' }); }
          catch (e) { if (e && e.name === 'AbortError') return false; throw e; }
          await guardarPasta(pasta);
        }
        U.toast('Preparando o backup…');
        const fs = arquivos(await coletar());
        for (const f of fs) { const h = await pasta.getFileHandle(f.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
        marcarFeito();
        await U.modal({ titulo: 'Backup feito!', html: `<p class="aviso-caixa bom">${U.icon('check')}<span>Os dois arquivos foram salvos na pasta <b>${U.esc(pasta.name)}</b>:<br>${fs.map((f) => U.esc(f.name)).join('<br>')}</span></p><p class="mudo pequeno">Na próxima semana o sininho lembra de novo. Os próximos backups vão direto para essa pasta.</p>`, acoes: [{ txt: 'Ótimo', cls: 'btn-marca', valor: true }] });
        return true;
      }
      // celular e navegadores sem escolha de pasta
      U.toast('Preparando o backup…');
      const fs = arquivos(await coletar());
      if (navigator.canShare && navigator.canShare({ files: fs }) && matchMedia('(pointer: coarse)').matches) {
        const ok = await U.modal({ titulo: 'Backup pronto', html: `<p class="txt">Toque em <b>Salvar</b> e escolha <b>Salvar em Arquivos</b> (iPhone) ou <b>Drive</b> / <b>Arquivos</b> (Android). Se puder, guarde numa pasta chamada <b>${PASTA}</b>.</p>`, acoes: [{ txt: 'Voltar', valor: false }, { txt: 'Salvar', cls: 'btn-marca', aoTocar: async () => { try { await navigator.share({ files: fs, title: 'Backup do lava' }); return true; } catch (e) { return e && e.name === 'AbortError' ? false : (fs.forEach(baixar), true); } } }] });
        if (ok) marcarFeito();
        return !!ok;
      }
      fs.forEach(baixar);
      marcarFeito();
      U.toast('Backup baixado (pasta Downloads)');
      return true;
    } catch (e) {
      U.toast('Não consegui fazer o backup: ' + (Nuvem.erroTxt ? Nuvem.erroTxt(e) : e.message || e), 'bad');
      return false;
    }
  };

  // ---------------- tela ----------------
  const passo = (n, t, x) => `<div class="ajuda-passo"><i>${n}</i><div><b>${t}</b><p>${x}</p></div></div>`;
  Telas.backup = {
    titulo: 'Backup dos dados', perfis: ['dono'], parado: true,
    render: async (el) => {
      const u = B.ultimo(), atras = B.atrasado(), pc = B.podePasta(), temPasta = await B.temPasta();
      el.innerHTML = `
        <section class="cartao">
          <p class="aviso-caixa ${atras ? 'toque' : 'bom'}">${U.icon(atras ? 'alerta' : 'check')}<span>${u ? `Último backup: <b>${U.dataBR(u)}</b> (${U.diasDesde(u) === 0 ? 'hoje' : U.diasDesde(u) === 1 ? 'ontem' : `há ${U.diasDesde(u)} dias`}).` : '<b>Nenhum backup feito ainda.</b>'}${atras ? ' Está na hora de fazer o desta semana.' : ' O desta semana já está feito.'}</span></p>
          <button type="button" class="btn btn-marca btn-g btn-bloco" id="bkFazer">${U.icon('nuvem')}<span>Fazer backup agora</span></button>
          ${temPasta ? '<button type="button" class="link centro" id="bkTrocar">Salvar em outra pasta</button>' : ''}
        </section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('ajuda')} Por que fazer backup?</h3></div>
          <p class="mudo">Seus dados já ficam guardados na nuvem do Google, com cópias em mais de um lugar. O backup é uma <b>cópia extra que fica com você</b>, no seu computador: se alguém apagar alguma coisa por engano, se um dia trocar de sistema ou só para guardar o histórico, você tem tudo dos seus clientes, carros e atendimentos. Leva menos de um minuto.</p>
          <p class="mudo">Toda <b>segunda-feira</b> o sininho lembra. Basta tocar no aviso e depois em <b>Fazer backup agora</b>.</p></section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('lista')} Como fazer</h3></div>
          ${pc ? passo(1, 'Toque em “Fazer backup agora”', 'Abre a janela para escolher onde salvar.')
            + passo(2, `Na primeira vez, crie a pasta “${PASTA}”`, `Vá em <b>Documentos</b>, clique em <b>Nova pasta</b>, dê o nome <b>${PASTA}</b>, entre nela e clique em <b>Selecionar pasta</b>. Se o navegador perguntar, clique em <b>Ver arquivos</b> / <b>Permitir</b>.`)
            + passo(3, 'Pronto', 'Os arquivos são salvos nessa pasta. Nas próximas semanas vão direto para ela (no máximo o navegador pergunta se pode salvar).')
            : passo(1, 'Toque em “Fazer backup agora”', 'Espere alguns segundos enquanto os dados são juntados.')
            + passo(2, 'Toque em “Salvar”', `Escolha <b>Salvar em Arquivos</b> (iPhone) ou <b>Drive</b> / <b>Arquivos</b> (Android). Se puder, crie e use a pasta <b>${PASTA}</b>.`)
            + passo(3, 'Melhor ainda: faça no computador', 'No computador, os backups ficam todos juntos na mesma pasta, com um clique.')}
        </section>
        <section class="cartao"><div class="cartao-cab"><h3>${U.icon('caixa')} O que vai no backup</h3></div>
          <div class="par"><span><b>Backup ${U.esc(nomeLimpo(DB.lava().nome))} (data).json</b><br><small class="mudo">Tudo: clientes, carros, atendimentos, agenda, despesas, produtos, pedidos, serviços e preços. É o arquivo que serve para restaurar.</small></span></div>
          <div class="par"><span><b>Clientes ${U.esc(nomeLimpo(DB.lava().nome))} (data).csv</b><br><small class="mudo">Abre no Excel: nome, WhatsApp, carros, placas, visitas, última visita e total gasto de cada cliente.</small></span></div>
          <p class="mudo pequeno">Guarde os arquivos com cuidado: têm nome e telefone dos seus clientes. Para restaurar um backup, fale com o suporte.</p></section>`;
      el.querySelector('#bkFazer').onclick = async (e) => { e.currentTarget.disabled = true; await B.fazer(false); App.render(); };
      const tr = el.querySelector('#bkTrocar'); if (tr) tr.onclick = async () => { await B.fazer(true); App.render(); };
    }
  };
})();
