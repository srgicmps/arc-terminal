// Ayudante para los tests de las fuentes: sustituye `fetch` por una función que responde
// con datos de ejemplo según la URL, sin salir a internet.
import { vi } from 'vitest';

type Reply = string | object | Response | undefined;

/**
 * `route` recibe la URL pedida y devuelve el cuerpo: texto (RSS, CSV), un objeto (se manda como JSON)
 * o una Response ya hecha. Si devuelve undefined, la respuesta es un 404.
 */
export function mockFetch(route: (url: string, init?: RequestInit) => Reply) {
	const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input instanceof Request ? input.url : input);
		const reply = route(url, init);
		if (reply instanceof Response) return reply;
		if (reply === undefined) return new Response('no encontrado', { status: 404 });
		if (typeof reply === 'string') return new Response(reply, { status: 200 });
		return Response.json(reply);
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}
