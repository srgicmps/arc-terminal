// Pages Function de Cloudflare: /api/family («Mandar a la familia»). La lógica está en cloud/family.ts (con sus
// tests). Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1AlertStore } from '../../cloud/alerts.ts';
import { d1FamilyStore, handleFamily } from '../../cloud/family.ts';
import { json } from '../../cloud/prefs.ts';
import { d1PushStore, type PushEnv } from '../../cloud/push.ts';

export const onRequest = ({ request, env }: { request: Request; env: PushEnv }) =>
	handleFamily(
		request,
		env,
		env.DB ? d1FamilyStore(env.DB) : null,
		env.DB ? d1AlertStore(env.DB) : null,
		// Claves de Access, fetch y hora: los de siempre.
		undefined,
		undefined,
		undefined,
		// Y los navegadores con avisos (Web Push), si los tiene.
		env.DB ? d1PushStore(env.DB) : null
	).catch(() => json(503, { error: 'no disponible' }));
