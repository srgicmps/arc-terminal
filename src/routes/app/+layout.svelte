<!--
	Armazón de la app Sencilla (modo Sencillo): otra app, pensada para quien nunca ha usado una terminal financiera.
	Cabecera con el nombre de la pestaña y «Buscar», el contenido y una barra de pestañas abajo (en el ordenador,
	arriba). Nada de barra de comandos ni de códigos: la terminal sigue a un toque en «Modo experto».
	Es como un layout anidado de Vue Router: el raíz (src/routes/+layout.svelte) no pinta nada suyo en /app.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/sencillo/Icon.svelte';
	import { setModo } from '#lib/modo.svelte.ts';
	import { TABS, tabOf } from '#lib/sencillo/nav.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const current = $derived(tabOf(page.route.id));

	function expert() {
		setModo('terminal');
		goto(resolve('/'));
	}
</script>

<div class="sapp">
	<header class="bar">
		<a class="brand" href={resolve('/app')} aria-label="Arc, inicio">
			<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M4 16a7 7 0 0 1 14 0" /><path d="M8 16a3 3 0 0 1 6 0" /></svg>
			Arc
		</a>
		<nav class="top-tabs" aria-label="Secciones">
			{#each TABS as t (t.id)}
				<a href={resolve(t.route)} aria-current={current === t.id ? 'page' : undefined}><Icon name={t.icon} />{t.label}</a>
			{/each}
		</nav>
		<a class="search" href={resolve('/app/buscar')} aria-current={page.route.id === '/app/buscar' ? 'page' : undefined}>
			<Icon name="search" /><span>Buscar</span>
		</a>
	</header>

	<main>
		{@render children()}
		<footer>
			<p>Datos públicos (INE, Eurostat, Banco Central Europeo, Red Eléctrica, Ministerio…), actualizados cada 15 minutos.</p>
			<button type="button" class="expert" onclick={expert}>Modo experto</button>
		</footer>
	</main>

	<nav class="tabs" aria-label="Secciones">
		{#each TABS as t (t.id)}
			<a href={resolve(t.route)} aria-current={current === t.id ? 'page' : undefined}>
				<Icon name={t.icon} />
				<span>{t.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.sapp {
		min-height: 100dvh;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--app-font);
		font-size: var(--app-fs-body);
		line-height: var(--lh-text);
		-webkit-tap-highlight-color: transparent;
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: var(--z-bar);
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		padding: calc(env(safe-area-inset-top) + var(--sp-8)) var(--sp-16) var(--sp-8);
		background: var(--bg);
		border-bottom: var(--border);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		color: var(--fg);
		font-size: var(--app-fs-h2);
		font-weight: var(--fw-bold);
		text-decoration: none;
	}

	.brand svg {
		width: var(--logo);
		height: var(--logo);
		fill: none;
		stroke: var(--amber);
		stroke-width: 2.2;
		stroke-linecap: round;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		margin-left: auto;
		min-height: var(--touch);
		padding: 0 var(--sp-16);
		border-radius: var(--app-radius-pill);
		background: var(--raise);
		color: var(--fg);
		font-size: var(--app-fs-small);
		text-decoration: none;
	}

	.search[aria-current='page'] {
		color: var(--amber);
	}

	main {
		max-width: var(--app-wide);
		margin: 0 auto;
		padding: var(--sp-16) var(--sp-16) calc(var(--app-tab-h) + env(safe-area-inset-bottom) + var(--sp-24));
	}

	footer {
		display: grid;
		justify-items: center;
		gap: var(--sp-8);
		margin-top: var(--sp-24);
		padding-top: var(--sp-16);
		border-top: var(--border);
		color: var(--muted);
		font-size: var(--app-fs-small);
		text-align: center;
	}

	footer p {
		margin: 0;
		max-width: var(--app-max);
	}

	.expert {
		min-height: var(--touch);
		padding: 0 var(--sp-12);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	/* Barra de pestañas: abajo, a mano del pulgar, con la zona segura del iPhone. */
	.tabs {
		position: fixed;
		inset: auto 0 0;
		z-index: var(--z-bar);
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		height: calc(var(--app-tab-h) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background: var(--panel);
		border-top: var(--border);
	}

	.tabs a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		color: var(--muted);
		font-size: var(--app-fs-tab);
		text-decoration: none;
	}

	.tabs a[aria-current='page'],
	.top-tabs a[aria-current='page'] {
		color: var(--amber);
	}

	.top-tabs {
		display: none;
	}

	/* En el ordenador, las pestañas suben a la cabecera. */
	@media (min-width: 900px) {
		.tabs {
			display: none;
		}

		main {
			padding-bottom: var(--sp-24);
		}

		.bar {
			padding-inline: max(var(--sp-16), calc((100% - var(--app-wide)) / 2));
		}

		.top-tabs {
			display: flex;
			gap: var(--sp-4);
			margin-left: var(--sp-16);
		}

		.top-tabs a {
			display: flex;
			align-items: center;
			gap: var(--sp-6);
			min-height: var(--touch);
			padding: 0 var(--sp-12);
			border-radius: var(--app-radius-pill);
			color: var(--muted);
			font-size: var(--app-fs-small);
			text-decoration: none;
		}

		.top-tabs a[aria-current='page'] {
			background: var(--amber-soft);
		}
	}
</style>
