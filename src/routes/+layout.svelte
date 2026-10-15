<script lang="ts">
	import { onRowKey } from '#lib/rownav.ts';
	import { isShortcut } from '#lib/shortcuts.ts';
	import { routeHref } from '#lib/routes.ts';
	import '../app.css';
	import '../styles/ajustes.css';
	import { afterNavigate, goto } from '$app/navigation';
	import { MediaQuery } from 'svelte/reactivity';
	import { neighbour, nudge, SWIPE, swipeDirection } from '#lib/swipe.ts';
	import { asset, resolve } from '$app/paths';
	import { page, updated } from '$app/state';
	import { startClock } from '#lib/clock.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import Clocks from '#lib/components/Clocks.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Menu from '#lib/components/ui/Menu.svelte';
	import CommandBar from '#lib/components/CommandBar.svelte';
	import ExpLauncher from '#lib/components/ExpLauncher.svelte';
	import Feedback from '#lib/components/Feedback.svelte';
	import PlacePicker from '#lib/components/PlacePicker.svelte';
	import InstallHint from '#lib/components/InstallHint.svelte';
	import { enterOS } from '#lib/os/mode.svelte.ts';
	import OsNotice from '#lib/os/invite/OsNotice.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import { ui } from '#lib/ui.svelte.ts';
	import { fit, initFit, toggleFit } from '#lib/fit.svelte.ts';
	import { initTape, tape as tapeState, toggleTape } from '#lib/tape.svelte.ts';
	import { initMode, mode, toggleMode } from '#lib/layout.svelte.ts';
	import { loadPins } from '#lib/pins.svelte.ts';
	import { initTheme } from '#lib/theme.svelte.ts';
	import Appearance from '#lib/components/Appearance.svelte';
	import { followPlaceUrl, initPlace } from '#lib/place.svelte.ts';
	import { initWatchlist, watchlist } from '#lib/watchlist.svelte.ts';
	import { initFolded } from '#lib/folded.svelte.ts';
	import { initCloud } from '#lib/cloud.svelte.ts';
	import { initEmbed, isEmbedded, reportPath, unembed } from '#lib/os/embed.ts';
	import { listenServiceWorker } from '#lib/pwa.ts';
	import PanelIndex from '#lib/components/PanelIndex.svelte';
	import { setPanelIndex } from '#lib/panelindex.svelte.ts';
	import { tvSymbol } from '#lib/tickers.ts';
	import { initTaste, taste, VISIBLE_KEYS } from '#lib/taste.svelte.ts';
	import { startTv, stopTv, tickTv, togglePause, tv } from '#lib/tv.svelte.ts';
	import { crossedNow, initThresholds } from '#lib/thresholds.svelte.ts';
	import { parseTv, routeOf } from '#lib/tv.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// El reloj arranca en el navegador (como onMounted en Vue) y se para al salir.
	$effect(startClock);
	$effect(initWatchlist);
	$effect(initThresholds);
	// Umbrales cruzados (lote 25): un contador discreto en la barra, con sus nombres al pasar por encima.
	const crossedRules = $derived(crossedNow());
	$effect(initFolded);
	setPanelIndex();
	$effect(initTaste);
	$effect(initPlace);
	// «Tu sitio» por la URL al navegar: ?lugar=… o ?buscar=Tokio.
	$effect(() => followPlaceUrl(page.url.searchParams));
	$effect(initTheme);
	$effect(initFit);
	$effect(initTape);
	$effect(initMode);
	$effect(loadPins);
	// Tus ajustes en tu cuenta (arcterminal.dev): los sube y trae los de tus otros dispositivos.
	// Dentro de una ventana de Arc OS, la cuenta la lleva el escritorio (no cada ventana).
	$effect(() => (isEmbedded() ? undefined : initCloud()));
	$effect(initEmbed);
	afterNavigate(({ to }) => to && reportPath(unembed(to.url.pathname + to.url.search + to.url.hash)));
	// Sesión de Cloudflare Access caducada: el service worker avisa y se recarga para ir al login.
	$effect(listenServiceWorker);

	// Modo TV: cualquier URL con ?tv=TOP,WS…&s=30 lo arranca y salta a la primera vista.
	$effect(() => {
		const views = page.url.searchParams.get('tv');
		if (views === null) return;
		const { codes, seconds } = parseTv(views, page.url.searchParams.get('s'));
		startTv(codes, seconds);
		goto(routeHref(routeOf(codes[0])), { replaceState: true });
	});

	// El reloj del modo TV: cada cuarto de segundo avanza la barra de progreso y, al llegar, cambia de vista.
	$effect(() => {
		if (!tv.on) return;
		const id = setInterval(() => {
			const next = tickTv(0.25);
			if (next) goto(routeHref(routeOf(next)));
		}, 250);
		return () => clearInterval(id);
	});

	/** j/k, ↓/↑ y «o» con el foco en una fila (rownav.ts): antes que la barra de comandos, que se quedaría la letra. */
	function onListKey(e: KeyboardEvent) {
		if (tv.on || !onRowKey(e)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	/** En modo TV, Esc sale (antes de que la barra de comandos lo lleve a la portada) y Espacio pausa. */
	function onTvKey(e: KeyboardEvent) {
		if (!tv.on) return;
		const target = e.target as HTMLElement | null;
		const typing = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
		if (isShortcut(e, 'tv-exit')) stopTv();
		// El espacio pausa, salvo si se está escribiendo (por ejemplo, en la barra de comandos).
		else if (isShortcut(e, 'tv-pause') && !typing) togglePause();
		else return;
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	// En el móvil los accesos van en una fila con scroll: el de la vista actual, siempre a la vista.
	$effect(() => {
		void page.route.id;
		if (!matchMedia('(max-width: 720px)').matches) return;
		document.querySelector('.keys [aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});

	// Deslizar entre vistas en el móvil (lote 22): a izquierda o derecha, a la vista de al lado de la fila de
	// arriba. No cuenta si el dedo empieza en algo que ya se desliza en horizontal (tablas anchas, mapas,
	// gráficos, widgets, campos) ni junto al borde, que en iOS es «atrás».
	let swipe: { x: number; y: number; t: number } | null = null;
	let shift = $state(0);
	const NO_SWIPE = 'input, textarea, select, iframe, canvas, svg, .map, .chart, .tv, .board, [data-noswipe]';

	function scrollsX(el: Element | null): boolean {
		for (let e = el; e && e !== document.body; e = e.parentElement) {
			if (e.matches(NO_SWIPE)) return true;
			const o = getComputedStyle(e).overflowX;
			if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth) return true;
		}
		return false;
	}

	function onSwipeStart(e: TouchEvent) {
		swipe = null;
		const t = e.touches[0];
		if (e.touches.length !== 1 || tv.on || !matchMedia('(max-width: 720px) and (pointer: coarse)').matches) return;
		if (t.clientX < SWIPE.edge || t.clientX > innerWidth - SWIPE.edge || scrollsX(e.target as Element)) return;
		swipe = { x: t.clientX, y: t.clientY, t: Date.now() };
	}

	function onSwipeMove(e: TouchEvent) {
		if (!swipe) return;
		const dx = e.touches[0].clientX - swipe.x;
		const dy = e.touches[0].clientY - swipe.y;
		// En cuanto el gesto es más vertical que horizontal, es scroll: se olvida.
		if (Math.abs(dy) > Math.abs(dx)) {
			swipe = null;
			shift = 0;
		} else shift = nudge(dx);
	}

	function onSwipeEnd(e: TouchEvent) {
		const s = swipe;
		swipe = null;
		shift = 0;
		if (!s) return;
		const t = e.changedTouches[0];
		const dir = swipeDirection(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t);
		if (!dir) return;
		const next = neighbour(keys, keys.findIndex((k) => k.route === page.route.id), dir);
		if (next) goto(routeHref(next.route));
	}

	/** En modo TV, tocar la pantalla pausa o sigue (menos en los botones del aviso de pausa). */
	function onTvTap(e: PointerEvent) {
		if (tv.on && !(e.target as Element | null)?.closest('.tv-chip')) togglePause();
	}

	const wide = new MediaQuery('min-width: 1280px');

	// Fila de arriba y barra inferior del móvil (a mano del pulgar): las de la web o las de «A tu gusto».
	const keys = $derived(COMMANDS.filter((c) => taste.top.includes(c.code)));
	// A la vista, solo las primeras de la fila (como mucho VISIBLE_KEYS); el resto va en «Más».
	const visibleKeys = $derived(keys.slice(0, VISIBLE_KEYS));
	const hiddenKeys = $derived(keys.slice(VISIBLE_KEYS));
	const hiddenCurrent = $derived(hiddenKeys.find((k) => k.route === page.route.id));
	const thumb = $derived(COMMANDS.filter((c) => taste.thumb.includes(c.code)));

	// navigator.onLine, enlazado como en Vue con un ref que se actualiza solo.
	let online = $state(true);

	// Cinta de cotizaciones en directo de TradingView.
	const tape = {
		symbols: [
			{ proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
			{ proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
			{ proName: 'BME:IBC', title: 'IBEX 35' },
			{ proName: 'XETR:DAX', title: 'DAX' },
			{ proName: 'FX:EURUSD', title: 'EUR/USD' },
			{ proName: 'TVC:UKOIL', title: 'Brent' },
			{ proName: 'TVC:GOLD', title: 'Oro' },
			// TVC:US10Y sale vacío en los widgets; FRED:DGS10 es la rentabilidad oficial al cierre del día anterior.
			{ proName: 'FRED:DGS10', title: 'Bono EE. UU. 10A' },
			{ proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' }
		],
		showSymbolLogo: false,
		displayMode: 'compact'
	};
	// Si en MIS has elegido llevar tu lista a la cinta (y tiene algo), la cinta enseña tus valores.
	const tapeConfig = $derived(
		watchlist.tape && watchlist.codes.length
			? { ...tape, symbols: watchlist.codes.map((code) => ({ proName: tvSymbol(code), title: code })) }
			: tape
	);
</script>

<svelte:window bind:online onkeydowncapture={(e) => (onTvKey(e), onListKey(e))} onpointerdown={onTvTap} />

<svelte:head>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
</svelte:head>

<div class="app" data-ui="app">
	<header class="top" data-ui="top">
		<a class="brand" data-ui="brand" href={resolve('/')}>
			<Logo />
			<span>Arc <span class="brand-sub">Terminal</span></span>
		</a>
		<CommandBar />
		{#if !online}<span class="offline" title="Se muestra la última copia guardada">Sin conexión</span>{/if}
		<Clocks />
		<PlacePicker />
		{#if crossedRules.length}
			<span class="limits" role="status" title={crossedRules.map(([, r]) => `${r.name} ${r.op === '>' ? 'por encima de' : 'por debajo de'} ${r.v.toLocaleString('es-ES', { maximumFractionDigits: 3 })}`).join(' · ')}>
				<span aria-hidden="true">⚑</span>
				{crossedRules.length}<span class="sr"> {crossedRules.length === 1 ? 'umbral cruzado' : 'umbrales cruzados'}</span>
			</span>
		{/if}
		<!-- Estética, tema, acento y densidad: un solo botón (src/lib/components/Appearance.svelte). -->
		<Appearance />
		<!-- Lo que se usa poco va en «⋯»: así la cabecera queda en logo, barra, sitio, hora y avisos. -->
		<Menu label="Más opciones" cls="theme" ui="more" title="Más opciones: encajar y portada modular">
			{#snippet button()}<span aria-hidden="true">⋯</span>{/snippet}
			{#snippet children(close)}
				<!-- Terminal clásico → Modo OS (la vuelta, en el menú Inicio, el Panel de control y el móvil). -->
				<button type="button" onclick={() => (close(), enterOS())}>Cambiar al Modo OS <small>⧉</small></button>
				<hr />
				{#if page.route.id === '/'}
					<!-- General / Modular: de momento solo la portada se puede personalizar. -->
					<button type="button" aria-pressed={mode.modular} onclick={() => (toggleMode(), close())}>
						Portada modular <small>{mode.modular ? 'sí' : 'no'} · ▦</small>
					</button>
				{/if}
				<!-- «Encajar» solo tiene sentido en escritorio. -->
				{#if wide.current}
					<button type="button" aria-pressed={fit.on} onclick={() => (toggleFit(), close())}>
						Encajar en la pantalla <small>{fit.on ? 'sí' : 'no'} · ⤢</small>
					</button>
				{/if}
				<button type="button" aria-pressed={tapeState.on} onclick={() => (toggleTape(), close())}>
					Cinta de cotizaciones <small>{tapeState.on ? 'sí' : 'no'}</small>
				</button>
				<hr />
				<a href={resolve('/help')} onclick={close}>A tu gusto y ayuda <small>HELP</small></a>
			{/snippet}
		</Menu>
	</header>

	<nav class="keys" data-ui="keys" aria-label="Secciones">
		{#each visibleKeys as key (key.code)}
			<a
				class="key"
				data-ui="key"
				data-code={key.code}
				href={routeHref(key.route)}
				aria-current={page.route.id === key.route ? 'page' : undefined}
			>
				{key.code}<span>{key.key}</span>
			</a>
		{/each}
		<!-- El resto de tu fila y la ayuda, en «Más»; si estás en una de esas vistas, el botón lo dice. -->
		<Menu label="Más secciones" cls="key more" ui="key" current={!!hiddenCurrent || page.route.id === '/help'} title="Más secciones">
			{#snippet button()}{hiddenCurrent?.code ?? 'Más'}<span aria-hidden="true">▾</span>{/snippet}
			{#snippet children(close)}
				{#each hiddenKeys as key (key.code)}
					<a href={routeHref(key.route)} onclick={close} aria-current={page.route.id === key.route ? 'page' : undefined}>
						{key.code} <small>{key.key}</small>
					</a>
				{/each}
				{#if hiddenKeys.length}<hr />{/if}
				<a href={resolve('/help')} onclick={close} aria-current={page.route.id === '/help' ? 'page' : undefined}>Todos los comandos <small>HELP</small></a>
			{/snippet}
		</Menu>
		<ExpLauncher hotkey />
	</nav>

	{#if tapeState.on}
		<div class="tape" data-ui="tape">
			<TvWidget widget="ticker-tape" config={tapeConfig} height={44} credit={false} />
		</div>
	{/if}

	<!-- Aviso discreto cuando la Action ha publicado una versión nueva (datos o mejoras). -->
	{#if updated.current}
		<button class="fresh" type="button" onclick={() => location.reload()}>
			Hay datos nuevos · <b>Recargar</b>
		</button>
	{/if}

	{#if !tv.on}<PanelIndex /><InstallHint /><OsNotice />{/if}

	<main
		data-ui="main"
		class:nudged={shift !== 0}
		style:translate={shift ? `${shift}px 0` : undefined}
		ontouchstart={onSwipeStart}
		ontouchmove={onSwipeMove}
		ontouchend={onSwipeEnd}
		ontouchcancel={() => ((swipe = null), (shift = 0))}
	>
		{@render children()}
	</main>

	<nav class="thumb" data-ui="tabs" aria-label="Accesos rápidos">
		{#each thumb as c (c.code)}
			<a href={routeHref(c.route)} data-code={c.code} aria-current={page.route.id === c.route ? 'page' : undefined}>{c.code}</a>
		{/each}
		<ExpLauncher variant="thumb" />
		<button type="button" aria-label="Buscar o escribir un comando" aria-pressed={ui.sheet} onclick={() => (ui.sheet = !ui.sheet)}>
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
		</button>
	</nav>

	{#if tv.on}
		<!-- Progreso hasta la vista siguiente: una línea de 1 px abajo del todo. -->
		<div class="tv-progress" class:paused={tv.paused} style:width="{Math.min(100, (tv.elapsed / tv.seconds) * 100)}%" aria-hidden="true"></div>
		{#if tv.paused}
			<div class="tv-chip" role="status">
				<span>TV en pausa · {tv.codes[tv.index]}</span>
				<button type="button" onclick={togglePause}>Seguir</button>
				<button type="button" onclick={stopTv}>Salir</button>
			</div>
		{/if}
	{/if}

	<footer class="status" data-ui="foot">
		<span>Datos públicos actualizados cada 15 min con GitHub Actions · cotizaciones de TradingView</span>
		<a href={resolve('/status')}>Estado de las fuentes</a>
		<Feedback />
		<span><kbd>/</kbd> comando · <kbd>Esc</kbd> portada · <kbd>⇧F</kbd> pantalla completa</span>
	</footer>
</div>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-10) var(--sp-18);
		padding-block: var(--sp-4) var(--sp-10);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		color: inherit;
		text-decoration: none;
		font-size: var(--fs-s);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-brand);
		text-transform: uppercase;
	}

	.top :global(.theme) {
		display: grid;
		place-items: center;
		width: var(--btn-sm);
		height: var(--btn-sm);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-m);
		cursor: pointer;
	}

	.top :global(.theme:hover),
	.top :global(.theme[aria-expanded='true']) {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	/* En pantallas táctiles se ve igual (28 px), pero la zona pulsable llega a 44 × 44 px. */
	@media (pointer: coarse) {
		.top :global(.theme) {
			position: relative;
			min-height: var(--btn-sm);
		}

		.top :global(.theme::after) {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--sp-8));
		}
	}

	.brand-sub {
		color: var(--muted);
		font-weight: var(--fw-regular);
	}

	.offline {
		font-size: var(--fs-xs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--amber);
		border: var(--hair) solid var(--amber-edge);
		border-radius: var(--radius-s);
		padding: var(--sp-2) var(--sp-7);
	}

	/* Umbrales cruzados: cifra pequeña en ámbar, sin caja, para que no grite. */
	.limits {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		cursor: default;
	}

	/* Teclas de función */
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding-block: var(--sp-2) var(--sp-10);
	}

	.keys :global(.key) {
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-code);
		color: var(--amber);
		text-decoration: none;
		border: var(--border);
		border-radius: var(--radius-s);
		padding: var(--sp-4) var(--sp-10);
	}

	.keys :global(.key span) {
		margin-left: var(--sp-7);
		color: var(--muted);
		font-family: var(--sans);
		font-weight: var(--fw-regular);
		letter-spacing: 0;
	}

	/* «Más ▾» es un botón: se pinta como las pestañas. */
	.keys :global(button.key) {
		background: none;
		font-family: inherit;
		line-height: inherit;
		cursor: pointer;
	}

	.keys :global(.key:hover) {
		border-color: var(--amber-edge);
	}

	.keys :global(.key[aria-current='page']) {
		background: var(--amber);
		border-color: var(--amber);
		color: var(--on-amber);
	}

	.keys :global(.key[aria-current='page'] span) {
		color: var(--on-amber);
	}

	/* Cinta de cotizaciones */
	.tape {
		overflow: hidden;
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--panel);
		margin-bottom: var(--sp-12);
	}

	main {
		padding-bottom: var(--sp-16);
		/* Al soltar el dedo, la pista de «deslizar» vuelve a su sitio sin salto; mientras se desliza, va con él. */
		transition: translate var(--dur-fast) ease-out;
	}

	main.nudged {
		transition: none;
	}

	.fresh {
		position: fixed;
		right: var(--sp-16);
		bottom: var(--sp-16);
		z-index: 30;
		background: var(--raise);
		border: var(--hair) solid var(--amber-edge);
		border-radius: var(--radius-s);
		color: var(--muted);
		padding: var(--sp-7) var(--pad-x);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.fresh b {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-6) var(--sp-20);
		padding-block: var(--sp-10) var(--sp-18);
		border-top: var(--border);
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.status a {
		color: var(--muted);
	}

	/* Modo TV (html[data-tv]): sin teclas, sin barra inferior ni pie; solo la vista. */
	:global(html[data-tv]) .keys,
	:global(html[data-tv]) .thumb,
	:global(html[data-tv]) .status {
		display: none;
	}

	/* Arc OS (html[data-embed]): la vista dentro de una ventana, sin la cabecera, las teclas, la cinta ni el pie. */
	:global(html[data-embed]) .top,
	:global(html[data-embed]) .keys,
	:global(html[data-embed]) .tape,
	:global(html[data-embed]) .thumb,
	:global(html[data-embed]) .status,
	:global(html[data-embed] aside.install) {
		display: none;
	}

	:global(html[data-embed]) .app {
		padding-bottom: 0;
	}

	:global(html[data-tv]) .app {
		padding-bottom: 0;
	}

	.tv-progress {
		position: fixed;
		left: 0;
		bottom: 0;
		z-index: 40;
		height: var(--hair);
		background: var(--amber);
		transition: width 0.25s linear;
	}

	.tv-progress.paused {
		background: var(--muted);
	}

	.tv-chip {
		position: fixed;
		right: var(--gutter);
		bottom: var(--sp-16);
		z-index: 40;
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		padding: var(--sp-6) var(--sp-10);
		background: var(--panel);
		border: var(--hair) solid var(--amber-edge);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.tv-chip button {
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		padding: var(--sp-4) var(--sp-10);
		color: var(--fg);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.tv-chip button:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	@media (pointer: coarse) {
		.tv-chip button {
			min-height: var(--touch);
		}
	}

	/* Barra inferior para el pulgar: solo en pantallas estrechas. */
	.thumb {
		display: none;
	}

	@media (max-width: 720px) {
		.thumb {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 35;
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
			background: var(--panel);
			border-top: var(--border);
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}

		.thumb a,
		.thumb button {
			display: grid;
			place-items: center;
			height: var(--tabbar-h);
			background: none;
			border: 0;
			color: var(--muted);
			text-decoration: none;
			font-family: var(--mono);
			font-size: var(--fs-s);
			letter-spacing: var(--track-code);
			cursor: pointer;
		}

		.thumb [aria-current='page'],
		.thumb [aria-pressed='true'] {
			color: var(--amber);
			text-decoration: underline var(--hair);
			text-underline-offset: var(--sp-5);
		}

		.thumb button {
			color: var(--amber);
		}

		.thumb svg {
			width: var(--sp-18);
			height: var(--sp-18);
			fill: none;
			stroke: currentColor;
			stroke-width: 1.6;
			stroke-linecap: round;
		}

		/* La cabecera del móvil en una línea: logo a la izquierda; tu sitio y los botones, a la derecha. */
		.top {
			/* 6 px: logo, reloj, sitio, Apariencia y «⋯» caben en una línea a 390 px. */
			column-gap: var(--sp-6);
		}

		.top :global(.place .caret) {
			display: none;
		}

		/* Accesos de arriba: se ven igual, pero la zona pulsable llega a --touch de alto. */
		.keys :global(.key) {
			position: relative;
		}

		.keys :global(.key::after) {
			content: '';
			position: absolute;
			inset: calc((var(--touch) - 100%) / -2) 0;
		}

		/* Que el contenido no quede tapado por la barra. */
		.app {
			padding-bottom: calc(var(--tabbar-h) + var(--hair) + env(safe-area-inset-bottom, 0px));
		}

		.fresh {
			bottom: calc(var(--tabbar-h) + var(--sp-12) + env(safe-area-inset-bottom, 0px));
		}

		.keys :global(.key span:not([aria-hidden])) {
			display: none;
		}

		/* Accesos en una sola fila que se desliza en horizontal: la cabecera ocupa una línea menos. Un fundido
		   muy leve a la derecha avisa de que hay más; el de la vista actual se trae a la vista al cambiar. */
		.keys {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			mask-image: linear-gradient(to right, var(--bg) calc(100% - var(--sp-24)), transparent);
		}

		.keys::-webkit-scrollbar {
			display: none;
		}

		.keys :global(.key) {
			flex: none;
		}

		.top :global(.cmd) {
			order: 2;
			flex-basis: 100%;
		}

		/* Como antes del tema: logo, relojes y barra de comandos, cada uno en su línea. El chip de tu sitio y el
		   botón de Apariencia van en la línea del logo, a la derecha; sus márgenes negativos evitan que esa línea crezca. */
		.brand {
			order: -2;
		}

		.top :global(.theme),
		.top :global([data-ui='appearance']) {
			order: -1;
			margin-block: calc((var(--logo) - var(--btn-sm)) / 2);
		}

		/* El chip de «Tu sitio» va delante del tema, empujado a la derecha, con los mismos márgenes negativos. */
		.top :global(.place) {
			order: -1;
			margin-block: calc((var(--logo) - var(--btn-sm)) / 2);
		}

		/* El reloj (uno solo en el móvil), en la misma línea, empujado a la derecha, delante de tu sitio. */
		.top :global(.clocks) {
			order: -1;
			margin-left: auto;
			margin-block: calc((var(--logo) - var(--control-h)) / 2);
		}
	}

	/* «Encajar en pantalla» (html[data-fit], solo ≥1280 px): la página no hace scroll; la vista llena el
	   alto que queda y cada panel se desplaza por dentro. Si una vista tiene varias filas de paneles,
	   la zona de la vista hace scroll como último recurso. */
	@media (min-width: 1280px) {
		:global(html[data-fit]),
		:global(html[data-fit] body) {
			height: 100dvh;
			overflow: hidden;
		}

		:global(html[data-fit]) .app {
			display: flex;
			flex-direction: column;
			height: 100dvh;
		}

		:global(html[data-fit]) main {
			flex: 1;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: auto;
			padding-bottom: 0;
		}

		/* La última rejilla llena el alto que queda, pero nunca mide menos que la suma de los altos mínimos
		   de sus paneles: si no caben, hace scroll la vista, en vez de aplastar los paneles a 0 px. */
		:global(html[data-fit] main > .grid:last-child) {
			flex: 1 1 0;
		}

		:global(html[data-fit] main > .grid:last-child > .col) {
			display: flex;
			flex-direction: column;
		}

		/* Reparto del alto de una columna, igual en todas las vistas:
		   - cada panel parte de --fit-panel-min (cabecera y unas 9 filas) o de su contenido entero, si es
		     menor: ninguno se queda en 2-3 filas;
		   - el alto que sobra se reparte a partes iguales, sin que ningún panel pase de su contenido: lo
		     que no usa una tabla corta se lo quedan las listas largas, que hacen scroll por dentro. */
		:global(html[data-fit] main > .grid:last-child > .col > .panel:not(.max, .folded)) {
			flex: 1 0 auto;
			height: var(--fit-panel-min);
			max-height: fit-content;
			overflow: auto;
		}

		/* Gráficos, mapas y widgets tienen un alto fijo: recortados no se leen, así que van enteros. */
		:global(html[data-fit] main > .grid:last-child > .col > .panel:not(.max, .folded):has(.chart, .map, .tv, .curve, .bars)) {
			height: auto;
		}
	}

	/* Subcolumnas también al encajar: una columna con varios paneles que mide el doble de --col-split o más
	   (rejillas de 2 columnas desde ~1680 px, de 3 desde ~2500 px) los reparte en dos, de izquierda a
	   derecha, separados por 1 px. Cada fila parte de --fit-panel-min y se reparte el alto que sobra. Si
	   el número de paneles es impar, el último ocupa las dos subcolumnas. */
	@media (min-width: 1680px) {
		:global(html[data-fit] main > .grid:is(.grid-2, .grid-2e):last-child > .col:has(> .panel + .panel)) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--grid-gap);
			background: var(--grid-fill);
		}

		:global(html[data-fit] main > .grid:is(.grid-2, .grid-2e):last-child > .col:has(> .panel + .panel) > .panel:not(.max, .folded)) {
			height: auto;
			max-height: none;
			border-top: 0;
		}

		/* Cada panel cuenta como --fit-panel-min al medir las filas (contain: size) y luego se estira con
		   su fila. Sin esto, la fila mediría el contenido entero y no se repartiría el alto. Los gráficos,
		   mapas y widgets van enteros, como en una columna. */
		:global(html[data-fit] main > .grid:is(.grid-2, .grid-2e):last-child > .col:has(> .panel + .panel) > .panel:not(.max, .folded):not(:has(.chart, .map, .tv, .curve, .bars))) {
			contain: size;
			contain-intrinsic-block-size: var(--fit-panel-min);
		}

		:global(html[data-fit] main > .grid:is(.grid-2, .grid-2e):last-child > .col:has(> .panel + .panel) > .panel:last-child:nth-child(odd)) {
			grid-column: 1 / -1;
		}
	}

	/* Las mismas reglas para la rejilla de 3 columnas, que tiene las columnas más estrechas. */
	@media (min-width: 2500px) {
		:global(html[data-fit] main > .grid.grid-3:last-child > .col:has(> .panel + .panel)) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--grid-gap);
			background: var(--grid-fill);
		}

		:global(html[data-fit] main > .grid.grid-3:last-child > .col:has(> .panel + .panel) > .panel:not(.max, .folded)) {
			height: auto;
			max-height: none;
			border-top: 0;
		}

		/* Cada panel cuenta como --fit-panel-min al medir las filas (contain: size) y luego se estira con
		   su fila. Sin esto, la fila mediría el contenido entero y no se repartiría el alto. Los gráficos,
		   mapas y widgets van enteros, como en una columna. */
		:global(html[data-fit] main > .grid.grid-3:last-child > .col:has(> .panel + .panel) > .panel:not(.max, .folded):not(:has(.chart, .map, .tv, .curve, .bars))) {
			contain: size;
			contain-intrinsic-block-size: var(--fit-panel-min);
		}

		:global(html[data-fit] main > .grid.grid-3:last-child > .col:has(> .panel + .panel) > .panel:last-child:nth-child(odd)) {
			grid-column: 1 / -1;
		}
	}

	/* Informe impreso (TOP, IMP…): solo el contenido, sin cabecera, barras, cinta de cotizaciones ni pie. */
	@media print {
		.top,
		.keys,
		.tape,
		.thumb,
		.status,
		.tv-progress,
		.tv-chip {
			display: none;
		}
	}
</style>
