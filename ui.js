/* ============================================================
   AXIOMA · ui.js
   Vistas, navegacion, importacion de archivos y ventana de
   reproduccion. Arranca la aplicacion al final del archivo.
   ============================================================ */
window.Axioma = window.Axioma || {};

(function () {
  const U = Axioma.util;
  const P = Axioma.player;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const APP_VERSION = '1.2';

  /* ------------------------------------------------------------
     Iconografia. El transporte usa las figuras macizas clasicas;
     el resto son trazos de 1.8 con esquinas redondeadas.
     ------------------------------------------------------------ */
  const STROKE = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.2 20.2l-3.9-3.9"/>',
    note: '<path d="M9 18V5.5l11-2V16"/><ellipse cx="6" cy="18" rx="3" ry="2.6"/><ellipse cx="17" cy="16" rx="3" ry="2.6"/>',
    stack: '<path d="M4 6.5h16M4 12h16M4 17.5h8.5"/><path d="M15 14.9l6.2 2.7-6.2 2.7z" fill="currentColor" stroke="none"/>',
    sliders: '<path d="M5 20v-7M5 9V4M12 20v-9M12 7V4M19 20v-4M19 12V4"/><path d="M2.6 11h4.8M9.6 9h4.8M16.6 14h4.8"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    down: '<path d="M6 9.5l6 6 6-6"/>',
    more: '<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
    shuffle: '<path d="M3 6h3.5l3 5M21 6h-4l-8.5 12H3"/><path d="M21 18h-4"/><path d="M18.4 3.6L21 6l-2.6 2.4M18.4 15.6L21 18l-2.6 2.4"/>',
    repeat: '<path d="M4 10V8.5A3.5 3.5 0 017.5 5H18"/><path d="M20 14v1.5a3.5 3.5 0 01-3.5 3.5H6"/><path d="M15.6 2.6L18.4 5l-2.8 2.4M8.4 21.4L5.6 19l2.8-2.4"/>',
    heart: '<path d="M12 20s-7.3-4.6-7.3-9.4A4.1 4.1 0 0112 8.4a4.1 4.1 0 017.3 2.2C19.3 15.4 12 20 12 20z"/>',
    queue: '<path d="M4 7h12M4 12h12M4 17h8"/><path d="M19 8v9"/><path d="M16 11h6"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.4 1.6M9.4 2.8h5.2"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4.6h5v1.9"/><path d="M6.6 6.5l.9 12.4a1.6 1.6 0 001.6 1.5h5.8a1.6 1.6 0 001.6-1.5l.9-12.4"/><path d="M10.4 10v7M13.6 10v7"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/>',
    mic: '<rect x="9" y="2.8" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3.2M8.6 21.2h6.8"/>',
    folder: '<path d="M3.5 7.2A1.7 1.7 0 015.2 5.5h3.6l1.8 2.2h8.2a1.7 1.7 0 011.7 1.7v7.9a1.7 1.7 0 01-1.7 1.7H5.2a1.7 1.7 0 01-1.7-1.7z"/>',
    down_tray: '<path d="M12 3.5v11M7.8 10.6l4.2 4.2 4.2-4.2"/><path d="M4.5 17v2.2a1.3 1.3 0 001.3 1.3h12.4a1.3 1.3 0 001.3-1.3V17"/>',
    moon: '<path d="M20 14.2A8.2 8.2 0 019.8 4 8.5 8.5 0 1020 14.2z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.9v.2"/>',
  };
  const FILL = {
    play: '<path d="M6 4l14 8-14 8z"/>',
    pause: '<rect x="5.5" y="4.5" width="4.6" height="15"/><rect x="13.9" y="4.5" width="4.6" height="15"/>',
    stop: '<rect x="5" y="5" width="14" height="14"/>',
    prev: '<path d="M20 4v16L8.6 12z"/><rect x="3.4" y="4" width="3.4" height="16"/>',
    next: '<path d="M4 4v16l11.4-8z"/><rect x="17.2" y="4" width="3.4" height="16"/>',
    eject: '<path d="M12 4l8 10H4z"/><rect x="4" y="16.4" width="16" height="3.6"/>',
    heart_on: '<path d="M12 20.5s-7.6-4.8-7.6-9.8A4.3 4.3 0 0112 8.1a4.3 4.3 0 017.6 2.6c0 5-7.6 9.8-7.6 9.8z"/>',
  };
  function ic(name) {
    if (FILL[name]) return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${FILL[name]}</svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STROKE[name] || ''}</svg>`;
  }

  /* ------------------------------------------------------------
     Estado de la biblioteca
     ------------------------------------------------------------ */
  let tracks = [];
  const byId = new Map();
  let albums = [], artists = [], playlists = [];
  let libTab = 'canciones';
  let view = 'biblioteca';
  let detail = null;
  const thumbs = new Map();

  const el = {};
  const getTrack = (id) => byId.get(id) || null;

  function thumbUrl(t) {
    if (!t) return null;
    if (thumbs.has(t.id)) return thumbs.get(t.id);
    const b = t.thumb || t.cover;
    const u = b ? URL.createObjectURL(b) : null;
    thumbs.set(t.id, u);
    return u;
  }
  function dropThumb(id) {
    const u = thumbs.get(id);
    if (u) URL.revokeObjectURL(u);
    thumbs.delete(id);
  }

  const PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%230a0a0a"/>' +
      '<g fill="none" stroke="%2300600a" stroke-width="2.4" stroke-linecap="round">' +
      '<path d="M26 42V22l16-3v17"/></g>' +
      '<ellipse cx="22" cy="42" rx="4.6" ry="4" fill="%2300600a"/>' +
      '<ellipse cx="38" cy="39" rx="4.6" ry="4" fill="%2300600a"/></svg>'
    );
  const art = (t) => thumbUrl(t) || PLACEHOLDER;

  /* ------------------------------------------------------------
     Agrupaciones derivadas
     ------------------------------------------------------------ */
  function regroup() {
    tracks.sort((a, b) => U.cmp(a.title, b.title));
    byId.clear();
    tracks.forEach((t) => byId.set(t.id, t));

    const am = new Map(), rm = new Map();
    for (const t of tracks) {
      const who = t.albumArtist || t.artist;
      const key = U.fold(t.album) + '::' + U.fold(who);
      let a = am.get(key);
      if (!a) am.set(key, (a = { key, name: t.album, artist: who, tracks: [], year: t.year }));
      a.tracks.push(t);
      if (t.year && (!a.year || t.year < a.year)) a.year = t.year;

      const rk = U.fold(t.artist);
      let r = rm.get(rk);
      if (!r) rm.set(rk, (r = { key: rk, name: t.artist, tracks: [], albums: new Set() }));
      r.tracks.push(t);
      r.albums.add(key);
    }
    albums = Array.from(am.values()).sort((a, b) => U.cmp(a.name, b.name));
    albums.forEach((a) => a.tracks.sort((x, y) => (x.discNo || 1) - (y.discNo || 1) || (x.trackNo || 999) - (y.trackNo || 999) || U.cmp(x.title, y.title)));
    artists = Array.from(rm.values()).sort((a, b) => U.cmp(a.name, b.name));
    artists.forEach((r) => r.tracks.sort((x, y) => U.cmp(x.title, y.title)));
  }

  const albumOf = (t) => albums.find((a) => a.key === U.fold(t.album) + '::' + U.fold(t.albumArtist || t.artist));
  const artistOf = (t) => artists.find((r) => r.key === U.fold(t.artist));

  /* ------------------------------------------------------------
     Fragmentos de HTML
     ------------------------------------------------------------ */
  function rowHTML(t, i) {
    const playing = P.current && P.current.id === t.id;
    return `<button class="row${playing ? ' playing' : ''}" data-i="${i}" data-id="${U.esc(t.id)}">
      <span class="row__n">${i + 1}</span>
      <img class="row__art" src="${art(t)}" alt="" loading="lazy" decoding="async">
      <span class="row__txt">
        <span class="row__t">${U.esc(t.title)}</span>
        <span class="row__s">${U.esc(t.artist)}${t.album && t.album !== 'Sin álbum' ? ' · ' + U.esc(t.album) : ''}</span>
      </span>
      ${playing ? '<span class="row__eq"><i></i><i></i><i></i></span>' : `<span class="row__d">${U.time(t.duration)}</span>`}
      <span class="row__more" data-menu="${U.esc(t.id)}">${ic('more')}</span>
    </button>`;
  }

  const listHTML = (list) => `<div class="rows">${list.map(rowHTML).join('')}</div>`;

  const emptyHTML = (icon, title, text, action) =>
    `<div class="empty">${ic(icon)}<h3>${title}</h3><p>${text}</p>${action || ''}</div>`;

  const albumTile = (a) => `<button class="tile" data-album="${U.esc(a.key)}">
      <img class="tile__art" src="${art(a.tracks[0])}" alt="" loading="lazy" decoding="async">
      <span class="tile__t">${U.esc(a.name)}</span>
      <span class="tile__s">${U.esc(a.artist)}</span>
    </button>`;

  const artistTile = (r) => `<button class="tile tile--round" data-artist="${U.esc(r.key)}">
      <img class="tile__art" src="${art(r.tracks[0])}" alt="" loading="lazy" decoding="async">
      <span class="tile__t">${U.esc(r.name)}</span>
      <span class="tile__s">${r.tracks.length} ${r.tracks.length === 1 ? 'canción' : 'canciones'}</span>
    </button>`;

  const totalTime = (list) => list.reduce((s, t) => s + (t.duration || 0), 0);
  const summary = (list) =>
    `${list.length} ${list.length === 1 ? 'canción' : 'canciones'} · ${Math.round(totalTime(list) / 60)} min`;

  /* ------------------------------------------------------------
     Vistas
     ------------------------------------------------------------ */
  function renderLibrary() {
    const box = el.vBiblioteca;
    if (!tracks.length) {
      box.innerHTML = emptyHTML(
        'folder', 'Biblioteca vacía',
        'Importa canciones desde el almacenamiento del teléfono. Se guardan dentro de la app y suenan sin conexión.',
        `<button class="btn" data-act="import">${ic('eject')}Importar música</button>`
      );
      box._list = null;
      return;
    }
    if (libTab === 'canciones') {
      box.innerHTML =
        `<div class="sectionhead"><span class="plate">Todas las canciones</span><span class="count">${summary(tracks)}</span></div>` +
        listHTML(tracks);
      box._list = tracks;
    } else if (libTab === 'albumes') {
      box.innerHTML =
        `<div class="sectionhead"><span class="plate">Álbumes</span><span class="count">${albums.length}</span></div>` +
        `<div class="grid">${albums.map(albumTile).join('')}</div>`;
      box._list = null;
    } else {
      box.innerHTML =
        `<div class="sectionhead"><span class="plate">Artistas</span><span class="count">${artists.length}</span></div>` +
        `<div class="grid">${artists.map(artistTile).join('')}</div>`;
      box._list = null;
    }
  }

  function renderSearch() {
    const q = U.fold(el.q.value.trim());
    const box = el.vBuscar;
    if (!q) {
      const recent = tracks.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
      if (!recent.length) {
        box.innerHTML = emptyHTML('search', 'Busca en tu música', 'Escribe el nombre de una canción, un artista o un álbum.');
        box._list = null;
        return;
      }
      box.innerHTML = `<div class="sectionhead"><span class="plate">Añadidas hace poco</span></div>` + listHTML(recent);
      box._list = recent;
      return;
    }
    const hit = tracks.filter((t) =>
      U.fold(t.title).includes(q) || U.fold(t.artist).includes(q) ||
      U.fold(t.album).includes(q) || U.fold(t.albumArtist || '').includes(q));
    if (!hit.length) {
      box.innerHTML = emptyHTML('search', 'Sin resultados', `Nada coincide con «${U.esc(el.q.value.trim())}».`);
      box._list = null;
      return;
    }
    box.innerHTML = `<div class="sectionhead"><span class="plate">Resultados</span><span class="count">${hit.length}</span></div>` + listHTML(hit);
    box._list = hit;
  }

  function autoLists() {
    const favs = tracks.filter((t) => t.favorite);
    const recent = tracks.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 40);
    const most = tracks.filter((t) => t.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 40);
    return [
      { id: '@fav', name: 'Favoritas', icon: 'heart', list: favs, note: favs.length ? summary(favs) : 'Marca canciones con el corazón' },
      { id: '@recent', name: 'Añadidas hace poco', icon: 'down_tray', list: recent, note: recent.length ? summary(recent) : 'Aún no has importado nada' },
      { id: '@most', name: 'Más escuchadas', icon: 'repeat', list: most, note: most.length ? summary(most) : 'Se llena sola conforme escuchas' },
    ];
  }

  function renderPlaylists() {
    let h = `<div class="settings"><div class="card"><span class="plate">Se arman solas</span>`;
    for (const a of autoLists()) {
      h += `<button class="opt" data-auto="${a.id}">${ic(a.icon)}
        <span class="opt__txt"><span class="opt__t">${a.name}</span><span class="opt__s">${U.esc(a.note)}</span></span>
        <span class="opt__v">${a.list.length}</span></button>`;
    }
    h += `</div><div class="card"><span class="plate">Mis listas</span>`;
    if (!playlists.length) {
      h += `<div class="opt"><span class="opt__txt"><span class="opt__s">Todavía no has creado ninguna lista. Agrupa lo que sueles escuchar junto.</span></span></div>`;
    } else {
      for (const p of playlists) {
        const list = p.trackIds.map(getTrack).filter(Boolean);
        h += `<button class="opt" data-playlist="${U.esc(p.id)}">${ic('stack')}
          <span class="opt__txt"><span class="opt__t">${U.esc(p.name)}</span><span class="opt__s">${list.length ? summary(list) : 'Vacía'}</span></span>
          <span class="opt__v">${list.length}</span></button>`;
      }
    }
    h += `</div><button class="btn btn--ghost btn--wide" data-act="new-playlist">Crear lista</button></div>`;
    el.vListas.innerHTML = h;
  }

  async function renderSettings() {
    const size = tracks.reduce((s, t) => s + (t.size || 0), 0);
    let quota = 0, used = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        quota = e.quota || 0; used = e.usage || 0;
      }
    } catch (e) { /* el navegador no lo expone */ }
    const pct = quota ? Math.min(100, (used / quota) * 100) : 0;
    const persisted = await (navigator.storage && navigator.storage.persisted
      ? navigator.storage.persisted().catch(() => false) : Promise.resolve(false));
    const dia = document.documentElement.getAttribute('data-skin') === 'dia';
    const demos = tracks.filter((t) => t.demo).length;
    const sleep = P.sleepLeft();

    let h = `<div class="settings">`;

    h += `<div class="card"><span class="plate">Almacenamiento</span>
      <div class="meter">
        <div class="meter__bar"><div class="meter__fill" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="meter__legend"><span>${tracks.length} pistas · ${U.bytes(size)}</span><span>${quota ? U.bytes(used) + ' / ' + U.bytes(quota) : 'sin límite conocido'}</span></div>
      </div>
      <button class="opt" data-act="import">${ic('eject')}
        <span class="opt__txt"><span class="opt__t">Importar archivos</span><span class="opt__s">MP3, M4A, FLAC, OGG, Opus o WAV. Se abre el explorador del teléfono, así que también sirve Drive o Descargas.</span></span></button>
      <button class="opt" data-act="import-folder">${ic('folder')}
        <span class="opt__txt"><span class="opt__t">Importar una carpeta</span><span class="opt__s">Toma de golpe todos los audios que haya dentro. Si tu teléfono no permite elegir carpetas, usa la opción de arriba.</span></span></button>
      <button class="opt" data-act="persist" ${persisted ? 'disabled' : ''}>${ic('check')}
        <span class="opt__txt"><span class="opt__t">Proteger biblioteca</span><span class="opt__s">${persisted ? 'Activo. El sistema no borrará tu música para liberar espacio.' : 'Pide al sistema que no borre tu música si el teléfono se queda sin espacio.'}</span></span></button>
    </div>`;

    h += `<div class="card"><span class="plate">Sonido</span>
      <button class="opt" data-act="studio">${ic('sliders')}
        <span class="opt__txt"><span class="opt__t">Modo estudio</span><span class="opt__s">Enciende el ecualizador y el analizador de espectro. En algunos teléfonos puede cortar el audio al bloquear la pantalla.</span></span>
        <span class="switch" role="switch" aria-checked="${P.studio}"></span></button>
      <button class="opt" data-act="eq" ${P.studio ? '' : 'disabled'}>${ic('sliders')}
        <span class="opt__txt"><span class="opt__t">Ecualizador</span><span class="opt__s">${P.studio ? 'Diez bandas, preamplificador y ajustes rápidos' : 'Requiere el modo estudio'}</span></span>
        <span class="opt__v">${P.eq.some((g) => g) || P.preamp ? 'Ajustado' : 'Plano'}</span></button>
      <button class="opt" data-act="sleep">${ic('timer')}
        <span class="opt__txt"><span class="opt__t">Temporizador</span><span class="opt__s">Baja el volumen y pausa al terminar</span></span>
        <span class="opt__v">${sleep ? Math.ceil(sleep / 60000) + ' min' : 'Off'}</span></button>
    </div>`;

    h += `<div class="card"><span class="plate">Apariencia</span>
      <button class="opt" data-act="skin">${ic(dia ? 'sun' : 'moon')}
        <span class="opt__txt"><span class="opt__t">${dia ? 'Chasis claro' : 'Chasis oscuro'}</span><span class="opt__s">${dia ? 'Gris claro, para exteriores' : 'Azul pizarra, el predeterminado'}</span></span>
        <span class="switch" role="switch" aria-checked="${!dia}"></span></button>
    </div>`;

    h += `<div class="card"><span class="plate">Mantenimiento</span>`;
    if (demos) {
      h += `<button class="opt" data-act="drop-demo">${ic('x')}
        <span class="opt__txt"><span class="opt__t">Quitar demostración</span><span class="opt__s">Las ${demos} pistas de ejemplo que trae la app</span></span></button>`;
    }
    h += `<button class="opt" data-act="wipe">${ic('trash')}
        <span class="opt__txt"><span class="opt__t" style="color:var(--alert)">Borrar biblioteca</span><span class="opt__s">Elimina las ${tracks.length} pistas y las listas. No se puede deshacer.</span></span></button>
    </div>`;

    h += `<div class="card"><span class="plate">Acerca de</span>
      <div class="opt">${ic('info')}
        <span class="opt__txt"><span class="opt__t">Axioma ${APP_VERSION}</span>
        <span class="opt__s">Reproductor local. Tu música nunca sale del teléfono: no hay cuentas, ni servidores, ni anuncios.</span></span></div>
      <button class="opt" data-act="update">${ic('repeat')}
        <span class="opt__txt"><span class="opt__t">Buscar actualización</span><span class="opt__s">Trae la última versión publicada y reinicia la app. Tu música y tus listas no se tocan.</span></span></button>
      ${installPrompt ? `<button class="opt" data-act="install">${ic('down_tray')}<span class="opt__txt"><span class="opt__t">Instalar en el teléfono</span><span class="opt__s">Añade Axioma al cajón de aplicaciones</span></span></button>` : ''}
    </div></div>`;

    el.vAjustes.innerHTML = h;
  }

  /* ---------- vistas de detalle ---------- */
  const detailHead = (artHTML, title, sub, meta, extra) =>
    `<div class="empty" style="padding:18px 20px 12px;gap:10px">
      ${artHTML}
      <h3>${U.esc(title)}</h3>
      ${sub ? `<p>${U.esc(sub)}</p>` : ''}
      <p class="plate" style="color:var(--lcd-2)">${meta}</p>
      ${extra || ''}
    </div>`;

  const playButtons = `<div style="display:flex;gap:6px;margin-top:2px">
      <button class="btn" data-act="play-list">${ic('play')}Reproducir</button>
      <button class="btn btn--ghost" data-act="shuffle-list">${ic('shuffle')}Aleatorio</button>
    </div>`;

  function openAlbum(key) {
    const a = albums.find((x) => x.key === key);
    if (!a) return;
    detail = { kind: 'album', key, title: a.name };
    const head = detailHead(
      `<img class="tile__art" style="width:160px;height:160px" src="${art(a.tracks[0])}" alt="">`,
      a.name, a.artist + (a.year ? ' · ' + a.year : ''), summary(a.tracks), playButtons);
    showDetail(head + listHTML(a.tracks), a.tracks, a.name);
  }

  function openArtist(key) {
    const r = artists.find((x) => x.key === key);
    if (!r) return;
    detail = { kind: 'artist', key, title: r.name };
    const rAlbums = albums.filter((a) => r.albums.has(a.key));
    const head = detailHead(
      `<img class="tile__art" style="width:132px;height:132px;border-radius:50%" src="${art(r.tracks[0])}" alt="">`,
      r.name, '', `${rAlbums.length} ${rAlbums.length === 1 ? 'álbum' : 'álbumes'} · ${summary(r.tracks)}`, playButtons);
    const grid = rAlbums.length > 1
      ? `<div class="sectionhead"><span class="plate">Álbumes</span></div><div class="grid">${rAlbums.map(albumTile).join('')}</div>` : '';
    showDetail(head + grid + `<div class="sectionhead"><span class="plate">Todas las canciones</span></div>` + listHTML(r.tracks), r.tracks, r.name);
  }

  function openCollection(id) {
    let list, title, isUser = false;
    const auto = autoLists().find((a) => a.id === id);
    if (auto) { list = auto.list; title = auto.name; }
    else {
      const p = playlists.find((x) => x.id === id);
      if (!p) return;
      list = p.trackIds.map(getTrack).filter(Boolean);
      title = p.name;
      isUser = true;
    }
    detail = { kind: isUser ? 'playlist' : 'auto', key: id, title, list };
    const extra = (list.length ? playButtons : '') +
      (isUser ? `<button class="btn btn--alert" style="margin-top:6px" data-act="del-playlist">${ic('trash')}Eliminar lista</button>` : '');
    const head = detailHead('', title, '', list.length ? summary(list) : 'Lista vacía', extra);
    const body = list.length ? listHTML(list)
      : `<p style="text-align:center;color:var(--lcd-3);font-size:12px;padding:0 30px 26px">Usa el menú de cualquier canción para añadirla aquí.</p>`;
    showDetail(head + body, list, title);
  }

  function showDetail(html, list, crumb) {
    el.vDetalle.innerHTML = html;
    el.vDetalle._list = list;
    setView('detalle', crumb);
    el.scroll.scrollTop = 0;
  }

  /* ------------------------------------------------------------
     Navegacion
     ------------------------------------------------------------ */
  const CRUMB = { biblioteca: 'Biblioteca', buscar: 'Buscar', listas: 'Listas', ajustes: 'Opciones' };

  function setView(v, crumb) {
    view = v;
    $$('.view').forEach((s) => s.classList.toggle('on', s.dataset.view === v));
    el.seg.hidden = v !== 'biblioteca';
    el.searchbar.hidden = v !== 'buscar';
    el.back.hidden = v !== 'detalle';
    el.crumb.textContent = crumb || CRUMB[v] || '';
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === v)));
    el.topActions.hidden = v === 'ajustes' || v === 'detalle';
  }

  function goTab(v) {
    detail = null;
    setView(v);
    el.scroll.scrollTop = 0;
    if (v === 'biblioteca') renderLibrary();
    if (v === 'buscar') { renderSearch(); setTimeout(() => el.q.focus(), 200); }
    if (v === 'listas') renderPlaylists();
    if (v === 'ajustes') renderSettings();
  }

  function refresh() {
    regroup();
    if (view === 'biblioteca') renderLibrary();
    else if (view === 'buscar') renderSearch();
    else if (view === 'listas') renderPlaylists();
    else if (view === 'ajustes') renderSettings();
    else if (view === 'detalle' && detail) {
      if (detail.kind === 'album') openAlbum(detail.key);
      else if (detail.kind === 'artist') openArtist(detail.key);
      else openCollection(detail.key);
    }
    updateNow();
  }

  /* ------------------------------------------------------------
     Avisos y hojas inferiores
     ------------------------------------------------------------ */
  let toastT;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove('on'), 2600);
  }

  const sheet = {
    open({ title, sub, body, foot }, onMount) {
      el.sheet.innerHTML =
        `<div class="sheet__head"><h3>${title}</h3><p></p></div>` +
        (sub ? `<div class="sheet__sub">${sub}</div>` : '') +
        (body ? `<div class="sheet__body">${body}</div>` : '') +
        (foot ? `<div class="sheet__foot">${foot}</div>` : '');
      el.sheet.classList.add('on');
      el.scrim.classList.add('on');
      if (onMount) onMount(el.sheet);
    },
    close() {
      el.sheet.classList.remove('on');
      el.scrim.classList.remove('on');
    },
    get isOpen() { return el.sheet.classList.contains('on'); },
  };

  function confirmSheet(title, text, label, danger, run) {
    sheet.open({
      title, sub: text,
      foot: `<button class="btn btn--ghost" style="flex:1" data-sheet="cancel">Cancelar</button>
             <button class="btn ${danger ? 'btn--alert' : ''}" style="flex:1" data-sheet="ok">${label}</button>`,
    }, (root) => {
      $('[data-sheet="cancel"]', root).onclick = sheet.close;
      $('[data-sheet="ok"]', root).onclick = () => { sheet.close(); run(); };
    });
  }

  /* ---------- menu de una pista ---------- */
  function trackMenu(t) {
    const a = albumOf(t), r = artistOf(t);
    sheet.open({
      title: 'Canción',
      sub: `${U.esc(t.title)} — ${U.esc(t.artist)} · ${U.time(t.duration)}`,
      body:
        `<button class="sheet__act" data-m="fav">${ic(t.favorite ? 'heart_on' : 'heart')}${t.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}</button>
         <button class="sheet__act" data-m="next">${ic('next')}Reproducir a continuación</button>
         <button class="sheet__act" data-m="queue">${ic('queue')}Añadir a la cola</button>
         <button class="sheet__act" data-m="playlist">${ic('stack')}Añadir a una lista</button>
         ${a ? `<button class="sheet__act" data-m="album">${ic('disc')}Ir al álbum<span class="plate">${U.esc(a.name)}</span></button>` : ''}
         ${r ? `<button class="sheet__act" data-m="artist">${ic('mic')}Ir al artista<span class="plate">${U.esc(r.name)}</span></button>` : ''}
         <button class="sheet__act danger" data-m="del">${ic('trash')}Eliminar del teléfono</button>`,
    }, (root) => {
      const act = {
        fav: () => { toggleFav(t); sheet.close(); },
        next: () => { P.playNext(t); sheet.close(); toast('Suena a continuación'); },
        queue: () => { P.enqueue(t); sheet.close(); toast('Añadida a la cola'); },
        playlist: () => playlistPicker(t),
        album: () => { sheet.close(); const x = albumOf(t); if (x) openAlbum(x.key); },
        artist: () => { sheet.close(); const x = artistOf(t); if (x) openArtist(x.key); },
        del: () => {
          sheet.close();
          confirmSheet('Eliminar', `«${U.esc(t.title)}» se borrará del almacenamiento del teléfono.`, 'Eliminar', true,
            () => removeTracks([t.id]));
        },
      };
      $$('[data-m]', root).forEach((b) => { b.onclick = act[b.dataset.m]; });
    });
  }

  function playlistPicker(t) {
    sheet.open({
      title: 'Añadir a lista',
      sub: U.esc(t.title),
      body: `<button class="sheet__act" data-p="@new">Crear una lista nueva</button>` +
        playlists.map((p) => `<button class="sheet__act" data-p="${U.esc(p.id)}">${ic('stack')}${U.esc(p.name)}
          <span class="plate">${p.trackIds.includes(t.id) ? 'ya está' : p.trackIds.length}</span></button>`).join(''),
    }, (root) => {
      $$('[data-p]', root).forEach((b) => {
        b.onclick = () => {
          if (b.dataset.p === '@new') return newPlaylist(t);
          addToPlaylist(b.dataset.p, t);
          sheet.close();
        };
      });
    });
  }

  function newPlaylist(addTrack) {
    sheet.open({
      title: 'Nueva lista',
      sub: 'Ponle un nombre que reconozcas después.',
      body: `<div style="padding:10px"><input class="field" id="pl-name" placeholder="Para correr..." maxlength="60"></div>`,
      foot: `<button class="btn btn--ghost" style="flex:1" data-sheet="cancel">Cancelar</button>
             <button class="btn" style="flex:1" data-sheet="ok">Crear</button>`,
    }, (root) => {
      const input = $('#pl-name', root);
      setTimeout(() => input.focus(), 160);
      const create = async () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const p = { id: 'pl-' + Date.now().toString(36), name, trackIds: addTrack ? [addTrack.id] : [], createdAt: Date.now() };
        playlists.push(p);
        await Axioma.db.put('playlists', p);
        sheet.close();
        toast(addTrack ? `Creada «${name}» con 1 canción` : `Lista «${name}» creada`);
        if (view === 'listas') renderPlaylists();
      };
      $('[data-sheet="cancel"]', root).onclick = sheet.close;
      $('[data-sheet="ok"]', root).onclick = create;
      input.onkeydown = (e) => { if (e.key === 'Enter') create(); };
    });
  }

  async function addToPlaylist(id, t) {
    const p = playlists.find((x) => x.id === id);
    if (!p) return;
    if (p.trackIds.includes(t.id)) { toast(`Ya estaba en «${p.name}»`); return; }
    p.trackIds.push(t.id);
    await Axioma.db.put('playlists', p);
    toast(`Añadida a «${p.name}»`);
    if (view === 'listas') renderPlaylists();
  }

  /* ---------- ecualizador grafico de diez bandas ---------- */
  function eqSheet() {
    const bandHTML = (label, value, attr) => `<div class="eq__band${attr === 'pre' ? ' eq__band--pre' : ''}">
        <span class="eq__val" data-val="${attr}">${value > 0 ? '+' : ''}${value}</span>
        <span class="eq__slot"><input type="range" min="-12" max="12" step="1" value="${value}"
          data-band="${attr}" aria-label="${attr === 'pre' ? 'Preamplificador' : 'Banda de ' + label}"></span>
        <span class="eq__lab">${label}</span>
      </div>`;

    sheet.open({
      title: 'Ecualizador',
      body: `<div class="eqwrap">
        <div class="chips">${Object.keys(P.PRESETS).map((k) => `<button class="chip" data-preset="${k}">${k}</button>`).join('')}</div>
        <div class="eq">
          <div class="eq__scale"><span>+12</span><span>0</span><span>-12</span></div>
          ${bandHTML('PRE', P.preamp, 'pre')}
          ${P.eq.map((v, i) => bandHTML(P.EQ_LABELS[i], v, String(i))).join('')}
        </div>
      </div>`,
    }, (root) => {
      const paint = () => {
        const cur = P.eq, pre = P.preamp;
        $$('[data-val]', root).forEach((s) => {
          const k = s.dataset.val;
          const v = k === 'pre' ? pre : cur[+k];
          s.textContent = (v > 0 ? '+' : '') + v;
        });
        $$('[data-preset]', root).forEach((c) => {
          const p = P.PRESETS[c.dataset.preset];
          c.setAttribute('aria-pressed', String(p.every((v, i) => v === cur[i])));
        });
      };
      $$('[data-band]', root).forEach((s) => {
        s.oninput = () => {
          const k = s.dataset.band;
          if (k === 'pre') P.setPreamp(+s.value); else P.setEq(+k, +s.value);
          paint();
        };
      });
      $$('[data-preset]', root).forEach((c) => {
        c.onclick = () => {
          P.setEqAll(P.PRESETS[c.dataset.preset]);
          $$('[data-band]', root).forEach((s) => {
            if (s.dataset.band !== 'pre') s.value = P.eq[+s.dataset.band];
          });
          paint();
        };
      });
      paint();
    });
  }

  function sleepSheet() {
    const left = P.sleepLeft();
    sheet.open({
      title: 'Temporizador',
      sub: left ? `Quedan ${Math.ceil(left / 60000)} minutos.` : 'La música baja de volumen y se pausa sola.',
      body: [0, 10, 20, 30, 45, 60, 90].map((m) =>
        `<button class="sheet__act" data-min="${m}">${ic('timer')}${m ? m + ' minutos' : 'Desactivar'}</button>`).join(''),
    }, (root) => {
      $$('[data-min]', root).forEach((b) => {
        b.onclick = () => {
          const m = +b.dataset.min;
          P.setSleep(m);
          sheet.close();
          toast(m ? `Se apagará en ${m} minutos` : 'Temporizador desactivado');
          if (view === 'ajustes') renderSettings();
        };
      });
    });
  }

  function queueSheet() {
    const q = P.queue;
    if (!q.length) { toast('La cola está vacía'); return; }
    sheet.open({
      title: 'A continuación',
      sub: `${q.length} ${q.length === 1 ? 'canción' : 'canciones'} en cola`,
      body: q.map((t, i) => `<button class="sheet__act" data-q="${i}" style="${i === P.index ? 'color:var(--lcd)' : ''}">
          <img class="row__art" style="width:30px;height:30px" src="${art(t)}" alt="">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(t.title)}</span>
          ${i === P.index ? '<span class="plate">Suena</span>' : `<span class="row__d">${U.time(t.duration)}</span>`}
        </button>`).join(''),
    }, (root) => {
      $$('[data-q]', root).forEach((b) => {
        b.onclick = () => { P.jump(+b.dataset.q); sheet.close(); };
      });
      const cur = $(`[data-q="${P.index}"]`, root);
      if (cur) cur.scrollIntoView({ block: 'center' });
    });
  }

  /* ------------------------------------------------------------
     Acciones sobre la biblioteca
     ------------------------------------------------------------ */
  async function toggleFav(t) {
    t.favorite = t.favorite ? 0 : 1;
    await Axioma.db.put('tracks', t);
    toast(t.favorite ? 'Añadida a favoritas' : 'Quitada de favoritas');
    updateNow();
    if (view === 'listas' || (view === 'detalle' && detail && detail.key === '@fav')) refresh();
  }

  async function removeTracks(ids) {
    P.dropTracks(ids);
    for (const id of ids) { await Axioma.db.del('tracks', id); dropThumb(id); }
    const set = new Set(ids);
    tracks = tracks.filter((t) => !set.has(t.id));
    for (const p of playlists) {
      const n = p.trackIds.filter((x) => !set.has(x));
      if (n.length !== p.trackIds.length) { p.trackIds = n; await Axioma.db.put('playlists', p); }
    }
    const done = `${ids.length} ${ids.length === 1 ? 'canción eliminada' : 'canciones eliminadas'}`;
    if (view === 'detalle' && detail && (detail.kind === 'album' || detail.kind === 'artist')) {
      regroup();
      const still = detail.kind === 'album'
        ? albums.some((a) => a.key === detail.key) : artists.some((a) => a.key === detail.key);
      if (!still) { goTab('biblioteca'); toast(done); return; }
    }
    refresh();
    toast(done);
  }

  async function deletePlaylist(id) {
    playlists = playlists.filter((p) => p.id !== id);
    await Axioma.db.del('playlists', id);
    goTab('listas');
    toast('Lista eliminada');
  }

  /* ------------------------------------------------------------
     Importacion de archivos
     ------------------------------------------------------------ */
  /* WMA queda fuera a propósito: Chrome en Android no lo decodifica,
     así que importarlo solo dejaría pistas mudas en la biblioteca. */
  const AUDIO_RE = /\.(mp3|m4a|m4b|aac|flac|ogg|oga|opus|wav|wave|aiff?)$/i;
  let importing = false;

  async function importFiles(fileList) {
    if (importing) { toast('Ya hay una importación en curso'); return; }
    const all = Array.from(fileList);
    const files = all.filter((f) => (f.type && f.type.startsWith('audio/')) || AUDIO_RE.test(f.name));
    if (!files.length) {
      /* Decimos qué llegó: ayuda cuando el explorador entrega nombres raros. */
      toast(all.length ? `Sin audio reconocible. Llegó «${all[0].name}»` : 'No seleccionaste nada');
      return;
    }

    importing = true;
    el.prog.hidden = false;
    let added = 0, dupes = 0, failed = 0;
    let batch = [];

    const flush = async () => {
      if (!batch.length) return;
      await Axioma.db.putMany('tracks', batch);
      tracks.push(...batch);
      batch = [];
      refresh();
    };

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      el.progN.textContent = `${i + 1} / ${files.length}`;
      el.progF.textContent = f.name;
      el.progFill.style.width = `${(i / files.length) * 100}%`;
      await new Promise((r) => setTimeout(r, 0));

      const id = 'f' + U.hash(`${f.name}|${f.size}|${f.lastModified || 0}`);
      if (byId.has(id) || batch.some((b) => b.id === id)) { dupes++; continue; }

      try {
        const tag = await Axioma.tags.read(f);
        const dur = await Axioma.duration(f);
        let thumb = null, color = Axioma.art.DEFAULT;
        if (tag.cover) {
          const p = await Axioma.art.process(tag.cover);
          thumb = p.thumb; color = p.color;
        }
        batch.push({
          id, title: tag.title, artist: tag.artist,
          albumArtist: tag.albumArtist || tag.artist, album: tag.album,
          genre: tag.genre || '', year: tag.year || 0,
          trackNo: tag.trackNo || 0, discNo: tag.discNo || 1,
          duration: dur, size: f.size, mime: f.type || '',
          sampleRate: tag.sampleRate || 0, channels: tag.channels || 0,
          fileName: f.name, blob: f, cover: tag.cover || null, thumb, color,
          addedAt: Date.now() + i, playCount: 0, lastPlayedAt: 0, favorite: 0,
        });
        added++;
        if (batch.length >= 6) await flush();
      } catch (e) {
        console.warn('No se pudo importar', f.name, e);
        failed++;
        if (e && (e.name === 'QuotaExceededError' || e.name === 'NotAllowedError')) {
          await flush();
          el.prog.hidden = true;
          importing = false;
          toast('El teléfono se quedó sin espacio. Libera almacenamiento.');
          return;
        }
      }
    }

    try { await flush(); }
    catch (e) {
      el.prog.hidden = true; importing = false;
      toast('No se pudo guardar. Puede que falte espacio en el teléfono.');
      return;
    }

    el.progFill.style.width = '100%';
    el.prog.hidden = true;
    importing = false;
    const bits = [`${added} ${added === 1 ? 'añadida' : 'añadidas'}`];
    if (dupes) bits.push(`${dupes} ya estaban`);
    if (failed) bits.push(`${failed} con error`);
    toast(bits.join(' · '));
    if (added) askPersist();
  }

  let askedPersist = false;
  async function askPersist() {
    if (askedPersist || !navigator.storage || !navigator.storage.persist) return;
    askedPersist = true;
    try {
      if (await navigator.storage.persisted()) return;
      await navigator.storage.persist();
    } catch (e) { /* el navegador lo decide */ }
  }

  /* ------------------------------------------------------------
     Ventana de reproduccion
     ------------------------------------------------------------ */
  let npOpen = false;
  let rafId = 0;
  let scrubbing = false;

  function openNP() {
    if (!P.current) return;
    npOpen = true;
    el.np.classList.add('on');
    drawLoop();
  }
  function closeNP() {
    npOpen = false;
    el.np.classList.remove('on');
    drawLoop();
  }

  /* La marquesina solo rueda si el texto no cabe, como en el original. */
  function marquee(box, span, text) {
    span.textContent = text;
    box.classList.remove('roll');
    requestAnimationFrame(() => {
      const over = span.scrollWidth - box.clientWidth;
      if (over > 4) {
        box.style.setProperty('--roll', `-${over + 12}px`);
        box.classList.add('roll');
      }
    });
  }

  function updateNow() {
    const t = P.current;
    el.mini.hidden = !t;
    if (!t) { if (npOpen) closeNP(); return; }
    const cover = P.coverUrl || art(t);
    const pos = P.index >= 0 ? P.index + 1 : 1;

    el.npArt.src = cover;
    /* Formato clasico de la pantalla: «3. Artista - Título (3:35)» */
    const line = `${pos}. ${t.artist} - ${t.title} (${U.time(t.duration)})`;
    marquee(el.miniMarq, el.miniT, line);
    marquee(el.npMarq, el.npT, line);
    el.npCrumb.textContent = t.album && t.album !== 'Sin álbum' ? t.album : 'Axioma';

    el.fav.classList.toggle('on', !!t.favorite);
    el.fav.innerHTML = ic(t.favorite ? 'heart_on' : 'heart');
    el.fav.setAttribute('aria-label', t.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas');

    /* Ficha tecnica real, leida de la cabecera del archivo. */
    const kbps = t.duration > 0 ? Math.round((t.size * 8) / t.duration / 1000) : 0;
    el.npKbps.textContent = kbps || '--';
    el.npKhz.textContent = t.sampleRate ? Math.round(t.sampleRate / 100) / 10 : '--';
    el.npCh.textContent = t.channels === 1 ? 'mono' : t.channels === 2 ? 'stereo' : '';
    el.npCh.className = t.channels ? '' : 'off';
    el.npFmt.textContent = (t.fileName.split('.').pop() || '').toUpperCase();

    document.title = `${t.title} · ${t.artist} — Axioma`;
    paintPlaying();
  }

  function paintPlaying() {
    const on = P.playing;
    el.miniBtn.innerHTML = ic(on ? 'pause' : 'play');
    el.miniBtn.setAttribute('aria-label', on ? 'Pausar' : 'Reproducir');
    const state = ic(on ? 'play' : 'pause');
    el.miniState.innerHTML = state;
    el.npState.innerHTML = state;
    el.play.disabled = on;
    el.pause.disabled = !on;

    const id = P.current ? P.current.id : null;
    $$('.row').forEach((r) => {
      const is = r.dataset.id === id;
      if (r.classList.contains('playing') === is) return;
      r.classList.toggle('playing', is);
      const slot = $('.row__d', r) || $('.row__eq', r);
      if (!slot) return;
      const t = getTrack(r.dataset.id);
      slot.outerHTML = is ? '<span class="row__eq"><i></i><i></i><i></i></span>'
        : `<span class="row__d">${U.time(t ? t.duration : 0)}</span>`;
    });
    drawLoop();
  }

  function paintTime(t, d) {
    if (scrubbing) return;
    const pct = d > 0 ? (t / d) * 100 : 0;
    for (const s of scrubs) {
      s.fill.style.width = pct + '%';
      s.knob.style.left = pct + '%';
      s.box.setAttribute('aria-valuenow', Math.round(pct));
    }
    const clock = U.time(t).padStart(5, '0');
    el.miniTime.textContent = clock;
    el.npTime.textContent = clock;
    el.elapsed.textContent = U.time(t);
    el.remain.textContent = '-' + U.time(Math.max(0, (d || 0) - t));
  }

  function paintFlags() {
    const f = P.flags();
    el.shuffle.classList.toggle('on', f.shuffle);
    el.shuffle.setAttribute('aria-pressed', String(f.shuffle));
    el.repeat.classList.toggle('on', f.repeat !== 'off');
    el.repeatLbl.textContent = f.repeat === 'one' ? 'Repeat 1' : 'Repeat';
    el.repeat.setAttribute('aria-label',
      { off: 'Repetición desactivada', all: 'Repetir toda la cola', one: 'Repetir esta canción' }[f.repeat]);
    drawLoop();
  }

  /* ------------------------------------------------------------
     Analizador de espectro. Dibuja en las dos pantallas visibles.
     Sin modo estudio no hay datos, y entonces no dibuja nada:
     la barra queda apagada en lugar de inventar niveles.
     ------------------------------------------------------------ */
  const BARS = 19;
  const peaks = new Float32Array(BARS);

  function visTargets() {
    if (!P.studio) return [];
    const out = [];
    if (!el.mini.hidden) out.push(el.miniVis);
    if (npOpen) out.push(el.npVis);
    return out;
  }

  /* Sin modo estudio no hay señal que medir: se apaga el analizador y
     queda un botón para encenderlo, en vez de un hueco muerto. */
  function paintVis() {
    el.miniVis.hidden = !P.studio;
    el.npVis.hidden = !P.studio;
    el.visOff.hidden = P.studio;
  }

  function drawLoop() {
    cancelAnimationFrame(rafId);
    paintVis();
    if (!P.studio || !P.current) { [el.miniVis, el.npVis].forEach(clearVis); return; }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const step = () => {
      rafId = requestAnimationFrame(step);
      const data = P.levels();
      const targets = visTargets();
      if (!targets.length) { cancelAnimationFrame(rafId); return; }

      let loud = 0;
      for (let i = 0; i < BARS; i++) {
        let v = 0;
        if (data) {
          /* Escala perceptual: mas resolucion en graves que en agudos. */
          const idx = Math.floor(Math.pow(i / BARS, 1.7) * (data.length - 1));
          v = data[idx] / 255;
        }
        peaks[i] = Math.max(v, peaks[i] - 0.02);
        loud = Math.max(loud, v);
        bars[i] = v;
      }

      for (const cv of targets) {
        const w = cv.clientWidth, h = cv.clientHeight;
        if (!w || !h) continue;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const g = cv.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const bw = w / BARS;
        for (let i = 0; i < BARS; i++) {
          const bh = Math.max(1, bars[i] * h);
          /* Degradado clasico: verde abajo, ambar y naranja arriba. */
          const grd = g.createLinearGradient(0, h, 0, 0);
          grd.addColorStop(0, '#00d000');
          grd.addColorStop(0.55, '#c8e000');
          grd.addColorStop(1, '#ff7a00');
          g.fillStyle = grd;
          g.fillRect(Math.floor(i * bw), h - bh, Math.max(1, bw - 1), bh);
          const py = h - Math.max(1, peaks[i] * h) - 1;
          g.fillStyle = '#c6c6de';
          g.fillRect(Math.floor(i * bw), Math.max(0, py), Math.max(1, bw - 1), 1);
        }
      }
      if (!P.playing && loud < 0.01 && peaks.every((p) => p < 0.02)) {
        cancelAnimationFrame(rafId);
        targets.forEach(clearVis);
      }
    };
    step();
  }
  const bars = new Float32Array(BARS);

  function clearVis(cv) {
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
  }

  /* ------------------------------------------------------------
     Correderas de posicion (la del reproductor y la de la ventana)
     ------------------------------------------------------------ */
  const scrubs = [];
  function bindScrub(box, fill, knob) {
    scrubs.push({ box, fill, knob });
    const ratio = (e) => {
      const r = box.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    const preview = (k) => {
      const d = P.audio.duration || 0;
      for (const s of scrubs) { s.fill.style.width = k * 100 + '%'; s.knob.style.left = k * 100 + '%'; }
      el.elapsed.textContent = U.time(k * d);
      el.remain.textContent = '-' + U.time(Math.max(0, d - k * d));
      el.miniTime.textContent = el.npTime.textContent = U.time(k * d).padStart(5, '0');
    };
    box.addEventListener('pointerdown', (e) => {
      if (!P.current) return;
      scrubbing = true;
      box.setPointerCapture(e.pointerId);
      preview(ratio(e));
    });
    box.addEventListener('pointermove', (e) => { if (scrubbing) preview(ratio(e)); });
    box.addEventListener('pointerup', (e) => {
      if (!scrubbing) return;
      scrubbing = false;
      P.seek(ratio(e) * (P.audio.duration || 0));
    });
    box.addEventListener('pointercancel', () => { scrubbing = false; });
  }

  /* Deslizar hacia abajo cierra la ventana de reproduccion. */
  function bindSwipe() {
    let y0 = null, dy = 0;
    el.np.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest('.seek, .np__transport, .np__tools, .np__body')) return;
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    el.np.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      el.np.style.transition = 'none';
      el.np.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    el.np.addEventListener('touchend', () => {
      if (y0 == null) return;
      el.np.style.transition = '';
      el.np.style.transform = '';
      if (dy > 90) closeNP();
      y0 = null;
    });
  }

  /* ------------------------------------------------------------
     Delegacion de eventos
     ------------------------------------------------------------ */
  const currentList = (node) => {
    const box = node.closest('.view');
    return (box && box._list) || tracks;
  };

  function bind() {
    el.scroll.addEventListener('click', (e) => {
      const menu = e.target.closest('[data-menu]');
      if (menu) { e.stopPropagation(); const t = getTrack(menu.dataset.menu); if (t) trackMenu(t); return; }

      const row = e.target.closest('.row');
      if (row) {
        if (P.current && P.current.id === row.dataset.id) { openNP(); return; }
        P.setQueue(currentList(row), +row.dataset.i, true);
        return;
      }
      const alb = e.target.closest('[data-album]');
      if (alb) return openAlbum(alb.dataset.album);
      const arti = e.target.closest('[data-artist]');
      if (arti) return openArtist(arti.dataset.artist);
      const auto = e.target.closest('[data-auto]');
      if (auto) return openCollection(auto.dataset.auto);
      const pl = e.target.closest('[data-playlist]');
      if (pl) return openCollection(pl.dataset.playlist);
      const act = e.target.closest('[data-act]');
      if (act) return doAction(act.dataset.act);
    });

    $$('.tab').forEach((b) => { b.onclick = () => goTab(b.dataset.tab); });
    $$('#seg button').forEach((b) => {
      b.onclick = () => {
        libTab = b.dataset.lib;
        $$('#seg button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        renderLibrary();
        el.scroll.scrollTop = 0;
      };
    });
    el.back.onclick = () => goTab(detail && detail.kind === 'playlist' ? 'listas' : 'biblioteca');
    el.importBtn.onclick = () => el.file.click();
    el.shuffleAll.onclick = () => {
      if (!tracks.length) { toast('Importa música primero'); return; }
      P.setShuffle(true);
      P.setQueue(U.shuffled(tracks), 0, true);
      toast('Sonando en aleatorio');
    };
    el.file.onchange = () => { const f = el.file.files; el.file.value = ''; importFiles(f); };
    el.folder.onchange = () => { const f = el.folder.files; el.folder.value = ''; importFiles(f); };
    el.q.addEventListener('input', U.debounce(renderSearch, 140));

    /* Reproductor compacto */
    el.lcdStrip.onclick = openNP;
    el.lcdStrip.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNP(); } };
    el.miniBtn.onclick = () => P.toggle();
    el.miniPrev.onclick = () => P.prev();
    el.miniNext.onclick = () => P.next(false);

    /* Transporte clasico de la ventana */
    el.play.onclick = () => P.play();
    el.pause.onclick = () => P.pause();
    el.stop.onclick = () => { P.pause(); P.seek(0); };
    el.nextBtn.onclick = () => P.next(false);
    el.prevBtn.onclick = () => P.prev();
    el.eject.onclick = () => el.file.click();
    el.shuffle.onclick = () => P.setShuffle(!P.flags().shuffle);
    el.repeat.onclick = () => P.cycleRepeat();
    el.npDown.onclick = closeNP;
    el.fav.onclick = () => { if (P.current) toggleFav(P.current); };
    el.eqBtn.onclick = () => {
      if (!P.studio) { toast('Activa el modo estudio en Opciones'); return; }
      eqSheet();
    };
    el.timerBtn.onclick = sleepSheet;
    el.queueBtn.onclick = queueSheet;
    el.visOff.onclick = () => doAction('studio');
    el.npMore.onclick = () => { if (P.current) trackMenu(P.current); };
    el.scrim.onclick = sheet.close;

    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); P.toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) P.next(false);
      else if (e.key === 'ArrowLeft' && e.shiftKey) P.prev();
      else if (e.key === 'Escape') { if (sheet.isOpen) sheet.close(); else if (npOpen) closeNP(); }
    });

    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    });
  }

  async function doAction(name) {
    switch (name) {
      case 'import': el.file.click(); break;
      case 'import-folder': el.folder.click(); break;
      case 'new-playlist': newPlaylist(null); break;
      case 'play-list': {
        const list = el.vDetalle._list || [];
        if (!list.length) return;
        P.setShuffle(false);
        P.setQueue(list, 0, true);
        break;
      }
      case 'shuffle-list': {
        const list = el.vDetalle._list || [];
        if (!list.length) return;
        P.setShuffle(true);
        P.setQueue(U.shuffled(list), 0, true);
        break;
      }
      case 'del-playlist':
        confirmSheet('Eliminar lista', `«${U.esc(detail.title)}» desaparecerá. Las canciones se quedan en la biblioteca.`,
          'Eliminar', true, () => deletePlaylist(detail.key));
        break;
      case 'studio': {
        const now = !P.studio;
        const ok = P.setStudio(now);
        if (now && !ok) toast('Tu navegador no permite procesar el audio');
        else toast(now ? 'Modo estudio activado' : 'Modo estudio desactivado');
        Axioma.db.setting.set('studio', P.studio);
        drawLoop();
        renderSettings();
        break;
      }
      case 'eq': if (P.studio) eqSheet(); break;
      case 'sleep': sleepSheet(); break;
      case 'skin': {
        const dia = document.documentElement.getAttribute('data-skin') !== 'dia';
        document.documentElement.setAttribute('data-skin', dia ? 'dia' : 'noche');
        Axioma.db.setting.set('skin', dia ? 'dia' : 'noche');
        const meta = $('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', dia ? '#a8a8c0' : '#14142a');
        renderSettings();
        break;
      }
      case 'persist':
        try {
          const ok = await navigator.storage.persist();
          toast(ok ? 'Biblioteca protegida' : 'El sistema no concedió la protección');
        } catch (e) { toast('Tu navegador no ofrece esta opción'); }
        renderSettings();
        break;
      case 'drop-demo':
        confirmSheet('Quitar demostración', 'Son las cuatro pistas de ejemplo que trae la app. Tu música importada no se toca.',
          'Quitar', false, () => removeTracks(tracks.filter((t) => t.demo).map((t) => t.id)));
        break;
      case 'wipe':
        confirmSheet('Borrar biblioteca', `Se eliminarán las ${tracks.length} pistas guardadas y todas tus listas. Los archivos originales de tu computadora no se tocan.`,
          'Borrar todo', true, wipe);
        break;
      case 'update': {
        /* Vaciamos la caché de la app y recargamos. IndexedDB, donde vive
           la música, no se toca: solo se tira lo descargado del servidor. */
        toast('Buscando actualización...');
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.update().catch(() => {})));
          }
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch (e) { /* recargar suele bastar igualmente */ }
        location.reload();
        break;
      }
      case 'install':
        if (!installPrompt) return;
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch (e) {}
        installPrompt = null;
        renderSettings();
        break;
    }
  }

  async function wipe() {
    P.pause();
    P.dropTracks(tracks.map((t) => t.id));
    await Axioma.db.clear('tracks');
    await Axioma.db.clear('playlists');
    await Axioma.db.setting.set('resume', null);
    tracks.forEach((t) => dropThumb(t.id));
    tracks = [];
    playlists = [];
    await Axioma.db.setting.set('demoLoaded', 1);
    goTab('biblioteca');
    refresh();
    toast('Biblioteca vacía');
  }

  /* ------------------------------------------------------------
     Instalacion como aplicacion
     ------------------------------------------------------------ */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (view === 'ajustes') renderSettings();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast('Axioma quedó instalada'); });

  /* ------------------------------------------------------------
     Arranque
     ------------------------------------------------------------ */
  async function boot() {
    Object.assign(el, {
      scroll: $('#scroll'), seg: $('#seg'), searchbar: $('#searchbar'), q: $('#q'),
      crumb: $('#crumb'), back: $('#back'), importBtn: $('#import'), shuffleAll: $('#shuffle-all'),
      topActions: $('#top-actions'), file: $('#file'), folder: $('#folder'),
      vBiblioteca: $('[data-view="biblioteca"]'), vBuscar: $('[data-view="buscar"]'),
      vListas: $('[data-view="listas"]'), vAjustes: $('[data-view="ajustes"]'), vDetalle: $('[data-view="detalle"]'),

      mini: $('#mini'), lcdStrip: $('#lcd-strip'), miniState: $('#mini-state'), miniTime: $('#mini-time'),
      miniVis: $('#vis-mini'), miniMarq: $('#mini-marq'), miniT: $('#mini-t'),
      miniBtn: $('#mini-btn'), miniPrev: $('#mini-prev'), miniNext: $('#mini-next'),

      np: $('#np'), npArt: $('#np-art'), npCrumb: $('#np-crumb'), npDown: $('#np-down'), npMore: $('#np-more'),
      npState: $('#np-state'), npTime: $('#np-time'), npVis: $('#vis-np'), npMarq: $('#np-marq'), npT: $('#np-t'),
      visOff: $('#vis-off'),
      npKbps: $('#np-kbps'), npKhz: $('#np-khz'), npCh: $('#np-ch'), npFmt: $('#np-fmt'),
      elapsed: $('#elapsed'), remain: $('#remain'),
      play: $('#play'), pause: $('#pause'), stop: $('#stop'), nextBtn: $('#next'), prevBtn: $('#prev'), eject: $('#eject'),
      shuffle: $('#shuffle'), repeat: $('#repeat'), repeatLbl: $('#repeat-lbl'),
      fav: $('#fav'), eqBtn: $('#eq'), timerBtn: $('#timer'), queueBtn: $('#queue-btn'),

      sheet: $('#sheet'), scrim: $('#scrim'), toast: $('#toast'),
      prog: $('#prog'), progN: $('#prog-n'), progF: $('#prog-f'), progFill: $('#prog-fill'),
    });

    $$('[data-icon]').forEach((n) => { n.innerHTML = ic(n.dataset.icon); });

    bind();
    bindScrub($('#np-seek'), $('#fill'), $('#knob'));
    bindScrub($('#mini-seek'), $('#mini-fill'), $('#mini-knob'));
    bindSwipe();

    const skin = await Axioma.db.setting.get('skin', 'noche');
    document.documentElement.setAttribute('data-skin', skin);

    tracks = await Axioma.db.all('tracks');
    playlists = await Axioma.db.all('playlists');
    playlists.sort((a, b) => a.createdAt - b.createdAt);

    /* Primera vez: sintetizamos cuatro pistas para que la app no
       arranque vacia. Se pueden quitar desde Opciones. */
    const seeded = await Axioma.db.setting.get('demoLoaded', 0);
    if (!tracks.length && !seeded) {
      try {
        const demo = await Axioma.demo.build();
        await Axioma.db.putMany('tracks', demo);
        tracks = demo;
        await Axioma.db.setting.set('demoLoaded', 1);
      } catch (e) { console.warn('No se pudieron crear las pistas de ejemplo', e); }
    }

    regroup();
    if (await Axioma.db.setting.get('studio', false)) P.setStudio(true);

    P.on('track', updateNow);
    P.on('state', paintPlaying);
    P.on('time', (d) => paintTime(d.t, d.d || 0));
    P.on('flags', paintFlags);
    P.on('error', toast);
    P.on('counted', () => { if (view === 'listas') renderPlaylists(); });
    P.on('sleep', () => { if (view === 'ajustes') renderSettings(); });

    await P.restore(getTrack);
    paintFlags();
    updateNow();

    goTab('biblioteca');
    const splash = $('#splash');
    if (splash) splash.remove();

    /* Trabajador de servicio: es lo que hace que la app abra sin conexion. */
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      try { await navigator.serviceWorker.register('sw.js'); }
      catch (e) { console.info('Sin modo sin conexión:', e.message); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  Axioma.ui = { toast, refresh, importFiles };
})();
