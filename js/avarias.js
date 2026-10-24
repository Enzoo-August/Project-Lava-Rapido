/* =========================================================
   Avarias — foto de risco, amassado ou trinca, presa à placa.
   - Na chegada: tirar a foto e escrever onde é.
   - Na volta do carro: "Ainda está lá?" → continua / resolvida.
   - Fica na ficha do pátio e no cadastro do cliente, como prova
     caso o cliente reclame depois. Dá para mandar as fotos a ele.
   A foto é reduzida (~100 KB) e guardada no próprio banco.
   ========================================================= */
(function () {
  const Av = {};
  window.Avaria = Av;
  const TIPOS = ['Risco', 'Amassado', 'Arranhão', 'Trincado'];
  // parte do carro com o artigo certo ("na porta", "no capô")
  const PARTES = { 'Para-choque': 'no para-choque', Porta: 'na porta', 'Capô': 'no capô', Lateral: 'na lateral', Teto: 'no teto', Roda: 'na roda', Retrovisor: 'no retrovisor', Farol: 'no farol', 'Para-brisa': 'no para-brisa' };
  const LOCAIS = [...TIPOS, ...Object.keys(PARTES)];

  // abre a câmera (ou a galeria) e devolve a foto já reduzida
  const escolherFoto = () => new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.style.display = 'none';
    i.onchange = async () => { const f = i.files && i.files[0]; i.remove(); if (!f) return res(null); try { res(await U.fotoPequena(f)); } catch (e) { U.toast(e.message || 'Não consegui abrir a foto.', 'bad'); res(null); } };
    document.body.appendChild(i); i.click();
  });
  Av.escolherFoto = escolherFoto;

  // foto + onde é a avaria → { foto, descricao }
  Av.nova = async (fotoPronta) => {
    const foto = fotoPronta || await Av.escolherFoto(); if (!foto) return null;   // Av.escolherFoto: os testes trocam pela foto de exemplo
    return U.modal({
      titulo: 'Foto da avaria',
      html: `<img class="av-grande" src="${foto}" alt="Foto da avaria">
        <label class="campo"><span>O que é e onde fica</span><input name="descricao" placeholder="Ex.: risco na porta traseira direita" autocapitalize="sentences" maxlength="120"></label>
        <div class="chips" id="avLocais">${LOCAIS.map((l) => `<button type="button" class="chip" data-l="${l}">${l}</button>`).join('')}</div>`,
      aoAbrir: (el) => {
        const d = el.querySelector('[name=descricao]');
        el.querySelector('#avLocais').onclick = (e) => {
          const b = e.target.closest('[data-l]'); if (!b) return;
          const l = b.dataset.l, parte = PARTES[l], pedaco = parte || l.toLowerCase(), atual = d.value.trim();
          if (atual.toLowerCase().includes(parte ? parte.slice(3) : l.toLowerCase())) return d.focus();
          d.value = !atual ? (parte ? parte.charAt(3).toUpperCase() + parte.slice(4) : l) : atual + (parte ? ' ' + pedaco : ' e ' + pedaco);
          d.focus();
        };
      },
      acoes: [{ txt: 'Tirar outra', valor: 'outra' }, { txt: 'Salvar foto', cls: 'btn-marca', aoTocar: (el) => ({ foto, descricao: el.querySelector('[name=descricao]').value.trim() }) }]
    }).then((r) => (r === 'outra' ? Av.nova() : r || null));
  };

  // ver a foto grande
  Av.ver = (av) => U.modal({
    titulo: av.descricao || 'Avaria',
    html: `<img class="av-grande" src="${av.foto}" alt="${U.esc(av.descricao || 'Avaria')}">
      <p class="mudo pequeno">Registrada em ${U.dataHora(av.criada_em)}${av.criada_por ? ' por ' + U.esc(av.criada_por) : ''}.${av.confirmada_em ? ` Conferida em ${U.dataBR(av.confirmada_em)}: continua.` : ''}${av.status === 'resolvida' ? ` Resolvida em ${U.dataBR(av.resolvida_em)}.` : ''}</p>`,
    acoes: [{ txt: 'Fechar', valor: true }]
  });

  // miniaturas (data-av-ver abre grande)
  Av.miniHtml = (av, extra) => `<div class="av-mini${av.status === 'resolvida' ? ' resolvida' : ''}" data-av="${av.id}">
      <button type="button" class="av-foto" data-av-ver="${av.id}" aria-label="Ver foto"><img src="${av.foto}" alt="" loading="lazy">${av.status === 'resolvida' ? '<i>resolvida</i>' : ''}</button>
      <span><b>${U.esc(av.descricao || 'Avaria')}</b><small>${U.dataBR(av.criada_em)}${av.confirmada_em ? ' · conferida ' + U.dataBR(av.confirmada_em) : ''}</small>${extra || ''}</span>
    </div>`;
  Av.ligarVer = (el, lista) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-av-ver]'); if (!b) return; const av = lista().find((x) => x.id === b.dataset.avVer); if (av) Av.ver(av); });

  // mandar as fotos para o cliente (celular: compartilhar; computador: baixa e abre o WhatsApp)
  Av.enviar = async (lista, cliente, placa) => {
    const texto = `Olá${cliente ? ', ' + U.primeiroNome(cliente.nome) : ''}! Registramos ${lista.length === 1 ? 'esta avaria' : 'estas avarias'} no seu carro (${U.placaFmt(placa)}) na chegada: ${lista.map((a) => a.descricao || 'avaria').join('; ')}. Qualquer dúvida, é só falar.\n${DB.lava().nome}`;
    const fs = lista.map((a, i) => U.arquivoDeFoto(a.foto, `avaria-${U.placaFmt(placa)}-${i + 1}.jpg`));
    if (navigator.canShare && navigator.canShare({ files: fs }) && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ files: fs, text: texto }); } catch (e) {} return; }
    fs.forEach((f) => { const u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); });
    if (cliente && U.telOk(cliente.telefone)) U.zap(cliente.telefone, texto);
    U.toast('Fotos baixadas: arraste para a conversa do WhatsApp.');
  };

  // todas as avarias de um carro (cadastro do cliente / ficha do pátio)
  Av.galeria = async (placa, o) => {
    o = o || {};
    const bloq = DB.bloqueado();
    U.toast('Carregando fotos…');
    let lista = await DB.carregarAvarias(placa);
    await U.modal({
      titulo: `Avarias · ${U.placaFmt(placa)}`, largo: true,
      html: `<div id="avGal"></div>`,
      aoAbrir: (el) => {
        const pintar = () => {
          lista = DB.avariasDe(placa);
          const ativas = lista.filter((a) => a.status !== 'resolvida'), res = lista.filter((a) => a.status === 'resolvida');
          el.querySelector('#avGal').innerHTML = `${lista.length ? '' : '<p class="mudo">Nenhuma avaria registrada neste carro.</p>'}
            ${ativas.length ? `<h3 class="sub-tit">Ainda no carro (${ativas.length})</h3><div class="av-lista">${ativas.map((a) => Av.miniHtml(a, bloq ? '' : `<button type="button" class="link" data-av-res="${a.id}">Marcar como resolvida</button>`)).join('')}</div>` : ''}
            ${res.length ? `<h3 class="sub-tit">Resolvidas (${res.length})</h3><div class="av-lista">${res.map((a) => Av.miniHtml(a, bloq ? '' : `<button type="button" class="link" data-av-vol="${a.id}">Voltou a aparecer</button>`)).join('')}</div>` : ''}
            ${bloq ? '' : `<button type="button" class="btn btn-bloco" id="avNova">${U.icon('camera')}<span>Tirar foto de outra avaria</span></button>`}
            ${ativas.length && o.cliente ? `<button type="button" class="btn btn-zap btn-bloco" id="avEnviar">${U.icon('zap')}<span>Mandar as fotos para o cliente</span></button>` : ''}`;
        };
        pintar();
        Av.ligarVer(el, () => lista);
        el.addEventListener('click', async (e) => {
          const r = e.target.closest('[data-av-res]'), v = e.target.closest('[data-av-vol]');
          if (r) { DB.salvarAvaria(Store.por('avarias', r.dataset.avRes), { status: 'resolvida', resolvida_em: new Date().toISOString() }); U.toast('Avaria marcada como resolvida'); pintar(); }
          if (v) { DB.salvarAvaria(Store.por('avarias', v.dataset.avVol), { status: 'ativa', resolvida_em: null, confirmada_em: new Date().toISOString() }); pintar(); }
          if (e.target.closest('#avNova')) { const n = await Av.nova(); if (n) { DB.salvarAvaria(null, { placa, cliente_id: o.cliente ? o.cliente.id : null, atendimento_id: o.atendimento ? o.atendimento.id : null, ...n }); U.toast('Foto da avaria salva'); pintar(); } }
          if (e.target.closest('#avEnviar')) Av.enviar(DB.avariasAtivas(placa), o.cliente, placa);
        });
      },
      acoes: [{ txt: 'Fechar', valor: true }]
    });
    if (o.aoFechar) o.aoFechar();
  };

  // foto de exemplo (demonstração): desenha um carro com a marca do risco
  Av.fotoExemplo = (texto) => {
    try {
      const c = document.createElement('canvas'); c.width = 640; c.height = 420; const g = c.getContext('2d');
      const fundo = g.createLinearGradient(0, 0, 0, 420); fundo.addColorStop(0, '#cfd6de'); fundo.addColorStop(1, '#8e99a5'); g.fillStyle = fundo; g.fillRect(0, 0, 640, 420);
      g.fillStyle = '#e9edf1'; g.beginPath(); g.moveTo(60, 300); g.lineTo(110, 200); g.lineTo(230, 150); g.lineTo(430, 150); g.lineTo(540, 210); g.lineTo(590, 300); g.closePath(); g.fill();
      g.fillStyle = '#2b333c'; [[170, 310], [470, 310]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 48, 0, 7); g.fill(); });
      g.strokeStyle = '#c62828'; g.lineWidth = 6; g.beginPath(); g.ellipse(330, 245, 70, 38, 0, 0, 7); g.stroke();
      g.strokeStyle = '#6b737c'; g.lineWidth = 3; g.beginPath(); g.moveTo(290, 238); g.lineTo(372, 252); g.stroke();
      g.fillStyle = '#10151c'; g.font = 'bold 26px sans-serif'; g.fillText(texto || 'Risco na porta', 24, 44);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) { return ''; }
  };
})();
