import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [weather, air, alerts] = await Promise.all([
		dataset('weather'),
		dataset('air'),
		dataset('alerts')
	]);
	return { weather, air, alerts };
};
