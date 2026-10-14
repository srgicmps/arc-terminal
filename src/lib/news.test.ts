import { describe, expect, it } from 'vitest';
import { mentions, names } from './news.ts';

const news = (...titles: string[]) => titles.map((title) => ({ title, url: `https://x/${title}`, source: 'X', time: null, summary: '' }));
const titles = (items: { title: string }[]) => items.map((i) => i.title);

describe('mentions', () => {
	it('busca el nombre y los alias por palabra completa y sin tildes', () => {
		const itx = { name: 'Inditex', aliases: ['Zara', 'Amancio Ortega'] };
		const items = news('Inditex gana un 9 % más', 'Zara abre en Maó', 'La familia de Amancio  Ortega', 'Zaragoza bate récords', 'INDITEX sube');
		expect(titles(mentions(items, itx))).toEqual(['Inditex gana un 9 % más', 'Zara abre en Maó', 'La familia de Amancio  Ortega', 'INDITEX sube']);
		expect(titles(mentions(news('Telefonica y Movistar Plus', 'TELEFÓNICA'), { name: 'Telefónica' }))).toEqual(['Telefonica y Movistar Plus', 'TELEFÓNICA']);
	});

	it('si el nombre empieza por mayúscula, el titular también', () => {
		const items = news('Meta presenta sus gafas', 'El Gobierno rebaja la meta de déficit', 'META cae en bolsa');
		expect(titles(mentions(items, { name: 'Meta' }))).toEqual(['Meta presenta sus gafas', 'META cae en bolsa']);
		// En minúscula, da igual: «oro» y «Oro».
		expect(titles(mentions(news('El oro marca máximos', 'Oro y plata'), { name: 'Oro', aliases: ['oro'] }))).toHaveLength(2);
	});

	it('nombres con signos y sin «(ETF)»', () => {
		expect(names({ name: 'S&P 500 (ETF)' })).toEqual(['S&P 500']);
		expect(titles(mentions(news('El S&P 500 cierra en verde', 'S&P 5000'), { name: 'S&P 500 (ETF)' }))).toEqual(['El S&P 500 cierra en verde']);
		expect(titles(mentions(news('J.P. Morgan sube', 'JxP Morgan'), { name: 'JPMorgan', aliases: ['J.P. Morgan'] }))).toEqual(['J.P. Morgan sube']);
	});
});
