// Sanciones y aranceles de EE. UU. en el Federal Register (la misma API pública que fedreg.ts):
// - OFAC (Tesoro): todo lo que publica son sanciones (designaciones, licencias, reglamentos).
// - USTR: aranceles y medidas comerciales (Section 301…).
// - ITA (Comercio): solo lo que habla de la Section 232, porque además publica cada día decenas de
//   avisos rutinarios de antidumping.
// El RSS propio de OFAC está retirado: no se usa.
import type { TradeDoc } from '../../src/lib/types.ts';
import { type Source } from '../lib.ts';
import { search } from './fedreg.ts';

interface Query {
	agency: string;
	topic: string;
	conditions: [string, string][];
}

export const QUERIES: Query[] = [
	{ agency: 'OFAC', topic: 'Sanciones', conditions: [['conditions[agencies][]', 'foreign-assets-control-office']] },
	{ agency: 'USTR', topic: 'Aranceles', conditions: [['conditions[agencies][]', 'trade-representative-office-of-united-states']] },
	{
		agency: 'ITA',
		topic: 'Aranceles',
		conditions: [
			['conditions[agencies][]', 'international-trade-administration'],
			['conditions[term]', '"Section 232"']
		]
	}
];

/** Junta las consultas sin repetir documentos y deja primero los más recientes. */
export function merge(lists: TradeDoc[][], max = 30): TradeDoc[] {
	const seen = new Set<string>();
	return lists
		.flat()
		.filter((d) => d.id && !seen.has(d.id) && seen.add(d.id))
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, max);
}

export const sanctions: Source<TradeDoc[]> = {
	name: 'sanctions',
	label: 'Sanciones y aranceles de EE. UU. · Federal Register (OFAC, USTR, ITA)',
	maxAgeMinutes: 60,
	async fetch() {
		const results = await Promise.allSettled(
			QUERIES.map(async (q) => (await search(q.conditions, 20)).map((d) => ({ ...d, agency: q.agency, topic: q.topic })))
		);
		const ok = results.filter((r): r is PromiseFulfilledResult<TradeDoc[]> => r.status === 'fulfilled');
		results.forEach((r, i) => r.status === 'rejected' && console.log(`  sanctions · ${QUERIES[i].agency}: ${r.reason?.message ?? r.reason}`));
		if (!ok.length) throw new Error('el Federal Register no responde');
		return merge(ok.map((r) => r.value));
	}
};
