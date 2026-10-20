// Pages Function de Cloudflare: /api/push (avisos en el navegador, Web Push). Toda la lógica está en cloud/push.ts.
import { d1PushStore, handlePush, type PushEnv } from '../../cloud/push.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: PushEnv }) =>
	handlePush(request, env, env.DB ? d1PushStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
