<!--
	Modo OS en el móvil (≤ 900 px), inspirado en un teléfono. Pantalla de inicio con rejilla de iconos y widgets,
	páginas que se deslizan con puntos, dock de 4 apps y «Buscar». Las apps se abren a pantalla completa (la vista en
	un iframe con ?embed=1, como las ventanas del escritorio; las herramientas, con su componente) y se vuelve con la
	barra de abajo: deslizar hacia arriba (o tocarla) lleva a inicio; deslizar más, o mantenerla, a la multitarea.
	Desde arriba: a la izquierda, notificaciones; a la derecha, centro de control. Hacia abajo en inicio: Spotlight.
	Lógica en home.ts. Las apps abiertas siguen vivas (hasta MAX_OPEN): la multitarea las enseña en tarjetas.
	Mantener un icono entra en el modo edición: se arrastra para cambiarlo de sitio, al dock o sobre otro para hacer
	una carpeta. El orden se guarda en arc-os-phone (va con la cuenta).
-->
<script lang="ts">
	import { routeHref } from '#lib/routes.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import { pushState, replaceState } from '$app/navigation';
	import { untrack } from 'svelte';
	import { page as nav } from '$app/state';
	import { markAllSeen, shell, startNotices } from '../shell/shell.svelte.ts';
	import { markSeen as seenWith } from '../shell/notices.ts';
	import { EVENTS_KEY, isEvents, isoDay } from '../apps/cal/cal.ts';
	import { APPS, appOfPath, embedSrc, findApp } from '../apps.ts';
	import { os, phoneOpen } from '../os.svelte.ts';
	import {
		ARRANGE_KEY,
		WIDGETS,
		addWidget,
		arrange,
		badgesFor,
		noticesOf,
		removeWidget,
		dockApps,
		drop,
		folderName,
		gesture,
		keyboardFit,
		readSession,
		SESSION_KEY,
		layout,
		place,
		rename,
		takeOut,
		touch,
		webApp,
		type Arrangement,
		type Folder,
		type PhoneApp,
		type Src,
		type Target,
		type WidgetId
	} from './home.ts';
	import PhoneStatus from './PhoneStatus.svelte';
	import PhoneIcon from './PhoneIcon.svelte';
	import PhoneWidget from './PhoneWidget.svelte';
	import Spotlight from './Spotlight.svelte';
	import CenterSheet from './CenterSheet.svelte';
	import WallLayer from '../system/wall/WallLayer.svelte';
	import OsIcon from '../icons/OsIcon.svelte';
	import type { Hit } from '../system/search.ts';
	import { lock } from '../system/system.svelte.ts';
	import { leaveOS } from '../mode.svelte.ts';
	import PhoneFolder from './PhoneFolder.svelte';
	import PhoneFolderIcon from './PhoneFolderIcon.svelte';

	/** La base de la web (vacía si se publica en la raíz), como en Window.svelte. */
	const base = routeHref('/').replace(/\/$/, '');

	let { apps = APPS as PhoneApp[] }: { apps?: PhoneApp[] } = $props();

	// Tu orden: inicio y dock, con carpetas.
	const ids = $derived(apps.map((a) => a.id));
	let arr = $state<Arrangement>({ items: [], dock: [], widgets: [] });
	$effect(() => {
		let raw: string | null = null;
		try {
			raw = localStorage.getItem(ARRANGE_KEY);
		} catch {}
		arr = arrange(raw, ids);
	});
	function save(next: Arrangement) {
		if (next === arr) return;
		arr = next;
		try {
			localStorage.setItem(ARRANGE_KEY, JSON.stringify(next));
		} catch {}
	}
	const pages = $derived(layout(apps, arr));
	const dock = $derived(dockApps(apps, arr.dock));

	const now = $derived(clock.now || Date.now());
	const time = $derived(new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));

	// Apps abiertas: la primera es la de delante. `current`: la que se ve (null: pantalla de inicio).
	let open = $state<string[]>([]);
	let current = $state<string | null>(null);
	let paths = $state<Record<string, string>>({});
	let sheet = $state<null | 'notif' | 'control' | 'spot' | 'switch'>(null);

	// Insignias: lo no leído del centro de notificaciones de Arc OS (el mismo que el del escritorio), en la app a la
	// que lleva cada aviso; y en Calendario, tus eventos de hoy.
	$effect(() => startNotices());
	const appIdOf = (href: string) => appOfPath(href.split(/[?#]/)[0])?.id;
	let todayEvents = $state(0);
	$effect(() => {
		const day = isoDay(new Date(now));
		try {
			const list: unknown = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]');
			todayEvents = isEvents(list) ? list.filter((e) => e.date === day).length : 0;
		} catch {}
	});
	const badge: Record<string, number> = $derived({ ...badgesFor(shell.notices, shell.seen, appIdOf), ...(todayEvents ? { calendario: todayEvents } : {}) });
	const folderBadge = (f: Folder) => f.apps.reduce((n, id) => n + (badge[id] ?? 0), 0);
	const notice = $derived(os.notice && now - os.notice.at < 10 * 60_000 ? os.notice.text : null);
	/** Lo que estaba sin leer al abrir las notificaciones (se marca leído al abrirlas, pero se distingue). */
	let unreadAtOpen = $state(new Set<string>());

	/** Al abrir una app, lo suyo del centro de notificaciones queda leído. */
	function markSeen(id: string) {
		const ids = noticesOf(shell.notices, id, appIdOf);
		if (!ids.length || ids.every((x) => shell.seen.includes(x))) return;
		shell.seen = seenWith(shell.seen, ids);
		try {
			localStorage.setItem('arc-os-seen', JSON.stringify(shell.seen));
		} catch {}
	}
	$effect(() => {
		if (sheet !== 'notif') return;
		// Sin untrack, markAllSeen() cambia shell.seen, que este efecto lee: bucle infinito y la hoja no se abría.
		untrack(() => {
			unreadAtOpen = new Set(shell.notices.filter((n) => !shell.seen.includes(n.id)).map((n) => n.id));
			markAllSeen();
		});
	});

	// Widgets: en el modo edición se quitan («−») o se añaden («+», arriba a la izquierda).
	let picking = $state(false);
	const addable = $derived(WIDGETS.filter((w) => addWidget(arr, w.id) !== arr));
	const widgetName = (id: WidgetId) => WIDGETS.find((w) => w.id === id)?.name ?? id;

	function launch(a: PhoneApp, path?: string) {
		sheet = null;
		if (path) paths = { ...paths, [a.id]: path };
		else if (!paths[a.id] && a.href) paths = { ...paths, [a.id]: a.href };
		open = touch(open, a.id);
		current = a.id;
		markSeen(a.id);
	}
	/** Rutas sin app (la ficha de un valor, MODO…): se abren con una app de paso (webApp) mientras siguen abiertas. */
	let extra = $state<Record<string, PhoneApp>>({});
	// Tras recargar, siguen las apps abiertas y la de delante (sessionStorage de esta pestaña, como arc-os-desks en
	// el escritorio).
	let restored = false;
	$effect(() =>
		untrack(() => {
			let raw: string | null = null;
			try {
				raw = sessionStorage.getItem(SESSION_KEY);
			} catch {}
			const s = readSession(raw, (id) => !!(findApp(id) ?? apps.find((a) => a.id === id)));
			extra = Object.fromEntries(s.open.filter((id) => id.startsWith('web:')).map((id) => [id, webApp(id.slice(4), s.names[id])]));
			paths = s.paths;
			open = s.open;
			restored = true;
			// Si había algo abierto, la entrada del historial en la que estamos es la suya, pero page.state no sobrevive a
			// la recarga: se le vuelve a poner (replaceState, ya con el enrutador de SvelteKit en marcha). Así «atrás»
			// cierra la app de delante y no se apila otra entrada en cada recarga.
			if (s.entry)
				setTimeout(() => {
					replaceState('', { phone: 'app' });
					pushed = true;
					current = s.current;
				});
		})
	);
	$effect(() => {
		const data = JSON.stringify({ open, current, paths, names: Object.fromEntries(Object.values(extra).map((w) => [w.id, w.name])), entry: layer !== null });
		if (!restored) return;
		try {
			sessionStorage.setItem(SESSION_KEY, data);
		} catch {}
	});
	/** Una ruta de la web («/news?q=x»): la abre su app, con esa ruta; si no tiene, una app de paso. */
	function launchPath(path: string, name?: string) {
		const clean = base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
		const a = appOfPath(clean) as PhoneApp | undefined;
		if (a) return launch(a, clean);
		// /os dentro de /os no: es volver a inicio.
		if (/^\/os(?:[/?#]|$)/.test(clean)) return goHome();
		const w = webApp(clean, name);
		extra = { ...extra, [w.id]: w };
		launch(w);
	}
	function launchCode(code: string) {
		const c = COMMANDS.find((x) => x.code === code);
		if (c) launchPath(c.route);
	}
	// Lo que las apps abren con openApp/openPath (Terminal «eco», enlaces de Ajustes o Calendario…) sería una ventana
	// del escritorio, que aquí no se ve: se abre a pantalla completa.
	$effect(() => {
		phoneOpen.fn = (id, path) => {
			const a = appOf(id);
			if (!a) return false;
			launch(a, path);
			return true;
		};
		return () => (phoneOpen.fn = null);
	});
	const goHome = () => ((current = null), (sheet = null), (openFolder = null));

	function closeApp(id: string) {
		open = drop(open, id);
		const { [id]: _, ...rest } = paths;
		paths = rest;
		if (id in extra) {
			const { [id]: _, ...others } = extra;
			extra = others;
		}
		if (current === id) current = null;
		if (!open.length && sheet === 'switch') sheet = null;
	}

	const appOf = (id: string) => (findApp(id) ?? apps.find((a) => a.id === id) ?? extra[id]) as PhoneApp | undefined;

	// Páginas: el punto activo sale del scroll.
	let page = $state(0);
	let pager: HTMLDivElement;
	const onscroll = () => (page = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)));
	const toPage = (i: number) => pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });

	// Gestos (Pointer Events, como en el núcleo). Mantener la barra de abajo 0,5 s abre la multitarea.
	let start: { x: number; y: number } | null = null;
	/** Dónde y cuándo se movió el dedo por última vez: si se para antes de soltar, la barra lleva a la multitarea. */
	let last = { x: 0, y: 0, at: 0 };
	let hold: ReturnType<typeof setTimeout> | undefined;
	let topBar: HTMLDivElement;
	function down(e: PointerEvent) {
		start = { x: e.clientX, y: e.clientY };
		last = { x: e.clientX, y: e.clientY, at: e.timeStamp };
	}
	function track(e: PointerEvent) {
		// Mantener la barra es mantenerla quieta: si el dedo ya sube, decide el gesto al soltar.
		if (start && hold && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) (clearTimeout(hold), (hold = undefined));
		if (start && Math.hypot(e.clientX - last.x, e.clientY - last.y) > 8) last = { x: e.clientX, y: e.clientY, at: e.timeStamp };
	}
	function up(e: PointerEvent) {
		clearTimeout(hold);
		if (!start) return;
		if (editing || drag || openFolder) return void (start = null);
		const top = topBar?.getBoundingClientRect().bottom ?? 48;
		const g = gesture(start, { x: e.clientX, y: e.clientY }, { w: innerWidth, h: innerHeight }, current !== null, { top, paused: e.timeStamp - last.at > 250 });
		start = null;
		if (sheet) return;
		if (g === 'home') goHome();
		else if (g === 'switch') sheet = 'switch';
		else if (g) sheet = g;
	}
	function barDown(e: PointerEvent) {
		down(e);
		hold = setTimeout(() => {
			start = null;
			sheet = 'switch';
		}, 500);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		// Esc en un campo de una app (borrar, salir de una nota) no cierra la app entera.
		const t = e.target as HTMLElement | null;
		if (!sheet && !openFolder && !editing && current && t?.closest('input, textarea, select, [contenteditable]')) return;
		if (openFolder) openFolder = null;
		else if (editing) editing = false;
		else if (sheet) sheet = null;
		else if (current) current = null;
		else return;
		e.preventDefault();
	}

	// ---- Modo edición, arrastrar y carpetas ----
	let editing = $state(false);
	let openFolder = $state<string | null>(null);
	const folder = $derived(arr.items.find((s): s is Folder => typeof s !== 'string' && s.id === openFolder));
	const folderApps = $derived(folder ? dockApps(apps, folder.apps) : []);

	// «Atrás» (botón del navegador, gesto del iPhone o de Android): cierra lo de encima en vez de salir de /os. Lo
	// que se abre (app, hoja o carpeta) deja una entrada en el historial con el enrutado superficial de SvelteKit.
	const layer = $derived(sheet ?? (openFolder ? 'folder' : current ? 'app' : null));
	let pushed = false;
	$effect(() => {
		if (layer && !pushed) {
			pushed = true;
			pushState('', { phone: layer });
		} else if (!layer && pushed && nav.state.phone) history.back();
	});
	$effect(() => {
		if (nav.state.phone || !pushed) return;
		// Se ha vuelto atrás: se cierra lo de encima (una hoja sobre una app deja la app).
		pushed = false;
		untrack(() => {
			if (sheet) sheet = null;
			else if (openFolder) openFolder = null;
			else current = null;
		});
	});

	/** Lo que se arrastra (null: nada), dónde está el dedo y dónde caería. */
	let drag = $state<{ src: Src; x: number; y: number; to: Target | null } | null>(null);
	let press: { src: Src; x: number; y: number; armed: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
	/** Tras un arrastre o una pulsación larga, el clic que llega después no abre nada. */
	let swallow = false;

	const sectionOf = (id: string) => COMMANDS.find((c) => c.code.toLowerCase() === id)?.manual?.section;
	const dragApp = $derived(drag ? (appOf(drag.src.id) ?? null) : null);
	const dragFolder = $derived(drag && !dragApp ? (arr.items.find((s): s is Folder => typeof s !== 'string' && s.id === drag!.src.id) ?? null) : null);

	function pressStart(e: PointerEvent, src: Src) {
		if (e.button > 0 || current !== null) return;
		clearTimeout(press?.timer);
		swallow = false;
		const p = { src, x: e.clientX, y: e.clientY, armed: editing, timer: undefined as unknown as ReturnType<typeof setTimeout> };
		p.timer = setTimeout(() => {
			p.armed = true;
			swallow = true;
			if (!editing) {
				editing = true;
				navigator.vibrate?.(10);
			}
		}, 450);
		press = p;
	}

	/** Lo que hay bajo el dedo: una casilla de inicio, del dock o de la carpeta abierta. */
	function targetAt(x: number, y: number): Target | null {
		const src = drag!.src;
		const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
		if (!el) return document.elementFromPoint(x, y)?.closest('.pager') ? { kind: 'end' } : null;
		const [kind, val] = (el.dataset.drop ?? '').split(/:(.*)/);
		const r = el.getBoundingClientRect();
		const after = x > r.left + r.width / 2;
		if (kind === 'item') {
			if (val === src.id) return null;
			const sq = el.querySelector('.sq')?.getBoundingClientRect() ?? r;
			const inner = Math.abs(x - (sq.left + sq.width / 2)) < sq.width * 0.32 && Math.abs(y - (sq.top + sq.height / 2)) < sq.height * 0.32;
			if (inner && dragApp) return { kind: 'merge', key: val };
			return { kind: after ? 'after' : 'before', key: val };
		}
		if (kind === 'dock' || kind === 'fitem') {
			const list = kind === 'dock' ? arr.dock : (folder?.apps ?? []);
			let i = Number(val) + (after ? 1 : 0);
			const from = list.indexOf(src.id);
			if (from >= 0 && (kind === 'dock' ? !src.folder : src.folder === folder?.id) && from < i) i--;
			return kind === 'dock' ? { kind: 'dock', index: i } : { kind: 'folder', folder: folder!.id, index: i };
		}
		if (kind === 'dockzone') return { kind: 'dock', index: arr.dock.length - (arr.dock.includes(src.id) ? 1 : 0) };
		return null;
	}

	let edge: ReturnType<typeof setTimeout> | undefined;
	function onmove(e: PointerEvent) {
		track(e);
		if (!press && !drag) return;
		if (press && !drag) {
			const d = Math.hypot(e.clientX - press.x, e.clientY - press.y);
			if (!press.armed) {
				if (d > 10) (clearTimeout(press.timer), (press = null));
				return;
			}
			if (d < 6) return;
			drag = { src: press.src, x: e.clientX, y: e.clientY, to: null };
		}
		if (!drag) return;
		drag.x = e.clientX;
		drag.y = e.clientY;
		// Fuera del recuadro de una carpeta abierta: se cierra y la app sale a inicio.
		if (openFolder && drag.src.folder) {
			const r = document.querySelector('[data-folder-panel]')?.getBoundingClientRect();
			if (r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) openFolder = null;
		}
		drag.to = targetAt(e.clientX, e.clientY);
		// Cerca del borde, pasa de página.
		const side = e.clientX < 24 ? -1 : e.clientX > innerWidth - 24 ? 1 : 0;
		clearTimeout(edge);
		if (side && !openFolder) edge = setTimeout(() => toPage(Math.max(0, Math.min(pages.length - 1, page + side))), 600);
	}
	function onrelease() {
		clearTimeout(edge);
		if (press) clearTimeout(press.timer);
		press = null;
		if (!drag) return;
		const { src, to } = drag;
		drag = null;
		swallow = true;
		const names = [to?.kind === 'merge' ? to.key : '', src.id].map(sectionOf);
		const next = to ? place(arr, src, to, folderName(names)) : arr;
		// Si sale de una carpeta y no cabe donde lo sueltas, queda justo detrás de la carpeta.
		save(next === arr && src.folder && !openFolder ? takeOut(arr, src.folder, src.id) : next);
	}
	function oncancel() {
		clearTimeout(edge);
		if (press) clearTimeout(press.timer);
		press = null;
		drag = null;
	}
	/** Un toque en una app: la abre, salvo en el modo edición o justo después de arrastrar. */
	function tap(a: PhoneApp) {
		if (swallow || editing) return void (swallow = false);
		launch(a);
	}
	function tapFolder(f: Folder) {
		if (swallow) return void (swallow = false);
		openFolder = f.id;
	}
	// Mientras se arrastra, el dedo no desplaza las páginas ni la carpeta (en iOS hace falta un touchmove activo).
	$effect(() => {
		const stop = (e: TouchEvent) => (drag || press?.armed) && e.cancelable && e.preventDefault();
		addEventListener('touchmove', stop, { passive: false });
		return () => removeEventListener('touchmove', stop);
	});
	/** La marca de dónde caería, para una casilla. */
	const markOf = (key: string) => (drag?.to && 'key' in drag.to && drag.to.key === key ? drag.to.kind : null);
	const dockMark = $derived(drag?.to?.kind === 'dock' ? drag.to.index : -1);
	const folderMark = $derived.by(() => {
		const to = drag?.to;
		if (to?.kind !== 'folder' || !folder) return null;
		const n = folder.apps.length - (drag!.src.folder === folder.id ? 1 : 0);
		const list = folder.apps.filter((x) => x !== drag!.src.id);
		const at = Math.min(to.index, n);
		const key = at < list.length ? list[at] : list[list.length - 1];
		return { index: folder.apps.indexOf(key), side: at < list.length ? ('before' as const) : ('after' as const) };
	});

	/** Un resultado del buscador universal, en el teléfono: apps y rutas a pantalla completa; el resto, aquí. */
	function runPhoneHit(h: Hit) {
		const a = h.action;
		if ('app' in a) {
			const app = appOf(a.app);
			if (app) launch(app);
		} else if ('path' in a) launchPath(a.path, h.kind === 'Valor' ? undefined : h.title);
		else if (a.sys === 'lock') ((sheet = null), lock());
		else if (a.sys === 'leave') leaveOS();
		else if (a.sys === 'control') sheet = 'control';
		else if (a.sys === 'notices') sheet = 'notif';
		else goHome();
	}

	// Teclado en pantalla: el teléfono se ajusta a lo que queda visible (visualViewport), así el campo que escribes
	// no queda tapado y la barra de abajo sube con el teclado. Sin zoom de pellizco de por medio.
	let kb = $state<{ top: number; h: number } | null>(null);
	$effect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const fit = () => (kb = keyboardFit(vv, innerHeight));
		vv.addEventListener('resize', fit);
		vv.addEventListener('scroll', fit);
		return () => (vv.removeEventListener('resize', fit), vv.removeEventListener('scroll', fit));
	});

	/** Lo que se carga en el iframe de cada app abierta. */
	const src = (id: string) => base + embedSrc(paths[id] ?? appOf(id)?.href ?? '/');
</script>

<svelte:window {onkeydown} onpointermove={onmove} onpointerup={onrelease} onpointercancel={oncancel} />

<!-- Arc OS tiene un solo estilo, «Mando» (tokens.css): también el teléfono y lo que se abre encima. -->
<div class="skin" data-os-skin="mando" data-ui="os">
<div class="phone" class:in-app={current !== null} class:editing style:top={kb ? `${kb.top}px` : null} style:height={kb ? `${kb.h}px` : null} role="application" oncontextmenu={(e) => e.preventDefault()} aria-label="Modo OS" onpointerdown={down} onpointerup={up}>
	<!-- Fondo de pantalla: el que eliges en la app «Fondo de pantalla» de OS 5 (el mismo que el escritorio). -->
	<div class="wall" aria-hidden="true"><WallLayer /></div>
	<div class="top" bind:this={topBar}>
		<PhoneStatus {time} onnotif={() => (sheet = 'notif')} oncontrol={() => (sheet = 'control')} />
		{#if editing && current === null}
			<button class="add" onclick={() => (picking = true)} disabled={!addable.length} aria-label="Añadir un widget">+</button>
			<button class="done" onclick={() => ((editing = false), (picking = false))}>Listo</button>
		{/if}
	</div>

	<!-- Pantalla de inicio -->
	<div class="home" inert={current !== null || sheet === 'switch'} aria-hidden={current !== null}>
		<div class="pager" bind:this={pager} {onscroll}>
			{#each pages as cells, i (i)}
				<section class="page" aria-label="Página {i + 1} de {pages.length}">
					{#each cells as c (c.kind === 'app' ? c.app.id : c.kind === 'folder' ? c.folder.id : c.id)}
						{#if c.kind === 'app' || c.kind === 'folder'}
							{@const key = c.kind === 'app' ? c.app.id : c.folder.id}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="cell icon mark-{markOf(key)}"
								class:ghosted={drag?.src.id === key}
								data-drop="item:{key}"
								onpointerdown={(e) => pressStart(e, { id: key })}
							>
								{#if c.kind === 'app'}
									<PhoneIcon app={c.app} badge={badge[c.app.id] ?? 0} onopen={tap} />
								{:else}
									<PhoneFolderIcon folder={c.folder} apps={c.apps} badge={folderBadge(c.folder)} onopen={() => tapFolder(c.folder)} />
								{/if}
							</div>
						{:else}
							<div class="cell w-{c.size}">
								<PhoneWidget id={c.id} {now} notices={shell.notices} onopen={launchCode} onpath={launchPath} />
								{#if editing}
									<button class="minus" onclick={() => save(removeWidget(arr, c.id))} aria-label="Quitar el widget {widgetName(c.id)}">−</button>
								{/if}
							</div>
						{/if}
					{/each}
				</section>
			{/each}
		</div>

		<div class="below">
			<button class="search" onclick={() => (sheet = 'spot')}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
				Buscar
			</button>
			<div class="dots" role="tablist" aria-label="Páginas">
				{#each pages as _, i (i)}
					<button role="tab" aria-selected={page === i} aria-label="Página {i + 1}" class:on={page === i} onclick={() => toPage(i)}></button>
				{/each}
			</div>
		</div>

		<nav class="dock" aria-label="Dock" data-drop="dockzone">
			{#each dock as a, i (a.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="icon"
					class:ghosted={drag?.src.id === a.id}
					class:mark-before={dockMark === i}
					class:mark-after={dockMark === dock.length && i === dock.length - 1}
					data-drop="dock:{i}"
					onpointerdown={(e) => pressStart(e, { id: a.id })}
				>
					<PhoneIcon app={a} bare badge={badge[a.id] ?? 0} onopen={tap} />
				</div>
			{/each}
		</nav>
	</div>

	<!-- Apps abiertas: siguen vivas; la de delante se ve a pantalla completa, o todas en tarjetas (multitarea). -->
	{#if open.length}
		<div class="apps" class:switching={sheet === 'switch'} role={sheet === 'switch' ? 'dialog' : undefined} aria-label={sheet === 'switch' ? 'Apps abiertas' : undefined}>
			{#each open as id (id)}
				{@const a = appOf(id)}
				{#if a}
					<div class="slot" class:front={current === id} hidden={sheet !== 'switch' && current !== id}>
						{#if sheet === 'switch'}
							<div class="card-head">
								<span class="ch"><OsIcon id={a.id} size={16} /> {a.name}</span>
								<button onclick={() => closeApp(id)} aria-label="Cerrar {a.name}">✕</button>
							</div>
						{/if}
						<div class="frame">
							{#if a.load}
								{#await a.load() then mod}
									<mod.default win={id} />
								{/await}
							{:else}
								<iframe src={src(id)} title={a.name}></iframe>
							{/if}
						</div>
						{#if sheet === 'switch'}
							<button class="pick" onclick={() => ((current = id), (sheet = null), (open = touch(open, id)))} aria-label="Abrir {a.name}"></button>
						{/if}
					</div>
				{/if}
			{/each}
			{#if sheet === 'switch'}
				<button class="to-home" onclick={goHome}>Inicio</button>
			{/if}
		</div>
	{/if}

	{#if current !== null && sheet !== 'switch'}
		<button class="bar" onpointerdown={barDown} onclick={goHome} aria-label="Volver a inicio (mantén pulsado: apps abiertas)">
			<span aria-hidden="true"></span>
		</button>
	{/if}
</div>

{#if folder}
	<PhoneFolder
		{folder}
		apps={folderApps}
		{badge}
		{editing}
		dragging={drag?.src.id ?? null}
		mark={folderMark}
		onopen={(a) => tap(a)}
		onpress={(e, id) => pressStart(e, { id, folder: folder.id })}
		onrename={(name) => save(rename(arr, folder.id, name))}
		onclose={() => !drag && (openFolder = null)}
	/>
{/if}

{#if picking}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="pick-scrim" onclick={() => (picking = false)}></div>
	<div class="picker" role="dialog" aria-modal="true" aria-label="Añadir un widget">
		<h2>Widgets</h2>
		{#each addable as w (w.id)}
			<button class="wrow" onclick={() => (save(addWidget(arr, w.id)), (picking = false))}>
				<b>{w.name} <small>{w.size === 'l' ? 'grande' : 'pequeño'}</small></b>
				<span>{w.desc}</span>
			</button>
		{:else}
			<p>No cabe ninguno más: quita uno antes.</p>
		{/each}
	</div>
{/if}

{#if drag}
	<div class="drag" style:left="{drag.x}px" style:top="{drag.y}px" aria-hidden="true">
		{#if dragApp}
			<PhoneIcon app={dragApp} bare onopen={() => {}} />
		{:else if dragFolder}
			<PhoneFolderIcon folder={dragFolder} apps={dockApps(apps, dragFolder.apps)} onopen={() => {}} />
		{/if}
	</div>
{/if}

{#if sheet === 'spot'}
	<Spotlight {apps} {now} onapp={(a) => launch(a)} onpath={launchPath} onhit={runPhoneHit} onclose={() => (sheet = null)} />
{:else if sheet === 'notif' || sheet === 'control'}
	<CenterSheet kind={sheet} notices={shell.notices} unread={unreadAtOpen} {notice} {now} onclose={() => (sheet = null)} onpath={launchPath} />
{/if}

</div>

<style>
	.skin {
		display: contents;
	}
	.phone {
		/* Alto de la barra de inicio de abajo: la misma medida para la barra y para el hueco que le deja la app. */
		--home-bar: calc(env(safe-area-inset-bottom, 0px) + 22px);
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top, 0px);
		background: var(--os-phone-wall);
		color: var(--fg);
		font-family: var(--os-phone-font);
		overflow: hidden;
		overscroll-behavior: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.wall {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
	.top {
		position: relative;
		z-index: 3;
		touch-action: none;
	}
	.phone {
		-webkit-touch-callout: none;
	}
	.done {
		position: absolute;
		right: var(--sp-12);
		top: 50%;
		transform: translateY(-50%);
		height: var(--control-h);
		padding: 0 var(--sp-14);
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--fg);
		font: var(--fw-bold) var(--fs-s) var(--os-phone-font);
		cursor: pointer;
	}
	.add {
		position: absolute;
		left: var(--sp-12);
		top: 50%;
		transform: translateY(-50%);
		width: var(--control-h);
		height: var(--control-h);
		padding: 0;
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--fg);
		font: var(--fw-bold) var(--fs-l) var(--os-phone-font);
		cursor: pointer;
	}
	.add:disabled {
		opacity: 0.4;
	}
	.editing:not(.in-app) .top :global(.t) {
		visibility: hidden;
	}
	.w-l,
	.w-s {
		position: relative;
	}
	.minus {
		position: absolute;
		top: calc(-1 * var(--sp-6));
		left: calc(-1 * var(--sp-6));
		z-index: 1;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--raise);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--fg);
		font: var(--fw-bold) var(--fs-m) / 24px var(--os-phone-font);
		cursor: pointer;
	}
	.pick-scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) + 2);
		background: var(--os-glass-strong);
	}
	.picker {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--z-modal) + 3);
		display: flex;
		flex-direction: column;
		gap: var(--hair);
		max-height: 70dvh;
		overflow-y: auto;
		padding: var(--sp-16) var(--sp-16) calc(env(safe-area-inset-bottom, 0px) + var(--sp-16));
		border-radius: var(--os-radius-xl) var(--os-radius-xl) 0 0;
		background: var(--panel);
		box-shadow: inset 0 var(--hair) 0 var(--cmd-cold-dim);
		font-family: var(--os-phone-font);
		color: var(--fg);
	}
	.picker h2 {
		margin: 0 0 var(--sp-8);
		font-size: var(--fs-l);
	}
	.picker p {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.wrow {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
		padding: var(--sp-12);
		border: 0;
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.wrow small {
		color: var(--muted);
		font-weight: var(--fw-normal);
	}
	.wrow span {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.editing:not(.in-app) .top :global(.ic) {
		visibility: hidden;
	}
	/* Modo edición: los iconos se mecen un poco (sutil) y no desplazan la página al arrastrarlos. */
	.editing .icon {
		touch-action: none;
	}
	.editing .icon > :global(*) {
		animation: sway 0.32s ease-in-out infinite alternate;
	}
	.editing .icon:nth-child(2n) > :global(*) {
		animation-delay: -0.16s;
	}
	@keyframes sway {
		from {
			transform: rotate(-1deg);
		}
		to {
			transform: rotate(1deg);
		}
	}
	.icon {
		position: relative;
	}
	.ghosted {
		opacity: 0.3;
	}
	/* Dónde caería: una raya de acento a un lado, o el icono destino un poco mayor (carpeta). */
	.mark-before::before,
	.mark-after::after {
		content: '';
		position: absolute;
		top: 0;
		width: var(--sp-2);
		height: var(--os-icon-size);
		border-radius: var(--sp-2);
		background: var(--amber);
	}
	.mark-before::before {
		left: calc(-1 * var(--sp-6));
	}
	.mark-after::after {
		right: calc(-1 * var(--sp-6));
	}
	.mark-merge > :global(*) {
		transform: scale(1.12);
		transition: transform var(--dur-fast) var(--ease);
	}
	.drag {
		position: fixed;
		z-index: calc(var(--z-modal) + 5);
		width: calc(var(--os-icon-size) + var(--sp-12));
		transform: translate(-50%, -60%) scale(1.1);
		pointer-events: none;
		filter: drop-shadow(0 var(--sp-6) var(--sp-12) var(--bg));
	}
	.in-app .top {
		background: var(--bg);
	}
	.home {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-8));
		transition:
			transform var(--dur-ui) var(--ease),
			opacity var(--dur-ui) var(--ease);
	}
	.in-app .home {
		transform: scale(0.94);
		opacity: 0;
	}
	.pager {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		touch-action: pan-x;
	}
	.pager::-webkit-scrollbar {
		display: none;
	}
	.page {
		flex: 0 0 100%;
		scroll-snap-align: start;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: repeat(6, minmax(0, 1fr));
		gap: var(--sp-6) var(--sp-12);
		padding: var(--sp-8) var(--sp-20);
	}
	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
	}
	.w-l {
		grid-column: span 4;
		grid-row: span 2;
		align-items: stretch;
	}
	.w-s {
		grid-column: span 2;
		grid-row: span 2;
		align-items: stretch;
	}
	.w-l > :global(*),
	.w-s > :global(*) {
		flex: 1;
	}
	.below {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) 0 var(--sp-10);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: 30px;
		padding: 0 var(--sp-14);
		border: 0;
		border-radius: var(--os-radius-pill);
		background: var(--os-glass);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	.search svg {
		width: 13px;
		height: 13px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
	}
	.dots {
		display: flex;
		gap: var(--sp-8);
	}
	.dots button {
		flex: none;
		width: 7px;
		height: 7px;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--faint);
		cursor: pointer;
	}
	.dots button.on {
		background: var(--fg);
	}
	.dock {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0 var(--sp-12);
		padding: var(--sp-14) var(--sp-12);
		border-radius: var(--os-radius-xl);
		background: var(--os-glass);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
	}

	/* Apps a pantalla completa */
	.apps {
		position: absolute;
		inset: calc(env(safe-area-inset-top, 0px) + 44px) 0 0 0;
		z-index: 2;
		pointer-events: none;
	}
	.slot {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		pointer-events: auto;
		animation: zoom var(--dur-ui) var(--ease);
	}
	.slot[hidden] {
		display: none;
	}
	.frame {
		flex: 1;
		min-height: 0;
		padding-bottom: var(--home-bar);
	}
	iframe {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
		background: var(--bg);
	}
	.bar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
		display: flex;
		justify-content: center;
		align-items: center;
		height: var(--home-bar);
		/* Sin el mínimo táctil de app.css (44 px): la app solo deja libre --home-bar y lo de abajo quedaba tapado. */
		min-height: 0;
		padding: 0;
		border: 0;
		background: var(--bg);
		cursor: pointer;
		touch-action: none;
	}
	.bar span {
		width: 134px;
		height: 5px;
		border-radius: 3px;
		background: var(--fg);
		opacity: 0.85;
	}

	/* Multitarea: las mismas apps vivas, en tarjetas que se deslizan en horizontal. */
	.switching {
		display: flex;
		align-items: center;
		gap: var(--sp-16);
		inset: 0;
		padding: var(--sp-24) 12vw;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		background: var(--os-glass-strong);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		pointer-events: auto;
		z-index: 4;
	}
	.switching .slot {
		position: relative;
		inset: auto;
		flex: 0 0 76vw;
		height: 72dvh;
		border-radius: var(--os-radius-l);
		overflow: hidden;
		scroll-snap-align: center;
		box-shadow: var(--shadow-pop);
		animation: none;
	}
	.switching .frame {
		padding: 0;
		pointer-events: none;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-8) var(--sp-12);
		background: var(--raise);
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
	}
	.ch {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
	}
	.card-head button {
		position: relative;
		z-index: 2;
		min-width: var(--touch);
		min-height: var(--control-h);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}
	.pick {
		position: absolute;
		inset: 40px 0 0 0;
		z-index: 1;
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.to-home {
		position: fixed;
		left: 50%;
		bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-16));
		transform: translateX(-50%);
		height: var(--touch);
		padding: 0 var(--sp-20);
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	@keyframes zoom {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
	}
	/* iPhone y iPad (área de QA OS 3). Sin zoom por doble toque en las apps (dos toques seguidos en la Calculadora
	   ampliaban la página) ni pellizco en inicio; en horizontal, nada debajo de la muesca. */
	.phone {
		touch-action: manipulation;
		padding-left: env(safe-area-inset-left, 0px);
		padding-right: env(safe-area-inset-right, 0px);
	}
	/* Solo las páginas se desplazan (en horizontal): un arrastre vertical desde «Buscar», los puntos o el dock era
	   para el navegador, que cancelaba el puntero (pointercancel) y el gesto de Spotlight no llegaba. */
	.home {
		touch-action: pan-x;
	}
	/* Sin el rebote de Safari en toda la página al tirar hacia abajo o hacia arriba. */
	:global(html:has(.phone)),
	:global(body:has(.phone)) {
		overscroll-behavior: none;
	}
	.apps {
		left: env(safe-area-inset-left, 0px);
		right: env(safe-area-inset-right, 0px);
	}
	/* Tablet en vertical (iPad, 700–900 px): iconos algo mayores para tanto hueco. */
	@media (min-width: 700px) and (min-height: 700px) {
		.phone {
			--os-icon-size: 72px;
		}
	}
	/* Teléfono en horizontal: 6 filas no caben en ~390 px de alto y los iconos se montaban. Las mismas 24 casillas
	   pasan a 8 × 3 (un widget grande ocupa media fila) y todo se compacta. */
	@media (orientation: landscape) and (max-height: 540px) {
		.phone {
			--os-icon-size: 40px;
		}
		.page {
			grid-template-columns: repeat(8, 1fr);
			grid-template-rows: repeat(3, minmax(0, 1fr));
			gap: var(--sp-4) var(--sp-12);
			padding: var(--sp-4) var(--sp-20);
		}
		.page :global(.name) {
			font-size: var(--fs-xs);
		}
		/* «Buscar» sigue a mano deslizando hacia abajo; quedan los puntos de página. */
		.search {
			display: none;
		}
		.below {
			padding: var(--sp-4) 0;
		}
		.dock {
			padding: var(--sp-6) var(--sp-12);
		}
		.switching .slot {
			flex-basis: 56vw;
			height: 70dvh;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.home,
		.slot,
		.editing .icon > :global(*) {
			transition: none;
			animation: none;
		}
	}
</style>
