import { describe, expect, it } from 'vitest';
import { fileSize, fitScale, frame, keepPoint, sideways, ZOOM_MAX, ZOOM_MIN, zoomStep } from './fit.ts';

describe('geometría del Visor', () => {
	it('sabe cuándo va de lado', () => {
		expect([0, 90, 180, 270, 360, -90].map(sideways)).toEqual([false, true, false, true, false, true]);
	});

	it('encaja sin agrandar, también imágenes altas y giradas', () => {
		expect(fitScale(1600, 900, 800, 500)).toBeCloseTo(0.5);
		// Alta (300×800) en un hueco apaisado: manda el alto.
		expect(fitScale(300, 800, 800, 500)).toBeCloseTo(0.625);
		// Girada, la apaisada pasa a ser alta.
		expect(fitScale(1600, 900, 800, 500, 90)).toBeCloseTo(500 / 1600);
		expect(fitScale(100, 50, 800, 500)).toBe(1);
		expect(fitScale(0, 0, 800, 500)).toBe(1);
	});

	it('da la caja girada para el scroll', () => {
		expect(frame(1600, 900, 0.5)).toEqual({ w: 800, h: 450, boxW: 800, boxH: 450 });
		expect(frame(1600, 900, 0.5, 270)).toEqual({ w: 800, h: 450, boxW: 450, boxH: 800 });
	});

	it('hace pasos de zoom con topes', () => {
		expect(zoomStep(1, 1)).toBeCloseTo(1.25);
		expect(zoomStep(1, -1)).toBeCloseTo(0.8);
		expect(zoomStep(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
		expect(zoomStep(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
	});

	it('mantiene el centro al hacer zoom', () => {
		// De una caja que cabe (400 en 800, centrada) a una de 1600: el centro queda en el centro.
		expect(keepPoint(0, 800, 400, 1600)).toBe(400);
		// Ya desplazada: el punto del centro (scroll 200 + 400 = 600 de 1600) sigue en el centro al duplicar.
		expect(keepPoint(200, 800, 1600, 3200)).toBe(800);
		// Nunca se pasa de los bordes.
		expect(keepPoint(0, 800, 1600, 500)).toBe(0);
		expect(keepPoint(800, 800, 1600, 1000)).toBe(200);
	});

	it('escribe el tamaño del archivo', () => {
		expect(fileSize(200)).toBe('1 KB');
		expect(fileSize(7000)).toBe('7 KB');
		expect(fileSize(1572864)).toBe('1,5 MB');
	});
});
