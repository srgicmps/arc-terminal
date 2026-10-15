// Notas de Arc OS: qué es una nota y cómo se guarda. Lógica pura (con tests); el estado en el navegador va en
// notes.svelte.ts. Cada nota es una clave «arc-os-note-<id>» (prefs.ts), así cada una tiene su tope de 64 KB en la
// cuenta (cloud/prefs.ts) y se sincronizan por separado.

export interface Note {
	id: string;
	/** HTML sencillo y ya limpio (sanitize en notes.svelte.ts): p, br, b, i, u, s, h3, ul, ol, li, blockquote, a. */
	html: string;
	/** Última edición (ms). */
	updated: number;
	pinned?: boolean;
	/** En la papelera desde (ms). Se puede restaurar; se borra del todo al vaciarla. */
	trashed?: number;
}

export const NOTE_PREFIX = 'arc-os-note-';
/** Como mucho (la cuenta guarda 200 claves en total). */
export const MAX_NOTES = 40;
/** Tope de cada nota, por debajo de los 64 KB por clave de la cuenta. */
export const MAX_HTML = 60_000;

export const noteKey = (id: string) => NOTE_PREFIX + id;

export const isNote = (v: unknown): v is Note =>
	!!v && typeof v === 'object' && typeof (v as Note).id === 'string' && typeof (v as Note).html === 'string' && typeof (v as Note).updated === 'number';

/** El texto sin etiquetas (para buscar y para el título). */
export function plainText(html: string): string {
	return html
		.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
		.replace(/<(br|\/?(p|div|h3|li|ul|ol|blockquote))(\s[^>]*)?\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

/** El título: la primera línea con texto (como en Notas del móvil). */
export function titleOf(n: Note): string {
	const line = plainText(n.html).split('\n').map((l) => l.trim()).find(Boolean);
	return line ? line.slice(0, 80) : 'Nota nueva';
}

/** Lo que va debajo del título en la lista. */
export function snippetOf(n: Note): string {
	const lines = plainText(n.html).split('\n').map((l) => l.trim()).filter(Boolean);
	return lines.slice(1).join(' · ').slice(0, 120);
}

/** Orden de la lista: fijadas primero y luego la más reciente. */
export const byRecent = (a: Note, b: Note) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated - a.updated;

/** «Hoy 14:03», «ayer», «12 oct». */
export function whenText(ms: number, now = Date.now()): string {
	const d = new Date(ms);
	const today = new Date(now);
	const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
	if (days <= 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
	if (days === 1) return 'ayer';
	return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/** Sin nada escrito (una nota nueva que se deja tal cual se borra al salir de ella). */
export const isBlank = (html: string) => !plainText(html).trim();

/**
 * ¿Cabe una nota más? Las de la papelera también cuentan (cada una es una clave de la cuenta). Si no cabe pero hay
 * algo en la papelera, `purge` es la más antigua de ella, que se borra del todo para hacer sitio.
 */
export function makeRoom(list: Note[], max = MAX_NOTES): { ok: boolean; purge?: string } {
	if (list.length < max) return { ok: true };
	const old = list.filter((n) => n.trashed).sort((a, b) => a.trashed! - b.trashed!)[0];
	return old ? { ok: true, purge: old.id } : { ok: false };
}
