// handleError sustituye el de SvelteKit, que escribía en la consola los fallos de nuestro código. La prueba de
// humo y los e2e cazan los errores ahí (page.on('console')): si se deja de escribir, una vista rota pasa en verde.
import type { HandleClientError } from '@sveltejs/kit/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Los módulos $app/* los da el plugin de SvelteKit, que los tests no cargan: van de mentira. En dev, report() no
// hace nada, así que aquí solo se prueba la consola.
vi.mock('$app/env', () => ({ dev: true, version: 'test' }));
vi.mock('$app/paths', () => ({ asset: (p: string) => `/${p}` }));

describe('handleError', () => {
	beforeEach(() => {
		// El módulo escucha window al cargarse: en Node no hay addEventListener global.
		vi.stubGlobal('addEventListener', vi.fn());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	const load = async () => (await import('./hooks.client.ts')).handleError;
	const event = {} as Parameters<HandleClientError>[0]['event'];

	it('escribe en la consola los fallos de nuestro código, como el de SvelteKit', async () => {
		const handleError = await load();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const error = new TypeError("Cannot read properties of null (reading 'price')");
		await handleError({ kind: 'unknown', error, event });
		expect(log).toHaveBeenCalledWith(error);
	});

	it('no escribe los 404 ni los error() lanzados a propósito', async () => {
		const handleError = await load();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		await handleError({ kind: 'framework', error: { status: 404, message: 'Not Found' }, event });
		await handleError({ kind: 'app', error: { message: 'No hay datos' }, event });
		expect(log).not.toHaveBeenCalled();
	});
});
