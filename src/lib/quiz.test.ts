import { describe, expect, it } from 'vitest';
import { buildQuiz, headlineQuestions, isoWeek, marketQuestion, quakeQuestion, seeded, verdict } from './quiz.ts';

const now = Date.parse('2026-10-15T12:00:00Z');
const entry = (k: string, title: string) => ({ k, title, url: `https://x/${k}`, sources: ['A', 'B', 'C'], score: 5 });
const market = (label: string, change: number | null, kind: 'pct' | 'pb' = 'pct') => ({ label, last: 1, t: '2026-10-14', change, kind, decimals: 2, source: 'FRED' });
const quake = (id: string, mag: number, place: string, time = '2026-10-13T00:00:00Z') => ({ id, mag, place, time, url: `u${id}`, tsunami: false, alert: null, lat: 0, lon: 0, depth: 10 });

describe('isoWeek y seeded', () => {
	it('semana ISO y sorteo repetible', () => {
		expect(isoWeek(now)).toBe('2026-W42');
		expect(isoWeek(Date.parse('2027-01-01T12:00:00Z'))).toBe('2026-W53');
		const a = seeded('x');
		const b = seeded('x');
		expect([a(), a()]).toEqual([b(), b()]);
	});
});

describe('preguntas', () => {
	it('tapa el país de un titular', () => {
		const [q] = headlineQuestions([entry('1', 'Francia aprueba la reforma de las pensiones'), entry('2', 'Japón sube los tipos')], seeded('w'), 1);
		expect(q.q).toBe('Completa este titular de la semana: «___ aprueba la reforma de las pensiones»');
		expect(q.options[q.answer]).toBe('Francia');
		expect(new Set(q.options).size).toBe(4);
	});
	it('mercados: sube o baja, mucho o poco', () => {
		const q = marketQuestion([market('el bitcoin', -3.4)], seeded('w'))!;
		expect(q.options[q.answer]).toBe('Bajó más de un 2 %');
		const t = marketQuestion([market('el bono a 10 años', 4, 'pb')], seeded('w'))!;
		expect(t.options[t.answer]).toBe('Subió, pero menos de 10 pb');
		expect(marketQuestion([market('x', null)], seeded('w'))).toBeNull();
	});
	it('terremoto más fuerte de la semana, con el país en español', () => {
		const q = quakeQuestion([quake('a', 6.1, '30 km S of Hualien, Taiwan'), quake('b', 5, '10 km N of Lima, Peru'), quake('c', 7.5, 'old, Chile', '2026-09-01T00:00:00Z')], now, seeded('w'))!;
		expect(q.options[q.answer]).toBe('Taiwán');
	});
});

describe('buildQuiz', () => {
	it('cinco preguntas iguales para todos en la misma semana', () => {
		const input = {
			top: [entry('1', 'Francia aprueba la reforma'), entry('2', 'China y Japón firman un acuerdo'), entry('3', 'Sin país'), entry('4', 'Brasil elige presidente')],
			markets: [market('el bitcoin', 3.1), market('el euro frente al dólar', -0.4)],
			quakes: [quake('a', 6.1, 'Hualien, Taiwan')]
		};
		const a = buildQuiz(input, now);
		expect(a.week).toBe('2026-W42');
		expect(a.questions.map((q) => q.topic)).toEqual(['Titulares', 'Titulares', 'Mercados', 'Mundo', 'Titulares']);
		expect(buildQuiz(input, now + 3_600_000)).toEqual(a);
	});
	it('veredicto', () => {
		expect(verdict(5, 5)).toBe('¡Pleno! Estás al día de todo.');
		expect(verdict(0, 0)).toBe('');
	});
});
