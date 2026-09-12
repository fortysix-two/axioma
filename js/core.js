/* ============================================================
   AXIOMA · core.js
   Almacenamiento local (IndexedDB), lectura de etiquetas de audio,
   procesado de caratulas y pistas de demostracion sintetizadas.
   Sin dependencias externas. Todo ocurre en el telefono.
   ============================================================ */
window.Axioma = window.Axioma || {};

/* ------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------ */
Axioma.util = (function () {
  const pad = (n) => String(n).padStart(2, '0');

  function time(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function bytes(b) {
    if (!b) return '0 MB';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b < 10 && i > 1 ? b.toFixed(1) : Math.round(b)} ${u[i]}`;
  }

  /* Para buscar: minusculas y sin acentos, de modo que "cancion"
     encuentre "Canción". */
  function fold(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Orden natural: "Pista 2" antes que "Pista 10". */
  const coll = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
  const cmp = (a, b) => coll.compare(a || '', b || '');

  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { time, bytes, fold, esc, cmp, hash, debounce, shuffled };
})();

/* ------------------------------------------------------------
   IndexedDB
   ------------------------------------------------------------ */
Axioma.db = (function () {
  const NAME = 'axioma', VER = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('tracks')) {
          const s = db.createObjectStore('tracks', { keyPath: 'id' });
          s.createIndex('addedAt', 'addedAt');
          s.createIndex('album', 'album');
          s.createIndex('artist', 'artist');
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('La base de datos está en uso en otra pestaña.'));
    });
    return dbp;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('Transacción cancelada'));
    });
  }

  const all = (s) => run(s, 'readonly', (o) => o.getAll());
  const get = (s, k) => run(s, 'readonly', (o) => o.get(k));
  const put = (s, v) => run(s, 'readwrite', (o) => o.put(v));
  const del = (s, k) => run(s, 'readwrite', (o) => o.delete(k));
  const clear = (s) => run(s, 'readwrite', (o) => o.clear());

  async function putMany(store, items) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const it of items) os.put(it);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }

  /* Los ajustes viven en el almacen kv para sobrevivir al cierre. */
  const setting = {
    get: async (k, dflt) => {
      const r = await get('kv', k);
      return r === undefined ? dflt : r.v;
    },
    set: (k, v) => put('kv', { k, v }),
  };

  return { open, all, get, put, del, clear, putMany, setting };
})();

/* ------------------------------------------------------------
   Lectura de etiquetas: ID3v2/ID3v1 (MP3), atomos MP4 (M4A/AAC),
   Vorbis comments (FLAC, OGG, Opus). Todo a mano, sin librerias.
   ------------------------------------------------------------ */
Axioma.tags = (function () {
  const ascii = (buf, off, len) => {
    let s = '';
    const v = new Uint8Array(buf, off, len);
    for (let i = 0; i < len; i++) s += String.fromCharCode(v[i]);
    return s;
  };

  function decode(bytes, enc) {
    try {
      if (enc === 0) return new TextDecoder('iso-8859-1').decode(bytes);
      if (enc === 3) return new TextDecoder('utf-8').decode(bytes);
      /* UTF-16: la BOM decide el orden de bytes. */
      if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
      if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
      return new TextDecoder(enc === 2 ? 'utf-16be' : 'utf-16le').decode(bytes);
    } catch (e) {
      return '';
    }
  }

  const clean = (s) => (s || '').replace(/\u0000+$/g, '').replace(/\s+/g, ' ').trim();

  /* Encuentra el fin de una cadena terminada en nulo (1 o 2 bytes segun codificacion). */
  function endOfString(bytes, start, wide) {
    if (wide) {
      for (let i = start; i + 1 < bytes.length; i += 2) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
      }
      return bytes.length;
    }
    for (let i = start; i < bytes.length; i++) if (bytes[i] === 0) return i;
    return bytes.length;
  }

  function setNum(out, key, raw) {
    const n = parseInt(String(raw).split('/')[0], 10);
    if (!isNaN(n)) out[key] = n;
  }

  /* ---------- ID3v2 ---------- */
  function id3v2(buf) {
    const v = new DataView(buf);
    if (buf.byteLength < 10 || ascii(buf, 0, 3) !== 'ID3') return null;
    const major = v.getUint8(3), flags = v.getUint8(5);
    const syncsafe = (o) => (v.getUint8(o) << 21) | (v.getUint8(o + 1) << 14) | (v.getUint8(o + 2) << 7) | v.getUint8(o + 3);
    const end = Math.min(10 + syncsafe(6), buf.byteLength);
    let p = 10;
    if (flags & 0x40) p += major === 4 ? syncsafe(p) : v.getUint32(p) + 4;

    const out = {};
    const hdr = major === 2 ? 6 : 10;
    while (p + hdr <= end) {
      let id, size, fp;
      if (major === 2) {
        id = ascii(buf, p, 3);
        size = (v.getUint8(p + 3) << 16) | (v.getUint8(p + 4) << 8) | v.getUint8(p + 5);
        fp = p + 6;
      } else {
        id = ascii(buf, p, 4);
        size = major === 4 ? syncsafe(p + 4) : v.getUint32(p + 4);
        fp = p + 10;
        /* v2.4: el indicador de longitud de datos añade 4 bytes al inicio. */
        if (major === 4 && (v.getUint8(p + 9) & 0x01)) { fp += 4; size -= 4; }
      }
      if (!/^[A-Z0-9]{3,4}$/.test(id) || size <= 0 || fp + size > end) break;
      frame(id, new Uint8Array(buf, fp, size), out);
      p = fp + size;
    }
    return out;
  }

  const TEXT = {
    TIT2: 'title', TT2: 'title',
    TPE1: 'artist', TP1: 'artist',
    TPE2: 'albumArtist', TP2: 'albumArtist',
    TALB: 'album', TAL: 'album',
    TCON: 'genre', TCO: 'genre',
    TYER: 'year', TYE: 'year', TDRC: 'year',
    TRCK: 'trackNo', TRK: 'trackNo',
    TPOS: 'discNo', TPA: 'discNo',
  };

  function frame(id, bytes, out) {
    if (id === 'APIC' || id === 'PIC') return picture(id, bytes, out);
    const key = TEXT[id];
    if (!key || bytes.length < 2) return;
    const enc = bytes[0];
    let val = clean(decode(bytes.subarray(1), enc));
    if (!val) return;
    if (key === 'genre') val = val.replace(/^\((\d+)\)/, '').trim() || val;
    if (key === 'year') { const m = val.match(/\d{4}/); if (m) out.year = +m[0]; return; }
    if (key === 'trackNo' || key === 'discNo') return setNum(out, key, val);
    out[key] = val;
  }

  function picture(id, b, out) {
    const enc = b[0];
    let p = 1, mime;
    if (id === 'PIC') { mime = 'image/' + ascii(b.buffer, b.byteOffset + 1, 3).toLowerCase(); p = 4; }
    else {
      const e = endOfString(b, 1, false);
      mime = clean(decode(b.subarray(1, e), 0)).toLowerCase() || 'image/jpeg';
      p = e + 1;
    }
    const type = b[p]; p += 1;
    const wide = enc === 1 || enc === 2;
    p = endOfString(b, p, wide) + (wide ? 2 : 1);
    if (p >= b.length) return;
    if (mime === 'image/jpg') mime = 'image/jpeg';
    if (mime === '-->') return; /* enlace externo, no sirve sin conexion */
    /* Preferimos la portada frontal (tipo 3) sobre cualquier otra imagen. */
    if (out.cover && out.coverType === 3 && type !== 3) return;
    out.cover = new Blob([b.slice(p)], { type: mime });
    out.coverType = type;
  }

  /* ---------- ID3v1 (128 bytes al final) ---------- */
  function id3v1(buf) {
    if (buf.byteLength < 128) return null;
    const off = buf.byteLength - 128;
    if (ascii(buf, off, 3) !== 'TAG') return null;
    const f = (o, l) => clean(decode(new Uint8Array(buf, off + o, l), 0));
    const out = { title: f(3, 30), artist: f(33, 30), album: f(63, 30) };
    const y = f(93, 4);
    if (/^\d{4}$/.test(y)) out.year = +y;
    const track = new Uint8Array(buf, off + 125, 3);
    if (track[0] === 0 && track[1] > 0) out.trackNo = track[1];
    return out;
  }

  /* ---------- MP4 / M4A ---------- */
  const MP4KEYS = {
    '\xa9nam': 'title', '\xa9ART': 'artist', 'aART': 'albumArtist',
    '\xa9alb': 'album', '\xa9gen': 'genre', '\xa9day': 'year',
  };

  function mp4(buf) {
    const v = new DataView(buf);
    const out = {};
    let found = false;

    function ilst(start, end) {
      let p = start;
      while (p + 8 <= end) {
        const size = v.getUint32(p);
        const name = ascii(buf, p + 4, 4);
        if (size < 8 || p + size > end) break;
        /* Cada entrada contiene un atomo "data" con la carga util. */
        let q = p + 8;
        while (q + 16 <= p + size) {
          const ds = v.getUint32(q);
          if (ascii(buf, q + 4, 4) !== 'data' || ds < 16 || q + ds > p + size) break;
          const kind = v.getUint32(q + 8) & 0xffffff;
          const dp = q + 16, dl = ds - 16;
          read(name, kind, dp, dl);
          q += ds;
        }
        p += size;
      }
    }

    function read(name, kind, dp, dl) {
      if (dl <= 0) return;
      if (name === 'covr') {
        const mime = kind === 14 ? 'image/png' : 'image/jpeg';
        out.cover = new Blob([buf.slice(dp, dp + dl)], { type: mime });
        found = true;
        return;
      }
      if (name === 'trkn' && dl >= 4) { out.trackNo = v.getUint16(dp + 2); found = true; return; }
      if (name === 'disk' && dl >= 4) { out.discNo = v.getUint16(dp + 2); found = true; return; }
      const key = MP4KEYS[name];
      if (!key) return;
      const val = clean(new TextDecoder('utf-8').decode(new Uint8Array(buf, dp, dl)));
      if (!val) return;
      found = true;
      if (key === 'year') { const m = val.match(/\d{4}/); if (m) out.year = +m[0]; return; }
      out[key] = val;
    }

    function walk(start, end) {
      let p = start;
      while (p + 8 <= end) {
        let size = v.getUint32(p), head = 8;
        const type = ascii(buf, p + 4, 4);
        if (size === 1) {
          if (p + 16 > end) break;
          size = v.getUint32(p + 8) * 4294967296 + v.getUint32(p + 12);
          head = 16;
        } else if (size === 0) size = end - p;
        if (size < head || p + size > end) break;
        if (type === 'moov' || type === 'udta' || type === 'trak' || type === 'mdia') walk(p + head, p + size);
        else if (type === 'meta') walk(p + head + 4, p + size); /* meta lleva 4 bytes de version */
        else if (type === 'ilst') ilst(p + head, p + size);
        p += size;
      }
    }

    walk(0, buf.byteLength);
    return found ? out : null;
  }

  /* ---------- Vorbis comments (FLAC / OGG / Opus) ---------- */
  const VKEYS = {
    TITLE: 'title', ARTIST: 'artist', ALBUMARTIST: 'albumArtist',
    ALBUM: 'album', GENRE: 'genre', DATE: 'year', TRACKNUMBER: 'trackNo',
    DISCNUMBER: 'discNo',
  };

  function vorbisComments(v, base, limit, out) {
    let p = base;
    const vl = v.getUint32(p, true); p += 4 + vl;
    if (p + 4 > limit) return;
    const n = v.getUint32(p, true); p += 4;
    for (let i = 0; i < n && p + 4 <= limit; i++) {
      const len = v.getUint32(p, true); p += 4;
      if (len < 0 || p + len > limit) break;
      const s = new TextDecoder('utf-8').decode(new Uint8Array(v.buffer, v.byteOffset + p, len));
      p += len;
      const eq = s.indexOf('=');
      if (eq < 1) continue;
      const key = VKEYS[s.slice(0, eq).toUpperCase()];
      const val = clean(s.slice(eq + 1));
      if (!key || !val) continue;
      if (key === 'year') { const m = val.match(/\d{4}/); if (m) out.year = +m[0]; continue; }
      if (key === 'trackNo' || key === 'discNo') { setNum(out, key, val); continue; }
      out[key] = val;
    }
  }

  function flacPicture(v, base, size, out) {
    let p = base;
    const type = v.getUint32(p); p += 4;
    const ml = v.getUint32(p); p += 4;
    const mime = ascii(v.buffer, v.byteOffset + p, ml); p += ml;
    const dl = v.getUint32(p); p += 4 + dl;
    p += 16; /* ancho, alto, profundidad, colores */
    const len = v.getUint32(p); p += 4;
    if (len <= 0 || p + len > base + size) return;
    if (out.cover && out.coverType === 3 && type !== 3) return;
    out.cover = new Blob([v.buffer.slice(v.byteOffset + p, v.byteOffset + p + len)], { type: mime || 'image/jpeg' });
    out.coverType = type;
  }

  function flac(buf) {
    if (ascii(buf, 0, 4) !== 'fLaC') return null;
    const v = new DataView(buf);
    const out = {};
    let p = 4;
    while (p + 4 <= buf.byteLength) {
      const h = v.getUint8(p);
      const size = (v.getUint8(p + 1) << 16) | (v.getUint8(p + 2) << 8) | v.getUint8(p + 3);
      const bp = p + 4;
      if (bp + size > buf.byteLength) break;
      const type = h & 0x7f;
      if (type === 4) vorbisComments(v, bp, bp + size, out);
      else if (type === 6) flacPicture(v, bp, size, out);
      p = bp + size;
      if (h & 0x80) break;
    }
    return out;
  }

  /* Los comentarios OGG/Opus viven dentro de paginas Ogg; para cabeceras
     pequeñas (lo normal sin caratula incrustada) basta con localizarlas. */
  function ogg(buf) {
    if (ascii(buf, 0, 4) !== 'OggS') return null;
    const v = new DataView(buf);
    const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 262144));
    const out = {};
    const marks = [[[0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73], 7], [[0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 8]];
    for (const [sig, skip] of marks) {
      outer: for (let i = 0; i < bytes.length - sig.length; i++) {
        for (let j = 0; j < sig.length; j++) if (bytes[i + j] !== sig[j]) continue outer;
        try { vorbisComments(v, i + skip, buf.byteLength, out); } catch (e) { /* cabecera partida entre paginas */ }
        return out;
      }
    }
    return out;
  }

  /* ---------- Datos tecnicos del flujo: frecuencia y canales ----------
     Es lo que la pantalla del reproductor muestra junto a la tasa de bits.
     Se leen de la cabecera; si el formato no la expone, quedan en blanco. */
  const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

  function spec(buf) {
    const v = new DataView(buf);
    const n = buf.byteLength;
    try {
      if (n > 44 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WAVE') {
        let p = 12;
        while (p + 24 <= n) {
          const id = ascii(buf, p, 4), sz = v.getUint32(p + 4, true);
          if (id === 'fmt ') return { channels: v.getUint16(p + 10, true), sampleRate: v.getUint32(p + 12, true) };
          if (sz <= 0) break;
          p += 8 + sz + (sz & 1);
        }
        return null;
      }
      if (n > 42 && ascii(buf, 0, 4) === 'fLaC') {
        const b = new Uint8Array(buf, 8, 34);
        const sr = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
        return sr ? { sampleRate: sr, channels: ((b[12] >> 1) & 7) + 1 } : null;
      }
      /* MP3: primera cabecera de trama despues de la etiqueta ID3 */
      let start = 0;
      if (n > 10 && ascii(buf, 0, 3) === 'ID3') {
        start = 10 + ((v.getUint8(6) << 21) | (v.getUint8(7) << 14) | (v.getUint8(8) << 7) | v.getUint8(9));
      }
      const limit = Math.min(n - 4, start + 300000);
      for (let p = Math.max(0, start); p < limit; p++) {
        if (v.getUint8(p) !== 0xff || (v.getUint8(p + 1) & 0xe0) !== 0xe0) continue;
        const b1 = v.getUint8(p + 1), b2 = v.getUint8(p + 2), b3 = v.getUint8(p + 3);
        const ver = (b1 >> 3) & 3, layer = (b1 >> 1) & 3;
        const brIdx = (b2 >> 4) & 15, srIdx = (b2 >> 2) & 3;
        if (ver === 1 || layer === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) continue;
        const rates = MP3_RATES[ver];
        if (!rates) continue;
        return { sampleRate: rates[srIdx], channels: ((b3 >> 6) & 3) === 3 ? 1 : 2 };
      }
    } catch (e) { /* cabecera no reconocida */ }
    return null;
  }

  /* ---------- Respaldo: deducir del nombre de archivo ---------- */
  function fromName(fileName) {
    let s = fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const out = {};
    const lead = s.match(/^(\d{1,3})\s*[-.–)]\s*(.+)$/);
    if (lead) { out.trackNo = +lead[1]; s = lead[2].trim(); }
    const split = s.split(/\s+[-–]\s+/);
    if (split.length >= 2) {
      out.artist = split[0].trim();
      out.title = split.slice(1).join(' - ').trim();
    } else {
      out.title = s;
    }
    return out;
  }

  /* ---------- Punto de entrada ---------- */
  async function read(file) {
    /* Los archivos grandes se leen por los extremos: las etiquetas viven
       al principio (ID3, FLAC) o en cualquiera de los dos (moov en MP4). */
    const LIMIT = 24 * 1024 * 1024;
    let out = null, tech = null;
    try {
      if (file.size <= LIMIT) {
        const buf = await file.arrayBuffer();
        out = id3v2(buf) || mp4(buf) || flac(buf) || ogg(buf) || id3v1(buf);
        tech = spec(buf);
      } else {
        const head = await file.slice(0, 4 * 1024 * 1024).arrayBuffer();
        out = id3v2(head) || mp4(head) || flac(head) || ogg(head);
        tech = spec(head);
        if (!out || !out.title) {
          const tail = await file.slice(file.size - 4 * 1024 * 1024).arrayBuffer();
          out = mp4(tail) || id3v1(tail) || out;
        }
      }
    } catch (e) {
      out = null;
    }
    const guess = fromName(file.name);
    const t = Object.assign({}, guess, {});
    for (const k in (out || {})) if (out[k] !== undefined && out[k] !== '') t[k] = out[k];
    if (!t.title) t.title = guess.title || file.name;
    if (!t.artist) t.artist = 'Artista desconocido';
    if (!t.album) t.album = 'Sin álbum';
    if (tech) { t.sampleRate = tech.sampleRate || 0; t.channels = tech.channels || 0; }
    delete t.coverType;
    return t;
  }

  return { read, fromName };
})();

/* ------------------------------------------------------------
   Caratulas: miniatura para las listas y color dominante para
   teñir la interfaz mientras suena la pista.
   ------------------------------------------------------------ */
Axioma.art = (function () {
  const DEFAULT = '#ff9f1c';

  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (!d) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
  }

  function hex(h, s, l) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  /* Agrupamos por matiz y elegimos el grupo con mas peso cromatico,
     no el color mas frecuente: asi un fondo gris no gana nunca. */
  function dominant(data) {
    const B = 18, w = new Float64Array(B), sum = new Float64Array(B * 2);
    let chroma = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
      if (l < 0.08 || l > 0.95) continue;
      const weight = s * s * (1 - Math.abs(l - 0.5));
      if (weight < 0.004) continue;
      chroma += weight;
      const b = Math.min(B - 1, Math.floor(h * B));
      w[b] += weight;
      sum[b * 2] += s * weight;
      sum[b * 2 + 1] += l * weight;
    }
    if (chroma < 0.5) return DEFAULT;
    let best = 0;
    for (let i = 1; i < B; i++) if (w[i] > w[best]) best = i;
    if (!w[best]) return DEFAULT;
    const h = (best + 0.5) / B;
    const s = Math.min(0.92, Math.max(0.55, sum[best * 2] / w[best] * 1.25));
    return hex(h, s, 0.62);
  }

  /* Guardamos una miniatura de 180 px: las listas no deben decodificar
     caratulas de 3000 px cada vez que se desplazan. */
  async function process(blob) {
    let bmp;
    try { bmp = await createImageBitmap(blob); } catch (e) { return { thumb: null, color: DEFAULT }; }
    const N = 180;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const k = Math.max(N / bmp.width, N / bmp.height);
    const w = bmp.width * k, h = bmp.height * k;
    g.drawImage(bmp, (N - w) / 2, (N - h) / 2, w, h);

    const s = document.createElement('canvas');
    s.width = s.height = 16;
    const sg = s.getContext('2d', { willReadFrequently: true });
    sg.drawImage(c, 0, 0, 16, 16);
    let color = DEFAULT;
    try { color = dominant(sg.getImageData(0, 0, 16, 16).data); } catch (e) { /* canvas restringido */ }

    const thumb = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    if (bmp.close) bmp.close();
    return { thumb, color };
  }

  return { process, dominant, DEFAULT };
})();

/* ------------------------------------------------------------
   Duracion real del archivo, medida por el propio navegador.
   ------------------------------------------------------------ */
Axioma.duration = function (blob) {
  return new Promise((res) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const d = isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      res(d);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = finish;
    a.onerror = finish;
    setTimeout(finish, 10000);
    a.src = url;
  });
};

/* ------------------------------------------------------------
   Pistas de demostracion.
   Se sintetizan en el telefono la primera vez que abres la app,
   para que la biblioteca no arranque vacia. No se descarga nada.
   ------------------------------------------------------------ */
Axioma.demo = (function () {
  const SR = 22050;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Filtro paso bajo de un polo, suficiente para redondear el timbre. */
  function lowpass(buf, cutoff) {
    const a = Math.exp((-2 * Math.PI * cutoff) / SR);
    let z = 0;
    for (let i = 0; i < buf.length; i++) { z = (1 - a) * buf[i] + a * z; buf[i] = z; }
  }

  function fades(buf, inSec, outSec) {
    const fi = Math.round(inSec * SR), fo = Math.round(outSec * SR), n = buf.length;
    for (let i = 0; i < fi && i < n; i++) buf[i] *= i / fi;
    for (let i = 0; i < fo && i < n; i++) buf[n - 1 - i] *= i / fo;
  }

  function normalize(buf, peak) {
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    if (!m) return;
    const k = peak / m;
    for (let i = 0; i < buf.length; i++) buf[i] *= k;
  }

  /* --- Deriva: acorde suspendido con oscilaciones lentas de amplitud --- */
  function deriva(dur) {
    const n = dur * SR, out = new Float32Array(n);
    const notes = [130.81, 196.0, 329.63, 493.88, 587.33];
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (let k = 0; k < notes.length; k++) {
        const detune = 1 + (k % 2 ? 0.0018 : -0.0015);
        const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * (0.055 + 0.014 * k) * t + k * 1.7);
        s += Math.sin(2 * Math.PI * notes[k] * detune * t) * env / (1 + k * 0.55);
      }
      out[i] = s * 0.2;
    }
    lowpass(out, 1500);
    fades(out, 3.2, 4.5);
    normalize(out, 0.78);
    return out;
  }

  /* --- Cobre: pulso grave con charles filtrado --- */
  function cobre(dur) {
    const n = dur * SR, out = new Float32Array(n);
    const rand = rng(4021);
    const bass = [55, 55, 73.42, 61.74];
    const beat = 0.5;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const b = Math.floor(t / beat), u = t - b * beat;
      /* bombo: barrido descendente de tono */
      const kick = Math.sin(2 * Math.PI * (46 + 40 * Math.exp(-26 * u)) * u) * Math.exp(-8.5 * u);
      /* charles en las corcheas */
      const hv = t - (Math.floor(t / (beat / 2)) * (beat / 2));
      const hat = (rand() * 2 - 1) * Math.exp(-52 * hv) * (Math.floor(t / (beat / 2)) % 2 ? 0.34 : 0.12);
      /* bajo sostenido, un tono por compas de cuatro tiempos */
      const note = bass[Math.floor(b / 4) % bass.length];
      const line = Math.sin(2 * Math.PI * note * t) * 0.5 * (0.6 + 0.4 * Math.exp(-3 * u));
      out[i] = kick * 0.85 + hat + line;
    }
    lowpass(out, 5200);
    fades(out, 0.6, 2.4);
    normalize(out, 0.8);
    return out;
  }

  /* --- Alba: campanas pentatonicas sobre colchon --- */
  function alba(dur) {
    const n = dur * SR, out = new Float32Array(n);
    const scale = [523.25, 587.33, 698.46, 783.99, 1046.5];
    const step = 0.31;
    const partials = [1, 2.01, 3.03, 4.52];
    const rand = rng(917);
    const seq = [];
    for (let k = 0; k < Math.ceil(dur / step); k++) seq.push(scale[Math.floor(rand() * scale.length)]);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      /* colchon de fondo en La menor */
      let s = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 261.63 * t) * 0.7) * 0.09;
      const k = Math.floor(t / step), u = t - k * step;
      const f = seq[k] || scale[0];
      for (let q = 0; q < partials.length; q++) {
        s += Math.sin(2 * Math.PI * f * partials[q] * u) * Math.exp(-(5 + q * 3.5) * u) * (0.32 / (q + 1));
      }
      out[i] = s;
    }
    lowpass(out, 6500);
    fades(out, 1.2, 3.4);
    normalize(out, 0.76);
    return out;
  }

  /* --- Tinta: zumbido grave y textura de ruido barrido --- */
  function tinta(dur) {
    const n = dur * SR, out = new Float32Array(n);
    const rand = rng(2718);
    let lp = 0, bp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let drone = 0;
      for (let h = 1; h <= 6; h++) drone += Math.sin(2 * Math.PI * 82.41 * h * t) / (h * h);
      /* filtro variable de estado, barrido lento sobre el ruido */
      const cut = 380 + 1100 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * t));
      const f = 2 * Math.sin((Math.PI * cut) / SR);
      const input = rand() * 2 - 1;
      const hp = input - lp - 0.9 * bp;
      bp += f * hp;
      lp += f * bp;
      out[i] = drone * 0.42 + bp * 0.5;
    }
    fades(out, 2.5, 3.8);
    normalize(out, 0.72);
    return out;
  }

  function wav(samples) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const tag = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); tag(8, 'WAVE');
    tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    tag(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* Caratulas generadas: campo degradado, arcos concentricos que
     citan la marca, y grano fino para que no se vea plano. */
  function cover(hue, sat) {
    const N = 420;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const hx = (l, s) => `hsl(${hue} ${Math.round((s == null ? sat : s) * 100)}% ${Math.round(l * 100)}%)`;

    const bg = g.createLinearGradient(0, 0, N, N);
    bg.addColorStop(0, hx(0.16, sat * 0.55));
    bg.addColorStop(1, hx(0.06, sat * 0.4));
    g.fillStyle = bg;
    g.fillRect(0, 0, N, N);

    const glow = g.createRadialGradient(N * 0.34, N * 0.5, 0, N * 0.34, N * 0.5, N * 0.72);
    glow.addColorStop(0, hx(0.58, Math.min(1, sat * 1.1)));
    glow.addColorStop(0.45, hx(0.3, sat * 0.8));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, N, N);

    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.strokeStyle = `hsl(${hue} ${Math.round(sat * 40)}% ${88 - i * 6}% / ${0.5 - i * 0.075})`;
      g.lineWidth = 13 - i * 1.9;
      const sweep = Math.PI * (0.62 - i * 0.052);
      g.arc(N * 0.34, N * 0.5, N * (0.14 + i * 0.106), -sweep, sweep);
      g.stroke();
    }

    const grain = g.getImageData(0, 0, N, N);
    const rand = rng(hue * 7 + 13);
    for (let i = 0; i < grain.data.length; i += 4) {
      const d = (rand() - 0.5) * 15;
      grain.data[i] += d; grain.data[i + 1] += d; grain.data[i + 2] += d;
    }
    g.putImageData(grain, 0, 0);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
  }

  const PIECES = [
    { title: 'Deriva', dur: 21, gen: deriva, hue: 33, sat: 0.72, no: 1 },
    { title: 'Cobre', dur: 19, gen: cobre, hue: 14, sat: 0.66, no: 2 },
    { title: 'Alba', dur: 22, gen: alba, hue: 172, sat: 0.5, no: 3 },
    { title: 'Tinta china', dur: 20, gen: tinta, hue: 268, sat: 0.44, no: 4 },
  ];

  async function build() {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < PIECES.length; i++) {
      const p = PIECES[i];
      const blob = wav(p.gen(p.dur));
      const art = await cover(p.hue, p.sat);
      const { thumb, color } = await Axioma.art.process(art);
      out.push({
        id: 'demo-' + p.title.toLowerCase().replace(/\s+/g, '-'),
        title: p.title,
        artist: 'Axioma Estudio',
        albumArtist: 'Axioma Estudio',
        album: 'Pistas de prueba',
        genre: 'Demostración',
        year: 2026,
        trackNo: p.no,
        discNo: 1,
        duration: p.dur,
        size: blob.size,
        mime: 'audio/wav',
        sampleRate: SR,
        channels: 1,
        fileName: `${p.no} - ${p.title}.wav`,
        blob,
        cover: art,
        thumb,
        color,
        addedAt: now + i,
        playCount: 0,
        lastPlayedAt: 0,
        favorite: 0,
        demo: 1,
      });
    }
    return out;
  }

  return { build };
})();
