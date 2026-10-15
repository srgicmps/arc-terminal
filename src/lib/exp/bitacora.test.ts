import { describe, expect, it } from 'vitest';
import { addEntry, dueReminders, filterEntries, ideaMove, ideaReturn, MAX_ENTRIES, parseJournal, toggleDone, topics, type Entry } from './bitacora.ts';

const e = (over: Partial<Entry> = {}): Entry => ({ id: 'a', at: '2026-10-01T10:00:00Z', kind: 'nota', text: 'Hola', ...over });

describe('bitácora', () => {
	it('limpia lo guardado: fuera lo que no vale, sin repetidas y de la más nueva a la más antigua', () => {
		const raw = JSON.stringify([
			e(),
			e({ id: 'b', at: '2026-10-05T10:00:00Z', kind: 'idea', price: 100, about: 'NVDA' }),
			e(),
			{ id: 'c', kind: 'raro', text: 'x', at: '2026-10-01' },
			{ id: 'd', kind: 'nota', text: '', at: '2026-10-01' },
			'basura'
		]);
		const list = parseJournal(raw);
		expect(list.map((x) => x.id)).toEqual(['b', 'a']);
		expect(list[0].side).toBe('larga');
		expect(parseJournal('{malo')).toEqual([]);
		expect(parseJournal(null)).toEqual([]);
	});

	it('el precio solo cuenta en las ideas y la fecha solo en los recordatorios', () => {
		const [x] = parseJournal(JSON.stringify([e({ price: 5, due: '2026-10-02' })]));
		expect(x.price).toBeUndefined();
		expect(x.due).toBeUndefined();
	});

	it('sigue una idea: larga gana si sube, corta si baja', () => {
		const idea = e({ kind: 'idea', price: 100 });
		expect(ideaReturn(idea, 104)).toBeCloseTo(4);
		expect(ideaReturn({ ...idea, side: 'corta' }, 104)).toBeCloseTo(-4);
		expect(ideaReturn(idea, null)).toBeNull();
		expect(ideaReturn(e(), 104)).toBeNull();
	});

	it('si la serie ya es un %, la idea se mide en puntos', () => {
		const bono = e({ kind: 'idea', price: 4, side: 'corta' });
		expect(ideaMove(bono, 4.25, '%')).toEqual({ value: -0.25, unit: ' pp' });
		expect(ideaMove(e({ kind: 'idea', price: 100 }), 110, '$')?.unit).toBe(' %');
	});

	it('recordatorios de hoy o atrasados y sin hacer', () => {
		const list = [
			e({ id: '1', kind: 'aviso', due: '2026-10-20' }),
			e({ id: '2', kind: 'aviso', due: '2026-10-10' }),
			e({ id: '3', kind: 'aviso', due: '2026-10-15', done: true }),
			e({ id: '4', kind: 'aviso', due: '2026-10-15' })
		];
		expect(dueReminders(list, '2026-10-15').map((x) => x.id)).toEqual(['2', '4']);
		expect(toggleDone(list, '4').find((x) => x.id === '4')?.done).toBe(true);
		expect(toggleDone(list, '3').find((x) => x.id === '3')?.done).toBeUndefined();
	});

	it('con el tope, se va la más antigua que no sea una idea abierta', () => {
		let list: Entry[] = [e({ id: 'old-idea', at: '2000-01-01T00:00:00Z', kind: 'idea', price: 1 })];
		for (let i = 0; i < MAX_ENTRIES; i++) list = addEntry(list, e({ id: `n${i}`, at: new Date(2026, 0, 1, 0, i).toISOString() }));
		expect(list).toHaveLength(MAX_ENTRIES);
		expect(list.some((x) => x.id === 'old-idea')).toBe(true);
		expect(list.some((x) => x.id === 'n0')).toBe(false);
	});

	it('filtra por tipo y palabras (sin tildes) y cuenta los temas', () => {
		const list = [e({ id: '1', text: 'Inflación España', about: 'es' }), e({ id: '2', kind: 'idea', text: 'Chips', about: 'NVDA' }), e({ id: '3', about: 'ES' })];
		expect(filterEntries(list, 'todo', ['inflacion']).map((x) => x.id)).toEqual(['1']);
		expect(filterEntries(list, 'idea', []).map((x) => x.id)).toEqual(['2']);
		expect(topics(list)).toEqual([{ about: 'ES', n: 2 }, { about: 'NVDA', n: 1 }]);
	});
});
