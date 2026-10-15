// Pages Function de Cloudflare: /api/prefs. Toda la lógica está en cloud/prefs.ts (con sus tests).
import { d1Store, handlePrefs, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handlePrefs(request, env, env.DB ? d1Store(env.DB) : null);
