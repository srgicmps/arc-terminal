// Tus alertas, MIS y palabras para los avisos, en tu cuenta (/api/alerts, cloud/alerts.ts): lo usan la barra
// («alerta NVDA > 150», «+NVDA», «vigila aranceles») y AVISOS. Sustituye a los issues públicos de GitHub (F14).
import { asset } from '$app/paths';
import { parseConfig, type AlertConfig } from './alertconfig.ts';

const url = () => asset('api/alerts' as Parameters<typeof asset>[0]);

/** ¿Hay cuenta? Solo en arcterminal.dev; en local, no. */
export const hasAccount = () => new URL(url(), location.href).pathname === '/api/alerts';

export type Saved = { ok: true; config: AlertConfig } | { ok: false; why: 'none' | 'error' };

/** Lee tu configuración, le aplica `change` y la guarda. */
export async function changeAlerts(change: (c: AlertConfig) => AlertConfig): Promise<Saved> {
	if (!hasAccount()) return { ok: false, why: 'none' };
	try {
		const res = await fetch(url(), { cache: 'no-store', redirect: 'manual' });
		if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
		const now = parseConfig(((await res.json()) as { config: unknown }).config);
		const put = await fetch(url(), {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ config: change(now) }),
			redirect: 'manual'
		});
		if (!put.ok) throw new Error(String(put.status));
		return { ok: true, config: parseConfig(((await put.json()) as { config: unknown }).config) };
	} catch {
		return { ok: false, why: 'error' };
	}
}
