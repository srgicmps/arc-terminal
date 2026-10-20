// Lo que enseña el service worker al llegar un aviso por Web Push (src/service-worker/push.ts).
import { describe, expect, it } from 'vitest';
import { clickUrl, notice, safeUrl } from '../../src/service-worker/push.ts';

const SCOPE = 'https://arcterminal.dev/';

describe('notice', () => {
	it('el aviso de cloud/push.ts: título, texto, icono y la vista que abre', () => {
		const n = notice(JSON.stringify({ title: 'Terremoto', body: 'M 6,1\nJapón', url: 'https://arcterminal.dev/geo', tag: 'quake' }), SCOPE);
		expect(n).toEqual({
			title: 'Terremoto',
			options: {
				body: 'M 6,1\nJapón',
				lang: 'es',
				icon: 'https://arcterminal.dev/icon-192.png',
				data: { url: 'https://arcterminal.dev/geo' },
				tag: 'quake'
			}
		});
	});

	it('siempre sale una notificación, aunque el aviso llegue vacío o roto', () => {
		for (const text of [null, undefined, '', 'no es JSON', '[]', '{"title":"  "}']) {
			const n = notice(text, SCOPE);
			expect(n.title).toBe('Arc Terminal');
			expect(n.options.data.url).toBe(SCOPE);
		}
		expect(notice('{}', SCOPE).options.body).toBe('Tienes un aviso nuevo.');
	});
});

describe('safeUrl y clickUrl', () => {
	it('solo http(s); lo demás, a la portada', () => {
		expect(safeUrl('/imp', SCOPE)).toBe('https://arcterminal.dev/imp');
		expect(safeUrl('https://bbc.com/a', SCOPE)).toBe('https://bbc.com/a');
		expect(safeUrl('javascript:alert(1)', SCOPE)).toBe(SCOPE);
		expect(safeUrl(3, SCOPE)).toBe(SCOPE);
		expect(clickUrl({ url: '/eco' }, SCOPE)).toBe('https://arcterminal.dev/eco');
		expect(clickUrl(null, SCOPE)).toBe(SCOPE);
	});
});
