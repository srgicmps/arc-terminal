import { describe, expect, it } from 'vitest';
import { parseCzibs } from '../sources/czib.ts';
import { areaName, czibSentence } from '../../src/lib/czib.ts';

// Trozo de la tabla tal y como la devolvió la EASA en el sondeo del PR #415 (con etiquetas inventadas alrededor).
const HTML = `<table><tr><td>30/09/2026</td><td>09/10/2026</td><td>16/11/2026</td><td>Airspace of Saudi Arabia</td><td>CZIB-2026-09-R1</td><td>Active</td><td><a href="/en/domains/air-operations/czibs/czib-2026-09-r1">view</a></td></tr>
<tr><td>14/07/2026</td><td>30/09/2026</td><td>16/11/2026</td><td>Airspace of the Persian Gulf and Gulf of Oman</td><td>CZIB-2026-07R3</td><td>Active</td><td>view</td></tr>
<tr><td>31/08/2017</td><td>30/09/2026</td><td>30/04/2027</td><td>Airspace of Yemen &ndash; Sana&rsquo;a Flight Information Region</td><td>CZIB-2017-07R20</td><td>Active</td></tr>
<tr><td>31/07/2024</td><td>N/A</td><td>31/01/2025</td><td>Airspace of South Sudan</td><td>CZIB-2018-03R15</td><td>Withdrawn</td></tr>
<tr><td>30/10/2021</td><td>N/A</td><td>Airspace of Iran</td><td>CZIB-2020-01R2</td><td>Withdrawn</td></tr></table>`;

describe('parseCzibs', () => {
	it('lee los activos, con fechas ISO, nombre en español y enlace', () => {
		const items = parseCzibs(HTML);
		expect(items.map((c) => c.id)).toEqual(['CZIB-2026-09R1', 'CZIB-2026-07R3', 'CZIB-2017-07R20']);
		expect(items[0]).toMatchObject({ area: 'Arabia Saudí', issued: '2026-09-30', revised: '2026-10-09', validUntil: '2026-11-16', url: 'https://www.easa.europa.eu/en/domains/air-operations/czibs/czib-2026-09-r1' });
		expect(items[1].area).toBe('Golfo Pérsico y golfo de Omán');
		expect(items[1].url).toBe('https://www.easa.europa.eu/en/domains/air-operations/czibs');
		expect(items[2].area).toBe('Yemen (región de vuelo de Saná)');
	});
});

describe('textos', () => {
	it('nombres y frase', () => {
		expect(areaName('Pakistan – Baluchistan and Khyber Pakhtunkhwa provinces')).toBe('Pakistán (Baluchistan y Khyber Pakhtunkhwa)');
		expect(czibSentence([])).toBe('');
		// Con un solo boletín, en singular.
		const one = parseCzibs(HTML).slice(0, 1);
		expect(czibSentence(one)).toContain('sobre una zona:');
	});
});
