/* ============================================================
   AXIOMA · player.js
   Motor de reproduccion: cola, aleatorio, repeticion, ecualizador,
   medidor VU y controles en la pantalla de bloqueo del telefono.
   ============================================================ */
window.Axioma = window.Axioma || {};

Axioma.player = (function () {
  const audio = new Audio();
  audio.preload = 'auto';

  /* Estado */
  let queue = [];        // pistas en el orden en que van a sonar
  let order = [];        // orden original, para deshacer el aleatorio
  let index = -1;
  let current = null;
  let srcUrl = null;
  let coverUrl = null;
  let shuffle = false;
  let repeat = 'off';    // off | all | one
  let ready = false;

  /* Cadena de Web Audio, solo si el "modo estudio" esta activo.
     Diez bandas y preamplificador, como los ecualizadores graficos
     de los reproductores de escritorio de la epoca. */
  const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
  const PRESETS = {
    'Plano':    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Rock':     [5, 3, -4, -6, -3, 2, 5, 7, 7, 7],
    'Pop':      [-1, 3, 4, 4, 3, 0, -1, -1, -1, -1],
    'Dance':    [6, 4, 1, 0, 0, -3, -4, -4, 0, 0],
    'Techno':   [5, 4, 0, -3, -3, 0, 4, 5, 5, 5],
    'Club':     [0, 0, 3, 5, 5, 5, 3, 0, 0, 0],
    'Graves':   [7, 6, 5, 3, 1, -2, -5, -6, -6, -6],
    'Agudos':   [-6, -6, -5, -3, 1, 5, 8, 9, 9, 9],
    'Clásica':  [0, 0, 0, 0, 0, 0, -5, -6, -6, -8],
    'Voz':      [-4, -2, 0, 3, 5, 4, 2, 0, -1, -2],
    'Fiesta':   [5, 5, 0, 0, 0, 0, 0, 0, 5, 5],
  };
  let ctx = null, srcNode = null, preNode = null, filters = [], analyser = null, spectrum = null;
  let studio = false;
  let eqGains = EQ_FREQS.map(() => 0);
  let preamp = 0;
  const db2gain = (db) => Math.pow(10, db / 20);

  /* Suscriptores de la interfaz */
  const subs = {};
  function on(evt, fn) { (subs[evt] = subs[evt] || []).push(fn); }
  function emit(evt, data) { (subs[evt] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------- cadena de audio ---------- */
  function buildGraph() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      srcNode = ctx.createMediaElementSource(audio);
      preNode = ctx.createGain();
      preNode.gain.value = db2gain(preamp);
      srcNode.connect(preNode);
      let node = preNode;
      filters = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
        b.frequency.value = f;
        b.Q.value = 1.1;
        b.gain.value = eqGains[i] || 0;
        node.connect(b);
        return (node = b);
      });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      spectrum = new Uint8Array(analyser.frequencyBinCount);
      node.connect(analyser);
      analyser.connect(ctx.destination);
      return true;
    } catch (e) {
      /* Si el navegador no deja enrutar el audio, seguimos con la salida
         directa: mejor perder el ecualizador que perder el sonido. */
      console.warn('Modo estudio no disponible:', e);
      ctx = null; srcNode = null; filters = []; analyser = null;
      return false;
    }
  }

  function setStudio(onOff) {
    const existed = !!ctx;
    studio = !!onOff;
    if (studio) {
      if (!buildGraph()) { studio = false; return false; }
      /* Si el contexto ya existía puenteado, rehacemos la cadena. */
      if (existed) reconnectGraph();
      resume();
    } else if (ctx && srcNode) {
      /* Puenteamos la cadena. El contexto no se puede destruir sin recargar,
         pero el audio vuelve a salir sin procesar. */
      try {
        srcNode.disconnect();
        if (preNode) preNode.disconnect();
        filters.forEach((f) => f.disconnect());
        if (analyser) analyser.disconnect();
        srcNode.connect(ctx.destination);
      } catch (e) { /* nada que puentear */ }
    }
    emit('studio', studio);
    return studio;
  }

  function reconnectGraph() {
    if (!ctx || !srcNode) return;
    try {
      srcNode.disconnect();
      if (preNode) preNode.disconnect();
      filters.forEach((f) => f.disconnect());
      if (analyser) analyser.disconnect();
      let node = srcNode;
      if (preNode) { srcNode.connect(preNode); node = preNode; }
      filters.forEach((f) => { node.connect(f); node = f; });
      node.connect(analyser);
      analyser.connect(ctx.destination);
    } catch (e) { /* ya conectado */ }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setEq(i, db) {
    eqGains[i] = db;
    if (filters[i]) filters[i].gain.value = db;
    Axioma.db.setting.set('eq', eqGains.slice());
  }

  function setEqAll(gains) {
    eqGains = gains.slice(0, EQ_FREQS.length);
    while (eqGains.length < EQ_FREQS.length) eqGains.push(0);
    filters.forEach((f, i) => { f.gain.value = eqGains[i]; });
    Axioma.db.setting.set('eq', eqGains.slice());
  }

  function setPreamp(db) {
    preamp = db;
    if (preNode) preNode.gain.value = db2gain(db);
    Axioma.db.setting.set('preamp', db);
  }

  function levels() {
    if (!studio || !analyser) return null;
    analyser.getByteFrequencyData(spectrum);
    return spectrum;
  }

  /* ---------- carga de pista ---------- */
  function releaseUrls() {
    if (srcUrl) { URL.revokeObjectURL(srcUrl); srcUrl = null; }
    if (coverUrl) { URL.revokeObjectURL(coverUrl); coverUrl = null; }
  }

  function load(track, autoplay) {
    if (!track) return;
    releaseUrls();
    current = track;
    srcUrl = URL.createObjectURL(track.blob);
    coverUrl = track.cover ? URL.createObjectURL(track.cover) : null;
    audio.src = srcUrl;
    audio.load();
    ready = true;
    emit('track', track);
    mediaSession();
    if (autoplay) play();
    else emit('state', false);
    save();
  }

  async function play() {
    if (!current) return;
    if (studio) resume();
    try {
      await audio.play();
      emit('state', true);
      mark();
    } catch (e) {
      emit('state', false);
      emit('error', 'Toca el botón de reproducir para empezar.');
    }
  }

  function pause() { audio.pause(); emit('state', false); }
  function toggle() { audio.paused ? play() : pause(); }

  /* Cuenta la reproduccion tras unos segundos, no al pulsar play. */
  let counted = null;
  function mark() {
    if (!current || counted === current.id) return;
    const id = current.id;
    setTimeout(() => {
      if (!current || current.id !== id || audio.paused) return;
      counted = id;
      current.playCount = (current.playCount || 0) + 1;
      current.lastPlayedAt = Date.now();
      Axioma.db.put('tracks', current).catch(() => {});
      emit('counted', current);
    }, 8000);
  }

  /* ---------- cola ---------- */
  function setQueue(list, startIndex, autoplay) {
    order = list.slice();
    queue = shuffle ? shuffleFrom(order, startIndex) : order.slice();
    index = shuffle ? 0 : Math.max(0, Math.min(startIndex | 0, queue.length - 1));
    emit('queue', queue);
    load(queue[index], autoplay !== false);
  }

  /* Al activar el aleatorio, la pista actual queda primero y el resto se
     baraja: nadie espera que "aleatorio" cambie lo que esta sonando. */
  function shuffleFrom(list, keepIndex) {
    const rest = list.filter((_, i) => i !== keepIndex);
    const head = list[keepIndex];
    const out = Axioma.util.shuffled(rest);
    if (head) out.unshift(head);
    return out;
  }

  function setShuffle(v) {
    shuffle = !!v;
    if (!queue.length) { persistFlags(); emit('flags', flags()); return; }
    if (shuffle) {
      queue = shuffleFrom(queue, index);
      index = 0;
    } else {
      queue = order.slice();
      index = Math.max(0, queue.findIndex((t) => current && t.id === current.id));
    }
    persistFlags();
    emit('queue', queue);
    emit('flags', flags());
  }

  function setRepeat(v) {
    repeat = v;
    persistFlags();
    emit('flags', flags());
  }

  function cycleRepeat() { setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'); }

  function next(auto) {
    if (!queue.length) return;
    if (auto && repeat === 'one') { audio.currentTime = 0; play(); return; }
    if (index + 1 < queue.length) { index++; }
    else if (repeat === 'all' || !auto) { index = 0; }
    else { pause(); audio.currentTime = 0; emit('ended'); return; }
    load(queue[index], true);
  }

  function prev() {
    if (!queue.length) return;
    if (audio.currentTime > 3.5) { audio.currentTime = 0; return; }
    index = index - 1 < 0 ? queue.length - 1 : index - 1;
    load(queue[index], true);
  }

  function jump(i) {
    if (i < 0 || i >= queue.length) return;
    index = i;
    load(queue[index], true);
  }

  function playNext(track) {
    if (!queue.length) { setQueue([track], 0, true); return; }
    queue.splice(index + 1, 0, track);
    order.splice(Math.min(order.length, index + 1), 0, track);
    emit('queue', queue);
  }

  function enqueue(track) {
    if (!queue.length) { setQueue([track], 0, true); return; }
    queue.push(track);
    order.push(track);
    emit('queue', queue);
  }

  function removeFromQueue(i) {
    if (i < 0 || i >= queue.length || i === index) return;
    queue.splice(i, 1);
    if (i < index) index--;
    emit('queue', queue);
  }

  /* Si una pista desaparece de la biblioteca, sale tambien de la cola. */
  function dropTracks(ids) {
    const set = new Set(ids);
    const wasCurrent = current && set.has(current.id);
    order = order.filter((t) => !set.has(t.id));
    const before = queue.slice(0, index).filter((t) => !set.has(t.id)).length;
    queue = queue.filter((t) => !set.has(t.id));
    index = Math.min(before, Math.max(0, queue.length - 1));
    if (wasCurrent) {
      pause();
      releaseUrls();
      audio.removeAttribute('src');
      current = null;
      if (queue.length) load(queue[index], false);
      else { emit('track', null); emit('state', false); }
    }
    emit('queue', queue);
  }

  function seek(sec) {
    if (!current || !isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(sec, audio.duration));
    emit('time', { t: audio.currentTime, d: audio.duration });
    position();
  }

  /* ---------- pantalla de bloqueo ---------- */
  function mediaSession() {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      const art = [];
      if (coverUrl) art.push({ src: coverUrl, sizes: '512x512', type: current.cover.type || 'image/jpeg' });
      else art.push({ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' });
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title, artist: current.artist, album: current.album, artwork: art,
      });
    } catch (e) { /* el navegador no soporta metadatos */ }
  }

  function position() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        position: Math.min(audio.currentTime, audio.duration),
        playbackRate: audio.playbackRate || 1,
      });
    } catch (e) { /* posicion fuera de rango durante una carga */ }
  }

  function bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) {} };
    set('play', play);
    set('pause', pause);
    set('previoustrack', prev);
    set('nexttrack', () => next(false));
    set('stop', () => { pause(); audio.currentTime = 0; });
    set('seekto', (d) => { if (d.seekTime != null) seek(d.seekTime); });
    set('seekbackward', (d) => seek(audio.currentTime - (d.seekOffset || 10)));
    set('seekforward', (d) => seek(audio.currentTime + (d.seekOffset || 10)));
  }

  /* ---------- persistencia ---------- */
  function flags() { return { shuffle, repeat, studio }; }
  function persistFlags() { Axioma.db.setting.set('flags', { shuffle, repeat }); }

  let saveAt = 0;
  function save(force) {
    const now = Date.now();
    if (!force && now - saveAt < 4000) return;
    saveAt = now;
    Axioma.db.setting.set('resume', {
      trackId: current ? current.id : null,
      position: audio.currentTime || 0,
      queueIds: queue.map((t) => t.id),
      orderIds: order.map((t) => t.id),
      index,
    }).catch(() => {});
  }

  async function restore(byId) {
    const [saved, f, eq, pre] = await Promise.all([
      Axioma.db.setting.get('resume', null),
      Axioma.db.setting.get('flags', null),
      Axioma.db.setting.get('eq', null),
      Axioma.db.setting.get('preamp', 0),
    ]);
    if (f) { shuffle = !!f.shuffle; repeat = f.repeat || 'off'; }
    if (eq && eq.length === EQ_FREQS.length) eqGains = eq.slice();
    preamp = +pre || 0;
    emit('flags', flags());
    if (!saved || !saved.trackId) return false;
    const q = (saved.queueIds || []).map(byId).filter(Boolean);
    if (!q.length) return false;
    queue = q;
    order = (saved.orderIds || saved.queueIds || []).map(byId).filter(Boolean);
    index = Math.max(0, Math.min(saved.index | 0, queue.length - 1));
    const t = byId(saved.trackId);
    if (!t) return false;
    if (queue[index] !== t) {
      const i = queue.findIndex((x) => x.id === t.id);
      index = i >= 0 ? i : 0;
    }
    load(queue[index], false);
    /* Retomamos donde se quedo, en pausa: nadie quiere que la musica
       arranque sola al abrir la app. */
    const at = saved.position || 0;
    if (at > 1) {
      const seekOnce = () => { try { audio.currentTime = at; } catch (e) {} emit('time', { t: at, d: audio.duration }); };
      if (audio.readyState >= 1) seekOnce();
      else audio.addEventListener('loadedmetadata', seekOnce, { once: true });
    }
    emit('queue', queue);
    return true;
  }

  /* ---------- temporizador de apagado ---------- */
  let sleepAt = 0, sleepTimer = null;
  function setSleep(minutes) {
    clearTimeout(sleepTimer);
    if (!minutes) { sleepAt = 0; emit('sleep', 0); return; }
    sleepAt = Date.now() + minutes * 60000;
    sleepTimer = setTimeout(() => {
      /* Bajamos el volumen en cinco segundos antes de parar. */
      const from = audio.volume, steps = 25;
      let k = 0;
      const fade = setInterval(() => {
        k++;
        audio.volume = Math.max(0, from * (1 - k / steps));
        if (k >= steps) {
          clearInterval(fade);
          pause();
          audio.volume = from;
          sleepAt = 0;
          emit('sleep', 0);
        }
      }, 200);
    }, minutes * 60000);
    emit('sleep', sleepAt);
  }
  function sleepLeft() { return sleepAt ? Math.max(0, sleepAt - Date.now()) : 0; }

  /* ---------- eventos del elemento de audio ---------- */
  audio.addEventListener('timeupdate', () => {
    emit('time', { t: audio.currentTime, d: audio.duration });
    save();
  });
  audio.addEventListener('loadedmetadata', () => {
    emit('time', { t: audio.currentTime, d: audio.duration });
    position();
  });
  audio.addEventListener('play', () => {
    emit('state', true);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    position();
  });
  audio.addEventListener('pause', () => {
    emit('state', false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    save(true);
  });
  audio.addEventListener('ended', () => { save(true); next(true); });
  audio.addEventListener('error', () => {
    if (!current) return;
    emit('error', `No se pudo reproducir «${current.title}».`);
    if (queue.length > 1) next(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (studio) resume(); save(true); }
  });
  window.addEventListener('pagehide', () => save(true));

  bindMediaSession();

  return {
    audio, on, load, play, pause, toggle, next, prev, jump, seek,
    setQueue, playNext, enqueue, removeFromQueue, dropTracks,
    setShuffle, setRepeat, cycleRepeat, flags,
    setStudio, setEq, setEqAll, setPreamp, levels, reconnectGraph,
    setSleep, sleepLeft, restore, save,
    get current() { return current; },
    get queue() { return queue; },
    get index() { return index; },
    get playing() { return !audio.paused && ready; },
    get eq() { return eqGains.slice(); },
    get preamp() { return preamp; },
    get studio() { return studio; },
    get coverUrl() { return coverUrl; },
    EQ_FREQS, EQ_LABELS, PRESETS,
  };
})();
