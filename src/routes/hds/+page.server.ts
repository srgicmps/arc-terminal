import { dataset } from '#lib/data.ts';
import type { FundsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// El índice de HDS (unos 500 valores, src/lib/holders.ts) sin las acciones, y de cada fondo su nombre y su trimestre.
export const load: PageServerLoad = async () => {
	const set = await dataset<FundsData>('funds');
	if (!set?.data.holders) return { hds: null };
	return {
		hds: {
			fetchedAt: set.fetchedAt,
			funds: set.data.funds.map(({ key, name, period, filed }) => ({ key, name, period, filed })),
			issuers: set.data.holders.map((e) => ({
				cusip: e.cusip,
				name: e.name,
				total: e.total,
				holders: e.holders.map(({ fund, value, weight, rank, change, pct }) => ({ fund, value, shares: 0, weight, rank, change, pct }))
			}))
		}
	};
};
