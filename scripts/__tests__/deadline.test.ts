import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEADLINE_MS, deadlineFor, getJson, withDeadline } from '../lib.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.useRealTimers();
});

describe('withDeadline', () => {
	it('devuelve el resultado si llega a tiempo y limpia el temporizador', async () => {
		vi.useFakeTimers();
		const slow = new Promise<string>((resolve) => setTimeout(() => resolve('datos'), 89_000));
		const result = withDeadline(slow, 90_000, 'tiempo agotado (90 s)');
		await vi.advanceTimersByTimeAsync(89_000);
		await expect(result).resolves.toBe('datos');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('falla con el mensaje si se pasa del plazo', async () => {
		vi.useFakeTimers();
		const never = new Promise<string>(() => {});
		const result = withDeadline(never, 90_000, 'tiempo agotado (90 s)');
		const check = expect(result).rejects.toThrow('tiempo agotado (90 s)');
		await vi.advanceTimersByTimeAsync(89_999);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		await check;
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([401, 403])('un %i dentro del plazo falla a la primera, sin reintentos', async (status) => {
		vi.useFakeTimers();
		const fetch = mockFetch(() => new Response('', { status }));
		const result = withDeadline(getJson('https://example.org/api'), 90_000, 'tiempo agotado (90 s)');
		const check = expect(result).rejects.toThrow(`HTTP ${status} en https://example.org/api`);
		await vi.runAllTimersAsync();
		await check;
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('el plazo no repite la descarga: un 500 se reintenta solo lo que manda request()', async () => {
		vi.useFakeTimers();
		const fetch = mockFetch(() => new Response('', { status: 500 }));
		const result = withDeadline(getJson('https://example.org/api'), 90_000, 'tiempo agotado (90 s)');
		const check = expect(result).rejects.toThrow('HTTP 500');
		await vi.runAllTimersAsync();
		await check;
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('deja pasar el error de la propia fuente y limpia el temporizador', async () => {
		vi.useFakeTimers();
		const result = withDeadline(Promise.reject(new Error('HTTP 500')), 90_000, 'tiempo agotado (90 s)');
		await expect(result).rejects.toThrow('HTTP 500');
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('deadlineFor', () => {
	it('usa 90 s si la fuente no pide otro plazo', () => {
		expect(DEFAULT_DEADLINE_MS).toBe(90_000);
		expect(deadlineFor({})).toBe(90_000);
	});

	it('respeta el plazo propio de una fuente lenta', () => {
		expect(deadlineFor({ deadlineMs: 180_000 })).toBe(180_000);
	});
});
