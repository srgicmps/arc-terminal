import { dataset } from '#lib/data.ts';
import type { PerfData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Del perf.json, solo los máximos y mínimos de 52 semanas y sus fechas (unos 60 valores, pocos KB).
export const load: PageServerLoad = async () => {
	const perf = await dataset<PerfData>('perf');
	const metrics = perf?.data.metrics;
	if (!metrics) return { sig: null };
	return {
		sig: {
			fetchedAt: perf.fetchedAt,
			metrics: Object.fromEntries(
				Object.entries(metrics).map(([k, v]) => [k, { high52: v.high52, low52: v.low52, high52Date: v.high52Date, low52Date: v.low52Date }])
			)
		}
	};
};
