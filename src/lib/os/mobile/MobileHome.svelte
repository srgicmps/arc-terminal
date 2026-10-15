<!--
	Modo OS en el móvil (≤ 900 px): pantalla de inicio tipo teléfono. Páginas que se deslizan (la primera, widgets;
	las demás, rejilla de apps), dock fijo abajo, cajón con todas las apps (deslizar hacia arriba o «Todas») y
	notificaciones desde arriba (deslizar hacia abajo o la campana). Las apps se abren a pantalla completa (su vista
	de siempre, con «◂ Inicio» para volver: OsReturn.svelte); la Terminal, aquí mismo. Lógica en home.ts.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { answerFor, answerNeeds } from '#lib/bar/answers.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { findCommand } from '#lib/cmdline.ts';
	import { routeHref } from '#lib/routes.ts';
	import type { ChangesData } from '#lib/types.ts';
	import Terminal from '../terminal/Terminal.svelte';
	import { leaveOS } from '../mode.svelte.ts';
	import { allApps, dockApps, findApps, glyph, pages, type MobileApp } from './home.ts';

	let { apps = allApps() }: { apps?: MobileApp[] } = $props();

	const grid = $derived(pages(apps));
	const dock = $derived(dockApps(apps));

	let page = $state(0);
	let pager: HTMLDivElement;
	let drawer = $state(false);
	let notices = $state(false);
	let terminal = $state(false);
	let query = $state('');
	const found = $derived(findApps(apps, query));

	// Widgets: las respuestas rápidas de la barra (euríbor, prima, bitcóin, hora en Nueva York).
	const QUICK = ['euribor', 'prima', 'btc', 'hora nueva york'];
	const now = $derived(clock.now || Date.now());
	$effect(() => {
		loadBarData([...QUICK.flatMap((q) => answerNeeds(q)), 'changes']);
	});
	const quick = $derived(QUICK.map((q) => answerFor(q, { get: (n) => barData[n], now })).filter((a) => !!a));
	const changes = $derived(((barData.changes as ChangesData | null | undefined)?.items ?? []).slice(0, 6));

	const time = $derived(new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
	const date = $derived(new Date(now).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

	function open(a: MobileApp) {
		drawer = false;
		if (a.id === 'terminal' || !a.href) {
			terminal = true;
			return;
		}
		goto(resolve(a.href as '/'));
	}
	function openCode(code: string) {
		const c = findCommand(code);
		if (c) goto(routeHref(c.route));
	}
	function openHref(href: string) {
		terminal = false;
		goto(href);
	}

	function onscroll() {
		page = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
	}
	function toPage(i: number) {
		pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
	}

	// Gestos: deslizar hacia abajo desde arriba abre las notificaciones; hacia arriba desde el dock, el cajón.
	let startY = 0;
	let startZone: 'top' | 'bottom' | null = null;
	function ontouchstart(e: TouchEvent) {
		const y = e.touches[0].clientY;
		startY = y;
		startZone = y < 64 ? 'top' : y > innerHeight - 120 ? 'bottom' : null;
	}
	function ontouchend(e: TouchEvent) {
		const dy = e.changedTouches[0].clientY - startY;
		if (startZone === 'top' && dy > 60) notices = true;
		else if (startZone === 'bottom' && dy < -60) drawer = true;
		startZone = null;
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (terminal || drawer || notices) {
			e.preventDefault();
			terminal = drawer = notices = false;
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="phone" role="application" aria-label="Modo OS: inicio" {ontouchstart} {ontouchend}>
	<header class="status">
		<span class="t">{time}</span>
		<button class="bell" onclick={() => (notices = true)} aria-expanded={notices}>
			<span class="bl">Avisos</span>
			{#if changes.length}<i class="dot" aria-hidden="true"></i>{/if}
		</button>
	</header>

	<div class="pager" bind:this={pager} {onscroll} aria-label="Pantalla de inicio">
		<section class="page widgets" aria-label="Widgets">
			<div class="w clockw">
				<div class="big">{time}</div>
				<div class="sub">{date}</div>
			</div>
			<div class="w">
				<h2>Datos rápidos</h2>
				{#each quick as a (a.code)}
					<button class="q" onclick={() => a.open && openCode(a.open)} disabled={!a.open}><b>{a.code}</b><span>{a.desc}</span></button>
				{:else}
					<div class="q mut">Cargando…</div>
				{/each}
			</div>
			<button class="w hint" onclick={() => toPage(1)}>Desliza para ver tus apps →</button>
		</section>
		{#each grid as list, i (i)}
			<section class="page" aria-label="Apps, página {i + 1} de {grid.length}">
				<ul class="apps">
					{#each list as a (a.id)}
						<li>
							<button class="app" onclick={() => open(a)}>
								<span class="ic" class:mono={!a.icon} class:long={glyph(a).length > 4} aria-hidden="true">{glyph(a)}</span>
								<span class="name">{a.title}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<div class="dots" role="tablist" aria-label="Páginas">
		{#each [0, ...grid.map((_, i) => i + 1)] as i (i)}
			<button role="tab" aria-selected={page === i} aria-label={i === 0 ? 'Widgets' : `Apps ${i}`} class:on={page === i} onclick={() => toPage(i)}></button>
		{/each}
	</div>

	<nav class="dock" aria-label="Dock">
		{#each dock as a (a.id)}
			<button class="app" onclick={() => open(a)}>
				<span class="ic" class:mono={!a.icon} class:long={glyph(a).length > 4} aria-hidden="true">{glyph(a)}</span>
				<span class="name">{a.title}</span>
			</button>
		{/each}
		<button class="app" onclick={() => (drawer = true)} aria-expanded={drawer}>
			<span class="ic" aria-hidden="true">⋯</span>
			<span class="name">Todas</span>
		</button>
	</nav>

	{#if drawer}
		<div class="sheet up" role="dialog" aria-modal="true" aria-label="Todas las apps">
			<div class="sheet-head">
				<input type="search" placeholder="Buscar app" bind:value={query} aria-label="Buscar app" />
				<button onclick={() => (drawer = false)}>Cerrar</button>
			</div>
			<ul class="list">
				{#each found as a (a.id)}
					<li>
						<button onclick={() => open(a)}>
							<span class="ic sm" class:mono={!a.icon} aria-hidden="true">{glyph(a)}</span>{a.title}
						</button>
					</li>
				{/each}
			</ul>
			<button class="leave" onclick={leaveOS}>Volver al Terminal clásico</button>
		</div>
	{/if}

	{#if notices}
		<div class="sheet down" role="dialog" aria-modal="true" aria-label="Notificaciones">
			<div class="sheet-head">
				<h2>Novedades</h2>
				<button onclick={() => (notices = false)}>Cerrar</button>
			</div>
			<ul class="list">
				{#each changes as c (c.number)}
					<li><a href={resolve('/novedades')} onclick={() => (notices = false)}>{c.title}</a></li>
				{:else}
					<li class="mut">Nada nuevo.</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if terminal}
		<div class="full" role="dialog" aria-modal="true" aria-label="Terminal">
			<div class="full-head">
				<button onclick={() => (terminal = false)}>◂ Inicio</button>
				<span>Terminal</span>
			</div>
			<div class="full-body"><Terminal onopen={openHref} /></div>
		</div>
	{/if}
</div>

<style>
	.phone {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		background: var(--bg);
		background-image: var(--bg-image);
		color: var(--fg);
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		overscroll-behavior: none;
	}
	.status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-4) var(--pad-x);
		font-family: var(--mono);
		font-size: var(--fs-s);
		color: var(--muted);
	}
	button {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}
	.bell {
		position: relative;
		min-width: var(--touch);
		min-height: var(--touch);
	}
	.dot {
		position: absolute;
		top: var(--sp-10);
		right: var(--sp-10);
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		background: var(--amber);
	}
	.pager {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.pager::-webkit-scrollbar {
		display: none;
	}
	.page {
		flex: 0 0 100%;
		scroll-snap-align: start;
		overflow-y: auto;
		padding: var(--sp-8) var(--pad-x);
	}
	.widgets {
		display: flex;
		flex-direction: column;
		gap: var(--sp-12);
	}
	.w {
		background: var(--panel);
		backdrop-filter: var(--panel-blur);
		border: var(--border);
		border-radius: var(--radius);
		padding: var(--sp-12);
		text-align: left;
	}
	.w h2,
	.sheet-head h2 {
		margin: 0 0 var(--sp-6);
		font-family: var(--title-font);
		font-size: var(--fs-s);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
		color: var(--title-color);
	}
	.big {
		font-family: var(--mono);
		font-size: var(--fs-xxl);
		color: var(--amber);
		line-height: var(--lh-tight);
	}
	.sub {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.q {
		display: flex;
		width: 100%;
		text-align: left;
		flex-direction: column;
		padding: var(--sp-4) 0;
		border-top: var(--border);
		font-size: var(--fs-s);
	}
	.q:first-of-type {
		border-top: 0;
	}
	.q b {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}
	.q span,
	.mut {
		color: var(--muted);
	}
	.hint {
		color: var(--muted);
		font-size: var(--fs-s);
		min-height: var(--touch);
	}
	.apps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-16) var(--sp-8);
	}
	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
		width: 100%;
		min-height: var(--touch);
	}
	.ic {
		overflow: hidden;
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: var(--radius);
		background: var(--panel);
		border: var(--border);
		font-size: var(--fs-xl);
		color: var(--amber);
	}
	.ic.mono {
		font-family: var(--mono);
		font-size: var(--fs-s);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-code);
	}
	.ic.mono.long {
		font-size: var(--fs-xxs);
		letter-spacing: 0;
	}
	.ic.sm {
		width: 32px;
		height: 32px;
		font-size: var(--fs-m);
	}
	.ic.sm.mono {
		font-size: var(--fs-xxs);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		color: var(--fg);
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: var(--sp-6);
		padding: var(--sp-6) 0;
	}
	.dots button {
		flex: none;
		min-height: 0;
		width: var(--sp-6);
		height: var(--sp-6);
		border-radius: 50%;
		background: var(--faint);
		padding: 0;
	}
	.dots button.on {
		background: var(--amber);
	}
	.dock {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		margin: 0 var(--pad-x) var(--sp-8);
		padding: var(--sp-8) var(--sp-4);
		background: var(--panel);
		backdrop-filter: var(--panel-blur);
		border: var(--border);
		border-radius: var(--radius);
	}
	.sheet,
	.full {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		background: var(--bg);
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		animation: in var(--dur-ui) var(--ease);
	}
	.sheet.down {
		animation-name: from-top;
	}
	.sheet-head,
	.full-head {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
	}
	.sheet-head h2 {
		flex: 1;
		margin: 0;
	}
	.sheet-head input {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-8);
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-field);
	}
	.sheet-head button,
	.full-head button,
	.leave {
		min-height: var(--control-h);
		padding: 0 var(--sp-8);
		color: var(--amber);
	}
	.full-head span {
		font-family: var(--mono);
		color: var(--muted);
	}
	.list {
		flex: 1;
		overflow-y: auto;
		list-style: none;
		margin: 0;
		padding: 0 var(--pad-x);
	}
	.list li {
		border-bottom: var(--border);
	}
	.list button,
	.list a {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		width: 100%;
		min-height: var(--touch);
		padding: var(--sp-6) 0;
		text-align: left;
		color: var(--fg);
		text-decoration: none;
	}
	.list li.mut {
		padding: var(--sp-12) 0;
	}
	.leave {
		border-top: var(--border);
		min-height: var(--touch);
	}
	.full-body {
		flex: 1;
		min-height: 0;
	}
	@keyframes in {
		from {
			transform: translateY(var(--sp-24));
			opacity: 0;
		}
	}
	@keyframes from-top {
		from {
			transform: translateY(calc(-1 * var(--sp-24)));
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.full {
			animation: none;
		}
	}
</style>
