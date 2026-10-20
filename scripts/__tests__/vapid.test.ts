// scripts/vapid.ts: las claves que imprime valen para /api/push (cloud/webpush.ts) y no se guardan en ningún sitio.
import { describe, expect, it } from 'vitest';
import { parseVapid } from '../../cloud/webpush.ts';
import { vapidInstructions } from '../vapid.ts';

describe('vapidInstructions', () => {
	it('da un JWK que el Secret VAPID_PRIVATE_KEY acepta, y su clave pública', async () => {
		const text = await vapidInstructions();
		const jwk = /^\s+(\{"kty":"EC".*\})$/m.exec(text)?.[1];
		const vapid = await parseVapid(jwk);
		expect(vapid).not.toBeNull();
		expect(text).toContain(vapid!.public);
		expect(text).toContain('VAPID_PRIVATE_KEY');
		// Cada vez, un par nuevo.
		expect(await vapidInstructions()).not.toBe(text);
	});
});
