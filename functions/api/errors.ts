// Pages Function de Cloudflare: /api/errors. Toda la lógica está en cloud/errors.ts (con sus tests).
import { d1ErrorStore, handleErrors } from '../../cloud/errors.ts';
import type { AdminEnv } from '../../cloud/feedback.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: AdminEnv }) =>
	handleErrors(request, env, env.DB ? d1ErrorStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
