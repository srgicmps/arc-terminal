// Los errores que ven los usuarios en su navegador llegan a /admin (F29), sin datos personales.
// SvelteKit llama a handleError cuando algo falla al navegar o al pintar una vista (como app.config.errorHandler
// en Vue). Lo que falla después, en un clic o en un efecto, no pasa por ahí: llega a window como 'error' o
// 'unhandledrejection', y por eso se escuchan también. Todo acaba en report(): solo en la web publicada (ni en
// `pnpm dev` ni en localhost, así la prueba de humo y los e2e no informan), como mucho 5 por carga y uno por
// firma, y limpio (src/lib/errreport.ts). Informar nunca puede provocar otro error.
// Este archivo va en el arranque de todas las vistas, así que es mínimo: errreport.ts solo se descarga (import())
// la primera vez que hay un error.
import { dev, version } from '$app/env';
import { asset } from '$app/paths';
import type { HandleClientError } from '@sveltejs/kit/hooks';
import type { ErrorReport } from '#lib/errreport.ts';

const api = () => asset('api/errors' as Parameters<typeof asset>[0]);

/**
 * Lo manda como sendBeacon, pero con fetch y keepalive: sale aunque se cierre la página y, a diferencia de
 * sendBeacon, deja mandar JSON y no seguir la redirección al login si la sesión de Access ha caducado.
 */
const post = (r: ErrorReport) =>
	void fetch(api(), {
		method: 'POST',
		keepalive: true,
		redirect: 'manual',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(r)
	}).catch(() => {});

/** El informador con su tope (se crea con el primer error). */
let send: ((r: ErrorReport) => boolean) | undefined;

function report(err: unknown, fallback?: string) {
	if (dev) return;
	try {
		// Lo de la página se lee ya: mientras llega errreport.ts, se puede haber cambiado de vista.
		const html = document.documentElement;
		const page = {
			path: location.pathname,
			ver: version,
			style: html.dataset.style,
			modo: html.dataset.modo,
			embed: window.top !== window
		};
		import('#lib/errreport.ts')
			.then((m) => {
				// Solo en la web publicada y donde está la API (en la raíz, como /admin).
				if (!m.canReport(dev, location.hostname) || new URL(api(), location.href).pathname !== '/api/errors') return;
				const e = m.describe(err, fallback);
				if (m.skip(e.msg, e.stack, e.name)) return;
				send ??= m.reporter(post);
				send(m.clean({ ...page, msg: e.msg, stack: e.stack }));
			})
			.catch(() => {});
	} catch {
		// Nada: el error de verdad ya está en la consola.
	}
}

export const handleError: HandleClientError = ({ kind, error }) => {
	// Solo los fallos de nuestro código: ni los 404 (framework) ni los error() lanzados a propósito (app).
	if (kind === 'unknown') report(error);
};

addEventListener('error', (e) => report(e.error, e.message));
addEventListener('unhandledrejection', (e) => report(e.reason));
