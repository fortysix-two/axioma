# Axioma — reproductor de música offline

Aplicación web instalable (PWA) pensada solo para teléfono. Importas tus
archivos de audio, se guardan **dentro del teléfono** y suenan sin conexión.
No hay cuentas, ni servidores, ni anuncios: tu música nunca sale del dispositivo.

El aspecto es un homenaje a los reproductores de escritorio de los noventa:
chasis biselado azul pizarra, pantalla LCD verde, tipografía de mapa de bits,
analizador de espectro y ecualizador gráfico de diez bandas. Las proporciones,
en cambio, son de teléfono: todos los controles tienen área táctil suficiente.

---

## Qué hace

- Importa **MP3, M4A/AAC, FLAC, OGG, Opus y WAV** desde el almacenamiento del teléfono.
- Lee las etiquetas del archivo (título, artista, álbum, año, número de pista) y
  la **carátula incrustada**. Si el archivo no trae etiquetas, deduce artista y
  título del nombre del archivo.
- Lee la cabecera del archivo para mostrar **frecuencia de muestreo y canales**
  reales junto a la tasa de bits, como la pantalla de los reproductores clásicos.
- Organiza en **Canciones, Álbumes y Artistas**, con búsqueda que ignora acentos.
- **Listas de reproducción** propias, más tres que se arman solas: Favoritas,
  Añadidas hace poco y Más escuchadas.
- Cola de reproducción, aleatorio y repetición (una pista o toda la cola).
- **Controles en la pantalla de bloqueo** y en los audífonos, vía Media Session.
- Retoma donde te quedaste al volver a abrir la app.
- **Modo estudio** opcional: ecualizador de diez bandas con preamplificador,
  once ajustes rápidos y analizador de espectro en vivo.
- Temporizador de apagado con bajada de volumen progresiva.
- Chasis oscuro y chasis claro.

## Cómo está hecho

HTML, CSS y JavaScript sin ninguna librería ni dependencia externa. Nada se
descarga en tiempo de ejecución: las tipografías van empaquetadas en `fonts/`.

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la interfaz |
| `styles.css` | Chasis, pantallas y tipografías |
| `js/core.js` | Base de datos local, lectura de etiquetas y cabeceras, carátulas, pistas de demostración |
| `js/player.js` | Motor de audio, cola, ecualizador, pantalla de bloqueo |
| `js/ui.js` | Vistas, navegación, importación, analizador |
| `sw.js` | Trabajador de servicio: hace que la app abra sin conexión |
| `manifest.webmanifest` | Datos de instalación (nombre, iconos, color) |

Los archivos de audio y las carátulas viven en **IndexedDB**. El trabajador de
servicio solo guarda los archivos de la aplicación, nunca tu música.

---

## Instalarlo en el teléfono

### 1. Publicar la carpeta en GitHub Pages

1. Entra a [github.com](https://github.com) y crea una cuenta si no la tienes.
2. Crea un repositorio nuevo llamado `axioma`. Márcalo como **Public**
   (Pages no funciona en repositorios privados con cuenta gratuita).
3. En la página del repositorio vacío, pulsa **uploading an existing file**.
4. Arrastra **el contenido** de esta carpeta, no la carpeta misma: deben quedar
   `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest` y las carpetas
   `js/`, `icons/` y `fonts/` en la raíz del repositorio.
5. Pulsa **Commit changes**.
6. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama
   `main`, carpeta `/ (root)`. Guarda.
7. Espera un par de minutos. Arriba aparecerá la dirección:
   `https://TU-USUARIO.github.io/axioma/`

Si prefieres la línea de comandos:

```bash
git init && git add . && git commit -m "Axioma" && git branch -M main
git remote add origin https://github.com/TU-USUARIO/axioma.git && git push -u origin main
```

### 2. Instalar la app

1. Abre esa dirección en **Chrome** en el teléfono.
2. Menú de tres puntos → **Añadir a pantalla principal** (o **Instalar aplicación**).
3. Confirma. Axioma queda en el cajón de aplicaciones con su propio icono y se
   abre a pantalla completa, sin barra de navegador.
4. Ábrela una vez con datos o wifi para que termine de guardarse. A partir de
   ahí funciona en modo avión.

### 3. Pasar tu música al teléfono

Conecta el teléfono por cable USB y elige **Transferencia de archivos** en la
notificación que aparece. En el explorador de Windows copia tus canciones a
`Este equipo → [tu teléfono] → Almacenamiento interno → Music`.

También sirve subirlas a Google Drive y descargarlas en el teléfono.

### 4. Importar en la app

1. Abre Axioma y pulsa el botón de expulsión, arriba a la derecha.
2. Selecciona los archivos. Mantén pulsado uno y luego usa **Seleccionar todo**
   para importar una carpeta completa de una vez.
3. Verás el avance abajo. Al terminar, la biblioteca ya está lista.

Las cuatro pistas de ejemplo se quitan desde **Opciones → Quitar demostración**.

---

## Notas prácticas

**Protege la biblioteca.** En Opciones, pulsa *Proteger biblioteca*. Le pide a
Android que no borre tu música si el teléfono se queda corto de espacio.

**Modo estudio.** Enciende el ecualizador y el analizador, pero enruta el audio
por Web Audio. En algunos teléfonos eso puede cortar la reproducción al bloquear
la pantalla. Si te pasa, desactívalo y reabre la app. Viene apagado por eso.

**Actualizar la app.** Cambia los archivos en GitHub y sube el número de
`VERSION` en `sw.js` (`axioma-v2` → `axioma-v3`). Sin eso el teléfono seguirá
sirviendo la versión guardada.

**Copia de seguridad.** La música vive en el almacenamiento del navegador.
Desinstalar la app o borrar los datos de Chrome la elimina. Conserva siempre los
archivos originales en tu computadora.

**Formatos.** Axioma reproduce lo que soporte Chrome en Android: MP3, M4A/AAC,
FLAC, OGG, Opus y WAV. No reproduce WMA ni ALAC.

**Sobre el aspecto.** El diseño reproduce el lenguaje visual de aquellos
reproductores, pero la app no lleva el nombre ni el logotipo de ninguno: todas
las ventanas dicen Axioma.
