<!--
	Archivos de Arc OS: el explorador, al estilo de un gestor de archivos web de NAS. Usa el mismo árbol de carpetas
	que el escritorio (src/lib/os/fs/: fs.ts puro y fs.svelte.ts con files.tree y las acciones).
	- Izquierda, el árbol: Escritorio (con sus carpetas desplegables), los sitios del sistema (Apps, Notas, Valores,
	  Escritorios, Favoritos: virtuales y de solo lectura) y la Papelera.
	- Arriba: atrás, adelante, subir, la ruta clicable y el buscador (busca también en las subcarpetas). Debajo, la
	  barra de acciones: Crear carpeta, Renombrar, Copiar acceso, Mover a…, A la papelera, Restaurar, Vaciar papelera,
	  Propiedades y la vista (Lista o Iconos).
	- La carpeta abierta va en la ruta de la ventana («/desktop», «/trash», «/<id>», «/sys:notes»): openNode de una
	  carpeta abre esta app en ella y, si ya está abierta, navega.
	- Selección: clic, Ctrl o ⌘ (añadir), Mayús (tramo) y rectángulo en el fondo. Teclado: Intro abre, F2 renombra,
	  Supr tira (en la papelera, borra), Retroceso sube, Alt+← →, Ctrl+A. Clic derecho: menú.
	- Arrastrar: a una carpeta (de la lista, del árbol, del escritorio o de otra ventana), a la Papelera o al
	  escritorio. Lo del sistema no se mueve: deja un acceso directo.
	- Ventana de 600 px o menos (container query): el árbol pasa a un panel aparte («Carpetas») y la vista es lista.
	Lógica pura en explorer.ts (con tests); abrir lo que apunta un archivo, en open.ts.
-->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import Search from '../../../components/ui/Search.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import { readFavs } from '../../../bar/favs.ts';
	import { hasWords, queryWords } from '../../../search.ts';
	import { initWatchlist, watchlist } from '../../../watchlist.svelte.ts';
	import { APPS, findApp, type AppProps } from '../../apps.ts';
	import { dropPlan } from '../../fs/desk.ts';
	import { DESKTOP, isFolder, list, rootOf, TRASH } from '../../fs/fs.ts';
	import { addNode, dropTarget, emptyTrash, files, mkdir, move, moveToDesk, openNode, purge, rename, restore, trash } from '../../fs/fs.svelte.ts';
	import OsIcon from '../../icons/OsIcon.svelte';
	import { os, setPath } from '../../os.svelte.ts';
	import * as bridge from '../../shell/bridge.ts';
	import { titleOf } from '../notes/notes.ts';
	import { notes, startNotes } from '../notes/notes.svelte.ts';
	import * as ex from './explorer.ts';
	import { openRef } from './open.ts';

	let { win }: AppProps = $props();

	const VIEW_KEY = 'arc-os-files-view';
	const NARROW = 600;

	// ---- Dónde estamos ----
	const w = $derived(os.state.desks.flatMap((d) => d.wins).find((x) => x.uid === win));
	// En el móvil (MobileHome) la app va a pantalla completa sin ventana del núcleo: la carpeta se guarda aquí.
	let ownPath = $state<string | undefined>();
	const loc = $derived(ex.locOf(w ? w.path : ownPath));
	function goPath(path: string) {
		if (w) setPath(win, path);
		else ownPath = path;
	}

	let favs = $state<string[]>([]);
	onMount(() => {
		startNotes();
		initWatchlist();
		favs = readFavs();
		try {
			if (localStorage.getItem(VIEW_KEY) === 'icons') view = 'icons';
		} catch {}
	});

	const ctx = $derived<ex.Ctx>({
		apps: APPS.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
		notes: notes.list.map((n) => ({ id: n.id, title: titleOf(n), at: n.updated, trashed: !!n.trashed })),
		lists: watchlist.lists,
		desks: os.state.desks.map((d) => ({ id: d.id, name: d.name })),
		favs
	});
	const sys = $derived(ex.isSys(loc));
	const exists = $derived(ex.locExists(files.tree, loc, ctx));
	const isBin = $derived(loc === TRASH);
	/** Dentro de la papelera (ella o una carpeta tirada). */
	const binned = $derived(!sys && rootOf(files.tree, loc) === TRASH);
	/** ¿Se pueden crear cosas aquí? */
	const mine = $derived(!sys && exists && !binned);
	const crumbs = $derived(ex.crumbs(files.tree, loc, ctx));
	const up = $derived(ex.upOf(files.tree, loc));
	const locName = (l: string) => ex.locName(files.tree, l, ctx);
	const appName = (id: string) => findApp(id)?.name;

	// ---- Historial: cada cambio de carpeta (desde aquí o desde fuera) se apunta ----
	let hist = $state<ex.Hist>({ back: [], fwd: [] });
	let shown = untrack(() => loc);
	let jumping = false;
	$effect(() => {
		const l = loc;
		untrack(() => {
			if (l === shown) return;
			if (!jumping) hist = ex.visit(hist, shown, l);
			jumping = false;
			shown = l;
			selected = [];
			anchor = null;
			editing = null;
			query = '';
			dialog = null;
			treeOpen = false;
			expandTo(l);
		});
	});
	function go(to: string) {
		if (to !== loc) goPath(ex.locPath(to));
		treeOpen = false;
	}
	function jump(r: { hist: ex.Hist; to: string } | null) {
		if (!r) return;
		hist = r.hist;
		jumping = true;
		goPath(ex.locPath(r.to));
	}
	const back = () => jump(ex.goBack(hist, loc));
	const forward = () => jump(ex.goForward(hist, loc));

	// ---- Vista, búsqueda y orden ----
	let view = $state<'list' | 'icons'>('list');
	let width = $state(0);
	const narrow = $derived(width > 0 && width <= NARROW);
	const shownView = $derived(narrow ? 'list' : view);
	$effect(() => {
		const v = view;
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {}
	});
	let query = $state('');
	const words = $derived(queryWords(query));
	let sort = $state<ex.Sort>({ col: 'name', dir: 1 });

	const exists_ = (ref: string) => ex.refExists(ref, ctx);
	const all = $derived.by((): ex.Item[] => {
		if (!exists) return [];
		if (sys) return ex.sysItems(loc, ctx);
		return ex.folderNodes(files.tree, loc, words.length > 0).map((n) => ex.nodeItem(n, appName, exists_));
	});
	const items = $derived(ex.sortItems(words.length ? all.filter((i) => hasWords(i.name, words)) : all, sort, locName));
	const order = $derived(items.map((i) => i.key));
	const byKey = $derived(new Map(items.map((i) => [i.key, i])));

	// ---- Selección ----
	let selected = $state<string[]>([]);
	let anchor = $state<string | null>(null);
	const sel = $derived(selected.map((k) => byKey.get(k)).filter((i): i is ex.Item => !!i));
	const selNodes = $derived(sel.filter((i) => i.node).map((i) => i.node!.id));
	const selRefs = $derived(sel.filter((i) => i.ref));
	const one = $derived(sel.length === 1 ? sel[0] : null);
	const cursor = $derived(anchor && byKey.has(anchor) ? anchor : null);
	$effect(() => {
		// Lo seleccionado que ya no está (se ha movido desde otra ventana) deja de estarlo.
		const here = byKey;
		untrack(() => {
			if (selected.some((k) => !here.has(k))) selected = selected.filter((k) => here.has(k));
		});
	});

	// ---- Mensajes, diálogos y menú ----
	let note = $state('');
	let noteTimer: ReturnType<typeof setTimeout> | undefined;
	function say(text: string) {
		note = text;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (note = ''), 5000);
	}
	type Dialog =
		| { kind: 'props'; item: ex.Item }
		| { kind: 'pick'; mode: 'move' | 'copy'; keys: string[] }
		| { kind: 'ask'; text: string; ok: string; run: () => void };
	let dialog = $state<Dialog | null>(null);
	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	let root = $state<HTMLElement>();
	let pane = $state<HTMLElement>();

	const many = (n: number, one: string, more: string) => (n > 1 ? more.replace('#', String(n)) : one);
	const when = (ms: number) => new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	const whenShort = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : '');

	// ---- Acciones ----
	function open(i: ex.Item) {
		if (i.to) return go(i.to);
		if (i.trashed || binned) return say('Está en la papelera: restáuralo para abrirlo.');
		if (i.missing) return say(`«${i.name}» ya no está.`);
		if (i.node) openNode(i.node);
		else if (i.ref) openRef(i.ref);
	}
	async function newFolder() {
		if (!mine) return;
		const id = mkdir(loc);
		if (!id) return say('No cabe: hay demasiadas carpetas o están muy hondas.');
		query = '';
		await tick();
		selected = [id];
		anchor = id;
		startRename(id);
	}
	let editing = $state<string | null>(null);
	let draft = $state('');
	function startRename(key: string) {
		const i = byKey.get(key);
		if (!i?.node || binned) return;
		selected = [key];
		editing = key;
		draft = i.name;
	}
	function endRename(save: boolean) {
		const key = editing;
		if (key && save && draft.trim()) rename(key, draft);
		editing = null;
		if (key) queueMicrotask(() => pane?.focus());
	}
	function toTrash(ids: string[]) {
		if (!ids.length) return say('Lo del sistema no se tira: es de solo lectura.');
		trash(ids);
		selected = [];
		say(many(ids.length, 'A la papelera.', '# elementos a la papelera.'));
	}
	function doRestore(ids: string[]) {
		restore(ids);
		selected = [];
		say(many(ids.length, 'Restaurado.', '# elementos restaurados.'));
	}
	function askPurge(ids: string[]) {
		if (!ids.length) return;
		dialog = {
			kind: 'ask',
			text: ids.length > 1 ? `¿Eliminar para siempre ${ids.length} elementos?` : `¿Eliminar para siempre «${files.tree[ids[0]]?.name}»?`,
			ok: 'Eliminar',
			run: () => {
				purge(ids);
				selected = [];
			}
		};
	}
	function askEmpty() {
		const n = list(files.tree, TRASH).length;
		if (!n) return say('La papelera ya está vacía.');
		dialog = { kind: 'ask', text: `¿Borrar para siempre ${many(n, 'lo que hay', '# elementos')} en la papelera? No se puede deshacer.`, ok: 'Vaciar', run: emptyTrash };
	}
	// «Vaciar papelera…» desde el escritorio: lo pregunta la ventana que enseña la papelera.
	$effect(() => {
		if (isBin && files.ask) {
			files.ask = false;
			untrack(askEmpty);
		}
	});
	function pick(mode: 'move' | 'copy', keys = selected) {
		const its = keys.map((k) => byKey.get(k)).filter((i): i is ex.Item => !!i);
		if (mode === 'move' && !its.some((i) => i.node)) return say('Lo del sistema no se mueve: usa «Copiar acceso».');
		if (mode === 'copy' && !its.some((i) => i.ref)) return say('Las carpetas no tienen acceso: muévelas.');
		dialog = { kind: 'pick', mode, keys: [...keys] };
	}
	/** Deja accesos a lo que apuntan unas filas en una carpeta. Devuelve los ids nuevos. */
	function copyTo(its: ex.Item[], dest: string): string[] {
		const ids: string[] = [];
		for (const i of its) {
			const n = i.ref && ex.accessNode(i.ref, i.name, dest);
			const id = n && addNode(n);
			if (id) ids.push(id);
		}
		if (its.length && !ids.length) say('No cabe: hay demasiadas cosas en tus carpetas.');
		return ids;
	}
	function chosen(dest: string) {
		if (dialog?.kind !== 'pick') return;
		const its = dialog.keys.map((k) => byKey.get(k)).filter((i): i is ex.Item => !!i);
		if (dialog.mode === 'move') {
			move(its.filter((i) => i.node).map((i) => i.node!.id), dest);
			say(`Movido a «${locName(dest)}».`);
		} else if (copyTo(its.filter((i) => i.ref), dest).length) say(`Acceso creado en «${locName(dest)}».`);
		dialog = null;
	}
	const showProps = (i: ex.Item | null) => i && (dialog = { kind: 'props', item: i });
	function del() {
		if (binned) askPurge(selNodes);
		else toTrash(selNodes);
	}

	// ---- Árbol ----
	let expanded = $state<string[]>([DESKTOP]);
	let treeOpen = $state(false);
	function expandTo(l: string) {
		const ids = ex.crumbs(files.tree, l, ctx).map((c) => c.id);
		const add = ids.filter((id) => id !== l && !expanded.includes(id));
		if (add.length) expanded = [...expanded, ...add];
	}
	const toggle = (id: string) => (expanded = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id]);
	const subfolders = (id: string) => list(files.tree, id).filter((n) => n.kind === 'folder');
	const sysKids = (id: string): { id: string; name: string }[] =>
		id === ex.SYS_APPS ? ex.APP_KINDS.map((k) => ({ id: `${ex.SYS_APPS}:${k.id}`, name: k.name })) : id === ex.SYS_MIS ? ctx.lists.map((l, i) => ({ id: `${ex.SYS_MIS}:${i}`, name: l.name })) : [];

	// ---- Ratón: selección, arrastre y rectángulo ----
	let drag = $state<{ keys: string[]; x0: number; y0: number; x: number; y: number; moved: boolean } | null>(null);
	let single: string | null = null;
	const canHold = (t: string | null) => !!t && isFolder(files.tree, t) && t !== TRASH && rootOf(files.tree, t) === DESKTOP;
	const insideMe = (x: number, y: number) => !!root?.contains(document.elementFromPoint(x, y));

	function itemDown(e: PointerEvent, i: ex.Item) {
		if (e.button !== 0 || editing === i.key) return;
		e.stopPropagation();
		pane?.focus({ preventScroll: true });
		const mods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
		single = null;
		if (mods.ctrl || mods.shift || !selected.includes(i.key)) {
			const r = ex.clickSelect(order, selected, anchor, i.key, mods);
			selected = r.sel;
			anchor = r.anchor;
		} else single = i.key;
		if (e.pointerType === 'touch') return holdStart(e, i);
		const keys = (selected.includes(i.key) ? selected : [i.key]).filter((k) => byKey.get(k)?.node || byKey.get(k)?.ref);
		if (!keys.length) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { keys, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
	}
	function plan(x: number, y: number) {
		if (!drag) return null;
		const its = drag.keys.map((k) => byKey.get(k)).filter((i): i is ex.Item => !!i);
		const t = dropTarget(x, y, drag.keys);
		const real = its.filter((i) => i.node).map((i) => i.node!.id);
		if (real.length) return { t, its, p: dropPlan(files.tree, real, sys ? '' : loc, t) };
		return { t, its, p: canHold(t) ? ({ kind: 'copy', to: t! } as const) : ({ kind: 'none' } as const) };
	}
	function itemMove(e: PointerEvent) {
		holdMove(e);
		if (!drag) return;
		const moved = drag.moved || Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4;
		drag = { ...drag, x: e.clientX, y: e.clientY, moved };
		if (!moved) return;
		const r = plan(e.clientX, e.clientY);
		files.hover = r && r.p.kind !== 'none' && r.p.kind !== 'desk' ? r.t : null;
	}
	function itemUp(e: PointerEvent) {
		holdEnd();
		if (!drag) return;
		const r = drag.moved && e.type === 'pointerup' ? plan(e.clientX, e.clientY) : null;
		const here = insideMe(e.clientX, e.clientY);
		if (r) {
			const p = r.p;
			if (p.kind === 'trash') toTrash(p.ids);
			else if (p.kind === 'move' && p.to === DESKTOP && !here) moveToDesk(p.ids, e.clientX, e.clientY);
			else if (p.kind === 'move') move(p.ids, p.to);
			else if (p.kind === 'desk' && !here) moveToDesk(r.its.filter((i) => i.node).map((i) => i.node!.id), e.clientX, e.clientY);
			else if (p.kind === 'copy') {
				const ids = copyTo(r.its, p.to);
				if (ids.length && p.to === DESKTOP && !here) moveToDesk(ids, e.clientX, e.clientY);
				if (ids.length) say(many(ids.length, 'Acceso creado.', '# accesos creados.'));
			}
		} else if (single) {
			selected = [single];
			anchor = single;
		}
		single = null;
		drag = null;
		files.hover = null;
	}
	function itemClick(e: MouseEvent, i: ex.Item) {
		if (held) return void (held = false);
		if ((e as PointerEvent).pointerType === 'touch' && !e.ctrlKey && !e.shiftKey) open(i);
	}

	// ---- Táctil: sin clic derecho ni arrastre fino, mantener pulsado abre el menú (el de la fila o el del fondo) ----
	const HOLD_MS = 500;
	let hold: { id: number; timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
	/** El menú ya salió con esta pulsación: el toque que la acaba no abre nada. */
	let held = false;
	function holdStart(e: PointerEvent, i: ex.Item | null) {
		holdEnd();
		held = false;
		const { clientX: x, clientY: y } = e;
		const timer = setTimeout(() => {
			hold = null;
			held = true;
			if (i) itemMenu(x, y, i);
			else bgMenu(x, y);
		}, HOLD_MS);
		hold = { id: e.pointerId, timer, x, y };
	}
	function holdMove(e: PointerEvent) {
		// Si el dedo se mueve, es que desliza la lista: no es mantener pulsado.
		if (hold && e.pointerId === hold.id && Math.abs(e.clientX - hold.x) + Math.abs(e.clientY - hold.y) > 10) holdEnd();
	}
	function holdEnd() {
		if (hold) clearTimeout(hold.timer);
		hold = null;
	}

	let band = $state<{ x0: number; y0: number; x: number; y: number; base: string[] } | null>(null);
	function paneDown(e: PointerEvent) {
		if (e.button !== 0 || (e.target as HTMLElement).closest('[data-key], button, input')) return;
		if (e.pointerType === 'touch') return holdStart(e, null);
		pane?.focus({ preventScroll: true });
		const keep = e.ctrlKey || e.metaKey || e.shiftKey;
		if (!keep) selected = [];
		pane?.setPointerCapture(e.pointerId);
		band = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, base: keep ? [...selected] : [] };
	}
	function paneMove(e: PointerEvent) {
		holdMove(e);
		if (!band || !pane) return;
		band = { ...band, x: e.clientX, y: e.clientY };
		const r = ex.boxOf(band.x0, band.y0, band.x, band.y);
		const boxes = [...pane.querySelectorAll<HTMLElement>('[data-key]')].map((el): [string, ex.Box] => {
			const b = el.getBoundingClientRect();
			return [el.dataset.key!, { x: b.left, y: b.top, w: b.width, h: b.height }];
		});
		const hit = ex.boxHits(r, boxes);
		selected = [...new Set([...band.base, ...hit])];
		if (hit.length) anchor = hit[0];
	}
	function paneUp() {
		holdEnd();
		band = null;
	}
	const bandBox = $derived(band ? ex.boxOf(band.x0, band.y0, band.x, band.y) : null);

	// ---- Teclado ----
	function paneKey(e: KeyboardEvent) {
		if (editing || dialog) return;
		const k = e.key;
		const ctrl = e.ctrlKey || e.metaKey;
		if (k === 'Enter') {
			e.preventDefault();
			if (sel.length === 1) open(sel[0]);
			else for (const i of sel.filter((x) => !x.to)) open(i);
		} else if (k === 'F2') {
			e.preventDefault();
			if (one) startRename(one.key);
		} else if (k === 'Delete') {
			e.preventDefault();
			del();
		} else if (k === 'Backspace') {
			e.preventDefault();
			if (up) go(up);
		} else if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
			e.preventDefault();
			if (k === 'ArrowLeft') back();
			else forward();
		} else if (ctrl && k.toLowerCase() === 'a') {
			e.preventDefault();
			selected = [...order];
		} else if (k === 'Escape') selected = [];
		else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) {
			e.preventDefault();
			if (!order.length) return;
			const at = cursor ? order.indexOf(cursor) : -1;
			const cols = shownView === 'icons' && pane ? Math.max(1, getComputedStyle(pane.querySelector('.icons') ?? pane).gridTemplateColumns.split(' ').length) : 1;
			const step = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[k]!;
			const next = order[Math.max(0, Math.min(order.length - 1, at < 0 ? 0 : at + step))];
			const r = ex.clickSelect(order, selected, e.shiftKey ? anchor : null, next, { shift: e.shiftKey });
			selected = e.shiftKey ? r.sel : [next];
			if (!e.shiftKey) anchor = next;
			pane?.querySelector(`[data-key="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
		} else if (k === 'ContextMenu' || (e.shiftKey && k === 'F10')) {
			e.preventDefault();
			const el = cursor ? pane?.querySelector<HTMLElement>(`[data-key="${CSS.escape(cursor)}"]`) : null;
			const b = (el ?? pane)!.getBoundingClientRect();
			const i = cursor ? byKey.get(cursor) : null;
			if (i && selected.includes(i.key)) itemMenu(b.left + 24, b.top + b.height / 2, i);
			else bgMenu(b.left + 24, b.top + 24);
		}
	}
	function renameKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') endRename(true);
		else if (e.key === 'Escape') endRename(false);
	}
	function focusSelect(el: HTMLInputElement) {
		el.focus();
		el.select();
	}
	function rootKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && dialog) {
			e.stopPropagation();
			dialog = null;
		}
	}

	// ---- Menús ----
	function itemMenu(x: number, y: number, i: ex.Item) {
		if (!selected.includes(i.key)) {
			selected = [i.key];
			anchor = i.key;
		}
		const ids = selNodes;
		const n = sel.length;
		const items: MenuEntry[] = binned
			? [
					...(i.to ? [{ label: 'Abrir', kbd: 'Intro', run: () => open(i) }, 'sep' as const] : []),
					{ label: many(ids.length, 'Restaurar', 'Restaurar #'), disabled: !ids.length || !isBin, run: () => doRestore(ids) },
					{ label: 'Eliminar para siempre…', kbd: 'Supr', disabled: !ids.length, run: () => askPurge(ids) },
					'sep',
					{ label: 'Propiedades', disabled: n !== 1, run: () => showProps(i) }
				]
			: [
					{ label: 'Abrir', kbd: 'Intro', run: () => open(i) },
					...(i.kind === 'app' && i.ref ? [{ label: 'Abrir otra ventana', run: () => bridge.openFresh(ex.parseRef(i.ref!)!.id) }] : []),
					'sep',
					{ label: 'Cambiar nombre', kbd: 'F2', disabled: n !== 1 || !i.node, run: () => startRename(i.key) },
					{ label: 'Copiar acceso a…', disabled: !selRefs.length, run: () => pick('copy') },
					...(i.ref && !i.node ? [{ label: 'Poner en el escritorio', run: () => copyTo(selRefs, DESKTOP).length && say('En el escritorio.') }] : []),
					{ label: 'Mover a…', disabled: !ids.length, run: () => pick('move') },
					{ label: many(ids.length, 'A la papelera', 'Mover # a la papelera'), kbd: 'Supr', disabled: !ids.length, run: () => toTrash(ids) },
					'sep',
					{ label: 'Propiedades', disabled: n !== 1, run: () => showProps(i) }
				];
		menu = { x, y, label: `Menú de ${i.name}`, items };
	}
	function bgMenu(x: number, y: number) {
		menu = {
			x,
			y,
			label: `Menú de ${locName(loc)}`,
			items: [
				{ label: 'Crear carpeta', disabled: !mine, run: newFolder },
				...(isBin ? [{ label: 'Vaciar papelera…', disabled: !items.length, run: askEmpty }] : []),
				'sep',
				{ label: 'Lista', checked: shownView === 'list', run: () => (view = 'list') },
				{ label: 'Iconos', checked: shownView === 'icons', disabled: narrow, run: () => (view = 'icons') },
				...(up ? ['sep' as const, { label: 'Subir', kbd: '⌫', run: () => go(up!) }] : [])
			]
		};
	}
	function contextmenu(e: MouseEvent) {
		e.preventDefault();
		// En Android, mantener pulsado también lanza contextmenu: ya lo abre holdStart.
		if (held || hold) return;
		const el = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
		const i = el && byKey.get(el.dataset.key!);
		if (i) itemMenu(e.clientX, e.clientY, i);
		else bgMenu(e.clientX, e.clientY);
	}

	/** El fantasma del arrastre, al final de <body> para que salga de la ventana. */
	function portal(el: HTMLElement) {
		document.body.appendChild(el);
		return { destroy: () => el.remove() };
	}
	const ghost = $derived(drag?.moved ? byKey.get(drag.keys[0]) : null);

	const VIEWS = [
		{ value: 'list', label: 'Lista' },
		{ value: 'icons', label: 'Iconos' }
	] as const;
	// En la papelera, «Ubicación» y «Creado» dicen de dónde venía y cuándo se tiró.
	const COLS = $derived<{ col: ex.SortCol; label: string }[]>([
		{ col: 'name', label: 'Nombre' },
		{ col: 'type', label: 'Tipo' },
		{ col: 'where', label: isBin ? 'Venía de' : 'Ubicación' },
		{ col: 'at', label: isBin ? 'Tirado' : 'Creado' }
	]);
	const optId = (i: number) => `${win}-it${i}`;
	/** Foco al abrir un diálogo. */
	const focusBtn = (el: HTMLElement) => void queueMicrotask(() => el.focus());
	function focusFirst(el: HTMLElement, first: boolean) {
		if (first) queueMicrotask(() => el.focus());
	}
</script>

{#snippet folderRow(id: string, name: string, icon: string, depth: number, kids: boolean, drop: boolean)}
	<div class="row" class:cur={loc === id} class:drop={drop && files.hover === id} style:--depth={depth} data-fs-drop={drop ? id : undefined}>
		{#if kids}
			<button type="button" class="tw" aria-expanded={expanded.includes(id)} aria-label={`${expanded.includes(id) ? 'Plegar' : 'Desplegar'} ${name}`} onclick={() => toggle(id)}
				>{expanded.includes(id) ? '▾' : '▸'}</button
			>
		{:else}
			<span class="tw" aria-hidden="true"></span>
		{/if}
		<button type="button" class="lbl" aria-current={loc === id ? 'page' : undefined} onclick={() => go(id)}>
			<OsIcon id={icon} size={16} />
			<span>{name}</span>
		</button>
	</div>
{/snippet}

{#snippet branch(parent: string, depth: number)}
	{#each subfolders(parent) as n (n.id)}
		{@const kids = subfolders(n.id).length > 0}
		<li>
			{@render folderRow(n.id, n.name, 'folder', depth, kids, true)}
			{#if kids && expanded.includes(n.id)}<ul>{@render branch(n.id, depth + 1)}</ul>{/if}
		</li>
	{/each}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fx" data-ui="os-tool" data-win={win} bind:this={root} bind:clientWidth={width} class:narrow onkeydown={rootKey}>
	<header class="top">
		<div class="nav">
			<button type="button" class="sq" onclick={back} disabled={!hist.back.length} aria-label="Atrás" title="Atrás (Alt+←)">‹</button>
			<button type="button" class="sq" onclick={forward} disabled={!hist.fwd.length} aria-label="Adelante" title="Adelante (Alt+→)">›</button>
			<button type="button" class="sq" onclick={() => up && go(up)} disabled={!up} aria-label="Subir" title="Subir (Retroceso)">↑</button>
			<button type="button" class="places" aria-expanded={treeOpen} onclick={() => (treeOpen = !treeOpen)}>Carpetas</button>
		</div>
		<nav class="crumbs" aria-label="Ruta">
			{#each crumbs as c, i (c.id)}
				{#if i}<span class="sep" aria-hidden="true">›</span>{/if}
				<button
					type="button"
					class="crumb"
					class:drop={files.hover === c.id}
					data-fs-drop={!ex.isSys(c.id) ? c.id : undefined}
					aria-current={c.id === loc ? 'page' : undefined}
					onclick={() => go(c.id)}>{c.name}</button
				>
			{/each}
		</nav>
		<div class="find"><Search label="Buscar en esta carpeta" placeholder="Buscar…" bind:value={query} /></div>
	</header>

	<div class="acts" role="toolbar" aria-label="Acciones">
		{#if isBin}
			<button type="button" onclick={() => doRestore(selNodes)} disabled={!selNodes.length}>Restaurar</button>
			<button type="button" onclick={() => askPurge(selNodes)} disabled={!selNodes.length}>Eliminar</button>
			<button type="button" onclick={askEmpty} disabled={!items.length}>Vaciar papelera</button>
		{:else}
			<button type="button" onclick={newFolder} disabled={!mine}>Crear carpeta</button>
			<button type="button" onclick={() => one && startRename(one.key)} disabled={!one?.node || binned}>Renombrar</button>
			<button type="button" onclick={() => pick('copy')} disabled={!selRefs.length || binned}>Copiar acceso</button>
			<button type="button" onclick={() => pick('move')} disabled={!selNodes.length}>Mover a…</button>
			<button type="button" onclick={del} disabled={!selNodes.length}>{binned ? 'Eliminar' : 'A la papelera'}</button>
		{/if}
		<button type="button" onclick={() => showProps(one)} disabled={!one}>Propiedades</button>
		<span class="gap"></span>
		{#if !narrow}<Seg label="Vista" options={VIEWS} bind:value={view} />{/if}
	</div>

	<div class="body">
		<nav class="tree" class:open={treeOpen} aria-label="Carpetas">
			<ul>
				<li>
					{@render folderRow(DESKTOP, 'Escritorio', 'folder', 0, subfolders(DESKTOP).length > 0, true)}
					{#if expanded.includes(DESKTOP)}<ul>{@render branch(DESKTOP, 1)}</ul>{/if}
				</li>
			</ul>
			<p class="group">Arc</p>
			<ul>
				{#each ex.PLACES as p (p.id)}
					{@const kids = sysKids(p.id)}
					<li>
						{@render folderRow(p.id, p.name, p.icon, 0, kids.length > 0, false)}
						{#if kids.length && expanded.includes(p.id)}
							<ul>
								{#each kids as k (k.id)}<li>{@render folderRow(k.id, k.name, 'folder', 1, false, false)}</li>{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
			<ul class="bin">
				<li>{@render folderRow(TRASH, 'Papelera', 'trash', 0, false, true)}</li>
			</ul>
		</nav>

		<div
			class="pane"
			class:drop={files.hover === loc && !drag}
			bind:this={pane}
			data-fs-drop={!sys && exists ? loc : undefined}
			role="listbox"
			aria-multiselectable="true"
			aria-label={`Contenido de ${locName(loc)}`}
			aria-activedescendant={cursor ? optId(order.indexOf(cursor)) : undefined}
			tabindex="0"
			onpointerdown={paneDown}
			onpointermove={paneMove}
			onpointerup={paneUp}
			onpointercancel={paneUp}
			oncontextmenu={contextmenu}
			onkeydown={paneKey}
		>
			{#if !exists}
				<div class="empty">
					<p>Esta carpeta ya no está.</p>
					<button type="button" onclick={() => go(DESKTOP)}>Ir al Escritorio</button>
				</div>
			{:else}
				{#if shownView === 'list'}
					<div class="head" role="presentation">
						{#each COLS as c (c.col)}
							<button type="button" class="sorter c-{c.col}" aria-label={`Ordenar por ${c.label.toLowerCase()}`} onclick={() => (sort = ex.toggleSort(sort, c.col))}>
								{c.label}{#if sort.col === c.col}<span class="arrow" aria-hidden="true">{sort.dir === 1 ? '▲' : '▼'}</span>{/if}
							</button>
						{/each}
					</div>
				{/if}
				<div class={shownView === 'list' ? 'rows' : 'icons'} role="presentation">
					{#each items as i, idx (i.key)}
						<!-- svelte-ignore a11y_click_events_have_key_events (el teclado va en la lista: Intro, F2, Supr…) -->
						<div
							id={optId(idx)}
							class="it"
							class:sel={selected.includes(i.key)}
							class:cur={cursor === i.key}
							class:missing={i.missing}
							class:drop={i.kind === 'folder' && !!i.node && files.hover === i.key}
							class:moving={drag?.moved && drag.keys.includes(i.key)}
							role="option"
							aria-selected={selected.includes(i.key)}
							tabindex="-1"
							data-key={i.key}
							data-fs-item={i.key}
							data-fs-drop={i.kind === 'folder' && i.node ? i.key : undefined}
							title={i.trashed ? `Venía de ${locName(i.trashed.from)}` : i.missing ? `${i.name}: ya no está` : i.name}
							onpointerdown={(e) => itemDown(e, i)}
							onpointermove={itemMove}
							onpointerup={itemUp}
							onpointercancel={itemUp}
							onclick={(e) => itemClick(e, i)}
							ondblclick={() => open(i)}
						>
							<span class="name">
								<OsIcon id={i.icon} size={shownView === 'list' ? 18 : 48} />
								{#if editing === i.key}
									<input class="rename" aria-label="Nombre" maxlength="60" bind:value={draft} use:focusSelect onkeydown={renameKey} onblur={() => endRename(true)} />
								{:else}
									<span class="txt">{i.name}</span>
								{/if}
							</span>
							{#if shownView === 'list'}
								<span class="c-type">{i.type}</span>
								<span class="c-where">{locName(ex.shownWhere(i))}</span>
								<span class="c-at">{whenShort(ex.shownAt(i))}</span>
							{/if}
						</div>
					{:else}
						<p class="hint">
							{words.length ? 'Nada coincide con la búsqueda.' : isBin ? 'La papelera está vacía.' : sys ? 'Aquí no hay nada.' : 'Carpeta vacía. Arrastra aquí iconos o usa «Mover a…».'}
						</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<footer class="status" aria-live="polite">
		<span>{ex.plural(items.length, '1 elemento', '# elementos')}</span>
		{#if sel.length}<span>· {many(sel.length, '1 seleccionado', '# seleccionados')}</span>{/if}
		{#if sys}<span class="mut">· Solo lectura</span>{/if}
		{#if note}<span class="note">{note}</span>{/if}
	</footer>

	{#if dialog}
		<div class="veil">
			<div class="dlg" role="dialog" aria-modal="true" aria-labelledby={`${win}-dlg`}>
				{#if dialog.kind === 'props'}
					<h2 id={`${win}-dlg`}><OsIcon id={dialog.item.icon} size={24} /> Propiedades</h2>
					<dl>
						{#each ex.properties(dialog.item, { loc: locName, app: appName, date: when }) as [k, v] (k)}
							<dt>{k}</dt>
							<dd>{v}</dd>
						{/each}
					</dl>
					<div class="btns"><button type="button" use:focusBtn onclick={() => (dialog = null)}>Cerrar</button></div>
				{:else if dialog.kind === 'pick'}
					<h2 id={`${win}-dlg`}>{dialog.mode === 'move' ? 'Mover a…' : 'Copiar acceso a…'}</h2>
					<ul class="choices">
						{#each ex.folderChoices(files.tree, dialog.mode === 'move' ? dialog.keys.filter((k) => files.tree[k]?.kind === 'folder') : []) as c, n (c.id)}
							<li><button type="button" use:focusFirst={n === 0} onclick={() => chosen(c.id)}><OsIcon id="folder" size={16} /> {c.label}</button></li>
						{/each}
					</ul>
					<div class="btns"><button type="button" onclick={() => (dialog = null)}>Cancelar</button></div>
				{:else}
					<h2 id={`${win}-dlg`}>{dialog.ok}</h2>
					<p>{dialog.text}</p>
					<div class="btns">
						<button type="button" use:focusBtn onclick={() => (dialog = null)}>Cancelar</button>
						<button type="button" class="danger" onclick={() => (dialog?.kind === 'ask' && dialog.run(), (dialog = null))}>{dialog.ok}</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if ghost && drag}
	<div class="ghost" use:portal style:left={`${drag.x}px`} style:top={`${drag.y}px`} aria-hidden="true">
		<OsIcon id={ghost.icon} size={40} />
		{#if drag.keys.length > 1}<span class="count">{drag.keys.length}</span>{/if}
	</div>
{/if}

{#if bandBox}
	<div class="band" use:portal style:left={`${bandBox.x}px`} style:top={`${bandBox.y}px`} style:width={`${bandBox.w}px`} style:height={`${bandBox.h}px`} aria-hidden="true"></div>
{/if}

{#if menu}
	<ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onclose={() => (menu = null)} />
{/if}


<style>
	.fx {
		container: fx / inline-size;
		position: relative;
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		height: 100%;
		min-height: 0;
		background: var(--panel);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-m);
	}
	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-field);
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
		white-space: nowrap;
	}
	button:disabled {
		color: var(--faint);
		cursor: default;
	}
	button:focus-visible,
	.pane:focus-visible {
		outline: var(--focus-w) solid var(--amber);
		outline-offset: calc(-1 * var(--focus-w));
	}

	/* ---- Arriba: navegación, ruta y buscador ---- */
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}
	.nav {
		display: flex;
		gap: var(--sp-4);
	}
	.sq {
		width: var(--control-h);
		padding: 0;
	}
	.places {
		display: none;
	}
	.crumbs {
		display: flex;
		flex: 1 1 200px;
		align-items: center;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-4);
		overflow: hidden;
		white-space: nowrap;
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
	}
	.crumb {
		height: auto;
		padding: var(--sp-2) var(--sp-4);
		border-color: transparent;
		background: none;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 18ch;
	}
	.crumb:hover,
	.crumb.drop {
		color: var(--fg);
		background: var(--amber-soft);
	}
	.crumb[aria-current='page'] {
		color: var(--fg);
	}
	.sep {
		color: var(--faint);
	}
	.find {
		display: flex;
		flex: 0 1 240px;
		min-width: 160px;
	}

	/* ---- Barra de acciones ---- */
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-4) var(--pad-x);
		border-bottom: var(--border);
		background: var(--raise);
	}
	.acts button {
		background: var(--panel);
	}
	.gap {
		flex: 1;
	}

	/* ---- Cuerpo: árbol | contenido ---- */
	.body {
		position: relative;
		display: grid;
		grid-template-columns: 220px 1fr;
		min-height: 0;
	}
	.tree {
		min-height: 0;
		overflow: auto;
		padding: var(--sp-6) 0;
		border-right: var(--border);
		background: var(--raise);
	}
	.tree ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tree .bin {
		margin-top: var(--sp-8);
		padding-top: var(--sp-6);
		border-top: var(--border);
	}
	.group {
		margin: var(--sp-10) 0 var(--sp-2);
		padding: 0 var(--sp-12);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--faint);
	}
	.row {
		display: flex;
		align-items: center;
		padding-left: calc(var(--sp-4) + var(--sp-12) * var(--depth));
		border: var(--hair) solid transparent;
	}
	.row:hover {
		background: var(--amber-soft);
	}
	.row.cur {
		background: var(--amber-soft);
		box-shadow: inset var(--sp-2) 0 0 var(--amber);
	}
	.row.drop {
		border-color: var(--amber);
		background: var(--amber-soft);
	}
	.tw {
		flex: none;
		width: var(--sp-16);
		height: var(--control-h);
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: var(--fs-xs);
		display: inline-grid;
		place-items: center;
	}
	.lbl {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--sp-6);
		min-width: 0;
		padding: 0 var(--sp-6) 0 var(--sp-2);
		border: 0;
		background: none;
		text-align: left;
	}
	.lbl span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lbl[aria-current='page'] {
		color: var(--amber);
	}

	.pane {
		position: relative;
		min-height: 0;
		overflow: auto;
		outline: none;
		border: var(--hair) solid transparent;
		user-select: none;
	}
	.pane.drop {
		border-color: var(--amber-edge);
		background: var(--amber-soft);
	}

	/* Lista: nombre | tipo | ubicación | creado */
	.head,
	.rows .it {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 1.6fr) minmax(0, 1.4fr) minmax(0, 1fr);
		align-items: center;
		column-gap: var(--sp-8);
		padding: 0 var(--pad-x);
	}
	.head {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--panel);
		border-bottom: var(--border);
	}
	.sorter {
		display: inline-flex;
		align-items: center;
		height: var(--control-h);
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-label);
	}
	.sorter:hover {
		color: var(--fg);
	}
	.arrow {
		margin-left: var(--sp-4);
		color: var(--amber);
	}
	.rows .it {
		min-height: var(--control-h);
		border-bottom: var(--hair) solid var(--line);
	}
	.it {
		cursor: default;
		touch-action: manipulation;
		-webkit-touch-callout: none;
	}
	.it:hover {
		background: var(--amber-soft);
	}
	.it.sel {
		background: var(--amber-soft);
		box-shadow: inset var(--sp-2) 0 0 var(--amber);
	}
	.it.drop {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}
	.it.moving {
		opacity: 0.45;
	}
	.it.missing .txt {
		color: var(--faint);
		text-decoration: line-through;
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		min-width: 0;
	}
	.txt,
	.c-type,
	.c-where,
	.c-at {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.c-type,
	.c-where,
	.c-at {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	/* Iconos */
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		align-content: start;
		gap: var(--sp-4);
		padding: var(--sp-12) var(--pad-x);
	}
	.icons .it {
		padding: var(--sp-6) var(--sp-4);
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
	}
	.icons .it.sel {
		box-shadow: none;
		border-color: var(--amber-edge);
	}
	.icons .name {
		flex-direction: column;
		gap: var(--sp-4);
		text-align: center;
	}
	.icons .txt {
		max-width: 100%;
		font-size: var(--fs-xs);
	}
	.icons .sel .txt {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.rename {
		flex: 1;
		width: 100%;
		min-width: 0;
		padding: 0 var(--sp-2);
		font: inherit;
		font-size: var(--fs-s);
		color: var(--fg);
		background: var(--bg);
		border: var(--hair) solid var(--amber);
		border-radius: var(--radius-s);
		outline: none;
	}
	.hint,
	.empty p {
		grid-column: 1 / -1;
		margin: var(--sp-24) var(--pad-x) 0;
		text-align: center;
		color: var(--muted);
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--sp-12);
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding: var(--sp-4) var(--pad-x);
		border-top: var(--border);
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.mut {
		color: var(--faint);
	}
	.note {
		margin-left: auto;
		color: var(--amber);
	}

	/* ---- Diálogos ---- */
	.veil {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		padding: var(--sp-16);
		background: var(--scrim);
	}
	.dlg {
		width: min(100%, 420px);
		max-height: 100%;
		overflow: auto;
		padding: var(--sp-16);
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
	}
	.dlg h2 {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		margin: 0 0 var(--sp-12);
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}
	.dlg p {
		margin: 0;
		color: var(--muted);
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--sp-6) var(--sp-12);
		margin: 0;
		font-size: var(--fs-s);
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.choices {
		display: grid;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.choices button {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		width: 100%;
		text-align: left;
		border-color: transparent;
		background: none;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.choices button:hover {
		background: var(--amber-soft);
	}
	.btns {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-8);
		margin-top: var(--sp-16);
	}
	.danger {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	/* Fantasma del arrastre y rectángulo de selección (van en <body>: :global). */
	.ghost {
		position: fixed;
		z-index: var(--z-popover);
		pointer-events: none;
		transform: translate(-50%, -50%);
		opacity: 0.85;
	}
	.count {
		position: absolute;
		top: calc(-1 * var(--sp-4));
		right: calc(-1 * var(--sp-4));
		min-width: var(--sp-16);
		padding: 0 var(--sp-4);
		border-radius: var(--os-radius-pill);
		background: var(--amber);
		color: var(--on-amber);
		font-size: var(--fs-xxs);
		text-align: center;
	}
	.band {
		position: fixed;
		z-index: var(--z-popover);
		pointer-events: none;
		border: var(--hair) solid var(--amber);
		background: var(--amber-soft);
	}

	/* ---- Ventana estrecha: el árbol, en un panel aparte; la vista, en lista ---- */
	@container fx (max-width: 600px) {
		.places {
			display: inline-block;
		}
		.body {
			grid-template-columns: 1fr;
		}
		.tree {
			display: none;
			position: absolute;
			inset: 0;
			z-index: 2;
			border-right: 0;
		}
		.tree.open {
			display: block;
		}
		.head,
		.rows .it {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.c-type,
		.c-where,
		.head .c-type,
		.head .c-where {
			display: none;
		}
		/* La ruta cabe junto a los botones de navegar: una fila menos. */
		.crumbs {
			flex-basis: 96px;
		}
		.find {
			flex: 1 1 100%;
		}
		/* Las acciones, en una sola fila que se desliza: así no se comen la lista. */
		.acts {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			/* Un contenedor con scroll puede encogerse a 0 en la rejilla: que mida siempre su fila. */
			min-height: min-content;
		}
		.acts button {
			flex: none;
		}
	}
</style>
