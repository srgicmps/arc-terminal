import { describe, expect, it } from 'vitest';
import { currentSource, defaultConfig, fitSize, imageCss, parseConfig, parseSource, skyPhase, sunElevation, usedImages, type WallConfig } from './wall.ts';

describe('fondos: lo guardado', () => {
	it('sin nada, parte del fondo de la shell', () => {
		expect(parseConfig(null, 'rejilla').main).toEqual({ kind: 'preset', id: 'rejilla' });
		expect(parseConfig(null, 'raro').main).toEqual({ kind: 'preset', id: 'sistema' });
		expect(parseConfig('no es json').lock).toBe(true);
	});

	it('descarta fondos que no valen', () => {
		expect(parseSource({ kind: 'color', color: 'red' })).toBeNull();
		expect(parseSource({ kind: 'color', color: '#112233' })).toEqual({ kind: 'color', color: '#112233' });
		expect(parseSource({ kind: 'image', img: '../x', fit: 'cover' })).toBeNull();
		expect(parseSource({ kind: 'image', img: 'i1', fit: 'raro', x: 500 })).toEqual({ kind: 'image', img: 'i1', fit: 'cover', x: 100, y: 50 });
		expect(parseSource({ kind: 'gradient', from: '#000000', to: '#ffffff' })).toEqual({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 160 });
	});

	it('lee escritorios, presentación y bloqueo', () => {
		const c = parseConfig(JSON.stringify({ main: { kind: 'preset', id: 'aurora' }, desks: { d2: { kind: 'color', color: '#000000' } }, show: { on: true, minutes: 5, list: [{ kind: 'preset', id: 'liso' }] }, lock: false }));
		expect(c.desks.d2).toEqual({ kind: 'color', color: '#000000' });
		expect(c.show).toEqual({ on: true, minutes: 5, list: [{ kind: 'preset', id: 'liso' }] });
		expect(c.lock).toBe(false);
	});
});

describe('fondos: cuál toca', () => {
	const c: WallConfig = { ...defaultConfig({ kind: 'preset', id: 'aurora' }), desks: { d2: { kind: 'preset', id: 'liso' } } };

	it('el del escritorio, si lo tiene; si no, el general', () => {
		expect(currentSource(c, 'd2', 0)).toEqual({ kind: 'preset', id: 'liso' });
		expect(currentSource(c, 'd1', 0)).toEqual({ kind: 'preset', id: 'aurora' });
	});

	it('la presentación rota cada X minutos', () => {
		const s: WallConfig = { ...c, show: { on: true, minutes: 5, list: [{ kind: 'preset', id: 'puntos' }, { kind: 'preset', id: 'duna' }] } };
		expect(currentSource(s, 'd2', 0)).toEqual({ kind: 'preset', id: 'puntos' });
		expect(currentSource(s, 'd2', 5 * 60_000)).toEqual({ kind: 'preset', id: 'duna' });
		expect(currentSource(s, 'd2', 10 * 60_000)).toEqual({ kind: 'preset', id: 'puntos' });
	});

	it('sabe qué imágenes se usan', () => {
		const s: WallConfig = { ...c, main: { kind: 'image', img: 'a', fit: 'cover', x: 50, y: 50 } };
		expect([...usedImages(s)]).toEqual(['a']);
	});
});

describe('fondos: imagen y cielo', () => {
	it('coloca la imagen', () => {
		expect(imageCss('tile', 10, 10)).toEqual({ size: 'auto', repeat: 'repeat', position: 'top left' });
		expect(imageCss('cover', 30, 70).position).toBe('30% 70%');
	});

	it('reduce las imágenes grandes', () => {
		expect(fitSize(5120, 2880)).toEqual({ w: 2560, h: 1440 });
		expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
	});

	it('altura del sol', () => {
		expect(sunElevation(0, 0, { lat: 0, lon: 0 })).toBeCloseTo(90);
		expect(sunElevation(0, 180, { lat: 0, lon: 0 })).toBeCloseTo(-90);
		expect(skyPhase(-20)).toBe('noche');
		expect(skyPhase(2)).toBe('crepusculo');
		expect(skyPhase(40)).toBe('dia');
	});
});
