// Idioma de los titulares: ES (la traducción, si la hay) o EN (el original). Se guarda en el navegador.
//
// La traducción viene casi siempre hecha de la Action (`titleEs`, scripts/translate.ts). Lo que se queda
// sin ella lo traduce el propio navegador si tiene la Translator API integrada (Chrome de escritorio,
// on-device: el titular no sale del ordenador). En el resto de navegadores no se hace nada.
import type { Attachment } from 'svelte/attachments';
import { SvelteMap } from 'svelte/reactivity';

export type TitleLang = 'es' | 'en';

const KEY = 'arc-titles';

/** Como un ref() de Vue compartido por todas las vistas. Por defecto, en español. */
export const titles = $state({ lang: 'es' as TitleLang });

let loaded = false;

/** Lee la preferencia guardada. Solo en el navegador (desde un $effect). */
export function initTitles() {
	if (loaded) return;
	loaded = true;
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === 'es' || saved === 'en') titles.lang = saved;
	} catch {
		// Sin localStorage (modo privado estricto): se queda en español.
	}
}

export function setTitleLang(lang: TitleLang) {
	titles.lang = lang;
	try {
		localStorage.setItem(KEY, lang);
	} catch {
		// No se puede guardar: vale solo para esta visita.
	}
	// Pulsar el botón cuenta como gesto del usuario: si hace falta, Chrome descarga ahora el modelo.
	if (lang === 'es') void pump(true);
}

interface Headline {
	title: string;
	lang?: 'en';
	titleEs?: string;
}

/** Traducciones hechas en este navegador (titular original → español). */
const local = new SvelteMap<string, string>();

/** El titular en español, si existe (de la Action o del navegador). */
export function spanish(item: Headline): string | undefined {
	return item.titleEs ?? (item.lang === 'en' ? local.get(item.title) : undefined);
}

/** Lo que se enseña según la preferencia, y si es una traducción. */
export function shown(item: Headline): { text: string; translated: boolean } {
	const es = titles.lang === 'es' ? spanish(item) : undefined;
	return es ? { text: es, translated: true } : { text: item.title, translated: false };
}

/** Texto al pasar el ratón por un titular traducido: el original y quién lo ha traducido. */
export function original(item: Headline): string {
	return `${item.title}\nTraducción automática · ${item.titleEs ? 'MyMemory' : 'Chrome'}`;
}

// ---------- Translator API (Chrome) ----------

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface Translator {
	translate(text: string): Promise<string>;
}
interface TranslatorApi {
	availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
	create(o: { sourceLanguage: string; targetLanguage: string }): Promise<Translator>;
}

const PAIR = { sourceLanguage: 'en', targetLanguage: 'es' };
const api = () => (globalThis as { Translator?: TranslatorApi }).Translator;

/** ¿Este navegador puede traducir por su cuenta? (Detección de la característica.) */
export const canTranslate = () => typeof window !== 'undefined' && !!api();

const pending = new Set<string>();
const failed = new Set<string>();
let translator: Translator | null = null;
let unsupported = false;
let running = false;

/** Pide traducir en segundo plano los titulares en inglés que no traen `titleEs`. */
export function translateMissing(items: Headline[]) {
	if (!canTranslate() || unsupported) return;
	for (const i of items) {
		if (i.lang === 'en' && !i.titleEs && !local.has(i.title) && !failed.has(i.title)) pending.add(i.title);
	}
	void pump(false);
}

/** Un hueco libre del navegador entre titular y titular, para no bloquear la interfaz. */
const idle = () =>
	new Promise<void>((resolve) =>
		'requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 1000 }) : setTimeout(resolve, 50)
	);

async function ready(gesture: boolean): Promise<Translator | null> {
	if (translator) return translator;
	const T = api();
	if (!T || unsupported) return null;
	const state = await T.availability(PAIR);
	if (state === 'unavailable') {
		unsupported = true;
		return null;
	}
	// Si el modelo aún no está descargado, Chrome solo lo descarga tras un gesto del usuario.
	if (state !== 'available' && !gesture) return null;
	translator = await T.create(PAIR);
	return translator;
}

async function pump(gesture: boolean) {
	if (running || !pending.size || titles.lang !== 'es') return;
	running = true;
	try {
		const t = await ready(gesture);
		if (!t) return;
		for (const title of pending) {
			pending.delete(title);
			await idle();
			try {
				local.set(title, await t.translate(title));
			} catch {
				failed.add(title);
			}
		}
	} catch {
		// La API existe pero falla: los titulares se quedan en inglés.
	} finally {
		running = false;
	}
}

// ---------- Ver el original ----------

/**
 * En el móvil, una pulsación larga sobre un titular traducido enseña el original mientras se mantiene
 * (y un momento después). En el escritorio basta con pasar el ratón: va en el atributo `title`.
 */
export function longPress(peek: (on: boolean) => void): Attachment<HTMLElement> {
	return (node) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let hide: ReturnType<typeof setTimeout> | undefined;
		let held = false;
		const down = (e: PointerEvent) => {
			if (e.pointerType !== 'touch') return;
			held = false;
			clearTimeout(hide);
			timer = setTimeout(() => {
				held = true;
				peek(true);
			}, 400);
		};
		const up = () => {
			clearTimeout(timer);
			timer = undefined;
			if (held) hide = setTimeout(() => peek(false), 1500);
		};
		// Tras una pulsación larga, soltar no abre el enlace ni el menú del navegador.
		const click = (e: Event) => {
			if (held) e.preventDefault();
			held = false;
		};
		const menu = (e: Event) => {
			if (held) e.preventDefault();
		};
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('click', click);
		node.addEventListener('contextmenu', menu);
		return () => {
			clearTimeout(timer);
			clearTimeout(hide);
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('click', click);
			node.removeEventListener('contextmenu', menu);
		};
	};
}
