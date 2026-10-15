import { describe, expect, it } from 'vitest';
import { byDay, changeCommand, changeExperience } from './changes.ts';
import { merged } from '../../scripts/sources/changes.ts';

const pull = (number: number, title: string, merged_at: string | null) => ({
	number,
	title,
	merged_at,
	updated_at: merged_at ?? '2026-10-14T10:00:00Z',
	html_url: `https://github.com/x/y/pull/${number}`
});

describe('merged', () => {
	it('solo los fusionados desde la fecha, sin los trenes y del más reciente al más antiguo', () => {
		const since = Date.parse('2026-10-08T00:00:00Z');
		const items = merged(
			[
				pull(1, 'LUZ: 25 horas', '2026-10-14T13:00:00Z'),
				pull(2, 'Cerrado sin fusionar', null),
				pull(3, 'Tren 8: avisos (#1, #4)', '2026-10-14T20:00:00Z'),
				pull(4, 'TOP: módulos', '2026-10-14T20:00:01Z'),
				pull(5, 'Antiguo', '2026-10-01T10:00:00Z')
			],
			since
		);
		expect(items.map((i) => i.number)).toEqual([4, 1]);
		expect(items[0]).toEqual({
			number: 4,
			title: 'TOP: módulos',
			mergedAt: '2026-10-14T20:00:01Z',
			url: 'https://github.com/x/y/pull/4'
		});
	});
});

describe('changeCommand', () => {
	it('reconoce el comando del principio del título', () => {
		expect(changeCommand('LUZ: 25 horas el día del cambio')?.code).toBe('LUZ');
		expect(changeCommand('ECO (M6): PIB interanual')?.code).toBe('ECO');
		expect(changeCommand('GEO y USGOV: sanciones')?.code).toBe('GEO');
	});

	it('nada si no empieza por un comando conocido', () => {
		expect(changeCommand('Panel ampliado: también en encajar')).toBeNull();
		expect(changeCommand('PWA: acceso directo')).toBeNull();
		expect(changeCommand('Registro de fuentes')).toBeNull();
	});
});

describe('byDay', () => {
	it('agrupa por día de Madrid con «Hoy» y «Ayer»', () => {
		const now = Date.parse('2026-10-14T20:30:00Z'); // 22:30 en Madrid
		const days = byDay(
			[
				{ number: 2, title: 'b', mergedAt: '2026-10-14T08:00:00Z', url: '' },
				{ number: 1, title: 'a', mergedAt: '2026-10-13T21:30:00Z', url: '' }, // 23:30 del 13 en Madrid
				{ number: 0, title: 'z', mergedAt: '2026-10-11T10:00:00Z', url: '' }
			],
			now
		);
		expect(days.map((d) => [d.label, d.items.map((i) => i.number)])).toEqual([
			['Hoy', [2]],
			['Ayer', [1]],
			['dom 11 oct', [0]]
		]);
	});
});

describe('changeExperience', () => {
	it('lleva a la experiencia si el título empieza por «Experiencia <nombre>»', () => {
		expect(changeExperience('Experiencia Radio: informativo hablado (#427)')?.id).toBe('radio');
		expect(changeExperience('Experiencia Sala de control: el mundo en un mapa (#462)')?.id).toBe('sala');
		expect(changeExperience('Experiencias: galería con vistas previas')).toBeNull();
		expect(changeExperience('LUZ: horas baratas')).toBeNull();
	});
});
