// Registro de esta sesión de Arc OS (Centro de registros): qué apps se abren y se cierran. Solo en memoria: se
// pierde al recargar y no se guarda en ningún sitio. Lo alimenta os.svelte.ts (openApp y closeNow).
import type { SessionEvent } from './logs.ts';

/** Como mucho, los últimos 200 hechos. */
const MAX = 200;

export const session = $state({ events: [] as SessionEvent[] });

export function logSession(what: SessionEvent['what'], app: string) {
	session.events = [...session.events.slice(-(MAX - 1)), { t: new Date().toISOString(), what, app }];
}
