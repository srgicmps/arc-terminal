import { dataset } from '#lib/data.ts';
import { holdersFromTop } from '#lib/holders.ts';
import type { FundsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// El índice de HDS (unos 500 valores, src/lib/holders.ts) sin las acciones, y de cada fondo su nombre y su trimestre.
export const load: PageServerLoad = async () => {
	const set = await dataset<FundsData>('funds');
	if (!set) return { hds: null };
	// Las copias de antes de HDS no traen el índice: se rehace con las 10 mayores de cada fondo.
	const full = !!set.data.holders;
	const holders = set.data.holders ?? holdersFromTop(set.data.funds);
	return {
		hds: {
			fetchedAt: set.fetchedAt,
			top: full ? 100 : 10,
			funds: set.data.funds.map(({ key, name, period, filed }) => ({ key, name, period, filed })),
			issuers: holders.map((e) => ({
				cusip: e.cusip,
				name: e.name,
				total: e.total,
				holders: e.holders.map(({ fund, value, weight, rank, change, pct }) => ({ fund, value, shares: 0, weight, rank, change, pct }))
			}))
		}
	};
};
