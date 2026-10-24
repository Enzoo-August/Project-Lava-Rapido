/* =========================================================
   Agenda — horários marcados (para quem trabalha com hora marcada).
   Quando o cliente chega (ou o carro é buscado, no leva e traz),
   "Chegou"/"Busquei" abre a entrada já preenchida. Lembrete pelo
   WhatsApp, aviso no app no tempo escolhido e opção de pôr no
   calendário do celular (que avisa mesmo com o app fechado).
   ========================================================= */
(function () {
  const horaTxt = (g) => U.hora(g.quando);
  const AVISOS = [[0, 'Na hora'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes']];
  const avisoTxt = (g) => { const m = g.avisar_min == null ? 30 : Number(g.avisar_min); return m ? `${(AVISOS.find((x) => x[0] === m) || [m, m + ' min antes'])[1]} e na hora` : 'na hora'; };
  const mapa = (end) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(end);
  // calendário do celular: o próprio celular avisa, mesmo com o app fechado
  const paraCalendario = (g) => {
    const ini = new Date(g.quando), fim = new Date(ini.getTime() + 60 * 60000), z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const titulo = g.tipo === 'buscar' ? `Buscar o carro de ${g.nome}` : `${g.nome} · ${g.servico || 'horário marcado'}`;
    const desc = [g.servico, g.veiculo, U.placaOk(g.placa) ? U.placaFmt(g.placa) : '', g.telefone ? 'WhatsApp ' + U.telFmt(g.telefone) : '', g.obs].filter(Boolean).join(' · ');
    const antes = g.avisar_min == null ? 30 : Number(g.avisar_min);
    if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent)) {
      const esc = (t) => String(t || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lava Rapido//Agenda//PT', 'BEGIN:VEVENT', `UID:${g.id}@lavarapido`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(ini)}`, `DTEND:${z(fim)}`, `SUMMARY:${esc(titulo)}`, `DESCRIPTION:${esc(desc)}`, g.endereco ? `LOCATION:${esc(g.endereco)}` : '',
        'BEGIN:VALARM', `TRIGGER:-PT${antes}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(titulo)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      const arq = new File([ics], 'horario.ics', { type: 'text/calendar' }), url = URL.createObjectURL(arq), a = document.createElement('a');
      a.href = url; a.download = arq.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
      U.toast('Abra o arquivo e toque em “Adicionar ao Calendário”.');
    } else {
      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${z(ini)}/${z(fim)}&details=${encodeURIComponent(desc)}${g.endereco ? '&location=' + encodeURIComponent(g.endereco) : ''}`, '_blank', 'noopener');
      U.toast('No Google Agenda, toque em “Salvar”. O aviso do celular vem da própria agenda.');
    }
  };
  const diaTitulo = (chave) => {
    const d = U.deDia(chave), dias = U.diasDesde(d);
    const nome = dias === 0 ? 'Hoje' : dias === -1 ? 'Amanhã' : U.capitalizar(U.SEMANA_LONGA[d.getDay()]);
    return `${nome} · ${U.dataCurta(d)}`;
  };

  Telas.agenda = {
    titulo: 'Agenda', perfis: ['funcionario', 'dono'], relogio: true,
    render: (el) => {
      const lista = DB.agenda(), hoje = U.dia(), bloqueado = DB.bloqueado();
      const passados = lista.filter((g) => U.dia(g.quando) < hoje);
      const porDia = new Map();
      for (const g of lista.filter((x) => U.dia(x.quando) >= hoje)) { const k = U.dia(g.quando); if (!porDia.has(k)) porDia.set(k, []); porDia.get(k).push(g); }
      if (!porDia.has(hoje)) porDia.set(hoje, []);
      const dias = Array.from(porDia.keys()).sort();
      const cartao = (g) => {
        const atrasado = U.dia(g.quando) === hoje && new Date(g.quando).getTime() < Date.now() - 15 * 60000;
        return `<article class="agend${atrasado ? ' atrasado' : ''}" data-g="${g.id}">
          <button type="button" class="agend-info" data-acao="ver">
            <span class="agend-hora">${horaTxt(g)}</span>
            <span class="agend-txt"><b>${g.tipo === 'buscar' ? `${U.icon('carro')} Buscar · ` : ''}${U.esc(g.nome)}</b>
              <small>${U.esc(g.servico || 'serviço a combinar')}${g.valor ? ' · ' + U.brl0(g.valor) : ''}</small>
              <small>${U.esc(g.veiculo || '')}${U.placaOk(g.placa) ? ' · ' + U.esc(U.placaFmt(g.placa)) : ''}${g.tipo === 'buscar' && g.endereco ? ' · ' + U.esc(g.endereco) : ''}${atrasado ? ` · <b class="atraso">${g.tipo === 'buscar' ? 'passou da hora' : 'ainda não chegou'}</b>` : ''}</small></span>
          </button>
          ${bloqueado ? '' : `<div class="agend-acoes">
            ${U.telOk(g.telefone) ? `<button type="button" class="btn btn-p" data-acao="lembrar">${U.icon('zap')}<span>Lembrar</span></button>` : ''}
            <button type="button" class="btn btn-marca btn-p" data-acao="chegou">${U.icon('check')}<span>${g.tipo === 'buscar' ? 'Busquei' : 'Chegou'}</span></button>
          </div>`}
        </article>`;
      };
      el.innerHTML = `
        ${bloqueado ? '' : `<button class="btn btn-marca btn-g btn-bloco" id="gNovo">${U.icon('mais')}<span>Marcar horário</span></button>`}
        ${passados.length ? `<section class="agenda-dia"><h3>${U.icon('alerta')} Dias anteriores, sem resposta</h3><p class="mudo pequeno">Marque se o cliente veio, não veio ou se foi cancelado.</p>${passados.map(cartao).join('')}</section>` : ''}
        ${dias.map((k) => `<section class="agenda-dia"><h3>${diaTitulo(k)} <span class="mudo">(${porDia.get(k).length})</span></h3>
          ${porDia.get(k).length ? porDia.get(k).map(cartao).join('') : '<p class="mudo">Nada marcado.</p>'}</section>`).join('')}`;

      const novo = el.querySelector('#gNovo');
      if (novo) novo.onclick = async () => { if (await Telas.agenda.form(null)) { U.toast('Horário marcado'); App.render(); } };
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-acao]'), card = e.target.closest('[data-g]'); if (!b || !card) return;
        const g = Store.por('agendamentos', card.dataset.g); if (!g) return;
        if (b.dataset.acao === 'chegou') return App.ir('entrada/a/' + g.id);
        if (b.dataset.acao === 'lembrar') return U.zap(g.telefone, DB.msgAgenda(g));
        if (b.dataset.acao === 'ver') await Telas.agenda.detalhe(g);
      });
    },

    detalhe: async (g) => {
      const bloqueado = DB.bloqueado();
      const linha = (r, v) => (v ? `<div class="par"><span>${r}</span><b>${v}</b></div>` : '');
      const acao = await U.modal({
        titulo: U.capitalizar(DB.quandoTxt(g.quando)),
        html: `<div class="pares">${linha('Cliente', U.esc(g.nome))}${linha('WhatsApp', U.esc(U.telFmt(g.telefone)))}${linha('Carro', U.esc(g.veiculo || ''))}${linha('Placa', U.placaOk(g.placa) ? U.esc(U.placaFmt(g.placa)) : '')}
          ${linha('Tipo', g.tipo === 'buscar' ? 'Vou buscar o carro (leva e traz)' : 'Cliente traz o carro')}${linha('Onde buscar', g.tipo === 'buscar' ? U.esc(g.endereco || '') : '')}
          ${linha('Serviço', U.esc(g.servico || ''))}${linha('Valor combinado', g.valor ? U.brl(g.valor) : '')}${linha('Observação', U.esc(g.obs || ''))}${linha('Aviso no app', avisoTxt(g))}${linha('Marcado por', U.esc(g.criado_por || ''))}</div>
          ${bloqueado ? '' : `<div class="lista-menu">
            <button type="button" data-v="chegou">${U.icon('check')}<span>${g.tipo === 'buscar' ? 'Busquei o carro: registrar a entrada' : 'Chegou: registrar a entrada'}</span></button>
            ${g.tipo === 'buscar' && g.endereco ? `<a href="${mapa(g.endereco)}" target="_blank" rel="noopener" data-fechar>${U.icon('bandeira')}<span>Abrir o endereço no mapa</span></a>` : ''}
            <button type="button" data-v="calendario">${U.icon('calendario')}<span>Pôr no calendário do celular (avisa mesmo com o app fechado)</span></button>
            ${U.telOk(g.telefone) ? `<button type="button" data-v="lembrar">${U.icon('zap')}<span>Mandar lembrete no WhatsApp</span></button><a href="tel:+55${U.telDig(g.telefone)}" data-fechar>${U.icon('fone')}<span>Ligar</span></a>` : ''}
            <button type="button" data-v="editar">${U.icon('editar')}<span>Mudar dia, hora ou serviço</span></button>
            <button type="button" data-v="faltou">${U.icon('relogio')}<span>${g.tipo === 'buscar' ? 'Não deu para buscar' : 'Não veio'}</span></button>
            <button type="button" class="perigo" data-v="cancelar">${U.icon('x')}<span>Cancelar o horário</span></button>
          </div>`}`,
        aoAbrir: (el, fechar) => { const m = el.querySelector('.lista-menu'); if (m) m.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'lembrar') U.zap(g.telefone, DB.msgAgenda(g)); if (b.dataset.v === 'calendario') return paraCalendario(g); fechar(b.dataset.v); }); }
      });
      if (acao === 'chegou') return App.ir('entrada/a/' + g.id);
      if (acao === 'editar' && await Telas.agenda.form(g)) U.toast('Horário alterado');
      if (acao === 'faltou') { DB.salvarAgendamento(g, { status: 'faltou' }); U.toast(g.tipo === 'buscar' ? 'Marcado como “não deu para buscar”' : 'Marcado como “não veio”'); }
      if (acao === 'cancelar' && await U.confirmar('Cancelar este horário?', `${g.nome}, ${DB.quandoTxt(g.quando)}.`, 'Cancelar horário', 'btn-perigo')) { DB.salvarAgendamento(g, { status: 'cancelado' }); U.toast('Horário cancelado'); }
      App.render();
    },

    // marcar ou mudar um horário
    form: (g) => {
      const d = g ? new Date(g.quando) : (() => { const x = new Date(); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + 1); return x; })();
      let clienteId = g ? g.cliente_id : null;
      const servs = DB.servicos(), outro = g && g.servico && !servs.some((s) => s.nome === g.servico);
      return U.modal({
        titulo: g ? 'Mudar horário' : 'Marcar horário', largo: true,
        html: `<span class="rot">O que é</span>
          <div class="opcoes" id="gTipo"><button type="button" data-tipo="traz" class="${!g || g.tipo !== 'buscar' ? 'ativo' : ''}">Cliente traz o carro</button><button type="button" data-tipo="buscar" class="${g && g.tipo === 'buscar' ? 'ativo' : ''}">Vou buscar o carro (leva e traz)</button></div>
          <label class="campo"><span>Nome do cliente</span><input name="nome" value="${U.esc(g ? g.nome : '')}" autocapitalize="words" autocomplete="off"></label>
          <div id="gSug" class="achados"></div>
          <label class="campo"><span>WhatsApp (com DDD)</span><input name="telefone" inputmode="tel" value="${U.esc(g ? U.telFmt(g.telefone) : '')}" placeholder="(11) 99999-9999"></label>
          <div class="lado"><label class="campo"><span>Dia</span><input name="dia" type="date" value="${U.dia(d)}"></label><label class="campo"><span>Hora</span><input name="hora" type="time" value="${U.hora(d)}"></label></div>
          <div class="chips" id="gDias"><button type="button" class="chip" data-d="0">Hoje</button><button type="button" class="chip" data-d="1">Amanhã</button><button type="button" class="chip" data-d="2">Depois de amanhã</button></div>
          <label class="campo" id="gEnd" ${g && g.tipo === 'buscar' ? '' : 'hidden'}><span>Onde buscar (endereço)</span><input name="endereco" value="${U.esc(g ? g.endereco || '' : '')}" placeholder="Rua, número, bairro" autocapitalize="words"></label>
          <label class="campo"><span>Serviço</span><select name="servico"><option value="">A combinar</option>${servs.map((s) => `<option${g && g.servico === s.nome ? ' selected' : ''}>${U.esc(s.nome)}</option>`).join('')}<option value="__outro"${outro ? ' selected' : ''}>Outro (escrever)</option></select></label>
          <label class="campo" id="gOutro" ${outro ? '' : 'hidden'}><span>Qual serviço?</span><input name="servicoLivre" value="${U.esc(outro ? g.servico : '')}" autocapitalize="sentences"></label>
          <div class="lado"><label class="campo"><span>Carro (modelo e cor)</span><input name="veiculo" value="${U.esc(g ? g.veiculo || '' : '')}" autocapitalize="words" placeholder="Ex.: Corolla preto"></label>
            <label class="campo"><span>Placa (se souber)</span><input name="placa" value="${U.esc(g && U.placaOk(g.placa) ? g.placa : '')}" autocapitalize="characters" maxlength="8" placeholder="ABC1D23"></label></div>
          <label class="campo"><span>Valor combinado (opcional)</span><input name="valor" inputmode="decimal" value="${g && g.valor ? String(g.valor).replace('.', ',') : ''}" placeholder="0,00"></label>
          <label class="campo"><span>Observação</span><input name="obs" value="${U.esc(g ? g.obs || '' : '')}" placeholder="Ex.: trazer o carro sem objetos"></label>
          <span class="rot">Avisar no app (com som)</span>
          <div class="opcoes" id="gAviso">${AVISOS.map(([m, t]) => `<button type="button" data-av="${m}" class="${(g ? (g.avisar_min == null ? 30 : Number(g.avisar_min)) : 10) === m ? 'ativo' : ''}">${t}</button>`).join('')}</div>
          <p class="mudo pequeno">O app também avisa na hora marcada. Para o celular avisar mesmo com o app fechado, depois de marcar toque no horário → <b>Pôr no calendário do celular</b>.</p>`,
        aoAbrir: (el) => {
          const f = (n) => el.querySelector(`[name=${n}]`), sug = el.querySelector('#gSug');
          // cliente que já existe: toca no nome e preenche telefone, carro e placa
          f('nome').oninput = () => {
            clienteId = null;
            const t = f('nome').value.trim();
            const achados = t.length >= 2 ? DB.buscarClientes(t, 3) : [];
            sug.innerHTML = achados.map((c) => { const v = DB.veiculosDe(c.id)[0]; return `<button type="button" class="achado" data-c="${c.id}"><span><b>${U.esc(c.nome)}</b><small>${U.esc(U.telFmt(c.telefone))}${v ? ' · ' + U.esc(DB.nomeVeiculo(v)) : ''}</small></span>${U.icon('seta')}</button>`; }).join('');
          };
          sug.onclick = (e) => {
            const b = e.target.closest('[data-c]'); if (!b) return;
            const c = DB.cliente(b.dataset.c), v = DB.veiculosDe(c.id)[0];
            clienteId = c.id; f('nome').value = c.nome; f('telefone').value = U.telFmt(c.telefone);
            if (v) { f('veiculo').value = DB.nomeVeiculo(v); f('placa').value = U.semPlaca(v.placa) ? '' : v.placa; }
            sug.innerHTML = '';
          };
          f('telefone').oninput = () => { f('telefone').value = U.telFmt(f('telefone').value); };
          f('placa').oninput = () => { f('placa').value = U.placaLimpa(f('placa').value); };
          el.querySelector('#gTipo').onclick = (e) => { const b = e.target.closest('[data-tipo]'); if (!b) return; el.querySelectorAll('#gTipo button').forEach((x) => x.classList.toggle('ativo', x === b)); el.querySelector('#gEnd').hidden = b.dataset.tipo !== 'buscar'; };
          el.querySelector('#gAviso').onclick = (e) => { const b = e.target.closest('[data-av]'); if (!b) return; el.querySelectorAll('#gAviso button').forEach((x) => x.classList.toggle('ativo', x === b)); };
          f('servico').onchange = () => { el.querySelector('#gOutro').hidden = f('servico').value !== '__outro'; };
          el.querySelector('#gDias').onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) f('dia').value = U.dia(U.somaDias(new Date(), Number(b.dataset.d))); };
          if (!g) f('nome').focus();
        },
        acoes: [{ txt: 'Voltar', valor: false }, { txt: g ? 'Salvar' : 'Marcar', cls: 'btn-marca', aoTocar: (el) => {
          const x = U.campos(el);
          if (x.nome.length < 2) { U.toast('Escreva o nome do cliente.', 'bad'); return false; }
          if (x.telefone && !U.telOk(x.telefone)) { U.toast('Confira o telefone: DDD + número.', 'bad'); return false; }
          if (!x.dia || !x.hora) { U.toast('Informe o dia e a hora.', 'bad'); return false; }
          if (x.placa && !U.placaOk(x.placa)) { U.toast('Confira a placa (ex.: ABC1D23 ou ABC1234), ou deixe em branco.', 'bad'); return false; }
          const q = U.deDia(x.dia); q.setHours(Number(x.hora.slice(0, 2)), Number(x.hora.slice(3, 5)), 0, 0);
          // já tem alguém nesse horário? avisa uma vez; tocando de novo, marca assim mesmo
          const perto = DB.agenda().find((o) => o !== g && Math.abs(new Date(o.quando).getTime() - q.getTime()) < 30 * 60000);
          if (perto && el.dataset.avisou !== q.toISOString()) { el.dataset.avisou = q.toISOString(); U.toast(`Já tem ${U.primeiroNome(perto.nome)} às ${U.hora(perto.quando)} nesse dia. Para marcar assim mesmo, toque de novo.`, 'bad'); return false; }
          if (!clienteId) { const c = DB.clientePorTelefone(x.telefone); if (c) clienteId = c.id; }
          DB.salvarAgendamento(g, {
            cliente_id: clienteId, nome: x.nome, telefone: x.telefone, quando: q.toISOString(),
            servico: x.servico === '__outro' ? x.servicoLivre : x.servico, valor: U.num(x.valor),
            veiculo: x.veiculo, placa: x.placa, obs: x.obs,
            tipo: el.querySelector('#gTipo .ativo').dataset.tipo, endereco: el.querySelector('#gTipo .ativo').dataset.tipo === 'buscar' ? x.endereco : '',
            avisar_min: Number(el.querySelector('#gAviso .ativo').dataset.av)
          });
          return true;
        } }]
      });
    }
  };
})();
