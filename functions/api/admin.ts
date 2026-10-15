// Pages Function de Cloudflare: /api/admin. Toda la lógica está en cloud/admin.ts (con sus tests).
import { d1AdminStore, handleAdmin, type AdminFullEnv } from '../../cloud/admin.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: AdminFullEnv }) =>
	handleAdmin(request, env, env.DB ? d1AdminStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
