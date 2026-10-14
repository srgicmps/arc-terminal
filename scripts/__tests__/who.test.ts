import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseWho, who } from '../sources/who.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const body = {
	value: [
		{
			Title: 'Cholera - Global situation',
			DonId: '2026-DON588',
			UrlName: '2026-DON588',
			PublicationDateAndTime: '2026-10-01T15:00:00Z',
			Summary: '<p>Since 1 January 2026, <b>412 000</b> cases &amp; 3 000 deaths…</p>'
		},
		{
			Title: 'Avian Influenza A(H5N1) - Cambodia',
			OverrideTitle: 'Avian Influenza A(H5N1) – Cambodia',
			UrlName: '2026-DON590',
			PublicationDate: '2026-10-10T00:00:00Z'
		},
		{ Title: 'Sin enlace' }
	]
};

describe('who', () => {
	it('lee título, fecha, resumen en texto plano y enlace, de más reciente a más antiguo', () => {
		expect(parseWho(body)).toEqual([
			{
				id: '2026-DON590',
				title: 'Avian Influenza A(H5N1) – Cambodia',
				date: '2026-10-10T00:00:00.000Z',
				summary: '',
				url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON590'
			},
			{
				id: '2026-DON588',
				title: 'Cholera - Global situation',
				date: '2026-10-01T15:00:00.000Z',
				summary: 'Since 1 January 2026, 412 000 cases & 3 000 deaths…',
				url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON588'
			}
		]);
	});

	it('sin partes, falla (y se reutiliza la copia anterior)', async () => {
		mockFetch(() => ({ value: [] }));
		await expect(who.fetch(undefined)).rejects.toThrow('OMS');
	});
});
