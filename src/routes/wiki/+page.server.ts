import { dataset } from '#lib/data.ts';
import { trim } from '#lib/trim.ts';
import type { WikiData, WikiEdition } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

/** Efemérides por idioma: el feed trae entre 30 y 60, y la vista no necesita tantas. */
const ON_THIS_DAY = 20;

const short = <E extends WikiEdition>(e: E): E => ({ ...e, onThisDay: e.onThisDay.slice(0, ON_THIS_DAY) });

export const load: PageServerLoad = async () => ({
	wiki: trim(await dataset<WikiData>('wiki'), (d) => ({ ...short(d), ...(d.en && { en: short(d.en) }) }))
});
