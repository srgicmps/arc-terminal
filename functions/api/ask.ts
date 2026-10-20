// Pages Function de Cloudflare: /api/ask («PREGUNTA», la única pieza con IA). Toda la lógica está en cloud/ask.ts
// (con sus tests). Si algo falla (la base, por ejemplo), 503, nunca 500.
import { d1AskStore, handleAsk, type AskEnv } from '../../cloud/ask.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: AskEnv }) =>
	handleAsk(request, env, env.DB ? d1AskStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
