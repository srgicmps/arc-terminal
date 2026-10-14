import { describe, expect, it } from 'vitest';
import { sanctions } from '../sources/sanctions.ts';
import { mockFetch } from './mock.ts';

const doc = (id: string, date: string, title = id) => ({
	document_number: id,
	title,
	type: 'Notice',
	subtype: null,
	abstract: '',
	agencies: [{ name: 'Foreign Assets Control Office' }],
	publication_date: date,
	html_url: `https://www.federalregister.gov/d/${id}`,
	pdf_url: ''
});

describe('sanctions', () => {
	it('consulta OFAC, USTR e ITA (Section 232), sin repetir y de más reciente a más antiguo', async () => {
		const fetch = mockFetch((url) => {
			const params = new URL(url).searchParams;
			const agency = params.get('conditions[agencies][]');
			if (agency === 'foreign-assets-control-office') return { results: [doc('2026-1', '2026-10-13', 'Notice of OFAC Sanctions Actions'), doc('2026-9', '2026-10-14')] };
			if (agency === 'trade-representative-office-of-united-states') return { results: [doc('2026-2', '2026-10-14', 'Section 301 tariff action')] };
			if (agency === 'international-trade-administration') return { results: [doc('2026-9', '2026-10-14')] };
			return undefined;
		});
		const data = await sanctions.fetch(undefined);
		expect(data.map((d) => [d.id, d.agency, d.topic])).toEqual([
			['2026-9', 'OFAC', 'Sanciones'],
			['2026-2', 'USTR', 'Aranceles'],
			['2026-1', 'OFAC', 'Sanciones']
		]);
		const ita = fetch.mock.calls.map((c) => new URL(String(c[0])).searchParams).find((p) => p.get('conditions[agencies][]') === 'international-trade-administration');
		expect(ita?.get('conditions[term]')).toBe('"Section 232"');
	});

	it('BIS (M33): control de exportaciones, y «Chips» si habla de semiconductores o computación avanzada', async () => {
		mockFetch((url) =>
			new URL(url).searchParams.get('conditions[agencies][]') === 'industry-and-security-bureau'
				? {
						results: [
							doc('2026-5', '2026-10-14', 'Additions to the Entity List'),
							doc('2026-6', '2026-10-13', 'Export Controls on Advanced Computing Items and Semiconductor Manufacturing Items')
						]
					}
				: { results: [] }
		);
		expect((await sanctions.fetch(undefined)).map((d) => [d.id, d.agency, d.topic])).toEqual([
			['2026-5', 'BIS', 'Exportaciones'],
			['2026-6', 'BIS', 'Chips']
		]);
	});

	it('si una consulta falla, sigue con las demás; si fallan todas, error', async () => {
		mockFetch((url) => (url.includes('trade-representative') ? { results: [doc('2026-2', '2026-10-14')] } : undefined));
		expect((await sanctions.fetch(undefined)).map((d) => d.agency)).toEqual(['USTR']);
		mockFetch(() => undefined);
		await expect(sanctions.fetch(undefined)).rejects.toThrow('no responde');
	});
});
