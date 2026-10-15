import { describe, expect, it } from 'vitest';
import { diff, merge, readMemory, startPlan } from './cloud.ts';

describe('merge', () => {
	it('primera vez con el servidor vacío: sube todo lo de aquí (migración)', () => {
		const local = { 'arc-accent': 'cyan', 'arc-watchwords': '["paro"]' };
		const plan = merge(local, {}, null);
		expect(plan.push).toEqual({ set: local, del: [] });
		expect(plan.apply).toEqual({ set: {}, del: [] });
		expect(plan.result).toEqual(local);
	});
	it('primera vez con datos en los dos: se juntan y en lo repetido manda el servidor', () => {
		const plan = merge({ a: '1', b: 'aquí' }, { b: 'servidor', c: '3' }, null);
		expect(plan.result).toEqual({ a: '1', b: 'servidor', c: '3' });
		expect(plan.push).toEqual({ set: { a: '1' }, del: [] });
		expect(plan.apply).toEqual({ set: { b: 'servidor', c: '3' }, del: [] });
	});
	it('luego: lo cambiado aquí sube, lo cambiado fuera baja, y lo borrado se borra', () => {
		const base = { a: '1', b: '2', c: '3', d: '4' };
		const local = { a: 'nuevo', b: '2', d: '4' }; // a cambia aquí, c se borra aquí
		const remote = { a: '1', b: 'fuera', c: '3' }; // b cambia fuera, d se borra fuera
		const plan = merge(local, remote, base);
		expect(plan.push).toEqual({ set: { a: 'nuevo' }, del: ['c'] });
		expect(plan.apply).toEqual({ set: { b: 'fuera' }, del: ['d'] });
		expect(plan.result).toEqual({ a: 'nuevo', b: 'fuera' });
	});
	it('si cambió en los dos sitios, gana este navegador', () => {
		expect(merge({ a: 'aquí' }, { a: 'fuera' }, { a: '0' }).push).toEqual({ set: { a: 'aquí' }, del: [] });
	});
});

describe('startPlan', () => {
	it('si en este navegador estaba otra persona, no sube nada suyo: lo cambia por lo de la cuenta nueva', () => {
		const plan = startPlan({ a: 'de Ana' }, { b: 'de Luis' }, { user: 'ana@x.es', base: { a: 'de Ana' } }, 'luis@x.es');
		expect(plan.push).toEqual({ set: {}, del: [] });
		expect(plan.apply).toEqual({ set: { b: 'de Luis' }, del: ['a'] });
	});
	it('la misma persona: fusión normal', () => {
		const plan = startPlan({ a: '2' }, { a: '1' }, { user: 'ana@x.es', base: { a: '1' } }, 'ana@x.es');
		expect(plan.push.set).toEqual({ a: '2' });
	});
});

it('diff y readMemory', () => {
	expect(diff({ a: '1', b: '2' }, { a: '1', c: '3' })).toEqual({ set: { c: '3' }, del: ['b'] });
	expect(readMemory('no')).toBeNull();
	expect(readMemory(JSON.stringify({ user: 'a', base: {} }))).toEqual({ user: 'a', base: {} });
});
