<script lang="ts">
	import '../app.css';
	import { asset, resolve } from '$app/paths';
	import { page, updated } from '$app/state';
	import { startClock } from '#lib/clock.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import Clocks from '#lib/components/Clocks.svelte';
	import CommandBar from '#lib/components/CommandBar.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import { ui } from '#lib/ui.svelte.ts';
	import { cycleTheme, initTheme, theme } from '#lib/theme.svelte.ts';
	import { initWatchlist } from '#lib/watchlist.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// El reloj arranca en el navegador (como onMounted en Vue) y se para al salir.
	$effect(startClock);
	$effect(initWatchlist);
	$effect(initTheme);

	const THEME_LABEL = { auto: 'Tema automático (sigue al sistema)', light: 'Tema de día', dark: 'Tema de noche' };
	const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

	const keys = COMMANDS.filter((c) => c.pinned);
	// Barra inferior del móvil: los accesos más usados, a mano del pulgar.
	const thumb = ['TOP', 'ECO', 'WS', 'FUEL'].map((code) => COMMANDS.find((c) => c.code === code)!);

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
			{ proName: 'TVC:US10Y', title: 'Bono EE. UU. 10A' },
			{ proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' }
		],
		showSymbolLogo: false,
		displayMode: 'compact'
	};
</script>

<svelte:window bind:online />

<svelte:head>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
</svelte:head>

<div class="app">
	<header class="top">
		<a class="brand" href={resolve('/')}>
			<svg class="mark" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
				<path d="M4 16a7 7 0 0 1 14 0" />
				<path d="M8 16a3 3 0 0 1 6 0" />
			</svg>
			<span>Arc <span class="brand-sub">Terminal</span></span>
		</a>
		<CommandBar />
		{#if !online}<span class="offline" title="Se muestra la última copia guardada">Sin conexión</span>{/if}
		<Clocks />
		<button
			class="theme"
			type="button"
			onclick={cycleTheme}
			title="{THEME_LABEL[theme.mode]} · toca para cambiar"
			aria-label="{THEME_LABEL[theme.mode]}. Cambiar tema"
		>
			<span aria-hidden="true">{THEME_ICON[theme.mode]}</span>
		</button>
	</header>

	<nav class="keys" aria-label="Secciones">
		{#each keys as key (key.code)}
			<a
				class="key"
				href={resolve(key.route)}
				aria-current={page.route.id === key.route ? 'page' : undefined}
			>
				{key.code}<span>{key.key}</span>
			</a>
		{/each}
		<a class="key more" href={resolve('/help')} aria-current={page.route.id === '/help' ? 'page' : undefined}>
			…<span>Más</span>
		</a>
	</nav>

	<div class="tape">
		<TvWidget widget="ticker-tape" config={tape} height={44} credit={false} />
	</div>

	<!-- Aviso discreto cuando la Action ha publicado una versión nueva (datos o mejoras). -->
	{#if updated.current}
		<button class="fresh" type="button" onclick={() => location.reload()}>
			Hay datos nuevos · <b>Recargar</b>
		</button>
	{/if}

	<main>
		{@render children()}
	</main>

	<nav class="thumb" aria-label="Accesos rápidos">
		{#each thumb as c (c.code)}
			<a href={resolve(c.route)} aria-current={page.route.id === c.route ? 'page' : undefined}>{c.code}</a>
		{/each}
		<button type="button" aria-label="Abrir la barra de comandos" aria-pressed={ui.sheet} onclick={() => (ui.sheet = !ui.sheet)}>/</button>
	</nav>

	<footer class="status">
		<span>Datos públicos actualizados cada 15 min con GitHub Actions · cotizaciones de TradingView</span>
		<a href={resolve('/status')}>Estado de las fuentes</a>
		<span><kbd>/</kbd> comando · <kbd>Esc</kbd> portada</span>
	</footer>
</div>

<style>
	.app {
		max-width: 1600px;
		margin-inline: auto;
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		padding-block: 4px 10px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: inherit;
		text-decoration: none;
		font-size: var(--fs-s);
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.mark {
		display: block;
		width: 22px;
		height: 22px;
		fill: none;
		stroke: var(--amber);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.theme {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: none;
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--fs-m);
		cursor: pointer;
	}

	.theme:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	/* En pantallas táctiles se ve igual (28 px), pero la zona pulsable llega a 44 × 44 px. */
	@media (pointer: coarse) {
		.theme {
			position: relative;
			min-height: 28px;
		}

		.theme::after {
			content: '';
			position: absolute;
			inset: -8px;
		}
	}

	.brand-sub {
		color: var(--muted);
		font-weight: 400;
	}

	.offline {
		font-size: var(--fs-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--amber);
		border: 1px solid var(--amber-edge);
		padding: 2px 7px;
	}

	/* Teclas de función */
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding-block: 2px 10px;
	}

	.key {
		font-size: var(--fs-s);
		font-weight: 500;
		letter-spacing: 0.06em;
		color: var(--amber);
		text-decoration: none;
		border: 1px solid var(--line);
		padding: 4px 10px;
	}

	.key span {
		margin-left: 7px;
		color: var(--muted);
		font-family: var(--sans);
		font-weight: 400;
		letter-spacing: 0;
	}

	.key:hover {
		border-color: var(--amber-edge);
	}

	.key[aria-current='page'] {
		background: var(--amber);
		border-color: var(--amber);
		color: var(--on-amber);
	}

	.key[aria-current='page'] span {
		color: var(--on-amber);
	}

	/* Cinta de cotizaciones */
	.tape {
		overflow: hidden;
		border: 1px solid var(--line);
		background: var(--panel);
		margin-bottom: 12px;
	}

	main {
		padding-bottom: 16px;
	}

	.fresh {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 30;
		background: var(--raise);
		border: 1px solid var(--amber-edge);
		color: var(--muted);
		padding: 7px 12px;
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.fresh b {
		color: var(--amber);
		font-weight: 500;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 6px 20px;
		padding-block: 10px 18px;
		border-top: 1px solid var(--line);
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.status a {
		color: var(--muted);
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
			grid-template-columns: repeat(5, minmax(0, 1fr));
			background: var(--panel);
			border-top: 1px solid var(--line);
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}

		.thumb a,
		.thumb button {
			display: grid;
			place-items: center;
			height: 48px;
			background: none;
			border: 0;
			color: var(--muted);
			text-decoration: none;
			font-family: var(--mono);
			font-size: var(--fs-s);
			letter-spacing: 0.06em;
			cursor: pointer;
		}

		.thumb [aria-current='page'],
		.thumb [aria-pressed='true'] {
			color: var(--amber);
			text-decoration: underline 1px;
			text-underline-offset: 5px;
		}

		.thumb button {
			color: var(--amber);
			font-size: var(--fs-l);
		}

		/* Que el contenido no quede tapado por la barra. */
		.app {
			padding-bottom: calc(49px + env(safe-area-inset-bottom, 0px));
		}

		.fresh {
			bottom: calc(60px + env(safe-area-inset-bottom, 0px));
		}

		.key span {
			display: none;
		}

		.top :global(.cmd) {
			order: 2;
			flex-basis: 100%;
		}

		/* El botón del tema, en la línea del logo; los relojes, debajo. */
		.theme {
			order: 1;
			margin-left: auto;
		}

		.top :global(.clocks) {
			order: 3;
		}
	}
</style>
