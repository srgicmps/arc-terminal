import { describe, expect, it } from 'vitest';
import { findLeader, LEADERS, nowNext, recent, today } from './leaders.ts';

const ev = (start: string | null, date: string, title = 'x') => ({ start, date, title, place: '' });
const NOW = Date.parse('2026-10-14T10:00:00Z'); // 12:00 en Madrid

describe('leaders', () => {
	it('hoy en hora de Madrid: un acto de Washington a las 18:30 ya es mañana', () => {
		const events = [ev('2026-10-14T07:30:00Z', '2026-10-14', 'a'), ev('2026-10-14T22:30:00Z', '2026-10-14', 'b'), ev(null, '2026-10-14', 'c'), ev(null, '2026-10-15', 'd')];
		expect(today(events, NOW).map((e) => e.title)).toEqual(['c', 'a']);
	});

	it('ahora y siguiente', () => {
		const events = [ev('2026-10-14T07:30:00Z', '2026-10-14', 'consejo'), ev('2026-10-14T09:15:00Z', '2026-10-14', 'reunión'), ev('2026-10-14T16:00:00Z', '2026-10-14', 'viaje')];
		expect(nowNext(events, NOW)).toMatchObject({ current: { title: 'reunión' }, next: { title: 'viaje' } });
		// Si el último acto empezó hace más de 2 h, no hay «ahora».
		expect(nowNext(events, Date.parse('2026-10-14T12:00:00Z')).current).toBeNull();
	});

	it('lo último: comunicados del presidente y documentos del Federal Register', () => {
		const gov = [
			{ title: 'Sánchez se reúne con…', url: 'u1', source: 'La Moncloa', time: '2026-10-14T08:00:00Z', summary: '' },
			{ title: 'La ministra de Hacienda…', url: 'u2', source: 'La Moncloa', time: '2026-10-14T09:00:00Z', summary: '' },
			{ title: 'Remarks', url: 'u3', source: 'Casa Blanca', time: '2026-10-13T20:00:00Z', summary: '' }
		];
		const fedreg = [{ id: '1', title: 'Executive Order 14999', type: '', subtype: '', abstract: '', agencies: [], date: '2026-10-14', url: 'u4', pdf: '' }];
		const eco = [
			{ title: 'Christine Lagarde: Where AI risks meet', url: 'u5', source: 'BCE', time: '2026-10-01T15:30:00Z', summary: '' },
			{ title: 'Monetary policy decisions', url: 'u6', source: 'BCE', time: '2026-10-02T12:15:00Z', summary: '' }
		];
		const [sanchez, trump, lagarde] = LEADERS;
		expect(recent(sanchez, { gov }, fedreg).map((i) => i.url)).toEqual(['u1']);
		expect(recent(trump, { gov }, fedreg).map((i) => i.url)).toEqual(['u4', 'u3']);
		expect(recent(lagarde, { gov, eco }).map((i) => i.url)).toEqual(['u5']);
	});

	it('findLeader: id, nombre, alias sin tildes y principio de palabra', () => {
		expect(findLeader('lagarde')?.id).toBe('lagarde');
		expect(findLeader('SANCHEZ')?.id).toBe('sanchez');
		expect(findLeader('Von der Leyen')?.id).toBe('vonderleyen');
		expect(findLeader('pow')?.id).toBe('powell');
		expect(findLeader('reserva federal')?.id).toBe('powell');
		expect(findLeader('xx')).toBeUndefined();
		expect(new Set(LEADERS.map((l) => l.id)).size).toBe(LEADERS.length);
	});
});
