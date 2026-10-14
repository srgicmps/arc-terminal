import { dataset } from '#lib/data.ts';
import { LEADERS } from '#lib/leaders.ts';
import { trim } from '#lib/trim.ts';
import type { FedRegData, LeaderAgenda, NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

/** Solo los titulares que recent() puede elegir para algún líder (misma fuente y mismo filtro). */
function forLeaders(set: NewsData, section: 'gov' | 'eco'): NewsData {
	const rules = LEADERS.flatMap((l) => l.news.filter((n) => n.section === section));
	return {
		...set,
		items: set.items.filter((item) =>
			rules.some((n) => item.source === n.source && (!n.match || n.match.test(`${item.title} ${item.summary}`)))
		)
	};
}

export const load: PageServerLoad = async () => {
	const [leaders, gov, eco, fedreg] = await Promise.all([
		dataset<LeaderAgenda[]>('leaders'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('news-eco'),
		dataset<FedRegData>('fedreg')
	]);
	return {
		leaders,
		gov: trim(gov, (d) => forLeaders(d, 'gov')),
		eco: trim(eco, (d) => forLeaders(d, 'eco')),
		// La vista solo usa los documentos presidenciales.
		fedreg: trim(fedreg, (d) => ({ ...d, rules: [] }))
	};
};
