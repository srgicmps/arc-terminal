import { dataset, type SourceHistory, type SourceStatus } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	// El historial va aparte para que status.json, que se carga en todas las vistas, siga siendo ligero.
	const [status, history] = await Promise.all([
		dataset<SourceStatus[]>('status'),
		dataset<SourceHistory[]>('status-history')
	]);
	return { status, history };
};
