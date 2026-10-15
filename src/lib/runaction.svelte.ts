// Ejecuta las acciones de la barra (src/lib/actions.ts) en el navegador: cambia MIS o las palabras
// vigiladas, guarda tus alertas en tu cuenta (src/lib/myalerts.ts, para los avisos) o comparte. Enseña en
// la barra un aviso corto con el resultado.
import { parseAction, nextMis, shareInfo, shareTarget } from './actions.ts';
import type { Option } from './cmdline.ts';
import { routeHref } from './routes.ts';
import { legacyCopy, shareOrCopy } from './share.ts';
import { goto } from '$app/navigation';
import type { AlertConfig } from './alertconfig.ts';
import type { Saved } from './myalerts.ts';
import { alertText, LIMITS } from './useralerts.ts';
import { initWatchlist, setCodes, watchlist } from './watchlist.svelte.ts';
import { addWatchword, initWatchwords } from './watchwords.svelte.ts';

/** Cambia tu cuenta de avisos. El código se carga al usarlo, no con la barra (peso de cada vista). */
async function changeAlerts(change: (c: AlertConfig, lib: typeof import('./alertconfig.ts')) => AlertConfig): Promise<Saved> {
	const [lib, my] = await Promise.all([import('./alertconfig.ts'), import('./myalerts.ts')]);
	return my.changeAlerts((c) => change(c, lib));
}

/** «NASDAQ:NVDA» → «NVDA» si es de EE. UU. (como myalerts.usSymbol, sin cargarlo). */
const usSymbol = (code: string): string | null => {
	const [ex, sym] = code.includes(':') ? code.split(':') : ['', code];
	return (!ex || /^(NASDAQ|NYSE|AMEX|NYSEARCA)$/.test(ex)) && /^[A-Z0-9.]{1,12}$/.test(sym) ? sym : null;
};

/** Lo que se dice tras guardar en la cuenta. */
const said = (r: Saved, ok: string, off = ''): string =>
	r.ok ? (r.config.on ? ok : `${ok}${off}`) : r.why === 'none' ? '' : 'No se ha podido guardar en tu cuenta';
const OFF = '. Activa tus avisos en AVISOS para recibirla';

/** Ejecuta lo escrito si es una acción. `flash` enseña el resultado en la barra. False si no lo era. */
export function runAction(raw: string, all: Option[], flash: (text: string) => void): boolean {
	const action = parseAction(raw);
	if (!action) return false;
	switch (action.kind) {
		case 'share':
			void share(action, all, flash);
			break;
		case 'mis': {
			initWatchlist();
			const codes = nextMis(watchlist.codes, action);
			setCodes(codes);
			const text = `${action.code} ${action.add ? 'añadido a' : 'quitado de'} MIS`;
			flash(text);
			// También en tus valores de AVISOS (los de EE. UU., que son los que se vigilan).
			const sym = usSymbol(action.code);
			if (sym)
				void changeAlerts((c, lib) => ({ ...c, mis: action.add ? [...new Set([...c.mis, sym])].slice(0, lib.MIS_MAX) : c.mis.filter((x) => x !== sym) })).then((r) => {
					if (!r.ok && r.why === 'error') flash(said(r, ''));
				});
			break;
		}
		case 'watch': {
			if (!action.word) return true;
			initWatchwords();
			addWatchword(action.word);
			flash(`Vigilando «${action.word}»`);
			const word = action.word;
			void changeAlerts((c, lib) => ({ ...c, words: lib.parseWordList([...c.words, word]) })).then((r) => {
				if (!r.ok && r.why === 'error') flash(said(r, ''));
			});
			break;
		}
		case 'alert': {
			const alert = action.alert;
			if (alert) {
				flash('Guardando la alerta…');
				void changeAlerts((c, lib) => (c.prices.length >= LIMITS.alerts ? c : { ...c, prices: [...c.prices, lib.newPrice(alert)] })).then((r) => {
					if (r.ok && !r.config.prices.some((p) => alertText(p) === alertText(alert))) flash(`Ya tienes ${LIMITS.alerts} alertas: borra alguna en AVISOS`);
					else flash(said(r, `Alerta guardada: ${alertText(alert)}`, OFF) || 'Las alertas necesitan tu cuenta (arcterminal.dev)');
				});
			} else if (!action.raw) void goto(routeHref('/avisos'));
			break;
		}
	}
	return true;
}

/** «compartir WS»: el menú del sistema en el móvil; si no, copia el enlace al portapapeles. */
async function share(action: { arg: string }, all: Option[], flash: (text: string) => void) {
	const target = shareTarget(action, all);
	const info = target ? shareInfo(target) : null;
	const url = info ? new URL(routeHref(info.route) + info.search, location.href).href : location.href;
	const data = info ? { title: info.title, text: info.text, url } : { title: document.title, url };
	const result = await shareOrCopy(data, navigator, (t) => legacyCopy(t, document));
	if (result === 'copied') flash('Enlace copiado');
	else if (result === 'failed') flash('No se ha podido copiar el enlace');
}
