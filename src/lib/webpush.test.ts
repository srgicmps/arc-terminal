import { describe, expect, it } from 'vitest';
import { keyBytes, pushSupport, sameKey } from './webpush.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';

describe('pushSupport', () => {
	it('con PushManager, sí; en el iPhone sin instalar, que la instale; si no, no', () => {
		expect(pushSupport({ push: true, ua: FIREFOX, standalone: false, touchPoints: 0 })).toBe('ok');
		expect(pushSupport({ push: true, ua: IPHONE, standalone: true, touchPoints: 5 })).toBe('ok');
		expect(pushSupport({ push: false, ua: IPHONE, standalone: false, touchPoints: 5 })).toBe('install');
		// Instalada pero sin PushManager: un iOS anterior al 16.4.
		expect(pushSupport({ push: false, ua: IPHONE, standalone: true, touchPoints: 5 })).toBe('no');
		expect(pushSupport({ push: false, ua: FIREFOX, standalone: false, touchPoints: 0 })).toBe('no');
	});
});

describe('keyBytes y sameKey', () => {
	const KEY = 'BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs';
	it('la clave pública VAPID: 65 bytes, empieza por 0x04', () => {
		const b = keyBytes(KEY);
		expect(b.length).toBe(65);
		expect(b[0]).toBe(4);
	});
	it('reconoce la suscripción hecha con la misma clave, no con otra', () => {
		expect(sameKey(keyBytes(KEY).buffer, KEY)).toBe(true);
		const other = keyBytes(KEY);
		other[10] ^= 1;
		expect(sameKey(other.buffer, KEY)).toBe(false);
		expect(sameKey(null, KEY)).toBe(false);
	});
});
