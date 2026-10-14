// Sanciones del Reino Unido (OFSI) en la API de búsqueda de GOV.UK.
import { describe, expect, it } from 'vitest';
import { accumulate, parseOfsi } from '../sources/sanctions-uk.ts';

const result = (link: string, ts: string, over: Record<string, unknown> = {}) => ({
	title: `Financial sanctions notice: ${link}`,
	link: `/government/publications/${link}`,
	description: 'Asset freeze &amp; designations',
	public_timestamp: ts,
	content_store_document_type: 'notice',
	...over
});

describe('sanctions-uk', () => {
	it('lee los resultados de GOV.UK con su día de Madrid y descarta los incompletos', () => {
		const docs = parseOfsi({
			results: [
				result('russia', '2026-10-13T23:30:00.000+01:00'),
				result('sin-fecha', 'no'),
				{ title: '', link: '/x', public_timestamp: '2026-10-14T10:00:00Z' }
			]
		});
		expect(docs).toEqual([
			{
				id: 'ofsi:/government/publications/russia',
				title: 'Financial sanctions notice: russia',
				type: 'Aviso',
				subtype: '',
				abstract: 'Asset freeze & designations',
				agencies: ['OFSI'],
				date: '2026-10-14',
				url: 'https://www.gov.uk/government/publications/russia',
				pdf: '',
				agency: 'OFSI',
				topic: 'Sanciones'
			}
		]);
		expect(parseOfsi({})).toEqual([]);
	});

	it('acumula con lo anterior sin repetir y quita lo de hace más de 30 días', () => {
		const now = Date.parse('2026-10-14T12:00:00Z');
		const [a] = parseOfsi({ results: [result('a', '2026-10-14T10:00:00Z')] });
		const [old] = parseOfsi({ results: [result('old', '2026-08-01T10:00:00Z')] });
		const [b] = parseOfsi({ results: [result('b', '2026-10-10T10:00:00Z')] });
		expect(accumulate([a], [a, b, old], now).map((d) => d.id)).toEqual([a.id, b.id]);
	});
});
