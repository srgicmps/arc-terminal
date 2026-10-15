// Estado del sistema de Arc OS en el navegador: pantalla de inicio, bloqueo y sus ajustes. Como un store de
// Pinia: un objeto reactivo y unas funciones. Reglas puras en boot.ts.
//   · arc-os-boot: el día del último arranque (sale una vez al día).
//   · arc-os-system: ajustes del sistema (arranque y sonidos), sincronizados con la cuenta.
import { dayKey, startPhase } from './boot.ts';
import { DEFAULTS, parseSettings, type SysSettings } from './settings.ts';
import { playTone, type SoundKind } from './sounds.ts';

export const SYS_KEYS = { boot: 'arc-os-boot', settings: 'arc-os-system', locked: 'arc-os-locked' } as const;

/** Bloqueada en esta pestaña (sessionStorage): al recargar sigue bloqueada, como se espera de un bloqueo. */
const session = {
	get: () => {
		try {
			return sessionStorage.getItem(SYS_KEYS.locked) === '1';
		} catch {
			return false;
		}
	},
	set: (on: boolean) => {
		try {
			if (on) sessionStorage.setItem(SYS_KEYS.locked, '1');
			else sessionStorage.removeItem(SYS_KEYS.locked);
		} catch {}
	}
};

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

export const sys = $state({
	/** off: aún no se ha mirado · boot: pantalla de inicio · lock: bloqueo · on: escritorio. */
	phase: 'off' as 'off' | 'boot' | 'lock' | 'on',
	settings: { ...DEFAULTS } as SysSettings
});

/** Al montar Arc OS: arranque (si toca hoy) y bloqueo, o directo al escritorio. */
export function startSystem(now = new Date()) {
	sys.settings = parseSettings(read(SYS_KEYS.settings));
	sys.phase = startPhase(sys.settings.boot, read(SYS_KEYS.boot), now, session.get());
	if (sys.phase === 'boot') write(SYS_KEYS.boot, dayKey(now));
}

/** Suena un sonido del sistema, solo si están encendidos. */
export const sound = (kind: SoundKind) => sys.settings.sounds && playTone(kind);

export const bootDone = () => (sound('boot'), session.set(true), (sys.phase = 'lock'));
export const lock = () => (sound('lock'), session.set(true), (sys.phase = 'lock'));
export const unlock = () => (sound('unlock'), session.set(false), (sys.phase = 'on'));

export function setSettings(patch: Partial<SysSettings>) {
	sys.settings = { ...sys.settings, ...patch };
	write(SYS_KEYS.settings, JSON.stringify(sys.settings));
}
