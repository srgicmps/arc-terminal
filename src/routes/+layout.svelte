<script lang="ts">
	import '../app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Teclas de función de la maqueta. Irán creciendo con cada vista.
	const keys = [
		{ code: 'TOP', label: 'Portada', route: '/' },
		{ code: 'FUEL', label: 'Gasolina', route: '/fuel' }
	] as const;
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
	</header>

	<nav class="keys" aria-label="Secciones">
		{#each keys as key (key.code)}
			<a
				class="key"
				href={resolve(key.route)}
				aria-current={page.route.id === key.route ? 'page' : undefined}
			>
				{key.code}<span>{key.label}</span>
			</a>
		{/each}
	</nav>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		max-width: 1600px;
		margin-inline: auto;
		padding-bottom: 16px;
	}

	.top {
		display: flex;
		align-items: center;
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

	@media (max-width: 720px) {
		.key span {
			display: none;
		}
	}
</style>
