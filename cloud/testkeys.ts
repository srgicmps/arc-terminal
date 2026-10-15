// Para los tests de cloud/: un par de claves RSA como el de Access, para firmar JWT de prueba, y otra clave
// «ajena» para firmar tokens falsos.
export const TEAM = 'https://prueba.cloudflareaccess.com';
export const AUD = 'aud-de-prueba';
export const ENV = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
export const part = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));

const ALG = {
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256'
};

export async function testKeys() {
	const mine = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
	const other = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
	const jwks = [{ ...(await crypto.subtle.exportKey('jwk', mine.publicKey)), kid: 'k1' }];
	async function sign(claims: Record<string, unknown>, key = mine.privateKey, kid = 'k1') {
		const now = Math.floor(Date.now() / 1000);
		const body = `${part({ alg: 'RS256', kid, typ: 'JWT' })}.${part({ aud: [AUD], iss: TEAM, exp: now + 3600, iat: now, ...claims })}`;
		const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
		return `${body}.${b64url(new Uint8Array(sig))}`;
	}
	const certs = async (url: string) => {
		if (url !== `${TEAM}/cdn-cgi/access/certs`) throw new Error(`URL inesperada: ${url}`);
		return new Response(JSON.stringify({ keys: jwks }));
	};
	return { sign, certs, other: other.privateKey };
}
