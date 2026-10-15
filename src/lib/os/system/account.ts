// Qué decir de tu cuenta en Arc OS (Panel de control, Ajustes, la inicial de la barra y los avisos). Lógica pura;
// el estado lo lleva src/lib/cloud.svelte.ts y los avisos salen de account.svelte.ts.
import { PREFS } from '../../prefs.ts';

export type CloudState = 'local' | 'sync' | 'ok' | 'offline' | 'auth' | 'error';

/** Nombre corto de una clave que no cabe en la cuenta («una nota», «tus carpetas del escritorio»…). */
export function keyLabel(key: string): string {
	if (key.startsWith('arc-os-note-')) return 'una nota muy larga';
	const what = PREFS.find((p) => p.key === key || (p.prefix !== undefined && key.startsWith(p.prefix)))?.what ?? key;
	return what.split(/[:(]/)[0].trim().toLowerCase();
}

/** La frase de la cuenta y si es un aviso (algo no se está subiendo). */
export function accountLine(state: CloudState, user: string, frozen: string[] = []): { text: string; warn: boolean } {
	const big = frozen.length
		? ` ${frozen.length === 1 ? 'Hay algo que no cabe' : `Hay ${frozen.length} cosas que no caben`} en la cuenta (${keyLabel(frozen[0])}): se queda solo en este navegador.`
		: '';
	switch (state) {
		case 'ok':
			return { text: `Tu cuenta: ${user}. Se sincroniza entre tus dispositivos.${big}`, warn: !!big };
		case 'sync':
			return { text: 'Conectando con tu cuenta…', warn: false };
		case 'offline':
			return { text: 'Sin conexión: lo que cambies se guarda aquí y se sube al volver.', warn: true };
		case 'auth':
			return { text: 'Tu sesión ha caducado: recarga la página para entrar otra vez. Mientras, todo se guarda aquí.', warn: true };
		case 'error':
			return { text: 'Tu cuenta no responde: lo que cambies se guarda aquí y se subirá solo.', warn: true };
		default:
			return { text: 'Sin cuenta: todo se queda en este navegador.', warn: false };
	}
}
