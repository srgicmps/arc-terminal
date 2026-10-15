// Estado del sistema de Arc OS en el navegador: pantalla de inicio, bloqueo y sus ajustes. Como un store de
// Pinia: un objeto reactivo y unas funciones. Reglas puras en boot.ts.
//   · arc-os-boot: el día del último arranque (sale una vez al día).
//   · arc-os-system: ajustes del sistema (arranque sí o no), sincronizados con la cuenta.
import { bootDue, dayKey } from './boot.ts';

export const SYS_KEYS = { boot: 'arc-os-boot', settings: 'arc-os-system' } as const;

export interface SysSettings {
	/** Pantalla de inicio la primera vez del día. */
	boot: boolean;
}
const DEFAULTS: SysSettings = { boot: true };

const read = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};
const write = (k: string, v: string) => {
	try {
		localStorage.setItem(k, v);
	} catch {}
};

export function parseSettings(raw: string | null): SysSettings {
	try {
		const o = JSON.parse(raw ?? '{}') as Partial<SysSettings>;
		return { boot: typeof o.boot === 'boolean' ? o.boot : DEFAULTS.boot };
	} catch {
		return { ...DEFAULTS };
	}
}

export const sys = $state({
	/** off: aún no se ha mirado · boot: pantalla de inicio · lock: bloqueo · on: escritorio. */
	phase: 'off' as 'off' | 'boot' | 'lock' | 'on',
	settings: { ...DEFAULTS } as SysSettings
});

/** Al montar Arc OS: arranque (si toca hoy) y bloqueo, o directo al escritorio. */
export function startSystem(now = new Date()) {
	sys.settings = parseSettings(read(SYS_KEYS.settings));
	const due = sys.settings.boot && bootDue(read(SYS_KEYS.boot), now);
	if (due) write(SYS_KEYS.boot, dayKey(now));
	sys.phase = due ? 'boot' : 'on';
}

export const bootDone = () => (sys.phase = 'lock');
export const lock = () => (sys.phase = 'lock');
export const unlock = () => (sys.phase = 'on');

export function setSettings(patch: Partial<SysSettings>) {
	sys.settings = { ...sys.settings, ...patch };
	write(SYS_KEYS.settings, JSON.stringify(sys.settings));
}
