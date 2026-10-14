// Federal Register, el «BOE» de EE. UU.: API pública de la National Archives (sin clave).
// https://www.federalregister.gov/developers/documentation/api/v1 · Dominio público.
import type { FedRegData, FedRegDoc } from '../../src/lib/types.ts';
import { getJson, plain, type Source } from '../lib.ts';

const API = 'https://www.federalregister.gov/api/v1/documents.json';
const FIELDS = [
	'document_number',
	'title',
	'type',
	'subtype',
	'abstract',
	'agencies',
	'publication_date',
	'html_url',
	'pdf_url'
];

type Raw = Record<string, any>;

async function documents(type: string, count: number): Promise<FedRegDoc[]> {
	const params = new URLSearchParams({ per_page: String(count), order: 'newest' });
	params.append('conditions[type][]', type);
	for (const field of FIELDS) params.append('fields[]', field);
	const body = await getJson<{ results?: Raw[] }>(`${API}?${params}`);
	return (body.results ?? []).map((raw) => ({
		id: String(raw.document_number ?? ''),
		title: plain(raw.title, 400),
		type: String(raw.type ?? ''),
		subtype: String(raw.subtype ?? ''),
		abstract: plain(raw.abstract, 500),
		agencies: (raw.agencies ?? []).map((a: Raw) => plain(a.name ?? a.raw_name)).filter(Boolean),
		date: String(raw.publication_date ?? ''),
		url: String(raw.html_url ?? ''),
		pdf: String(raw.pdf_url ?? '')
	}));
}

export const fedreg: Source<FedRegData> = {
	name: 'fedreg',
	label: 'Federal Register · National Archives (EE. UU.)',
	maxAgeMinutes: 55,
	async fetch() {
		const [presidential, rules] = await Promise.all([
			documents('PRESDOCU', 25),
			documents('RULE', 25)
		]);
		if (!presidential.length && !rules.length) throw new Error('sin documentos');
		return { presidential, rules };
	}
};
