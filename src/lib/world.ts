// Contorno de los continentes, en proyección equirectangular (360 × 180): x = longitud + 180, y = 90 − latitud.
// Vive en src/lib/geo/land.svg, una sola fuente. Los mapas SVG lo dibujan con <use> (LAND_HREF, src/lib/geo/land.ts),
// sin escribirlo en el HTML ni en el JS. Aquí sale como texto para quien lo necesita como dato: el globo (Path2D)
// y los mapas de Arc OS.
import svg from './geo/land.svg?raw';

/** El atributo `d` del contorno. */
export const LAND = svg.match(/ d="([^"]+)"/)![1];
