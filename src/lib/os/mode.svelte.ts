// Estado del modo (Terminal clásico ↔ Modo OS) en el navegador. Reglas en mode.ts. Lo usan la Bienvenida, el aviso
// de novedad, el botón de la cabecera clásica y la shell de Arc OS («Salir de Arc OS»). Como un store de Pinia.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isOsMode, OS_KEY, type OsMode } from './mode.ts';

const initial = (): OsMode => {
	try {
		const v = localStorage.getItem(OS_KEY);
		return isOsMode(v) ? v : 'clasico';
	} catch {
		return 'clasico';
	}
};

export const osMode = $state({ value: (typeof window === 'undefined' ? 'clasico' : initial()) as OsMode });

export const isOS = () => osMode.value === 'os';

/** Guarda el modo sin moverse de sitio (la Bienvenida lo deja elegido para el final). */
export function setOsMode(value: OsMode) {
	osMode.value = value;
	try {
		localStorage.setItem(OS_KEY, value);
	} catch {}
}

/** Entra en el Modo OS (ruta /os). */
export function enterOS() {
	setOsMode('os');
	goto(resolve('/os' as '/'));
}

/** Vuelve al Terminal clásico, a la portada. */
export function leaveOS() {
	setOsMode('clasico');
	goto(resolve('/'));
}

export const toggleOS = () => (isOS() ? leaveOS() : enterOS());
