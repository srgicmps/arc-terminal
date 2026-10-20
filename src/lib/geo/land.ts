// El contorno de los continentes (land.svg) como archivo aparte: Vite lo deja en _app/immutable/assets con un hash
// en el nombre, así que se descarga en paralelo, una sola vez, y la caché (y la precaché del service worker) lo
// reutiliza entre vistas y publicaciones. Uso: <use class="land" href={LAND_HREF} /> dentro del <svg> del mapa.
// El relleno, el trazo y su grosor los pone el CSS de .land y se heredan; vector-effect no se hereda y va en el SVG.
import url from './land.svg?url';

export const LAND_HREF = `${url}#land`;
