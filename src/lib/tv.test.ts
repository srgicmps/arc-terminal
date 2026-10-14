import { describe, expect, it } from 'vitest';
import { TV_DEFAULT, parseTv, routeOf, tvCandidates, tvQuery } from './tv.ts';

describe('modo TV', () => {
	it('lee las vistas y los segundos de la URL', () => {
		expect(parseTv('top, ws;GEO luz', '45')).toEqual({ codes: ['TOP', 'WS', 'GEO', 'LUZ'], seconds: 45 });
	});

	it('quita lo que no existe, lo repetido y lo que no va en la tele', () => {
		expect(parseTv('TOP,NADA,TOP,TV,HELP,WS', null).codes).toEqual(['TOP', 'WS']);
		expect(tvCandidates().some((c) => c.code === 'TV')).toBe(false);
	});

	it('sin vistas válidas, las de siempre; los segundos entre 10 y 600', () => {
		expect(parseTv('', 'x')).toEqual({ codes: TV_DEFAULT, seconds: 30 });
		expect(parseTv(null, '2').seconds).toBe(10);
		expect(parseTv(null, '9999').seconds).toBe(600);
	});

	it('enlace y rutas', () => {
		expect(tvQuery(['TOP', 'WS'], 30)).toBe('?tv=TOP,WS&s=30');
		expect(routeOf('WS')).toBe('/ws');
		expect(routeOf('NADA')).toBe('/');
	});
});
