// Pages Function de Cloudflare: /api/alerts. Toda la lógica está en cloud/alerts.ts (con sus tests).
// Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1AlertStore, handleAlerts } from '../../cloud/alerts.ts';
import { json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handleAlerts(request, env, env.DB ? d1AlertStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
