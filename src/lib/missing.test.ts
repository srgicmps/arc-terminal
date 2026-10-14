import { describe, expect, it } from 'vitest';
import type { SourceStatus } from './data.ts';
import { missingNote } from './missing.ts';

const row = (state: SourceStatus['state'], extra: Partial<SourceStatus> = {}): SourceStatus[] => [
	{ name: 'finnhub', label: 'Finnhub', state, fetchedAt: null, requires: 'FINNHUB_API_KEY', ...extra }
];

describe('missingNote', () => {
	it('solo habla de la clave si la fuente se saltó por no tenerla', () => {
		expect(missingNote(row('off'), 'finnhub')).toBe('Falta la clave FINNHUB_API_KEY en GitHub Secrets.');
	});

	it('si la descarga falló, lo dice con el error corto', () => {
		expect(missingNote(row('error', { error: 'HTTP 429' }), 'finnhub')).toBe(
			'No se han podido descargar los datos (HTTP 429). Se reintenta en la próxima pasada.'
		);
	});

	it('con la clave puesta y sin estado de error, o sin status.json, no culpa a la clave', () => {
		expect(missingNote(row('ok'), 'finnhub')).toBe('Sin datos todavía.');
		expect(missingNote(undefined, 'finnhub')).toBe('Sin datos todavía.');
		expect(missingNote(row('off'), 'fred')).toBe('Sin datos todavía.');
	});
});
