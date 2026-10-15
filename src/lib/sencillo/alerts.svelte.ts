// Avisos de la cuenta para la app Sencilla: lee y guarda la misma configuración que AVISOS (/api/alerts,
// cloud/alerts.ts). Sin cuenta (en local o fuera de arcterminal.dev) no llama a nada.
import { asset } from '$app/paths';
import { DEFAULT_CONFIG, parseConfig, type AlertConfig } from '../alertconfig.ts';

const url = () => asset('api/alerts' as Parameters<typeof asset>[0]);

export const alerts = $state({
	phase: 'idle' as 'idle' | 'loading' | 'none' | 'ready' | 'error',
	config: { ...DEFAULT_CONFIG } as AlertConfig,
	saving: false,
	saved: ''
});

/** Carga una vez (las pestañas que lo usan lo llaman en un $effect). */
export function loadAlerts() {
	if (alerts.phase !== 'idle') return;
	if (new URL(url(), location.href).pathname !== '/api/alerts') {
		alerts.phase = 'none';
		return;
	}
	alerts.phase = 'loading';
	fetch(url(), { cache: 'no-store', redirect: 'manual' })
		.then(async (res) => {
			if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
			const body = (await res.json()) as { config: unknown };
			alerts.config = parseConfig(body.config);
			alerts.phase = 'ready';
		})
		.catch(() => (alerts.phase = 'error'));
}

export async function saveAlerts(patch: Partial<AlertConfig>) {
	const next = { ...alerts.config, ...patch };
	alerts.saving = true;
	alerts.saved = '';
	try {
		const res = await fetch(url(), {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ config: next, rotate: false }),
			redirect: 'manual'
		});
		if (!res.ok) throw new Error(String(res.status));
		const body = (await res.json()) as { config: unknown };
		alerts.config = parseConfig(body.config);
		alerts.saved = 'Guardado';
	} catch {
		alerts.saved = 'No se ha podido guardar. Prueba otra vez.';
	} finally {
		alerts.saving = false;
	}
}
