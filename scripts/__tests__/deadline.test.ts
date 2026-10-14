import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeadline } from '../lib.ts';

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

	it('deja pasar el error de la propia fuente y limpia el temporizador', async () => {
		vi.useFakeTimers();
		const result = withDeadline(Promise.reject(new Error('HTTP 500')), 90_000, 'tiempo agotado (90 s)');
		await expect(result).rejects.toThrow('HTTP 500');
		expect(vi.getTimerCount()).toBe(0);
	});
});
