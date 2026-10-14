import { dataset } from '#lib/data.ts';
import type { EuPowerData, PowerData, PowerMixData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [power, mix, eupower] = await Promise.all([
		dataset<PowerData>('power'),
		dataset<PowerMixData>('power-mix'),
		dataset<EuPowerData>('energycharts')
	]);
	return { power, mix, eupower };
};
