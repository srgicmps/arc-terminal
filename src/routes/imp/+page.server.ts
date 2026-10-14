import { dataset } from '#lib/data.ts';
import { trim } from '#lib/trim.ts';
import type { ImpData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const imp = await dataset<ImpData>('imp');
	// La vista no usa la memoria de temas (`seen`) y del top actual solo enseña los 10 primeros.
	return { imp: trim(imp, (d) => ({ ...d, current: d.current.slice(0, 10), seen: [] })) };
};
