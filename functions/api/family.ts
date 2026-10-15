// Pages Function de Cloudflare: /api/family («Mandar a la familia»). La lógica está en cloud/family.ts (con sus
// tests). Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1AlertStore } from '../../cloud/alerts.ts';
import { d1FamilyStore, handleFamily } from '../../cloud/family.ts';
import { json, type Env } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
	handleFamily(
		request,
		env,
		env.DB ? d1FamilyStore(env.DB) : null,
		env.DB ? d1AlertStore(env.DB) : null
	).catch(() => json(503, { error: 'no disponible' }));
