import { describe, expect, it } from 'vitest';
import { countdown, inProgress, nextLaunch, pending, type Launch } from './launches.ts';

const launch = (id: string, net: string, windowEnd: string | null = null): Launch => ({
	id,
	mission: id,
	rocket: 'Falcon 9',
	provider: 'SpaceX',
	pad: 'SLC-40',
	location: 'Cape Canaveral SFS, FL, USA',
	net,
	precise: true,
	windowStart: net,
	windowEnd,
	status: 'Go',
	statusName: 'Go for Launch',
	url: null,
	webcast: false
});

const at = (iso: string) => Date.parse(iso);

describe('cuenta atrás de lanzamientos', () => {
	it('formatea días, horas, minutos y segundos', () => {
		expect(countdown(((2 * 24 + 4) * 3600 + 13 * 60 + 20) * 1000)).toBe('T−2 d 04:13:20');
		expect(countdown((5 * 60 + 7) * 1000 + 999)).toBe('T−00:05:07');
		expect(countdown(-5000)).toBe('T−00:00:00');
	});

	const list = [
		launch('c', '2026-10-20T03:10:00Z'),
		launch('a', '2026-10-16T02:30:00Z', '2026-10-16T06:30:00Z'),
		launch('b', '2026-10-17T10:00:00Z')
	];

	it('antes del primero, el siguiente es el de NET más cercano', () => {
		expect(nextLaunch(list, at('2026-10-15T00:00:00Z'))?.id).toBe('a');
		expect(inProgress(list, at('2026-10-15T00:00:00Z'))).toEqual([]);
	});

	it('si el NET ya pasó, el lanzamiento está en curso hasta el final de la ventana y se pasa al siguiente', () => {
		const now = at('2026-10-16T05:00:00Z');
		expect(inProgress(list, now).map((l) => l.id)).toEqual(['a']);
		expect(nextLaunch(list, now)?.id).toBe('b');
		// Pasada la ventana, desaparece de la lista.
		expect(pending(list, at('2026-10-16T07:00:00Z')).map((l) => l.id)).toEqual(['b', 'c']);
	});

	it('sin ventana, se da una hora de margen tras el NET', () => {
		expect(inProgress(list, at('2026-10-17T10:30:00Z')).map((l) => l.id)).toEqual(['b']);
		expect(inProgress(list, at('2026-10-17T11:00:00Z'))).toEqual([]);
	});

	it('cuando ya han pasado todos, no hay siguiente', () => {
		expect(nextLaunch(list, at('2026-11-01T00:00:00Z'))).toBeNull();
	});
});
