import { describe, expect, it } from 'vitest';
import { leaders, parseFactbase, parseMoncloa, zoned } from '../sources/leaders.ts';
import { mockFetch } from './mock.ts';

// Trozo con la forma real de la página de La Moncloa (texto tras quitar etiquetas).
const moncloa = (date: string, body: string) => `<html><body><script>var x = "12:00 h. no";</script>
<div>Escuchar <h1>Agenda del Presidente - ${date}</h1>${body}<a>Imprimir</a></div><footer>Aviso legal 10:00 h. nada</footer></body></html>`;

describe('leaders', () => {
	it('convierte la hora local de cada zona a UTC, también con el cambio de hora', () => {
		expect(zoned('2026-10-15', '08:00', 'America/New_York')).toBe('2026-10-15T12:00:00.000Z');
		expect(zoned('2026-11-02', '08:00', 'America/New_York')).toBe('2026-11-02T13:00:00.000Z');
		expect(zoned('2026-10-14', '09:30', 'Europe/Madrid')).toBe('2026-10-14T07:30:00.000Z');
	});

	it('lee la agenda de La Moncloa: hora de Madrid, acto y lugar', () => {
		const html = moncloa(
			'13.10.2026',
			`<p>Pedro S&#225;nchez</p><p>Presidente del Gobierno</p>
			<p><strong>09:30 h.</strong> Preside la reuni&#243;n del Consejo de Ministros, que se celebra en el Complejo de la Moncloa.</p>
			<p><strong>18:00 h.</strong> Viaja a Bruselas (B&#233;lgica).</p>`
		);
		expect(parseMoncloa(html, '2026-10-13')).toEqual([
			{
				start: '2026-10-13T07:30:00.000Z',
				date: '2026-10-13',
				title: 'Preside la reunión del Consejo de Ministros, que se celebra en el Complejo de la Moncloa.',
				place: 'Complejo de la Moncloa'
			},
			{ start: '2026-10-13T16:00:00.000Z', date: '2026-10-13', title: 'Viaja a Bruselas (Bélgica).', place: '' }
		]);
		expect(parseMoncloa(moncloa('14.10.2026', 'No se han encontrado eventos'), '2026-10-14')).toEqual([]);
		expect(() => parseMoncloa('<html>otra cosa</html>', '2026-10-14')).toThrow('formato');
	});

	it('lee la agenda de Factba.se y pasa de la hora de Washington a UTC', () => {
		const now = Date.parse('2026-10-14T12:00:00Z');
		const events = parseFactbase(
			[
				{ date: '2026-10-15', time: null, details: 'TBD: The President arrives the White House', location: 'The White House' },
				{ date: '2026-10-15', time: '08:00:00', details: 'The President participates in Executive Time', location: 'The White House' },
				{ date: '2026-09-01', time: '08:00:00', details: 'Viejo', location: '' }
			],
			now
		);
		expect(events).toEqual([
			{ start: null, date: '2026-10-15', title: 'The President arrives the White House', place: 'The White House' },
			{ start: '2026-10-15T12:00:00.000Z', date: '2026-10-15', title: 'The President participates in Executive Time', place: 'The White House' }
		]);
	});

	it('si una agenda falla, ese líder sale sin agenda y el otro sigue', async () => {
		mockFetch((url) => (url.includes('factba.se') ? [] : undefined));
		const data = await leaders.fetch(undefined);
		expect(data.map((l) => [l.id, l.events === null])).toEqual([
			['sanchez', true],
			['trump', false]
		]);
		expect(data[0].error).toContain('404');
	});
});
