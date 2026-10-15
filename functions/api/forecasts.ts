// Pages Function de Cloudflare: /api/forecasts. Toda la lógica está en cloud/forecasts.ts (con sus tests).
// Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1ForecastStore, handleForecasts } from '../../cloud/forecasts.ts';
import { json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handleForecasts(request, env, env.DB ? d1ForecastStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
