// Avisos (app Sencilla): los del tiempo en vigor al construir; los de la cuenta se leen en el navegador.
import { dataset } from '#lib/data.ts';
import type { AlertsData } from '#lib/weather.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const alerts = await dataset<AlertsData>('alerts');
	return { weather: (alerts?.data.alerts ?? []).filter((a) => Date.parse(a.expires) > Date.now()) };
};
