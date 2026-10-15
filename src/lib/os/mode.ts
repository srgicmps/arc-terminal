// Arc OS (D46): dos modos con nombre claro, «Terminal clásico» (lo de siempre) y «Modo OS» (escritorio con
// ventanas; en el móvil, pantalla de inicio). Lógica pura; el estado del navegador está en mode.svelte.ts.

export type OsMode = 'os' | 'clasico';

/** Modo guardado. Sin nada, Terminal clásico. */
export const OS_KEY = 'arc-os';
/** Ya se ha enseñado el aviso «Prueba el Modo OS» a quien usaba la terminal antes de que existiera. */
export const OS_INVITE_KEY = 'arc-os-invite';

export const OS_MODES: readonly { value: OsMode; label: string; desc: string }[] = [
	{ value: 'clasico', label: 'Terminal clásico', desc: 'Vistas a pantalla completa, barra de comandos y paneles densos' },
	{ value: 'os', label: 'Modo OS', desc: 'Escritorio con ventanas, menú Inicio y widgets; en el móvil, pantalla de inicio con apps' }
];

export const isOsMode = (v: unknown): v is OsMode => v === 'os' || v === 'clasico';
export const osLabel = (m: OsMode) => OS_MODES.find((x) => x.value === m)!.label;

/**
 * ¿Se enseña el aviso de novedad? Solo a quien ya usaba la terminal (tiene claves «arc-…»), no ha elegido modo
 * y no lo ha visto. A quien llega nuevo se lo ofrece la Bienvenida.
 */
export function shouldInvite(stored: string | null, seen: string | null, keys: Iterable<string>): boolean {
	if (isOsMode(stored) || seen) return false;
	for (const k of keys) if (k.startsWith('arc-') && k !== OS_KEY && k !== OS_INVITE_KEY) return true;
	return false;
}
