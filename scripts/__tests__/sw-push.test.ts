// Lo que enseña el service worker al llegar un aviso por Web Push (src/service-worker/push.ts).
import { describe, expect, it } from 'vitest';
import { clickUrl, mainTab, notice, openNotice, safeUrl, type Tab } from '../../src/service-worker/push.ts';

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

describe('mainTab y openNotice (al tocar un aviso)', () => {
	/** Ventanas de mentira que apuntan lo que se hace con ellas, en orden. */
	function browser(list: { url: string; frameType?: string; controlled?: boolean; login?: boolean }[]) {
		const steps: string[] = [];
		const tabs: Tab[] = list.map((t, i) => {
			const tab: Tab = {
				...t,
				focus: async () => void steps.push(`focus ${i}`),
				navigate: async (url) => {
					steps.push(`navigate ${i} ${url}`);
					if (t.controlled === false) throw new TypeError('no controlada');
					// Acaba fuera de la web (el login de Access): navigate da null.
					return t.login ? null : tab;
				}
			};
			return tab;
		});
		const openWindow = async (url: string) => void steps.push(`open ${url}`);
		return { steps, tabs, openWindow };
	}
	const GEO = 'https://arcterminal.dev/geo';

	it('la ventana principal, nunca un iframe de Arc OS (?embed=1) ni otra web', () => {
		const tabs = [
			{ url: 'https://arcterminal.dev/imp?embed=1', frameType: 'nested' },
			{ url: 'https://bbc.com/', frameType: 'top-level' },
			{ url: 'https://arcterminal.dev/os', frameType: 'top-level' }
		];
		expect(mainTab(tabs, 'https://arcterminal.dev')).toBe(tabs[2]);
		expect(mainTab(tabs.slice(0, 2), 'https://arcterminal.dev')).toBeUndefined();
	});

	it('mueve la ventana y después la pone delante (focus, después de navigate)', async () => {
		const b = browser([{ url: 'https://arcterminal.dev/imp?embed=1', frameType: 'nested' }, { url: 'https://arcterminal.dev/os', frameType: 'top-level' }]);
		await openNotice(GEO, SCOPE, b.tabs, b.openWindow);
		expect(b.steps).toEqual([`navigate 1 ${GEO}`, 'focus 1']);
	});

	it('si no se puede mover (no controlada) o acaba en el login, abre otra sin gastar antes el toque en focus', async () => {
		const b = browser([{ url: 'https://arcterminal.dev/', frameType: 'top-level', controlled: false }]);
		await openNotice(GEO, SCOPE, b.tabs, b.openWindow);
		expect(b.steps).toEqual([`navigate 0 ${GEO}`, `open ${GEO}`]);
		const login = browser([{ url: 'https://arcterminal.dev/', frameType: 'top-level', login: true }]);
		await openNotice(GEO, SCOPE, login.tabs, login.openWindow);
		expect(login.steps).toEqual([`navigate 0 ${GEO}`, `open ${GEO}`]);
	});

	it('sin la web abierta, o con un enlace de fuera, abre otra', async () => {
		const empty = browser([]);
		await openNotice(GEO, SCOPE, empty.tabs, empty.openWindow);
		expect(empty.steps).toEqual([`open ${GEO}`]);
		const b = browser([{ url: 'https://arcterminal.dev/', frameType: 'top-level' }]);
		await openNotice('https://bbc.com/a', SCOPE, b.tabs, b.openWindow);
		expect(b.steps).toEqual(['open https://bbc.com/a']);
	});
});
