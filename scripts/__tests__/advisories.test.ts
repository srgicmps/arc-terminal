import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advisories, parseTitle } from '../sources/advisories.ts';
import { mockFetch } from './mock.ts';

// Con la forma que devolvió la sonda (textos recortados).
const raw = [
	{ Title: 'Iceland - Level 1: Exercise Normal Precautions', Link: 'https://travel.state.gov/x/isl.html', Category: ['IC'], Summary: '<p>…</p>', Published: '2026-05-04T20:00:00-04:00', Updated: '2026-05-04T20:00:00-04:00' },
	{ Title: 'Ukraine - Level 4: Do Not Travel', Link: 'https://travel.state.gov/x/ukr.html', Category: ['UP'], Summary: '<p>…</p>', Published: '2026-08-28T20:00:00-04:00', Updated: '2026-08-28T20:00:00-04:00' },
	{ Title: 'Saudi Arabia - Level 3: Reconsider Travel', Link: 'https://travel.state.gov/x/sau.html', Category: ['SA'], Summary: '', Published: '2026-10-01T20:00:00-04:00', Updated: 'no es fecha' },
	{ Title: 'Worldwide Caution', Link: 'x', Category: [], Summary: '', Updated: '2026-10-01T00:00:00Z' }
];

describe('advisories', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('parseTitle: país y nivel del título', () => {
		expect(parseTitle('Ukraine - Level 4: Do Not Travel')).toEqual({ name: 'Ukraine', level: 4 });
		expect(parseTitle('Bosnia and Herzegovina - Level 2: Exercise Increased Caution')).toEqual({ name: 'Bosnia and Herzegovina', level: 2 });
		expect(parseTitle('Worldwide Caution')).toBeNull();
	});

	it('lee país, nivel y fecha; descarta lo que no es un aviso; ordena por nivel', async () => {
		mockFetch(() => raw);
		const { items } = await advisories.fetch(undefined);
		expect(items.map((i) => [i.name, i.level])).toEqual([
			['Ukraine', 4],
			['Saudi Arabia', 3],
			['Iceland', 1]
		]);
		// Sin «Updated» válido, vale «Published».
		expect(items[1].updated).toBe('2026-10-02T00:00:00.000Z');
		expect(items[0]).not.toHaveProperty('prevLevel');
	});

	it('apunta los cambios de nivel frente a la copia anterior y los recuerda 30 días', async () => {
		mockFetch(() => raw);
		const prev = {
			items: [
				{ name: 'Ukraine', level: 3 as const, title: '', url: '', updated: '' },
				{ name: 'Iceland', level: 1 as const, title: '', url: '', updated: '', prevLevel: 2 as const, changedAt: '2026-10-01T00:00:00.000Z' },
				{ name: 'Saudi Arabia', level: 3 as const, title: '', url: '', updated: '', prevLevel: 2 as const, changedAt: '2026-08-01T00:00:00.000Z' }
			]
		};
		const { items } = await advisories.fetch(prev);
		const by = Object.fromEntries(items.map((i) => [i.name, i]));
		expect(by.Ukraine).toMatchObject({ prevLevel: 3, changedAt: '2026-10-14T10:00:00.000Z' });
		expect(by.Iceland).toMatchObject({ prevLevel: 2, changedAt: '2026-10-01T00:00:00.000Z' });
		expect(by['Saudi Arabia']).not.toHaveProperty('changedAt');
	});
});
