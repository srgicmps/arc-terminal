// Experiencias: otras formas de usar Arc Terminal con los mismos datos (un periódico, una sala de control, un
// feed…). Cada una es una ruta propia en src/routes/x/<id> y se apunta aquí: de este registro salen el índice
// /x, el comando «EXP <nombre>», el selector de la cabecera de cada experiencia y la opción «Al entrar» de HELP.
// Lógica pura (sin Svelte ni Vite), para probarla.

export interface Experience {
	/** Identificador corto, sin tildes: va en la URL (/x/<id>) y en «EXP <id>». */
	id: string;
	name: string;
	/** Qué es, en una frase. */
	desc: string;
	/** Un carácter (emoji o símbolo) para las tarjetas y el selector. */
	icon: string;
	/** Posición en el índice (de 10 en 10). */
	order: number;
	/** Otras formas de pedirla con «EXP» (se comparan sin tildes ni mayúsculas). */
	aliases?: string[];
}

// Añade cada experiencia nueva al final del array (así dos ramas a la vez no chocan en la misma línea).
const LIST: Experience[] = [
	{ id: 'periodico', name: 'Periódico', desc: 'Arc como un diario: portada a columnas, breves con las cifras del día y ediciones de mañana y de tarde.', icon: '📰', order: 10, aliases: ['diario', 'prensa'] },
	{ id: 'zen', name: 'Zen', desc: 'Una sola cosa cada vez, en grande y explicada con palabras sencillas. Deslizar o flechas para la siguiente.', icon: '○', order: 30, aliases: ['tranquilo', 'calma'] },
	{ id: 'cabina', name: 'Cabina', desc: 'Relojes con aguja y zonas (riesgo, inflación, tipos, VIX, petróleo, euríbor, luz, paro) y el semáforo: todo de un vistazo.', icon: '◔', order: 40, aliases: ['relojes', 'salpicadero', 'indicadores'] },
	{ id: 'feed', name: 'Feed', desc: 'Todo lo que pasa en una línea de tiempo: titulares, datos publicados, avisos, mercados y récords, con filtros y «solo lo mío».', icon: '☰', order: 50, aliases: ['timeline', 'linea de tiempo', 'muro'] },
];

export const EXPERIENCES: Experience[] = [...LIST].sort((a, b) => a.order - b.order);

export const expHref = (e: Experience) => `/x/${e.id}`;

const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();

/** La experiencia que se pide con un texto («periódico», «Sala de control», «zen»), o null. */
export function findExperience(text: string | null | undefined, list = EXPERIENCES): Experience | null {
	const q = fold(text ?? '');
	if (!q) return null;
	return list.find((e) => [e.id, e.name, ...(e.aliases ?? [])].some((k) => fold(k) === q)) ?? list.find((e) => fold(e.name).startsWith(q) || e.id.startsWith(q)) ?? null;
}

/** «Al entrar» (arc-home) guarda las experiencias como «x:<id>». */
export const HOME_PREFIX = 'x:';
export const homeValue = (e: Experience) => `${HOME_PREFIX}${e.id}`;
export const fromHomeValue = (v: string | null, list = EXPERIENCES) =>
	v?.startsWith(HOME_PREFIX) ? (list.find((e) => e.id === v.slice(HOME_PREFIX.length)) ?? null) : null;
