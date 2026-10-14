import { describe, expect, it } from 'vitest';
import { accumulate, eurlex, parseL, splitTitle } from '../sources/eurlex.ts';
import type { EuLexDoc } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

const item = (title: string, date = 'Wed, 14 Oct 2026 00:00:00 +0200') =>
	`<item><title>${title}</title><link>https://eur-lex.europa.eu/./legal-content/AUTO/?uri=X</link><pubDate>${date}</pubDate><description>Council of the European Union</description></item>`;
const rss = (...items: string[]) => `<?xml version="1.0"?><rss version="2.0"><channel><title>5 - Acts of the Official Journal L</title>${items.join('')}</channel></rss>`;

const doc = (id: string, date: string): EuLexDoc => ({ id, title: id, type: 'Reglamento', tags: [], date, url: '' });

describe('eurlex', () => {
	it('separa el número CELEX del título', () => {
		expect(splitTitle('CELEX:32026R1753: Commission Delegated Regulation (EU) 2026/1753')).toEqual({
			celex: '32026R1753',
			title: 'Commission Delegated Regulation (EU) 2026/1753'
		});
		expect(splitTitle('Otra cosa')).toBeNull();
	});

	it('lee los actos con su tipo, etiquetas y día de Madrid, sin correcciones de errores', () => {
		const docs = parseL(
			rss(
				item('CELEX:32026R1800: Council Regulation (EU) 2026/1800 concerning restrictive measures in view of the situation in Ukraine'),
				item('CELEX:32026R1801: Commission Implementing Regulation imposing a definitive anti-dumping duty on steel'),
				item('CELEX:32026L0020: Directive (EU) 2026/20 on the internal market for electricity'),
				item('CELEX:32026D0900: Council Decision (EU) 2026/900'),
				item('CELEX:32023D2424R(02) The corrigendum does not concern the English version.')
			)
		);
		expect(docs.map((d) => [d.id, d.type, d.tags])).toEqual([
			['32026R1800', 'Reglamento', ['Sanciones']],
			['32026R1801', 'Reglamento', ['Aranceles']],
			['32026L0020', 'Directiva', ['Energía']],
			['32026D0900', 'Decisión', []]
		]);
		expect(docs[0].date).toBe('2026-10-14');
		expect(docs[0].url).toBe('https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32026R1800');
	});

	it('acumula sin repetir y olvida lo de hace más de 30 días', () => {
		const out = accumulate([doc('B', '2026-10-14'), doc('A', '2026-10-13')], [doc('A', '2026-10-13'), doc('V', '2026-09-01')], '2026-10-14');
		expect(out.map((d) => d.id)).toEqual(['B', 'A']);
	});

	it('si el RSS viene vacío, se queda con lo guardado', async () => {
		mockFetch(() => rss());
		const previous = [doc('A', new Date().toISOString().slice(0, 10))];
		expect(await eurlex.fetch(previous)).toEqual(previous);
		await expect(eurlex.fetch(undefined)).rejects.toThrow();
	});
});
