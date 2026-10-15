// Notas en el navegador: la lista (un $state, como un reactive() de Vue), crear, guardar, papelera. Cada nota es
// su clave en localStorage y cloud.svelte.ts la lleva a la cuenta (D1).
import { readJson, writeJson } from '../kit/store.ts';
import { byRecent, isNote, MAX_HTML, MAX_NOTES, NOTE_PREFIX, noteKey, type Note } from './notes.ts';

export const notes = $state({ list: [] as Note[] });

let started = false;

function readAll(): Note[] {
	const out: Note[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k?.startsWith(NOTE_PREFIX)) continue;
			const n = readJson<Note | null>(k, null, (v): v is Note | null => isNote(v));
			if (n && noteKey(n.id) === k) out.push({ ...n, html: sanitize(n.html) });
		}
	} catch {}
	return out.sort(byRecent);
}

export function startNotes() {
	if (typeof window === 'undefined') return;
	notes.list = readAll();
	if (started) return;
	started = true;
	addEventListener('storage', (e) => {
		if (!e.key || e.key.startsWith(NOTE_PREFIX)) notes.list = readAll();
	});
}

const find = (id: string) => notes.list.find((n) => n.id === id);
const save = (n: Note) => writeJson(noteKey(n.id), $state.snapshot(n));

/** Nota nueva (null si ya hay MAX_NOTES). */
export function newNote(html = ''): Note | null {
	if (notes.list.length >= MAX_NOTES) return null;
	const n: Note = { id: Math.random().toString(36).slice(2, 10), html, updated: Date.now() };
	notes.list.unshift(n);
	save(n);
	return find(n.id) ?? null;
}

export function updateNote(id: string, html: string) {
	const n = find(id);
	if (!n || n.html === html) return;
	n.html = html.slice(0, MAX_HTML);
	n.updated = Date.now();
	save(n);
	notes.list.sort(byRecent);
}

export function pinNote(id: string) {
	const n = find(id);
	if (n) (n.pinned = !n.pinned), save(n), notes.list.sort(byRecent);
}

export function trashNote(id: string) {
	const n = find(id);
	if (n) (n.trashed = Date.now()), save(n);
}

export function restoreNote(id: string) {
	const n = find(id);
	if (n) delete n.trashed, save(n);
}

/** Borra del todo (de aquí y, con la próxima sincronización, de la cuenta). */
export function deleteNote(id: string) {
	notes.list = notes.list.filter((n) => n.id !== id);
	try {
		localStorage.removeItem(noteKey(id));
	} catch {}
}

/** Se quitan con todo su contenido (no se dejan ni como texto). */
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'NOSCRIPT']);
const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'DIV']);

/**
 * Deja solo las etiquetas de ALLOWED, sin atributos (los enlaces, solo con href http(s)). Lo pegado de otra web o
 * de Word queda en texto con formato básico, sin estilos ni scripts.
 */
export function sanitize(html: string): string {
	const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
	const walk = (el: Element) => {
		for (const child of [...el.children]) {
			if (DROP.has(child.tagName)) {
				child.remove();
				continue;
			}
			walk(child);
			if (!ALLOWED.has(child.tagName)) {
				child.replaceWith(...child.childNodes);
				continue;
			}
			const href = child.tagName === 'A' ? child.getAttribute('href') : null;
			for (const a of [...child.attributes]) child.removeAttribute(a.name);
			if (href && /^https?:\/\//i.test(href)) {
				child.setAttribute('href', href);
				child.setAttribute('target', '_blank');
				child.setAttribute('rel', 'noopener');
			}
		}
	};
	walk(doc.body);
	return doc.body.innerHTML;
}
