// Arranque y bloqueo de Arc OS: cuándo sale la pantalla de inicio y qué resume la de bloqueo. Lógica pura
// (sin Svelte ni navegador) para probarla con Vitest; el estado vive en system.svelte.ts.
import type { Notice } from '../shell/notices.ts';

/** Fecha local «AAAA-MM-DD»: el arranque sale una vez por día. */
export function dayKey(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ¿Toca la pantalla de inicio? Solo si hoy aún no ha salido. */
export const bootDue = (last: string | null, now: Date) => last !== dayKey(now);

/** Pasos que enseña el arranque, en orden. Son de adorno: la web ya está cargada. */
export const BOOT_STEPS = ['Abriendo escritorios', 'Leyendo tus ajustes', 'Mirando los avisos', 'Listo'] as const;

/** Saludo según la hora local. */
export function greeting(hour: number): string {
	if (hour >= 6 && hour < 14) return 'Buenos días';
	if (hour >= 14 && hour < 21) return 'Buenas tardes';
	return 'Buenas noches';
}

export interface LockSummary {
	/** «3 avisos sin leer», «Sin avisos nuevos». */
	headline: string;
	/** Los avisos más recientes (como mucho `max`). */
	items: Notice[];
}

/** Lo que enseña la pantalla de bloqueo: cuántos avisos quedan por leer y los últimos. */
export function lockSummary(notices: Notice[], seen: Iterable<string>, max = 3): LockSummary {
	const s = new Set(seen);
	const pending = notices.filter((n) => !s.has(n.id));
	const avisos = pending.filter((n) => n.kind === 'aviso').length;
	const headline =
		pending.length === 0
			? 'Sin avisos nuevos'
			: avisos > 0
				? `${avisos} ${avisos === 1 ? 'aviso' : 'avisos'} sin leer`
				: `${pending.length} ${pending.length === 1 ? 'novedad' : 'novedades'} de Arc`;
	return { headline, items: pending.slice(0, max) };
}
