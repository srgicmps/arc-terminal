// Pages Function de Cloudflare: /api/rss («Mis RSS»). Toda la lógica está en cloud/rss.ts (con sus tests).
// Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1RssStore, handleRss } from '../../cloud/rss.ts';
import { json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handleRss(request, env, env.DB ? d1RssStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
