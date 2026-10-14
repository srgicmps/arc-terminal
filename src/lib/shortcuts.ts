// Registro único de atajos de teclado. De aquí salen la lista de HELP (y del MANUAL) y las teclas que
// escuchan la barra de comandos y el modo TV: si cambia una tecla, se cambia aquí y cambia en todas partes.
// Lógica pura, sin Svelte, para probarla con Vitest.

export type ShortcutGroup = 'Barra' | 'Paneles' | 'Listas' | 'Pantalla' | 'TV';

export interface Shortcut {
	id: string;
	group: ShortcutGroup;
	/** Teclas tal y como se muestran: cada una va en su <kbd>. Vacío si no hay tecla (solo `how`). */
	keys: string[];
	/** Las teclas van juntas (⇧ F); si no, son alternativas («Esc o ✕»). */
	combo?: boolean;
	/** Texto que acompaña a las teclas: «o empieza a escribir», «con un panel ampliado»… */
	how?: string;
	/** Qué hace. */
	action: string;
	/** Tecla que se escucha (KeyboardEvent.key) y si va con Mayúsculas. Sin match, es solo informativo. */
	match?: { key: string; shift?: boolean };
}

export const SHORTCUTS = [
	{ id: 'bar', group: 'Barra', keys: ['/'], how: 'o empieza a escribir', action: 'Ir a la barra', match: { key: '/' } },
	{ id: 'history', group: 'Barra', keys: [], how: 'Barra vacía', action: 'Tus 5 últimos comandos' },
	{ id: 'move', group: 'Barra', keys: ['↑', '↓'], action: 'Moverte por las sugerencias' },
	{ id: 'open', group: 'Barra', keys: ['Intro'], action: 'Abrir' },
	{ id: 'home', group: 'Barra', keys: ['Esc'], action: 'Volver a la portada', match: { key: 'Escape' } },
	{ id: 'panel', group: 'Paneles', keys: ['M'], how: 'con el foco en el título de un panel, o pulsa el título', action: 'Ampliar el panel', match: { key: 'm' } },
	{ id: 'panel-close', group: 'Paneles', keys: ['Esc', '✕'], how: 'con un panel ampliado', action: 'Cerrarlo' },
	{ id: 'options', group: 'Paneles', keys: ['←', '→'], how: 'en un grupo de opciones', action: 'Cambiar de opción' },
	{ id: 'clear', group: 'Paneles', keys: ['Esc'], how: 'en un buscador', action: 'Vaciarlo' },
	{ id: 'row-next', group: 'Listas', keys: ['J', '↓'], how: 'con el foco en un titular o una fila (entra con Tab)', action: 'Siguiente', match: { key: 'j' } },
	{ id: 'row-prev', group: 'Listas', keys: ['K', '↑'], how: 'con el foco en un titular o una fila', action: 'Anterior', match: { key: 'k' } },
	{ id: 'row-open', group: 'Listas', keys: ['Intro'], how: 'con el foco en un titular o una fila', action: 'Abrir' },
	{ id: 'row-open-source', group: 'Listas', keys: ['O'], how: 'con el foco en un titular o una fila', action: 'Abrir la fuente en otra pestaña', match: { key: 'o' } },
	{ id: 'fullscreen', group: 'Pantalla', keys: ['⇧', 'F'], combo: true, action: 'Pantalla completa', match: { key: 'F', shift: true } },
	{ id: 'tv-pause', group: 'TV', keys: ['Espacio'], how: 'en modo TV', action: 'Pausar o seguir', match: { key: ' ' } },
	{ id: 'tv-exit', group: 'TV', keys: ['Esc'], how: 'en modo TV', action: 'Salir', match: { key: 'Escape' } }
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

const byId = new Map<string, Shortcut>(SHORTCUTS.map((s) => [s.id, s]));

/** ¿La tecla pulsada es la de este atajo? Las letras valen en mayúscula o minúscula, salvo si piden ⇧. */
export function isShortcut(e: Pick<KeyboardEvent, 'key' | 'shiftKey'>, id: ShortcutId): boolean {
	const m = byId.get(id)?.match;
	if (!m) return false;
	if (m.shift) return e.shiftKey && e.key === m.key;
	return e.key.length === 1 ? e.key.toLowerCase() === m.key.toLowerCase() : e.key === m.key;
}

/** Cómo se unen las teclas de un atajo al mostrarlas: juntas o con «o». */
export const keyJoin = (s: Shortcut) => (s.combo ? ' ' : ' o ');
