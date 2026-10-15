// Modo «Sencillo» o «Terminal» (lógica pura; el estado del navegador está en modo.svelte.ts).
// Sencillo: menos paneles por vista (los esenciales de simple.ts), letra algo mayor, más aire y etiquetas en
// español claro. Terminal: todo, denso, como siempre. Va en <html data-modo> (lo pone src/app.html antes de
// pintar) y tokens.css redefine los tokens del bloque [data-modo='sencillo'].

export type Modo = 'sencillo' | 'terminal';

export const MODO_KEY = 'arc-modo';

export const MODOS: readonly { value: Modo; label: string }[] = [
	{ value: 'sencillo', label: 'Sencillo' },
	{ value: 'terminal', label: 'Terminal' }
];

export const isModo = (v: unknown): v is Modo => v === 'sencillo' || v === 'terminal';

/**
 * El modo con el que se entra. Lo guardado manda; si no hay nada, quien ya usaba la terminal (tiene otras claves
 * «arc-…» en el navegador, como Sergi) sigue en Terminal, y quien llega nuevo empieza en Sencillo.
 * src/app.html repite esta misma regla (no puede importar módulos); un test comprueba que no se separan.
 */
export function decideModo(stored: string | null, keys: Iterable<string>): Modo {
	if (isModo(stored)) return stored;
	for (const k of keys) if (k.startsWith('arc-') && k !== MODO_KEY) return 'terminal';
	return 'sencillo';
}
