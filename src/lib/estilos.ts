// Estéticas de Arc Terminal (lógica pura; el estado del navegador está en taste.svelte.ts).
// Cada una va en <html data-style="…"> y tiene su archivo en src/styles/estilos/<id>.css, que solo redefine
// tokens (y, si un token no basta, reglas propias colgadas de [data-style='<id>']). Terminal es lo de
// tokens.css, sin archivo. Una estética sale en el selector cuando existe su archivo (READY, en estilos-css.ts).
// Letras: solo libres (Google Fonts, OFL) o las del sistema. `fonts` es la consulta de Google Fonts (lo que va
// tras «css2?»); src/app.html la repite en FONTS para cargarla antes de pintar, y un test vigila que coincidan.

export interface Estilo {
	id: string;
	label: string;
	/** Una línea para el selector y el MANUAL. */
	desc: string;
	fonts: string;
}

export const ESTILOS: readonly Estilo[] = [
	{ id: 'terminal', label: 'Terminal', desc: 'La de siempre, al estilo Bloomberg: casi negro, monoespaciada y líneas de 1 px.', fonts: '' },
	{ id: 'grafito', label: 'Grafito', desc: 'Moderna y sobria: tarjetas, esquinas suaves, sombra leve e Inter.', fonts: 'family=Inter:wght@400;500;600;700' },
	{ id: 'cristal', label: 'Cristal', desc: 'Paneles translúcidos sobre un fondo con degradado suave.', fonts: 'family=Inter:wght@400;500;600;700' },
	{ id: 'papel', label: 'Papel', desc: 'Plana, sin sombras, bordes finos y mucho aire.', fonts: 'family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500' },
	{ id: 'calido', label: 'Cálido', desc: 'Crema y terracota, títulos en serif y calma editorial.', fonts: 'family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Sans+3:wght@400;500;600' },
	{ id: 'cupertino', label: 'Cupertino', desc: 'Letra del sistema, títulos grandes, materiales sutiles y azul.', fonts: 'family=Inter:wght@400;500;600;700' },
	{ id: 'retro', label: 'Fósforo', desc: 'Monitor de los 80: fósforo verde, letra de píxeles y líneas de escaneo.', fonts: 'family=VT323&family=IBM+Plex+Mono:wght@400;500' },
	{ id: 'neon', label: 'Neón', desc: 'Synthwave: magenta y cian con brillo y rejilla de horizonte.', fonts: 'family=Orbitron:wght@500;700&family=Share+Tech+Mono' },
	{ id: 'brutal', label: 'Brutalista', desc: 'Blanco y negro puro, letra enorme y bordes gruesos.', fonts: 'family=Archivo:wght@400;600;800;900&family=Space+Mono:wght@400;700' },
	{ id: 'bauhaus', label: 'Bauhaus', desc: 'Rojo, amarillo y azul primarios, geometría y bloques de color.', fonts: 'family=Jost:wght@400;500;600;700' },
	{ id: 'suizo', label: 'Suizo', desc: 'Rejilla estricta, neogrotesca, rojo como único acento.', fonts: 'family=Inter+Tight:wght@400;500;600;700;800' },
	{ id: 'cuaderno', label: 'Cuaderno', desc: 'Papel cuadriculado, tinta azul y títulos a mano.', fonts: 'family=Caveat:wght@500;700&family=Nunito+Sans:wght@400;600;700' },
	{ id: 'nordico', label: 'Nórdico', desc: 'Arena, madera clara y piedra; redondeada y con aire.', fonts: 'family=Nunito:wght@400;500;600;700' },
	{ id: 'lujo', label: 'Lujo', desc: 'Negro y dorado, serif de alto contraste y filetes finos.', fonts: 'family=Playfair+Display:wght@500;600;700&family=Lato:wght@400;700' },
	{ id: 'oceano', label: 'Océano', desc: 'Azules profundos y turquesa, degradados y transiciones fluidas.', fonts: 'family=Manrope:wght@400;500;600;700' },
	{ id: 'plano', label: 'Plano técnico', desc: 'Azul de plano con rejilla, líneas blancas y letra técnica.', fonts: 'family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@500;600' },
	{ id: 'contraste', label: 'Alto contraste', desc: 'Máxima legibilidad: AAA, letra grande, foco muy visible, sin efectos.', fonts: 'family=Atkinson+Hyperlegible:wght@400;700' }
];

export type StyleId = string;
export const DEFAULT_STYLE = 'terminal';
/** La de quien llega nuevo. */
export const NEW_STYLE = 'grafito';
export const STYLE_KEY = 'arc-style';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const isStyle = (v: unknown): v is StyleId => typeof v === 'string' && ESTILOS.some((e) => e.id === v);

/** Lo que se escribe en la barra («ESTILO fósforo», «ESTILO alto contraste»): por id o por nombre, sin tildes. */
export function parseStyle(text: string | null | undefined): StyleId | null {
	const t = norm(text ?? '');
	if (!t) return null;
	if (t === 'moderna' || t === 'modern') return NEW_STYLE;
	if (t === 'clasica') return 'terminal';
	return ESTILOS.find((e) => e.id === t || norm(e.label) === t)?.id ?? null;
}

/**
 * La estética con la que se entra. Lo guardado manda; si no hay nada, quien ya usaba la web (otras claves arc-…)
 * sigue en Terminal y quien llega nuevo empieza en Grafito. src/app.html repite la regla (no puede importar).
 */
export function decideStyle(stored: string | null, keys: Iterable<string>): StyleId {
	if (stored === 'modern') return NEW_STYLE;
	if (isStyle(stored)) return stored;
	for (const k of keys) if (k.startsWith('arc-') && k !== 'arc-modo' && k !== STYLE_KEY) return DEFAULT_STYLE;
	return NEW_STYLE;
}

/** URL de Google Fonts con las letras de unas estéticas (null si no hace falta ninguna). */
export function fontsUrl(ids: readonly StyleId[]): string | null {
	const q = [...new Set(ESTILOS.filter((e) => ids.includes(e.id) && e.fonts).flatMap((e) => e.fonts.split('&')))];
	return q.length ? `https://fonts.googleapis.com/css2?${q.join('&')}&display=swap` : null;
}
