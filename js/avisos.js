/* =========================================================
   Avisos — sininho no topo e aviso com som quando:
   - um carro passou do horário em que o cliente vem buscar
   - faltam 15 min para o cliente buscar e o carro não está pronto
   - faltam 30 min para um horário da agenda e o cliente não chegou
   - deu a hora marcada e o cliente não chegou
   Com permissão, também aparece como notificação do celular/computador
   (com o aplicativo aberto, mesmo em segundo plano). Com ele fechado
   seria preciso notificação "push" por servidor, que não existe ainda.
   ========================================================= */
(function () {
  const A = {};
  window.Avisos = A;
  let ctx = null, primeira = true, timer = null;

  const vistos = () => new Set(Store.pref('avisos.vistos') || []);
  const guardar = (s) => Store.pref('avisos.vistos', Array.from(s).slice(-300));
  A.somLigado = () => Store.pref('avisos.som') !== false;

  // o navegador só deixa tocar som depois que a pessoa tocou na tela uma vez
  let tocou = false;   // vibrar/tocar só depois do primeiro toque (o navegador exige)
  const destravar = () => { tocou = true; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} };
  document.addEventListener('pointerdown', destravar, { passive: true });

  A.tocar = () => {
    if (navigator.vibrate && tocou) { try { navigator.vibrate([120, 60, 120]); } catch (e) {} }
    if (!A.somLigado()) return;
    if (!tocou) return;
    destravar(); if (!ctx) return;
    const t = ctx.currentTime;
    [[880, 0], [1320, 0.18]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
      o.connect(g); g.connect(ctx.destination); o.start(t + d); o.stop(t + d + 0.45);
    });
  };

  // o que merece aviso agora
  A.lista = () => {
    if (!App.user || App.user.perfil === 'admin' || !Store.s || !Store.s.lava.id) return [];
    const agora = Date.now(), out = [];
    for (const a of DB.abertos()) {
      if (a.status === 'pronto' || !a.previsao) continue;
      const t = new Date(a.previsao).getTime(), c = DB.cliente(a.cliente_id), quem = c ? U.primeiroNome(c.nome) : 'O cliente';
      const carro = `${a.veiculo || 'Carro'} (${U.placaFmt(a.placa)})`, etapa = a.status === 'lavando' ? 'lavando' : 'na fila';
      if (t < agora) out.push({ id: `atraso:${a.id}:${a.previsao}`, tipo: 'atraso', a, titulo: `${carro} está atrasado`, txt: `${quem} vinha buscar ${U.dataHora(a.previsao).replace('hoje ', 'às ')}. Ainda está ${etapa}.` });
      else if (t - agora <= 15 * 60000) out.push({ id: `quase:${a.id}:${a.previsao}`, tipo: 'quase', a, titulo: `Faltam ${Math.max(1, Math.round((t - agora) / 60000))} min para ${quem} buscar`, txt: `${carro} ainda está ${etapa}. ${quem} vem às ${U.hora(a.previsao)}.` });
    }
    // agenda: quem marcou e ainda não chegou (o "Chegou" na agenda tira o aviso)
    for (const g of DB.agendaDoDia()) {
      const t = new Date(g.quando).getTime(), min = Math.round((t - agora) / 60000), quem = g.nome || 'Cliente', oQue = `${g.servico || 'serviço a combinar'}${g.veiculo ? ' · ' + g.veiculo : ''}`;
      if (min > 0 && min <= 30) out.push({ id: `agenda:${g.id}:${g.quando}`, tipo: 'agenda', g, titulo: `${quem} marcou às ${U.hora(g.quando)} e ainda não chegou`, txt: `Faltam ${min} min. ${oQue}` });
      else if (min <= 0 && min > -180) out.push({ id: `agenda-hora:${g.id}:${g.quando}`, tipo: 'agenda-atraso', g, titulo: `Deu ${U.hora(g.quando)} e ${quem} não chegou`, txt: `${-min < 2 ? 'Era agora.' : `Passou ${-min} min.`} Mande uma mensagem ou ligue. ${oQue}` });
    }
    return out;
  };

  // confere a cada 20 s; o que é novo toca e aparece no alto
  A.tick = () => {
    const l = A.lista(), v = vistos();
    let novo = null;
    for (const x of l) if (!v.has(x.id)) { v.add(x.id); if (!novo || urgente(x)) novo = x; }
    guardar(v);
    A.pintarSino(l);
    if (novo) { if (!primeira) { A.tocar(); A.notificar(novo); } A.mostrar(novo); }
    primeira = false;
  };
  A.iniciar = () => { clearInterval(timer); timer = setInterval(A.tick, 20000); setTimeout(A.tick, 1500); };

  const urgente = (x) => x.tipo === 'atraso' || x.tipo === 'agenda-atraso';
  const icone = (x) => (x.tipo.startsWith('agenda') ? 'calendario' : 'relogio');

  // notificação do sistema (aparece mesmo com outra janela na frente)
  A.podeNotificar = () => 'Notification' in window;
  A.notificar = (x) => {
    if (!A.podeNotificar() || Notification.permission !== 'granted') return;
    const o = { body: x.txt, tag: x.id, icon: '/assets/icons/icon-192.png', badge: '/assets/icons/icon-192.png', data: { rota: x.tipo.startsWith('agenda') ? 'agenda' : 'patio' } };
    const direto = () => { try { new Notification(x.titulo, o); } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then((r) => (r ? r.showNotification(x.titulo, o) : direto())).catch(direto);
    else direto();
  };

  // mensagem pronta para o cliente que marcou horário
  const msgCliente = (x) => (x.tipo === 'agenda-atraso'
    ? `Olá, ${U.primeiroNome(x.g.nome)}! Seu horário aqui era às ${U.hora(x.g.quando)}. Ainda vem hoje? Se precisar remarcar, é só avisar.\n${DB.lava().nome}`
    : DB.msgAgenda(x.g));
  const botoesCliente = (x) => (x.g && U.telOk(x.g.telefone)
    ? `<button type="button" class="btn btn-p" data-zap>${U.icon('zap')}<span>WhatsApp</span></button><a class="btn btn-p" href="tel:+55${U.telDig(x.g.telefone)}">${U.icon('fone')}<span>Ligar</span></a>` : '');

  A.pintarSino = (l) => {
    const b = document.getElementById('btSino'); if (!b) return;
    l = l || A.lista();
    const n = l.length, urg = l.some(urgente);
    b.innerHTML = `${U.icon('sino')}${n ? `<i class="sino-n${urg ? ' urgente' : ''}">${n}</i>` : ''}`;
    b.setAttribute('aria-label', n ? `${n} aviso${n > 1 ? 's' : ''}` : 'Avisos');
  };

  const abrir = (x) => {
    if (x.tipo.startsWith('agenda')) return App.ir('agenda');
    App.ir(x.a.status === 'pronto' ? 'patio/pronto' : 'patio');
    setTimeout(() => { if (Store.por('atendimentos', x.a.id)) Atend.detalhe(x.a); }, 350);
  };

  // faixa que aparece no alto da tela por alguns segundos
  A.mostrar = (x) => {
    let el = document.getElementById('alertaAviso');
    if (!el) { el = document.createElement('div'); el.id = 'alertaAviso'; document.body.appendChild(el); }
    el.className = 'alerta-aviso ' + x.tipo;
    el.innerHTML = `${U.icon(icone(x))}<div><b>${U.esc(x.titulo)}</b><small>${U.esc(x.txt)}</small></div>
      <span class="alerta-botoes">${botoesCliente(x)}<button type="button" class="btn btn-p" data-ver>Ver</button></span><button type="button" class="ic-btn" data-fechar-aviso aria-label="Fechar">${U.icon('x')}</button>`;
    el.hidden = false;
    el.onclick = (e) => {
      if (e.target.closest('[data-zap]')) { el.hidden = true; U.zap(x.g.telefone, msgCliente(x)); }
      else if (e.target.closest('[data-ver]')) { el.hidden = true; abrir(x); }
      else if (e.target.closest('[data-fechar-aviso]') || e.target.closest('a[href^="tel:"]')) el.hidden = true;
    };
    clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 25000);
  };

  // lista completa (toque no sininho)
  A.painel = () => {
    const l = A.lista();
    U.modal({
      titulo: 'Avisos',
      html: `${l.length ? `<div class="lista-menu">${l.map((x, i) => `<button type="button" data-i="${i}" class="aviso-${x.tipo}">${U.icon(icone(x))}<span>${U.esc(x.titulo)}<small>${U.esc(x.txt)}</small></span></button>`).join('')}</div>`
        : `<p class="mudo">Nenhum aviso agora. Aparece aqui, com som, quando: um carro passa do horário em que o cliente vem buscar; faltam 30 min para um horário da agenda e o cliente não chegou; e quando dá a hora marcada e ele ainda não chegou.</p>`}
        <label class="chave"><input type="checkbox" id="avSom" ${A.somLigado() ? 'checked' : ''}><span>Tocar som nos avisos<small>Vale só para este aparelho.</small></span></label>
        ${A.podeNotificar() ? `<label class="chave"><input type="checkbox" id="avNotif" ${Notification.permission === 'granted' ? 'checked' : ''} ${Notification.permission === 'denied' ? 'disabled' : ''}><span>Mostrar também como notificação<small>${Notification.permission === 'denied' ? 'Bloqueado neste navegador: libere em Configurações do site → Notificações.' : 'Aparece mesmo com outro aplicativo na frente, enquanto este estiver aberto.'}</small></span></label>` : ''}`,
      aoAbrir: (el, fechar) => {
        el.querySelector('#avSom').onchange = (e) => { Store.pref('avisos.som', e.target.checked); if (e.target.checked) A.tocar(); };
        const nt = el.querySelector('#avNotif');
        if (nt) nt.onchange = async (e) => {
          if (!e.target.checked) { U.toast('Para desligar de vez, use as configurações do navegador.'); e.target.checked = Notification.permission === 'granted'; return; }
          const r = await Notification.requestPermission();
          e.target.checked = r === 'granted';
          if (r === 'granted') A.notificar({ id: 'teste', tipo: 'agenda', titulo: 'Notificações ligadas', txt: 'Os avisos do lava vão aparecer assim.' });
          else U.toast('Notificação não foi liberada.', 'bad');
        };
        const m = el.querySelector('.lista-menu'); if (m) m.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; fechar(); abrir(l[Number(b.dataset.i)]); };
      }
    });
  };
})();
