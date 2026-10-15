import { describe, expect, it } from 'vitest';
import { installPlatform, iosSafari } from './install.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';

describe('installPlatform', () => {
	it('iPhone, iPad (que dice ser un Mac) y Android', () => {
		expect(installPlatform(IPHONE, false)).toBe('ios');
		expect(installPlatform(IPAD, false, 5)).toBe('ios');
		expect(installPlatform(ANDROID, false)).toBe('android');
	});

	it('nada si ya está instalada o es un ordenador', () => {
		expect(installPlatform(IPHONE, true)).toBeNull();
		expect(installPlatform(IPAD, false, 0)).toBeNull();
	});

	it('en el iPhone distingue Safari de Chrome', () => {
		expect(iosSafari(IPHONE)).toBe(true);
		expect(iosSafari(CHROME_IOS)).toBe(false);
	});
});
