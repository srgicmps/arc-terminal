// Pages Function de Cloudflare: /api/prefs. Toda la lógica está en cloud/prefs.ts (con sus tests).
// Si algo falla (la base, por ejemplo), 503: el navegador lo ignora y sigue con lo que tiene guardado.
// Al leer, apunta además el último acceso (tabla seen, para /admin).
import { touchSeen } from '../../cloud/admin.ts';
import { d1Store, handlePrefs, json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handlePrefs(request, env, env.DB ? { ...d1Store(env.DB), seen: (user) => touchSeen(env.DB!, user) } : null).catch(() =>
		json(503, { error: 'no disponible' })
	);
