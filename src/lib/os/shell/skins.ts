// Aspectos del escritorio de Arc OS: varias formas de presentar la misma lógica (ventanas, apps, escritorios),
// inspiradas en los sistemas de siempre pero sin marcas ni iconos de nadie. Van en <div class="os"
// data-os-skin="…">: cambian la barra, los menús, los botones de ventana (los pinta el núcleo), el fondo y la letra.
// Lógica pura.

export const SKINS = [
	{ id: 'mando', label: 'Mando', desc: 'Centro de mando: pizarra con rejilla técnica, nivel de alerta global, relojes UTC y Madrid, y pilotos de las fuentes en vivo.' },
	{ id: 'dsm', label: 'Arc DSM', desc: 'Como el panel web de un servidor: barra fina arriba con el menú de apps, iconos grandes y widgets del sistema a la derecha.' },
	{ id: 'windows', label: 'Windows', desc: 'Barra de tareas abajo con botón Inicio y menú, bandeja con reloj y ventanas con _ □ ✕ a la derecha.' },
	{ id: 'mac', label: 'Mac', desc: 'Barra de menús arriba con el nombre de la app, dock centrado abajo, semáforos a la izquierda, Launchpad y buscador con Ctrl+Espacio.' },
	{ id: 'linux', label: 'Linux', desc: 'Barra superior con «Actividades»: todas las ventanas en mosaico, escritorios virtuales y apps de un vistazo.' }
] as const;

export type Skin = (typeof SKINS)[number]['id'];
/** El de quien entra por primera vez (lo preselecciona el primer arranque). */
export const DEFAULT_SKIN: Skin = 'mando';
export const isSkin = (v: unknown): v is Skin => SKINS.some((s) => s.id === v);

/** Dónde va cada pieza en cada aspecto. */
export function layoutOf(skin: Skin, bar: 'top' | 'bottom') {
	return {
		/** Barra de arriba: la de Mando, la fina de DSM, menús (Mac), Actividades (Linux) o la de tareas si se ha subido (Windows). */
		top: skin === 'mando' ? 'mandobar' : skin === 'dsm' ? 'dsmbar' : skin === 'mac' ? 'menubar' : skin === 'linux' ? 'topbar' : bar === 'top' ? 'taskbar' : null,
		/** Abajo: la franja de estado (Mando), la barra de tareas (Windows) o el dock (Mac). */
		bottom: skin === 'mando' ? 'mandostrip' : skin === 'mac' ? 'dock' : skin === 'windows' && bar === 'bottom' ? 'taskbar' : null
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
