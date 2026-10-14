import { describe, expect, it } from 'vitest';
import { bankOf, speeches } from '../sources/speeches.ts';
import { mockFetch } from './mock.ts';

describe('speeches', () => {
	it('saca el banco central de la descripción, con nombre corto en los conocidos', () => {
		expect(bankOf('Speech by Mr Andrew Bailey, Governor of the Bank of England, at the Mansion House, London, 10 October 2026.')).toBe('Banco de Inglaterra');
		expect(bankOf('Remarks by Mr Jerome H Powell, Chair of the Board of Governors of the Federal Reserve System, at a conference, 9 October 2026.')).toBe('Reserva Federal');
		expect(bankOf('Speech by Mr Gabriel Makhlouf, Governor of the Central Bank of Ireland, at an event, Dublin, 8 October 2026.')).toBe('Central Bank of Ireland');
		expect(bankOf('Opening remarks by Mr Pablo Hernández de Cos, General Manager of the BIS, at Y, 1 October 2026.')).toBe('BIS');
		expect(bankOf('')).toBe('BIS');
	});

	it('lee el RSS 1.0 del BIS, del más reciente al más antiguo y sin resumen', async () => {
		const item = (title: string, date: string, descr: string) =>
			`<item rdf:about="https://www.bis.org/review/${date}.htm"><title>${title}</title><link>https://www.bis.org/review/${date}.htm</link><description>${descr}</description><dc:date>${date}T10:00:00Z</dc:date></item>`;
		mockFetch(
			() => `<?xml version="1.0" encoding="utf-8"?><rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel rdf:about="https://www.bis.org/doclist/cbspeeches.rss"><title>BIS</title></channel>
${item('Christine Lagarde: Monetary policy', '2026-10-10', 'Speech by Ms Christine Lagarde, President of the European Central Bank, at the IMF, 10 October 2026.')}
${item('Andrew Bailey: Inflation', '2026-10-12', 'Speech by Mr Andrew Bailey, Governor of the Bank of England, at X, 12 October 2026.')}
</rdf:RDF>`
		);
		const data = await speeches.fetch(undefined);
		expect(data.items.map((i) => [i.source, i.title])).toEqual([
			['Banco de Inglaterra', 'Andrew Bailey: Inflation'],
			['BCE', 'Christine Lagarde: Monetary policy']
		]);
		expect(data.items[0].summary).toBe('');
	});
});
