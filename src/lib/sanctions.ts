// GEO, «Sanciones y aranceles»: EE. UU. (sanctions.json), Reino Unido (sanctions-uk.json) y los actos de
// sanciones de la UE (eurlex.json), en una sola lista (M41). Lógica pura, con tests.
import type { EuLexDoc, TradeDoc } from './types.ts';

/** Un acto de la serie L con el tema «Sanciones», con la forma de las demás. */
export function euSanction(d: EuLexDoc): TradeDoc {
	return {
		id: `eu:${d.id}`,
		title: d.title,
		type: d.type,
		subtype: '',
		abstract: '',
		agencies: ['UE'],
		date: d.date,
		url: d.url,
		pdf: '',
		agency: 'UE',
		topic: 'Sanciones'
	};
}

/** Las tres listas juntas, sin repetir, de lo más reciente a lo más antiguo (a igualdad, EE. UU., Reino Unido, UE). */
export function mergeSanctions(
	us: TradeDoc[] | null | undefined,
	uk: TradeDoc[] | null | undefined,
	eu: EuLexDoc[] | null | undefined
): TradeDoc[] {
	const all = [...(us ?? []), ...(uk ?? []), ...(eu ?? []).filter((d) => d.tags.includes('Sanciones')).map(euSanction)];
	const seen = new Set<string>();
	return all
		.filter((d) => !seen.has(d.id) && !!seen.add(d.id))
		.map((d, i) => ({ d, i }))
		.sort((a, b) => b.d.date.localeCompare(a.d.date) || a.i - b.i)
		.map((x) => x.d);
}
