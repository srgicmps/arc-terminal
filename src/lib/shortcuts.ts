// Registro único de atajos de teclado. De aquí salen la lista de HELP (y del MANUAL) y las teclas que
// escuchan la barra de comandos y el modo TV: si cambia una tecla, se cambia aquí y cambia en todas partes.
// Lógica pura, sin Svelte, para probarla con Vitest.

export type ShortcutGroup = 'Barra' | 'Paneles' | 'Listas' | 'Pantalla' | 'TV' | 'Arc OS';

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
	match?: { key: string; shift?: boolean; alt?: boolean; ctrl?: boolean; code?: string };
}

export const SHORTCUTS = [
	{ id: 'bar', group: 'Barra', keys: ['/'], how: 'o empieza a escribir', action: 'Ir a la barra', match: { key: '/' } },
	{ id: 'history', group: 'Barra', keys: ['↑', '↓'], how: 'con la barra vacía', action: 'Recorrer tus últimos comandos, como en un terminal' },
	{ id: 'move', group: 'Barra', keys: ['↑', '↓'], how: 'mientras escribes', action: 'Moverte por las sugerencias' },
	{ id: 'queue', group: 'Barra', keys: ['Alt', '→'], combo: true, how: 'tras «ECO; WS CURVA» (o Intro con la barra vacía)', action: 'Abrir la siguiente vista de la cola', match: { key: 'ArrowRight', alt: true } },
	{ id: 'favs', group: 'Barra', keys: ['1', '9'], how: 'tras «fav ECO TIPOS»', action: 'Abrir un favorito (del 1 al 9)' },
	{ id: 'complete', group: 'Barra', keys: ['Tab'], how: 'tras un comando y un espacio salen sus opciones', action: 'Completar con la sugerencia (comando, líder, país, provincia…)', match: { key: 'Tab' } },
	{ id: 'open', group: 'Barra', keys: ['Intro'], action: 'Abrir' },
	{ id: 'home', group: 'Barra', keys: ['Esc'], action: 'Volver a la portada', match: { key: 'Escape' } },
	{ id: 'fold', group: 'Paneles', keys: [], how: 'Toca el título de un panel', action: 'Plegarlo o desplegarlo (se recuerda)' },
	{ id: 'panel', group: 'Paneles', keys: ['M'], how: 'con el foco en el título de un panel, o ⤢', action: 'Ampliar el panel', match: { key: 'm' } },
	{ id: 'panel-close', group: 'Paneles', keys: ['Esc', '✕'], how: 'con un panel ampliado', action: 'Cerrarlo' },
	{ id: 'options', group: 'Paneles', keys: ['←', '→'], how: 'en un grupo de opciones', action: 'Cambiar de opción' },
	{ id: 'clear', group: 'Paneles', keys: ['Esc'], how: 'en un buscador', action: 'Vaciarlo' },
	{ id: 'swipe', group: 'Pantalla', keys: [], how: 'En el móvil, desliza a izquierda o derecha', action: 'Vista de al lado de la fila de arriba' },
	{ id: 'row-next', group: 'Listas', keys: ['J', '↓'], how: 'con el foco en un titular o una fila (entra con Tab)', action: 'Siguiente', match: { key: 'j' } },
	{ id: 'row-prev', group: 'Listas', keys: ['K', '↑'], how: 'con el foco en un titular o una fila', action: 'Anterior', match: { key: 'k' } },
	{ id: 'row-open', group: 'Listas', keys: ['Intro'], how: 'con el foco en un titular o una fila', action: 'Abrir' },
	{ id: 'row-open-source', group: 'Listas', keys: ['O'], how: 'con el foco en un titular o una fila', action: 'Abrir la fuente en otra pestaña', match: { key: 'o' } },
	{ id: 'fullscreen', group: 'Pantalla', keys: ['⇧', 'F'], combo: true, action: 'Pantalla completa', match: { key: 'F', shift: true } },
	{ id: 'exp', group: 'Pantalla', keys: ['⇧', 'X'], combo: true, how: 'o el botón ✦', action: 'Saltar a otra experiencia (periódico, radio, muro…)', match: { key: 'X', shift: true } },
	{ id: 'tv-pause', group: 'TV', keys: ['Espacio'], how: 'en modo TV', action: 'Pausar o seguir', match: { key: ' ' } },
	{ id: 'tv-exit', group: 'TV', keys: ['Esc'], how: 'en modo TV', action: 'Salir', match: { key: 'Escape' } },
	// Arc OS (src/lib/components/os/WindowLayer.svelte, handleKey): todos con Alt, también con el foco dentro de una ventana.
	{ id: 'os-next', group: 'Arc OS', keys: ['Alt', 'º'], combo: true, how: 'o Alt+Tab si el sistema lo deja; con ⇧, la anterior', action: 'Cambiar de ventana: salen las miniaturas; al soltar Alt, vas a la elegida (Esc cancela)' },
	{ id: 'os-max', group: 'Arc OS', keys: ['Alt', '↑'], combo: true, action: 'Maximizar o restaurar la ventana' },
	{ id: 'os-min', group: 'Arc OS', keys: ['Alt', '↓'], combo: true, action: 'Desencajar o minimizar la ventana' },
	{ id: 'os-half', group: 'Arc OS', keys: ['Alt', '⇧', '←', '→'], combo: true, how: 'o ⌘/Super + flechas (después, ↑ o ↓ la pasan a un cuarto)', action: 'Ventana a media pantalla' },
	{ id: 'os-menu', group: 'Arc OS', keys: ['⇧', 'F10'], combo: true, how: 'o clic derecho en la barra de título', action: 'Menú de la ventana (siempre encima, nueva ventana, mover a otro escritorio…)' },
	{ id: 'os-close', group: 'Arc OS', keys: ['Alt', 'W'], combo: true, action: 'Cerrar la ventana' },
	{ id: 'os-tile', group: 'Arc OS', keys: ['Alt', 'T'], combo: true, action: 'Mosaico: todas las ventanas en rejilla' },
	{ id: 'os-keys', group: 'Arc OS', keys: ['←', '↑', '→', '↓'], how: 'con el foco en la barra de título (con ⇧, cambia el tamaño)', action: 'Mover la ventana' },
	{ id: 'os-terminal', group: 'Arc OS', keys: ['Ctrl', 'Alt', 'T'], combo: true, action: 'Abrir una Terminal (la barra de comandos como consola)' },
	{ id: 'os-desk', group: 'Arc OS', keys: ['Alt', '1…6'], combo: true, action: 'Ir a un escritorio' },
	// Escritorio y paneles de Arc OS (src/lib/os/shell/, foco en src/lib/os/focus.ts).
	{ id: 'os-search', group: 'Arc OS', keys: ['Ctrl', 'Espacio'], combo: true, how: 'o la lupa de la barra', action: 'Buscar apps, valores, países, comandos y ajustes' },
	{ id: 'os-icons', group: 'Arc OS', keys: ['←', '↑', '→', '↓'], how: 'en los iconos del escritorio (entra con Tab); Espacio elige y Ctrl+Espacio suma', action: 'Ir al icono de al lado' },
	{ id: 'os-ctx', group: 'Arc OS', keys: ['⇧', 'F10'], combo: true, how: 'en el escritorio o en un icono (o la tecla de menú)', action: 'Su menú, como el clic derecho' },
	{ id: 'os-esc', group: 'Arc OS', keys: ['Esc'], how: 'en un menú, el buscador, el Panel de control o los avisos', action: 'Cerrarlo: el foco vuelve adonde estaba' },
	// Sistema de Arc OS (src/lib/os/system/SystemLayer.svelte). `code` porque en el Mac ⌥ cambia la letra.
	{ id: 'os-lock', group: 'Arc OS', keys: ['Ctrl', 'Alt', 'L'], combo: true, action: 'Bloquear la pantalla (se entra con un clic o una tecla)', match: { key: 'l', ctrl: true, alt: true, code: 'KeyL' } },
	// App Ajustes de Arc OS (src/lib/os/apps/settings/Settings.svelte).
	{ id: 'os-settings-home', group: 'Arc OS', keys: ['Esc'], how: 'en Ajustes, dentro de una sección', action: 'Volver al panel con todos los ajustes', match: { key: 'Escape' } }
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

const byId = new Map<string, Shortcut>(SHORTCUTS.map((s) => [s.id, s]));

/** ¿La tecla pulsada es la de este atajo? Las letras valen en mayúscula o minúscula, salvo si piden ⇧. */
export function isShortcut(
	e: Pick<KeyboardEvent, 'key' | 'shiftKey'> & { altKey?: boolean; ctrlKey?: boolean; code?: string },
	id: ShortcutId
): boolean {
	const m = byId.get(id)?.match;
	if (!m) return false;
	if (m.ctrl) return e.ctrlKey === true && e.altKey === !!m.alt && (m.code ? e.code === m.code : e.key.toLowerCase() === m.key);
	if (m.alt) return e.altKey === true && e.key === m.key;
	if (m.shift) return e.shiftKey && e.key === m.key;
	return e.key.length === 1 ? e.key.toLowerCase() === m.key.toLowerCase() : e.key === m.key;
}

/** Cómo se unen las teclas de un atajo al mostrarlas: juntas o con «o». */
export const keyJoin = (s: Shortcut) => (s.combo ? ' ' : ' o ');
