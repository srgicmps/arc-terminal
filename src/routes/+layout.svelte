<script lang="ts">
	import '../app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { startClock } from '#lib/clock.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import Clocks from '#lib/components/Clocks.svelte';
	import CommandBar from '#lib/components/CommandBar.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// El reloj arranca en el navegador (como onMounted en Vue) y se para al salir.
	$effect(startClock);

	const keys = COMMANDS.filter((c) => c.pinned);

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
		<Clocks />
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

	<main>
		{@render children()}
	</main>

	<footer class="status">
		<span>Datos públicos actualizados cada 30 min con GitHub Actions · cotizaciones de TradingView</span>
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

	.brand-sub {
		color: var(--muted);
		font-weight: 400;
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

	@media (max-width: 720px) {
		.key span {
			display: none;
		}

		.top :global(.cmd) {
			order: 2;
			flex-basis: 100%;
		}
	}
</style>
