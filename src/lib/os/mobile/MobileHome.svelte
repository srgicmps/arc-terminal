<!--
	Modo OS en el móvil (≤ 900 px), inspirado en un teléfono. Pantalla de inicio con rejilla de iconos y widgets,
	páginas que se deslizan con puntos, dock de 4 apps y «Buscar». Las apps se abren a pantalla completa (la vista en
	un iframe con ?embed=1, como las ventanas del escritorio; las herramientas, con su componente) y se vuelve con la
	barra de abajo: deslizar hacia arriba (o tocarla) lleva a inicio; deslizar más, o mantenerla, a la multitarea.
	Desde arriba: a la izquierda, notificaciones; a la derecha, centro de control. Hacia abajo en inicio: Spotlight.
	Lógica en home.ts. Las apps abiertas siguen vivas (hasta MAX_OPEN): la multitarea las enseña en tarjetas.
-->
<script lang="ts">
	import { routeHref } from '#lib/routes.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import type { ChangesData } from '#lib/types.ts';
	import { APPS, appOfPath, embedSrc, findApp } from '../apps.ts';
	import { os } from '../os.svelte.ts';
	import { BADGES_KEY, badges, dockApps, drop, gesture, layout, readSeen, touch, type PhoneApp } from './home.ts';
	import PhoneStatus from './PhoneStatus.svelte';
	import PhoneIcon from './PhoneIcon.svelte';
	import PhoneWidget from './PhoneWidget.svelte';
	import Spotlight from './Spotlight.svelte';
	import CenterSheet from './CenterSheet.svelte';

	/** La base de la web (vacía si se publica en la raíz), como en Window.svelte. */
	const base = routeHref('/').replace(/\/$/, '');

	let { apps = APPS as PhoneApp[] }: { apps?: PhoneApp[] } = $props();

	const pages = $derived(layout(apps));
	const dock = $derived(dockApps(apps));

	const now = $derived(clock.now || Date.now());
	const time = $derived(new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));

	// Apps abiertas: la primera es la de delante. `current`: la que se ve (null: pantalla de inicio).
	let open = $state<string[]>([]);
	let current = $state<string | null>(null);
	let paths = $state<Record<string, string>>({});
	let sheet = $state<null | 'notif' | 'control' | 'spot' | 'switch'>(null);

	// Insignias: NOVEDADES desde la última vez que la abriste aquí.
	let seen = $state<Record<string, number>>({});
	$effect(() => {
		try {
			seen = readSeen(localStorage.getItem(BADGES_KEY));
		} catch {}
		loadBarData(['changes']);
	});
	const changes = $derived((barData.changes as ChangesData | null | undefined)?.items ?? []);
	const badge = $derived(badges(changes, seen, now));
	const notice = $derived(os.notice && now - os.notice.at < 10 * 60_000 ? os.notice.text : null);

	function markSeen(id: string) {
		seen = { ...seen, [id]: Date.now() };
		try {
			localStorage.setItem(BADGES_KEY, JSON.stringify(seen));
		} catch {}
	}

	function launch(a: PhoneApp, path?: string) {
		sheet = null;
		if (path) paths = { ...paths, [a.id]: path };
		else if (!paths[a.id] && a.href) paths = { ...paths, [a.id]: a.href };
		open = touch(open, a.id);
		current = a.id;
		markSeen(a.id);
	}
	/** Una ruta de la web («/news?q=x»): la abre su app, con esa ruta. */
	function launchPath(path: string) {
		const clean = base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
		const a = appOfPath(clean) as PhoneApp | undefined;
		if (a) launch(a, clean);
	}
	function launchCode(code: string) {
		const c = COMMANDS.find((x) => x.code === code);
		if (c) launchPath(c.route);
	}
	const goHome = () => ((current = null), (sheet = null));
	function closeApp(id: string) {
		open = drop(open, id);
		const { [id]: _, ...rest } = paths;
		paths = rest;
		if (current === id) current = null;
		if (!open.length && sheet === 'switch') sheet = null;
	}

	const appOf = (id: string) => (findApp(id) ?? apps.find((a) => a.id === id)) as PhoneApp | undefined;

	// Páginas: el punto activo sale del scroll.
	let page = $state(0);
	let pager: HTMLDivElement;
	const onscroll = () => (page = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)));
	const toPage = (i: number) => pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });

	// Gestos (Pointer Events, como en el núcleo). Mantener la barra de abajo 0,5 s abre la multitarea.
	let start: { x: number; y: number } | null = null;
	let hold: ReturnType<typeof setTimeout> | undefined;
	function down(e: PointerEvent) {
		start = { x: e.clientX, y: e.clientY };
	}
	function up(e: PointerEvent) {
		clearTimeout(hold);
		if (!start) return;
		const g = gesture(start, { x: e.clientX, y: e.clientY }, { w: innerWidth, h: innerHeight }, current !== null);
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
		if (sheet) sheet = null;
		else if (current) current = null;
		else return;
		e.preventDefault();
	}

	/** Lo que se carga en el iframe de cada app abierta. */
	const src = (id: string) => base + embedSrc(paths[id] ?? appOf(id)?.href ?? '/');
</script>

<svelte:window {onkeydown} />

<div class="phone" class:in-app={current !== null} role="application" aria-label="Modo OS" onpointerdown={down} onpointerup={up}>
	<div class="top">
		<PhoneStatus {time} onnotif={() => (sheet = 'notif')} oncontrol={() => (sheet = 'control')} />
	</div>

	<!-- Pantalla de inicio -->
	<div class="home" inert={current !== null || sheet === 'switch'} aria-hidden={current !== null}>
		<div class="pager" bind:this={pager} {onscroll}>
			{#each pages as cells, i (i)}
				<section class="page" aria-label="Página {i + 1} de {pages.length}">
					{#each cells as c (c.kind === 'app' ? c.app.id : c.id)}
						{#if c.kind === 'app'}
							<div class="cell"><PhoneIcon app={c.app} badge={badge[c.app.id] ?? 0} onopen={(a) => launch(a)} /></div>
						{:else}
							<div class="cell w-{c.size}"><PhoneWidget id={c.id} {now} onopen={launchCode} /></div>
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

		<nav class="dock" aria-label="Dock">
			{#each dock as a (a.id)}<PhoneIcon app={a} bare badge={badge[a.id] ?? 0} onopen={(x) => launch(x)} />{/each}
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
								<span>{a.icon} {a.name}</span>
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

{#if sheet === 'spot'}
	<Spotlight {apps} {now} onapp={(a) => launch(a)} onpath={launchPath} onclose={() => (sheet = null)} />
{:else if sheet === 'notif' || sheet === 'control'}
	<CenterSheet kind={sheet} {changes} {notice} {now} onclose={() => (sheet = null)} onpath={launchPath} />
{/if}

<style>
	.phone {
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
	.top {
		position: relative;
		z-index: 3;
		touch-action: none;
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
		border-radius: 15px;
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
		border-radius: calc(var(--os-radius-l) + var(--sp-8));
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
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 22px);
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
		height: calc(env(safe-area-inset-bottom, 0px) + 22px);
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
	@media (prefers-reduced-motion: reduce) {
		.home,
		.slot {
			transition: none;
			animation: none;
		}
	}
</style>
