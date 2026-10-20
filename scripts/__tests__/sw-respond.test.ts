import { describe, expect, it } from 'vitest';
import { buffered } from '../../src/service-worker/respond.ts';

describe('buffered: lo que sale de Cache Storage, ya leído', () => {
	it('mismo cuerpo, estado y cabeceras, y el cuerpo ya no es un stream a medias', async () => {
		const code = 'export const x = 1;\n'.repeat(500);
		const original = new Response(code, {
			status: 200,
			statusText: 'OK',
			headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }
		});
		const copy = await buffered(original);
		expect(original.bodyUsed).toBe(true);
		expect(copy.status).toBe(200);
		expect(copy.statusText).toBe('OK');
		expect(copy.headers.get('content-type')).toBe('text/javascript');
		expect(copy.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(await copy.text()).toBe(code);
	});

	it('también con un cuerpo binario (las letras .woff2 pasan por el mismo sitio)', async () => {
		const bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 255]);
		const copy = await buffered(new Response(bytes, { headers: { 'content-type': 'font/woff2' } }));
		expect(new Uint8Array(await copy.arrayBuffer())).toEqual(bytes);
	});
});
