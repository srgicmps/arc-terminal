import { dataset } from '#lib/data.ts';
import { EU_SHOWN, euLexShown, trim } from '#lib/trim.ts';
import type { BoeData, EuLexDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [boe, eurlex] = await Promise.all([dataset<BoeData>('boe'), dataset<EuLexDoc[]>('eurlex')]);
	// Del Diario Oficial de la UE solo lo que puede enseñar el panel (40 por filtro), no los 150 guardados.
	return { boe, eurlex: trim(eurlex, (docs) => euLexShown(docs, EU_SHOWN)) };
};
