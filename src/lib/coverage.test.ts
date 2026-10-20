import { describe, expect, it } from 'vitest';
import { coverageSentence, stories } from './coverage.ts';

const item = (source: string, title: string, url: string, time: string, extra: object = {}) => ({ source, title, url, time, summary: '', ...extra });

describe('stories', () => {
	it('junta el mismo hecho entre secciones e idiomas y marca los ángulos muertos', () => {
		const list = stories([
			item('El País', 'El BCE baja los tipos de interés al 1,75 %', 'https://elpais.com/a', '2026-10-15T10:00:00Z', {
				also: [{ source: 'RTVE', url: 'https://rtve.es/a' }]
			}),
			item('BBC', 'ECB cuts interest rates to 1.75%', 'https://bbc.co.uk/a', '2026-10-15T09:00:00Z', { lang: 'en', titleEs: 'El BCE baja los tipos de interés al 1,75 %' }),
			item('Al Jazeera', 'European Central Bank cuts rates', 'https://aljazeera.com/a', '2026-10-15T08:00:00Z', { also: [{ source: 'BBC', url: 'https://bbc.co.uk/a' }] }),
			item('CNBC', 'Apple unveils new iPhone', 'https://cnbc.com/b', '2026-10-15T07:00:00Z')
		]);
		expect(list).toHaveLength(1);
		expect(list[0].title).toBe('El BCE baja los tipos de interés al 1,75 %');
		expect(list[0].outlets.map((o) => o.source)).toEqual(['El País', 'RTVE', 'BBC', 'Al Jazeera']);
		expect(list[0].regions).toEqual(['es', 'uk', 'me']);
		expect(list[0].missing).toEqual(['eu', 'us', 'asia', 'africa']);
		expect(coverageSentence(list)).toBe('La noticia más repetida la cuentan 4 medios de 3 regiones; no sale en Europa, EE. UU., Asia, África.');
	});

	it('marca con lang «en» solo el título que se queda en inglés', () => {
		const bbc = (extra: object = {}) =>
			item('BBC', 'Floods hit northern Italy after record rainfall', 'https://bbc.co.uk/f', '2026-10-15T10:00:00Z', {
				lang: 'en',
				also: [{ source: 'Al Jazeera', url: 'https://aljazeera.com/f' }],
				...extra
			});
		// Sin traducción ni medio español: el original, en inglés.
		const [original] = stories([bbc()]);
		expect(original.title).toBe('Floods hit northern Italy after record rainfall');
		expect(original.lang).toBe('en');
		// Con traducción: el título es la traducción y hereda el español de la página.
		const [translated] = stories([bbc({ titleEs: 'Inundaciones en el norte de Italia tras lluvias récord' })]);
		expect(translated.title).toBe('Inundaciones en el norte de Italia tras lluvias récord');
		expect(translated).not.toHaveProperty('lang');
		// Si lo cuenta un medio español, manda su titular.
		const [spanish] = stories([
			bbc({ also: [{ source: 'El País', url: 'https://elpais.com/f' }] }),
			item('El País', 'Inundaciones históricas en Italia', 'https://elpais.com/f', '2026-10-15T09:00:00Z')
		]);
		expect(spanish.title).toBe('Inundaciones históricas en Italia');
		expect(spanish).not.toHaveProperty('lang');
	});

	it('no junta titulares parecidos con más de 24 h de diferencia', () => {
		const list = stories([
			item('El País', 'Terremoto de magnitud 7 en Japón', 'https://elpais.com/c', '2026-10-15T10:00:00Z'),
			item('El Mundo', 'Terremoto de magnitud 7 en Japón', 'https://elmundo.es/c', '2026-10-13T10:00:00Z')
		]);
		expect(list).toEqual([]);
	});
});
