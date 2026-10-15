import { dataset } from '#lib/data.ts';
import { rvMetrics } from '#lib/rv.ts';
import type { PeersData, PerfData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Cifras de unos 60 valores (perf.json) y de sus competidores de fuera (peers.json), solo las que compara RV.
// El valor se elige en el navegador (?s=NVDA).
export const load: PageServerLoad = async () => {
	const [perf, peers] = await Promise.all([dataset<PerfData>('perf'), dataset<PeersData>('peers')]);
	const metrics = perf?.data.metrics;
	if (!metrics || !peers) return { rv: null };
	return {
		rv: {
			fetchedAt: perf.fetchedAt,
			peersAt: peers.fetchedAt,
			metrics: rvMetrics(metrics, peers.data.metrics),
			peers: Object.fromEntries(Object.entries(peers.data.symbols).map(([k, v]) => [k, v.peers]))
		}
	};
};
