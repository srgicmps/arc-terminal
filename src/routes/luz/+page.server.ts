import { dataset } from '#lib/data.ts';
import type { DemandData, EuPowerData, PowerData, PowerMixData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [power, mix, eupower, demand] = await Promise.all([
		dataset<PowerData>('power'),
		dataset<PowerMixData>('power-mix'),
		dataset<EuPowerData>('energycharts'),
		dataset<DemandData>('ree-demand')
	]);
	return { power, mix, eupower, demand };
};
