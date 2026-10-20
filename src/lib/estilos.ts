// Estéticas de Arc Terminal (lógica pura; el estado del navegador está en taste.svelte.ts).
// Cada una va en <html data-style="…"> y tiene su archivo en static/estilos/<id>.css, que solo redefine
// tokens (y, si un token no basta, reglas propias colgadas de [data-style='<id>']). Plex e Inter ya vienen con la
// web (src/styles/fonts.css); otra letra, con @import de Google Fonts (solo libres, OFL) o del sistema.
// Terminal es lo de tokens.css, sin archivo. Una estética sale en el selector cuando existe su archivo (READY).
// Este registro solo lo cargan ESTILO y HELP: no pesa en las demás vistas.

export interface Estilo {
	id: string;
	label: string;
	/** Una línea para el selector y el MANUAL. */
	desc: string;
	/** Su color de acento es parte del diseño: el acento de «A tu gusto» no se aplica (src/styles/ajustes.css). */
	fixedAccent?: true;
}

export const ESTILOS: readonly Estilo[] = [
	{ id: 'terminal', label: 'Terminal', desc: 'La de siempre, al estilo Bloomberg: casi negro, monoespaciada y líneas de 1 px.' },
	{ id: 'grafito', label: 'Grafito', desc: 'Moderna y sobria: tarjetas, esquinas suaves, sombra leve e Inter.' },
	{ id: 'cristal', label: 'Cristal', desc: 'Paneles translúcidos sobre un fondo con degradado suave.' },
	{ id: 'papel', label: 'Papel', desc: 'Plana, sin sombras, bordes finos y mucho aire.' },
	{ id: 'calido', label: 'Cálido', desc: 'Crema y terracota, títulos en serif y calma editorial.' },
	{ id: 'cupertino', label: 'Cupertino', desc: 'Letra del sistema, títulos grandes, materiales sutiles y azul.' },
	{ id: 'retro', label: 'Fósforo', desc: 'Monitor de los 80: fósforo verde, letra de píxeles y líneas de escaneo.', fixedAccent: true },
	{ id: 'neon', label: 'Neón', desc: 'Synthwave: magenta y cian con brillo y rejilla de horizonte.' },
	{ id: 'brutal', label: 'Brutalista', desc: 'Blanco y negro puro, letra enorme y bordes gruesos.', fixedAccent: true },
	{ id: 'bauhaus', label: 'Bauhaus', desc: 'Rojo, amarillo y azul primarios, geometría y bloques de color.', fixedAccent: true },
	{ id: 'suizo', label: 'Suizo', desc: 'Rejilla estricta, neogrotesca, rojo como único acento.' },
	{ id: 'cuaderno', label: 'Cuaderno', desc: 'Papel cuadriculado, tinta azul y títulos a mano.' },
	{ id: 'nordico', label: 'Nórdico', desc: 'Arena, madera clara y piedra; redondeada y con aire.' },
	{ id: 'lujo', label: 'Lujo', desc: 'Negro y dorado, serif de alto contraste y filetes finos.' },
	{ id: 'oceano', label: 'Océano', desc: 'Azules profundos y turquesa, degradados y transiciones fluidas.' },
	{ id: 'plano', label: 'Plano técnico', desc: 'Azul de plano con rejilla, líneas blancas y letra técnica.' },
	{ id: 'contraste', label: 'Alto contraste', desc: 'Máxima legibilidad: AAA, letra grande, foco muy visible, sin efectos.', fixedAccent: true },
	{ id: 'zen', label: 'Zen', desc: 'Calma y aire: tarjetas suaves, títulos grandes y centrados, IBM Plex y entradas lentas.' }
];

export type StyleId = string;

/** ¿Usa esta estética el acento elegido en «A tu gusto»? */
export const takesAccent = (id: StyleId) => !ESTILOS.find((e) => e.id === id)?.fixedAccent;

const sheets = import.meta.glob('/static/estilos/*.css', { query: '?raw', import: 'default' });
/** Las estéticas que ya tienen archivo (y Terminal, que es tokens.css). Solo esas salen en el selector. */
export const READY: string[] = ['terminal', ...Object.keys(sheets).map((p) => p.replace(/^.*\//, '').replace(/\.css$/, ''))];
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

