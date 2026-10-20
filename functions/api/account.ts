// Pages Function de Cloudflare: /api/account («Borrar mi cuenta»). Toda la lógica está en cloud/account.ts (con sus tests).
import { handleAccount } from '../../cloud/account.ts';
import { d1AdminStore } from '../../cloud/admin.ts';
import { json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handleAccount(request, env, env.DB ? d1AdminStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
