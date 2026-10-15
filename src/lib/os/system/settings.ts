// Ajustes del sistema de Arc OS (clave arc-os-system): cómo se leen y sus valores por defecto. Lógica pura.

export interface SysSettings {
	/** Pantalla de inicio la primera vez del día. */
	boot: boolean;
	/** Sonidos del sistema (arranque, bloqueo, avisos). Apagados por defecto. */
	sounds: boolean;
}
export const DEFAULTS: SysSettings = { boot: true, sounds: false };

export function parseSettings(raw: string | null): SysSettings {
	try {
		const o = JSON.parse(raw ?? '{}') as Partial<SysSettings>;
		return {
			boot: typeof o.boot === 'boolean' ? o.boot : DEFAULTS.boot,
			sounds: typeof o.sounds === 'boolean' ? o.sounds : DEFAULTS.sounds
		};
	} catch {
		return { ...DEFAULTS };
	}
}

