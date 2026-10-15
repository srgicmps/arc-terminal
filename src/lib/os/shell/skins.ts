// Aspectos del escritorio de Arc OS: tres formas de presentar la misma lógica (ventanas, apps, escritorios),
// inspiradas en los sistemas de siempre pero sin marcas ni iconos de nadie. Van en <div class="os"
// data-os-skin="…">: cambian la barra, los menús, los botones de ventana (los pinta el núcleo), el fondo y la letra.
// Lógica pura.

export const SKINS = [
	{ id: 'windows', label: 'Windows', desc: 'Barra de tareas abajo con botón Inicio y menú, bandeja con reloj y ventanas con _ □ ✕ a la derecha.' },
	{ id: 'mac', label: 'Mac', desc: 'Barra de menús arriba con el nombre de la app, dock centrado abajo, semáforos a la izquierda, Launchpad y buscador con Ctrl+Espacio.' },
	{ id: 'linux', label: 'Linux', desc: 'Barra superior con «Actividades»: todas las ventanas en mosaico, escritorios virtuales y apps de un vistazo.' }
] as const;

export type Skin = (typeof SKINS)[number]['id'];
export const DEFAULT_SKIN: Skin = 'windows';
export const isSkin = (v: unknown): v is Skin => SKINS.some((s) => s.id === v);

/** Dónde va cada pieza en cada aspecto. */
export function layoutOf(skin: Skin, bar: 'top' | 'bottom') {
	return {
		/** Barra de arriba: menús (Mac), Actividades (Linux) o la de tareas si se ha subido (Windows). */
		top: skin === 'mac' ? 'menubar' : skin === 'linux' ? 'topbar' : bar === 'top' ? 'taskbar' : null,
		/** Abajo: la barra de tareas (Windows) o el dock (Mac). */
		bottom: skin === 'mac' ? 'dock' : skin === 'windows' && bar === 'bottom' ? 'taskbar' : null
	} as const;
}

/**
 * Lupa del dock: cuánto crece cada icono según lo cerca que esté el puntero (en px desde su centro). A más de
 * `reach` px no crece; justo encima crece `max` veces. Curva suave (coseno) para que no salte.
 */
export function magnify(distance: number, reach = 120, max = 1.6): number {
	const d = Math.abs(distance);
	if (d >= reach) return 1;
	return 1 + (max - 1) * (0.5 + 0.5 * Math.cos((Math.PI * d) / reach));
}

/** ¿Es el atajo del buscador? Ctrl+Espacio (o ⌘+Espacio en un Mac de verdad). */
export const isSpotlightKey = (e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>) =>
	e.code === 'Space' && (e.ctrlKey || e.metaKey) && !e.altKey;
