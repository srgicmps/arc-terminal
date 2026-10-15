// Sondeo de los avisos de Arc (P1 y P2) para sacarlos como toasts del sistema con notify() de la shell, que
// también los deja en el centro de notificaciones. Cada 2 minutos, como el Muro; la primera vuelta solo toma
// la hora (para no inundar al entrar). Reglas en alerts.ts.
import { asset } from '$app/paths';
import { notify } from '../shell/shell.svelte.ts';
import { freshAlerts, lastTime, type LogEntry } from './alerts.ts';

let since: string | null = null;
const shown = new Set<string>();

async function poll() {
	try {
		const r = await fetch(asset('/data/notify-log.json' as Parameters<typeof asset>[0]), { cache: 'no-store' });
		if (!r.ok) return;
		const body = (await r.json()) as { data?: { entries?: LogEntry[] }; entries?: LogEntry[] };
		const entries = body.data?.entries ?? body.entries ?? [];
		for (const a of freshAlerts(entries, since).reverse())
			if (!shown.has(a.id)) {
				shown.add(a.id);
				notify({ title: a.title, detail: a.detail, href: a.href, kind: 'aviso' });
			}
		since = lastTime(entries) || since || '';
	} catch {}
}

/** Lo pone en marcha SystemLayer; devuelve la función para pararlo. */
export function startAlerts() {
	poll();
	const id = setInterval(poll, 120_000);
	return () => clearInterval(id);
}
