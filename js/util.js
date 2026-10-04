/* =========================================================
   Utilidades: texto, datas, dinheiro, placa, telefone,
   ícones, janelas (modal) e avisos rápidos (toast).
   ========================================================= */
(function () {
  const U = {};
  window.U = U;

  U.$ = (sel, el) => (el || document).querySelector(sel);
  U.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  U.primeiroNome = (s) => String(s || '').trim().split(/\s+/)[0] || '';
  U.capitalizar = (s) => String(s || '').trim().replace(/\s+/g, ' ').split(' ')
    .map((p) => (/^(da|de|do|das|dos|e)$/i.test(p) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join(' ');

  U.uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const x = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
  };
  U.token = () => U.uuid().replace(/-/g, '').slice(0, 20);

  // ---------------- dinheiro ----------------
  U.brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  U.brl0 = (n) => 'R$ ' + Math.round(Number(n) || 0).toLocaleString('pt-BR');
  U.num = (s) => { if (typeof s === 'number') return s; const v = parseFloat(String(s || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
  U.pct = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('pt-BR') + '%';

  // ---------------- datas ----------------
  const p2 = (n) => String(n).padStart(2, '0');
  U.dia = (d) => { d = d ? new Date(d) : new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };   // chave AAAA-MM-DD no horário do aparelho
  U.deDia = (chave) => { const [a, m, d] = String(chave).split('-').map(Number); return new Date(a, m - 1, d); };
  U.inicioDia = (d) => { d = d ? new Date(d) : new Date(); d.setHours(0, 0, 0, 0); return d; };
  U.somaDias = (d, n) => { d = new Date(d); d.setDate(d.getDate() + n); return d; };
  U.hora = (d) => { if (!d) return ''; d = new Date(d); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  U.dataCurta = (d) => { if (!d) return ''; d = new Date(d); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };
  U.dataBR = (d) => { if (!d) return ''; d = typeof d === 'string' && d.length === 10 ? U.deDia(d) : new Date(d); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
  U.SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  U.SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  U.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  U.dataHora = (d) => { if (!d) return ''; return U.dia(d) === U.dia() ? 'hoje ' + U.hora(d) : U.dataCurta(d) + ' ' + U.hora(d); };
  U.duracao = (min) => { min = Math.max(0, Math.round(min)); if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${p2(m)}` : `${h}h`; };
  U.haQuanto = (d) => {
    if (!d) return '';
    const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    if (min < 60 * 24) return `há ${U.duracao(min)}`;
    const dias = Math.floor(min / 1440);
    return dias === 1 ? 'ontem' : dias < 60 ? `há ${dias} dias` : `há ${Math.floor(dias / 30)} meses`;
  };
  U.diasDesde = (d) => (d ? Math.floor((U.inicioDia().getTime() - U.inicioDia(d).getTime()) / 86400000) : null);

  // ---------------- placa ----------------
  // Mercosul: ABC1D23 · antiga: ABC1234 (guardamos sem traço, em maiúsculas)
  U.placaLimpa = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  U.placaOk = (p) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p || '');
  U.semPlaca = (p) => /^SEM-/.test(p || '');
  U.placaFmt = (p) => { if (!p) return ''; if (U.semPlaca(p)) return 'SEM PLACA'; return /^[A-Z]{3}\d{4}$/.test(p) ? p.slice(0, 3) + '-' + p.slice(3) : p; };
  // o que pode ser digitado em cada posição: L = letra, N = número, A = os dois
  U.placaPos = (i) => (i < 3 ? 'L' : i === 3 ? 'N' : i === 4 ? 'A' : 'N');
  U.placaHtml = (p, cls) => `<span class="placa ${cls || ''}${U.semPlaca(p) ? ' sem' : ''}">${U.esc(U.placaFmt(p))}</span>`;

  // ---------------- telefone ----------------
  U.telDig = (s) => { let d = String(s || '').replace(/\D/g, ''); if (d.length > 11 && d.startsWith('55')) d = d.slice(2); return d.slice(0, 11); };
  U.telFmt = (s) => {
    const d = U.telDig(s);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  U.telOk = (s) => { const d = U.telDig(s); return d.length === 10 || d.length === 11; };
  U.zapLink = (tel, texto) => `https://wa.me/55${U.telDig(tel)}?text=${encodeURIComponent(texto || '')}`;
  // abre o WhatsApp já com a mensagem escrita (a pessoa só toca em enviar)
  U.zap = (tel, texto) => { const a = document.createElement('a'); a.href = U.zapLink(tel, texto); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };

  // ---------------- cores ----------------
  U.hexRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.luminancia = (hex) => { const c = U.hexRgb(hex); if (!c) return 0; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  U.textoSobre = (hex) => (U.luminancia(hex) > 0.45 ? '#10151c' : '#ffffff');
  U.misturar = (hex, alvo, q) => { const a = U.hexRgb(hex), b = U.hexRgb(alvo); if (!a || !b) return hex; return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * q).toString(16).padStart(2, '0')).join(''); };

  // ---------------- ícones (traço, 24px) ----------------
  const IC = {
    carro: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.900 1.900 6.500 5.500"/><path d="M16 4.800a3.500 3.500 0 010 6.400M18.500 14.800c1.700.700 2.700 2.400 3 5.200"/>',
    grafico: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 00.300 1.900l.100.100a2 2 0 11-2.800 2.800l-.100-.100a1.700 1.700 0 00-2.900 1.200V21a2 2 0 11-4 0v-.100a1.700 1.700 0 00-2.900-1.200l-.100.100a2 2 0 11-2.800-2.800l.100-.100A1.700 1.700 0 003.100 14H3a2 2 0 110-4h.100a1.700 1.700 0 001.200-2.900l-.100-.100a2 2 0 112.800-2.800l.100.100a1.700 1.700 0 002.900-1.200V3a2 2 0 114 0v.100a1.700 1.700 0 002.900 1.200l.100-.100a2 2 0 112.800 2.800l-.100.100a1.700 1.700 0 001.200 2.900H21a2 2 0 110 4h-.100a1.700 1.700 0 00-1.500 1z"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    zap: '<path d="M4 20l1.300-4.200A8 8 0 1112 20a8 8 0 01-3.900-1L4 20z"/><path d="M9 9.500c0 3 2.500 5.500 5.500 5.500l1-1.500-2-1-.800.800a3.500 3.500 0 01-2-2l.800-.800-1-2L9 9.500z"/>',
    dinheiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/><path d="M6.500 9.500v5M17.500 9.500v5"/>',
    estrela: '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900L3.500 9.700l5.900-.800L12 3.500z"/>',
    presente: '<rect x="4" y="10" width="16" height="10" rx="1.500"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.500-3.500-5.500-3-5 0M12 7c1.500-3.500 5.500-3 5 0"/>',
    alerta: '<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4.500M12 17.500v.100"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sair: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 114 2c-.900.600-1.500 1.200-1.500 2.300M12 17v.100"/>',
    fone: '<path d="M6 3h3.500l1.500 4.500-2 1.500a11 11 0 006 6l1.500-2 4.500 1.500V18a3 3 0 01-3 3A16 16 0 013 6a3 3 0 013-3z"/>',
    editar: '<path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="M13.500 6.500l4 4"/>',
    gota: '<path d="M12 3.500c3.500 4.200 6 7.300 6 10.500a6 6 0 01-12 0c0-3.200 2.500-6.300 6-10.500z"/>',
    casa: '<path d="M4 11l8-7 8 7v9h-5.500v-6h-5v6H4v-9z"/>',
    carteira: '<path d="M4 7a2 2 0 012-2h11v3"/><rect x="4" y="8" width="17" height="11" rx="2"/><path d="M17 13.500h.100"/>',
    atualizar: '<path d="M20 12a8 8 0 01-14.300 4.900M4 12a8 8 0 0114.300-4.900"/><path d="M18 3v4.500h-4.500M6 21v-4.500h4.500"/>',
    nuvem: '<path d="M7 18a4.500 4.500 0 01-.500-9A6 6 0 0118 10.500a3.800 3.800 0 01-.500 7.500H7z"/>',
    lista: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.100M4 12h.100M4 18h.100"/>',
    chave: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2.500 2.500M14 8l1.500 1.500"/>',
    olho: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>',
    camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4V8z"/><circle cx="12" cy="13.500" r="3.200"/>',
    celular: '<rect x="7" y="2.500" width="10" height="19" rx="2.200"/><path d="M11 18.500h2"/>',
    loja: '<path d="M4 9.500l1.500-5h13l1.500 5M4 9.500V20h16V9.500M4 9.500a2.700 2.700 0 005.300 0 2.700 2.700 0 005.400 0 2.700 2.700 0 005.300 0M9.500 20v-5.500h5V20"/>',
    apagar: '<path d="M4 7h16M9 7V4h6v3M6.500 7l1 13h9l1-13"/>',
    calendario: '<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4M8 14h2.500M13.500 14H16M8 17.500h2.500"/>',
    lua: '<path d="M20 14.500A8 8 0 019.500 4a7 7 0 1010.500 10.500z"/>',
    bandeira: '<path d="M5 21V4M5 4.500h12l-2.500 4 2.500 4H5"/>'
  };
  U.icon = (nome, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.900" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[nome] || ''}</svg>`;

  // ---------------- aviso rápido ----------------
  U.toast = (msg, tipo) => {
    const root = document.getElementById('toastRoot'); if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.innerHTML = `${U.icon(tipo === 'bad' ? 'alerta' : 'check')}<span>${U.esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('some'); setTimeout(() => el.remove(), 300); }, tipo === 'bad' ? 5200 : 2800);
  };

  // ---------------- janela (modal) ----------------
  // U.modal({ titulo, html, acoes: [{ txt, cls, valor, fechar }], aoAbrir(el, fechar), largo })  →  Promise(valor)
  // Cada botão só responde uma vez (trava contra toque duplo).
  U.modal = (o) => new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    const acoes = (o.acoes || []).map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-i="${i}">${a.icone ? U.icon(a.icone) : ''}<span>${U.esc(a.txt)}</span></button>`).join('');
    fundo.innerHTML = `<div class="modal ${o.largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-topo"><h2>${U.esc(o.titulo || '')}</h2><button type="button" class="ic-btn" data-fechar aria-label="Fechar">${U.icon('x')}</button></div>
      <div class="modal-corpo">${o.html || ''}</div>
      ${acoes ? `<div class="modal-acoes ${o.empilhar ? 'empilha' : ''}">${acoes}</div>` : ''}
    </div>`;
    let fechado = false;
    const fechar = (valor) => { if (fechado) return; fechado = true; fundo.remove(); document.body.classList.toggle('com-modal', !!root.children.length); resolve(valor); };
    fundo.addEventListener('click', async (e) => {
      if (e.target === fundo && !o.fixo) return fechar(undefined);
      if (e.target.closest('[data-fechar]')) return fechar(undefined);
      const b = e.target.closest('.modal-acoes [data-i]'); if (!b || b.disabled) return;
      const a = o.acoes[Number(b.dataset.i)];
      if (a.aoTocar) {
        b.disabled = true;
        let r; try { r = await a.aoTocar(fundo, fechar); } catch (err) { U.toast(err.message || String(err), 'bad'); }
        if (r === false || r === undefined) { b.disabled = false; return; }   // false = continua aberta
        return fechar(r);
      }
      fechar(a.valor);
    });
    root.appendChild(fundo);
    document.body.classList.add('com-modal');
    if (o.aoAbrir) o.aoAbrir(fundo, fechar);
  });
  U.confirmar = (titulo, texto, sim, cls) => U.modal({ titulo, html: texto ? `<p class="txt">${U.esc(texto)}</p>` : '', acoes: [{ txt: 'Voltar', valor: false }, { txt: sim || 'Confirmar', cls: cls || 'btn-marca', valor: true }] }).then((v) => !!v);
  U.modalAberto = () => !!document.querySelector('.modal-fundo');

  // lê os campos de um formulário (name → valor)
  U.campos = (el) => { const o = {}; U.$$('[name]', el).forEach((i) => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; };

  // reduz uma imagem (logo) para caber no banco: devolve um "data:" pequeno
  U.imagemPequena = (arquivo, lado = 320) => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const q = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * q); c.height = Math.round(img.height * q);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL('image/webp', 0.86);
      if (!/^data:image\/webp/.test(data)) data = c.toDataURL('image/png');
      res(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui abrir essa imagem.')); };
    img.src = url;
  });
})();
