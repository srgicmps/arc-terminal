// Modelos de IA nuevos del mes y su precio: lista pública de modelos de OpenRouter (sin clave; una consulta cada 6 h).
// Ver src/lib/aimodels.ts.
import { parseAiModels, type AiModel } from '../../src/lib/aimodels.ts';
import { getJson, list, type Source } from '../lib.ts';

export const aimodels: Source<AiModel[]> = {
	name: 'aimodels',
	label: 'Modelos de IA nuevos y su precio · OpenRouter',
	maxAgeMinutes: 360,
	async fetch() {
		const body = await getJson<{ data?: unknown[] }>('https://openrouter.ai/api/v1/models');
		const models = parseAiModels(list(body.data) as Parameters<typeof parseAiModels>[0], Date.now());
		if (!models.length) throw new Error('OpenRouter no trae modelos del último mes');
		return models;
	}
};
