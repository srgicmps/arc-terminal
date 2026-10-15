import { describe, expect, it, vi } from 'vitest';
import { absoluteUrl, fuelShare, luzShare, relativeDay, shareOrCopy, shareText, stockShare } from './share.ts';

const info = { title: 'Luz hoy', text: 'Media 0,120 €/kWh', url: 'https://x.test/luz' };

function abort() {
	const e = new Error('cerrado');
	e.name = 'AbortError';
	return e;
}

describe('shareText y absoluteUrl', () => {
	it('une título, texto y URL, uno por línea', () => {
		expect(shareText(info)).toBe('Luz hoy\nMedia 0,120 €/kWh\nhttps://x.test/luz');
		expect(shareText({ title: 'A', text: 'A' })).toBe('A');
	});

	it('la URL por defecto es la página actual, con su query, y siempre absoluta', () => {
		const here = 'https://srgicmps.github.io/arc-terminal/fuel?zona=28';
		expect(absoluteUrl(undefined, here)).toBe(here);
		expect(absoluteUrl('?zona=07', here)).toBe('https://srgicmps.github.io/arc-terminal/fuel?zona=07');
	});
});

describe('shareOrCopy', () => {
	it('con navigator.share, usa el menú del sistema y no copia', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		const writeText = vi.fn();
		expect(await shareOrCopy(info, { share, clipboard: { writeText } })).toBe('shared');
		expect(share).toHaveBeenCalledWith(info);
		expect(writeText).not.toHaveBeenCalled();
	});

	it('si canShare dice que no, copia sin abrir el menú', async () => {
		const share = vi.fn();
		const writeText = vi.fn().mockResolvedValue(undefined);
		expect(await shareOrCopy(info, { share, canShare: () => false, clipboard: { writeText } })).toBe('copied');
		expect(share).not.toHaveBeenCalled();
	});

	it('sin navigator.share, copia título, texto y URL', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		expect(await shareOrCopy(info, { clipboard: { writeText } })).toBe('copied');
		expect(writeText).toHaveBeenCalledWith(shareText(info));
	});

	it('si el usuario cierra el menú (AbortError), no hace nada más', async () => {
		const writeText = vi.fn();
		const share = vi.fn().mockRejectedValue(abort());
		expect(await shareOrCopy(info, { share, clipboard: { writeText } })).toBe('cancelled');
		expect(writeText).not.toHaveBeenCalled();
	});

	it('si share falla por otra razón, copia', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const share = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
		expect(await shareOrCopy(info, { share, clipboard: { writeText } })).toBe('copied');
	});

	it('si el portapapeles falla, prueba el plan B y, si tampoco va, avisa del fallo', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
		const legacy = vi.fn().mockReturnValue(true);
		expect(await shareOrCopy(info, { clipboard: { writeText } }, legacy)).toBe('copied');
		expect(legacy).toHaveBeenCalledWith(shareText(info));
		expect(await shareOrCopy(info, { clipboard: { writeText } })).toBe('failed');
		expect(
			await shareOrCopy(info, {}, () => {
				throw new Error('x');
			})
		).toBe('failed');
	});
});

describe('textos de las vistas', () => {
	it('FUEL', () => {
		const s = fuelShare({
			fuel: 'Gasolina 95',
			place: 'Menorca',
			station: 'PETRO',
			town: 'Maó',
			price: 1.559,
			avg: 1.6123
		});
		expect(s.text).toBe('Gasolina 95 más barata en Menorca: PETRO (Maó) 1,559 €/L. Media de la zona: 1,612 €/L.');
		expect(fuelShare({ fuel: 'GLP', place: 'Madrid', station: 'A', town: 'B', price: 1 }).text).not.toContain('Media');
	});

	it('LUZ', () => {
		const s = luzShare({ when: 'hoy', kind: 'PVPC', avg: 0.1234, cheapHour: 3, cheapKwh: 0.08, cheapest: [3, 4, 14] });
		expect(s.title).toBe('Precio de la luz hoy');
		expect(s.text).toBe(
			'PVPC hoy: media 0,123 €/kWh. La hora más barata, a las 03:00 (0,080 €/kWh). Horas más baratas: 03:00 · 04:00 · 14:00.'
		);
	});

	it('ficha de valor', () => {
		expect(stockShare('NVDA', 'NVIDIA')).toEqual({
			title: 'NVDA · NVIDIA',
			text: 'Ficha de NVIDIA (NVDA): cotización, gráfico y datos en directo.'
		});
		expect(stockShare('XYZ', '').title).toBe('XYZ');
	});

	it('hoy, mañana o la fecha (también a fin de mes)', () => {
		expect(relativeDay('2026-10-14', '2026-10-14', 'x')).toBe('hoy');
		expect(relativeDay('2026-11-01', '2026-10-31', 'x')).toBe('mañana');
		expect(relativeDay('2026-10-13', '2026-10-14', 'martes, 13')).toBe('del martes, 13');
	});
});
