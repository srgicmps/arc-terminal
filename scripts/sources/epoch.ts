// Modelos frontera de IA y su cómputo de entrenamiento: CSV «Frontier AI models» de Epoch AI
// (https://epoch.ai/data/ai-models), con licencia CC BY 4.0: se puede mostrar citando la fuente.
// Una fila por modelo, con «Model», «Publication date», «Organization», «Training compute (FLOP)»…
// Ver src/lib/epoch.ts.
import type { FrontierData, FrontierModel } from '../../src/lib/epoch.ts';
import { parseCsv } from '../csv.ts';
import { getText, type Source } from '../lib.ts';

const URL = 'https://epoch.ai/data/frontier_ai_models.csv';
const KEEP = 15;

/** Del CSV, los `keep` más recientes y el récord de cómputo. */
export function parseFrontier(csv: string, keep = KEEP): FrontierData {
	const all: FrontierModel[] = [];
	for (const r of parseCsv(csv)) {
		const date = (r['Publication date'] ?? '').slice(0, 10);
		const name = (r.Model ?? '').trim();
		if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		const flop = Number(r['Training compute (FLOP)']);
		all.push({
			name,
			org: (r.Organization ?? '').split(',')[0].trim(),
			date,
			flop: r['Training compute (FLOP)'] && Number.isFinite(flop) && flop > 0 ? flop : null,
			country: (r['Country (of organization)'] ?? '').split(',')[0].trim(),
			url: /^https?:\/\//.test(r.Link ?? '') ? r.Link.split(/[\s,]/)[0] : 'https://epoch.ai/data/ai-models'
		});
	}
	all.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
	const record = all.reduce<FrontierModel | null>((best, m) => (m.flop && (!best || m.flop > (best.flop ?? 0)) ? m : best), null);
	return { models: all.slice(0, keep), record };
}

export const epoch: Source<FrontierData> = {
	name: 'epoch',
	label: 'Modelos frontera y cómputo de entrenamiento · Epoch AI (CC BY 4.0)',
	maxAgeMinutes: 720,
	minItems: 5,
	async fetch() {
		const data = parseFrontier(await getText(URL));
		if (!data.models.length) throw new Error('Epoch AI no trae modelos frontera');
		console.log(`  epoch · ${data.models.length} modelos, el último ${data.models[0].name} (${data.models[0].date})`);
		return data;
	}
};
