// Pages Function de Cloudflare: /api/brief («Tu mañana» por email). Toda la lógica está en cloud/brief.ts.
import { d1BriefStore, handleBrief, type BriefEnv } from '../../cloud/brief.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: BriefEnv }) =>
	handleBrief(request, env, env.DB ? d1BriefStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
