// Pages Function de Cloudflare: /api/feedback. Toda la lógica está en cloud/feedback.ts (con sus tests).
import { d1FeedbackStore, handleFeedback, type AdminEnv } from '../../cloud/feedback.ts';
import { json } from '../../cloud/prefs.ts';

export const onRequest = ({ request, env }: { request: Request; env: AdminEnv }) =>
	handleFeedback(request, env, env.DB ? d1FeedbackStore(env.DB) : null).catch(() => json(503, { error: 'no disponible' }));
