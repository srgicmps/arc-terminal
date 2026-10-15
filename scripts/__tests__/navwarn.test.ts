import { describe, expect, it } from 'vitest';
import { pickWarnings } from '../sources/navwarn.ts';
import { firstPoint, navDate, navSentence, placeName, toWarning } from '../../src/lib/navwarn.ts';

// Avisos reales del sondeo del PR #415 (recortados) y uno inventado de maniobras.
const survey = { msgYear: 2024, msgNumber: 1540, navArea: 'P', issueDate: '081538Z MAY 2024', text: 'PERSIAN GULF.\nQATAR.\nDNC 10.\nSURVEY OPERATIONS 08 MAY UNTIL FURTHER\nNOTICE BY M/V HORIZON GEOBAY\nIN AREA BOUND BY\n26-09.23N 051-48.00E.\nWIDE BERTH REQUESTED.\n' };
const mines = { msgYear: 2023, msgNumber: 2452, navArea: 'A', issueDate: '251230Z DEC 2023', text: 'BLACK SEA.\nUKRAINE.\nDNC 10.\nMINING OPERATIONS IN PROGRESS UNTIL FURTHER NOTICE\nIN AREAS BOUND BY:\nA. 46-22.50N 030-45.10E, 46-20.20N 030-53.10E.\n' };
const drill = { msgYear: 2026, msgNumber: 3001, navArea: 'P', issueDate: '120800Z OCT 2026', text: 'RED SEA.\nDNC 09.\nHAZARDOUS OPERATIONS, LIVE FIRING 14 THRU 16 OCT\nIN AREA BOUND BY 20-10.00N 038-30.00E.\n' };
const elsewhere = { msgYear: 2026, msgNumber: 1, navArea: 'A', issueDate: '010000Z OCT 2026', text: 'NORTH SEA.\nDNC 05.\nGUNNERY EXERCISES 01-00.00N 001-00.00E.\n' };

describe('navwarn', () => {
	it('fechas y coordenadas', () => {
		expect(navDate('081538Z MAY 2024')).toBe('2024-05-08T15:38:00.000Z');
		expect(navDate('raro')).toBeNull();
		expect(firstPoint('IN 26-09.23N 051-48.00E, 25-31.26N')).toEqual([26.15, 51.8]);
		expect(firstPoint('20-10.00S 038-30.00W')).toEqual([-20.17, -38.5]);
	});
	it('se queda con los de seguridad en zonas calientes', () => {
		expect(toWarning(survey)).toBeNull();
		expect(toWarning(elsewhere)).toBeNull();
		expect(toWarning(mines)).toMatchObject({ id: 'HYDROLANT 2452/23', region: 'Mar Negro', place: 'Ucrania', kind: 'Minas', at: [46.38, 30.75] });
		expect(toWarning(drill)).toMatchObject({ region: 'Mar Rojo', place: '', kind: 'Maniobras militares' });
		expect(pickWarnings([survey, mines, drill]).map((w) => w.id)).toEqual(['HYDROPAC 3001/26', 'HYDROLANT 2452/23']);
		expect(navSentence(pickWarnings([mines, drill]))).toBe('Hay 2 avisos de seguridad a los barcos en Mar Rojo, Mar Negro.');
		expect(placeName('QATAR')).toBe('Qatar');
		expect(placeName('SAUDI ARABIA')).toBe('Arabia Saudí');
		expect(navSentence(pickWarnings([drill]))).toBe('Hay un aviso de seguridad a los barcos en Mar Rojo.');
	});
});
