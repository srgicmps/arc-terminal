import { dataset } from '#lib/data.ts';
import type { FundMove, FundPosition, FundsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

/** Una compra o venta, sin el número de acciones (no se pinta). */
const move = ({ cusip, name, putCall, value, pct, status }: FundMove) => ({ cusip, name, putCall, value, pct, status });
const position = ({ cusip, name, putCall, value, weight }: FundPosition) => ({ cusip, name, putCall, value, weight });

export const load: PageServerLoad = async () => {
	const set = await dataset<FundsData>('funds');
	// Solo lo que se pinta: sin CIK ni nombre oficial, sin las acciones y, del trimestre anterior, solo la fecha.
	const funds = set && {
		fetchedAt: set.fetchedAt,
		funds: set.data.funds.map((f) => ({
			key: f.key,
			name: f.name,
			manager: f.manager,
			period: f.period,
			filed: f.filed,
			url: f.url,
			total: f.total,
			count: f.count,
			prevPeriod: f.prev?.period ?? null,
			top: f.top.map(position),
			bought: f.bought.map(move),
			sold: f.sold.map(move)
		}))
	};
	return { funds };
};
