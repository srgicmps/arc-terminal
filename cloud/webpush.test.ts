// Web Push (cloud/webpush.ts) contra los ejemplos de los RFC. Si el cifrado no cuadra byte a byte con el de
// RFC 8291, el servicio de push del navegador da 400 y el aviso no llega nunca, sin más pistas: por eso este test.
import { describe, expect, it } from 'vitest';
import { b64url, encrypt, fromB64url, generateVapid, MAX_PLAINTEXT, parseVapid, pushRequest, VAPID_TTL, vapidJwt } from './webpush.ts';

const join = (s: string) => s.replace(/\s+/g, '');

/** RFC 8291, sección 5 y apéndice A: «When I grow up, I want to be a watermelon». */
const RFC8291 = {
	plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
	asPublic: join(`BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg
		Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8`),
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	uaPublic: join(`BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx
		aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4`),
	uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	auth: 'BTBZMqHH6r4Tts7J_aSIgg',
	result: join(`DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
		mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
		pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`)
};

/** Un JWK EC P-256 a partir de la clave pública sin comprimir (65 bytes) y, si se da, la privada. */
function ecJwk(publicB64: string, d?: string): JsonWebKey {
	const raw = fromB64url(publicB64);
	return { kty: 'EC', crv: 'P-256', x: b64url(raw.slice(1, 33)), y: b64url(raw.slice(33, 65)), ...(d ? { d } : {}) };
}

async function rfcSender(): Promise<CryptoKeyPair> {
	const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
	return {
		privateKey: await crypto.subtle.importKey('jwk', ecJwk(RFC8291.asPublic, RFC8291.asPrivate), ecdh, true, ['deriveBits']),
		publicKey: await crypto.subtle.importKey('raw', fromB64url(RFC8291.asPublic), ecdh, true, [])
	};
}

/** Lo que hace el navegador al recibirlo: descifrar con su clave privada (RFC 8291, lado del user agent). */
async function decrypt(body: Uint8Array, uaPublic: string, uaPrivate: CryptoKey, auth: string): Promise<string> {
	const salt = body.slice(0, 16);
	const idlen = body[20];
	const asPublic = body.slice(21, 21 + idlen);
	const sealed = body.slice(21 + idlen);
	const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
	const as = await crypto.subtle.importKey('raw', asPublic, ecdh, false, []);
	const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: as }, uaPrivate, 256));
	const derive = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => {
		const k = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s as BufferSource, info: info as BufferSource }, k, n * 8);
		return new Uint8Array(bits);
	};
	const te = new TextEncoder();
	const info = new Uint8Array([...te.encode('WebPush: info\0'), ...fromB64url(uaPublic), ...asPublic]);
	const ikm = await derive(fromB64url(auth), secret, info, 32);
	const cek = await derive(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await derive(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
	const key = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt']);
	const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, key, sealed));
	expect(plain[plain.length - 1]).toBe(2); // delimitador de «último registro»
	return new TextDecoder().decode(plain.slice(0, -1));
}

/** Comprueba un JWT ES256 con una clave pública sin comprimir (lo que hace el servicio de push). */
async function verifyJwt(jwt: string, publicB64: string) {
	const [h, p, s] = jwt.split('.');
	const key = await crypto.subtle.importKey('raw', fromB64url(publicB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
	const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
	return { ok, header: JSON.parse(new TextDecoder().decode(fromB64url(h))), claims: JSON.parse(new TextDecoder().decode(fromB64url(p))) };
}

describe('cifrado aes128gcm (RFC 8291)', () => {
	it('da exactamente el resultado del ejemplo del RFC (sección 5 y apéndice A)', async () => {
		const body = await encrypt(
			fromB64url(RFC8291.plaintext),
			{ p256dh: RFC8291.uaPublic, auth: RFC8291.auth },
			{ pair: await rfcSender(), salt: fromB64url(RFC8291.salt) }
		);
		expect(b64url(body)).toBe(RFC8291.result);
		// Cabecera (86) + texto (41) + delimitador (1) + etiqueta de AES-GCM (16). El «Content-Length: 145» del
		// ejemplo del RFC no cuadra con su propio resultado, que son 144 bytes.
		expect(body.length).toBe(144);
	});

	it('con clave y sal aleatorias, el navegador lo descifra; cada aviso sale distinto', async () => {
		const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
		const p256dh = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)));
		const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
		const text = 'Terremoto de magnitud 6,1 · ¿Sale bien la ñ y el €?';
		const a = await encrypt(new TextEncoder().encode(text), { p256dh, auth });
		const b = await encrypt(new TextEncoder().encode(text), { p256dh, auth });
		expect(b64url(a)).not.toBe(b64url(b));
		expect(await decrypt(a, p256dh, ua.privateKey, auth)).toBe(text);
	});

	it('el vector del RFC también se descifra con la clave privada del navegador', async () => {
		const ua = await crypto.subtle.importKey('jwk', ecJwk(RFC8291.uaPublic, RFC8291.uaPrivate), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
		const text = await decrypt(fromB64url(RFC8291.result), RFC8291.uaPublic, ua, RFC8291.auth);
		expect(text).toBe('When I grow up, I want to be a watermelon');
	});

	it('rechaza claves que no son de P-256 y avisos que no caben en un registro', async () => {
		const keys = { p256dh: RFC8291.uaPublic, auth: RFC8291.auth };
		await expect(encrypt(new Uint8Array(1), { ...keys, p256dh: b64url(new Uint8Array(64)) })).rejects.toThrow();
		await expect(encrypt(new Uint8Array(1), { ...keys, auth: b64url(new Uint8Array(8)) })).rejects.toThrow();
		await expect(encrypt(new Uint8Array(MAX_PLAINTEXT + 1), keys)).rejects.toThrow('demasiado largo');
		expect((await encrypt(new Uint8Array(MAX_PLAINTEXT), keys)).length).toBe(4096);
	});
});

describe('VAPID (RFC 8292)', () => {
	it('el ejemplo del RFC se verifica igual que los nuestros (firma ES256 en formato JWT, no DER)', async () => {
		const rfc = join(`eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3
			B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1ha
			Wx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_H
			LGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA`);
		const k = join(`BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dR
			uU_RCPCfA5aq9ojSwk5Y2EmClBPs`);
		const { ok, claims } = await verifyJwt(rfc, k);
		expect(ok).toBe(true);
		expect(claims.aud).toBe('https://push.example.net');
	});

	it('nuestro JWT: ES256, aud = origen del servicio, caduca en ≤ 24 h y sub es la web (nunca un email)', async () => {
		const { jwk, public: pub } = await generateVapid();
		const vapid = (await parseVapid(JSON.stringify(jwk)))!;
		expect(vapid.public).toBe(pub);
		const now = Date.parse('2026-10-20T10:00:00Z');
		const jwt = await vapidJwt(vapid, 'https://fcm.googleapis.com', 'https://arcterminal.dev', now);
		const { ok, header, claims } = await verifyJwt(jwt, pub);
		expect(ok).toBe(true);
		expect(header).toEqual({ typ: 'JWT', alg: 'ES256' });
		expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now / 1000 + VAPID_TTL, sub: 'https://arcterminal.dev' });
		expect(VAPID_TTL).toBeLessThanOrEqual(24 * 3600);
	});

	it('la petición: Authorization vapid con t y k, aes128gcm, TTL y urgencia; un JWT por servicio', async () => {
		const { jwk } = await generateVapid();
		const vapid = (await parseVapid(JSON.stringify(jwk)))!;
		const keys = { p256dh: RFC8291.uaPublic, auth: RFC8291.auth };
		const jwts = new Map<string, string>();
		const opts = { ttl: 3600, urgency: 'high' as const, subject: 'https://arcterminal.dev' };
		const a = await pushRequest('https://fcm.googleapis.com/fcm/send/abc', keys, '{"title":"Hola"}', vapid, opts, jwts);
		await pushRequest('https://fcm.googleapis.com/fcm/send/def', keys, '{}', vapid, opts, jwts);
		await pushRequest('https://web.push.apple.com/QK', keys, '{}', vapid, opts, jwts);
		expect([...jwts.keys()]).toEqual(['https://fcm.googleapis.com', 'https://web.push.apple.com']);
		const h = a.headers as Record<string, string>;
		expect(h.authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.public}$`));
		expect(h['content-encoding']).toBe('aes128gcm');
		expect(h.ttl).toBe('3600');
		expect(h.urgency).toBe('high');
		expect((a.body as Uint8Array).length).toBe(86 + 16 + 1 + 16);
	});

	it('un Secret que no es un JWK EC P-256 privado no vale (null: la Function da 503)', async () => {
		const { jwk } = await generateVapid();
		for (const bad of [undefined, '', 'hola', '{}', JSON.stringify({ ...jwk, d: undefined }), JSON.stringify({ ...jwk, crv: 'P-384' })])
			expect(await parseVapid(bad)).toBeNull();
	});
});
