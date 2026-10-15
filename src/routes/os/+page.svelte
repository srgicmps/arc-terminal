<!--
	Arc OS: Arc Terminal como un sistema operativo, con escritorios y ventanas. Es un modo opcional (arc-shell,
	src/lib/os/mode.svelte.ts), junto al Terminal clásico. Aquí solo se colocan las piezas: el fondo y la barra son de «OS 2», las ventanas del núcleo
	(src/lib/os/, src/lib/components/os/WindowLayer.svelte). Ocupa toda la pantalla, por encima de la cabecera de la web.
-->
<script lang="ts">
	import WindowLayer from '#lib/components/os/WindowLayer.svelte';
	import { apps, navigate, open } from '#lib/os/shell/bridge.ts';
	import Desktop from '#lib/os/shell/Desktop.svelte';
	import OsChrome from '#lib/os/shell/OsChrome.svelte';
	import { loadShell, shell } from '#lib/os/shell/shell.svelte.ts';
	import SystemLayer from '#lib/os/system/SystemLayer.svelte';

	// La shell de «OS 2» (aspecto, barras, escritorio con iconos y widgets) alrededor de las ventanas del núcleo.
	$effect(() => loadShell(['top', 'imp', 'eco', 'ws', 'geo']));
</script>

<svelte:head>
	<title>Arc OS</title>
</svelte:head>

<div class="os" data-ui="os" data-os-skin={shell.skin} data-os-bar={shell.skin === 'windows' ? shell.bar : 'top'}>
	<div class="top"><OsChrome where="top" /></div>
	<div class="desk">
		<Desktop {apps} onopen={open} onnavigate={navigate}>
			<WindowLayer />
		</Desktop>
	</div>
	<div class="bottom"><OsChrome where="bottom" /></div>
	<OsChrome where="over" />
</div>
<!-- Arranque, bloqueo y Alt+Tab de «OS 5», por encima de todo. -->
<SystemLayer />

<style>
	.os {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		/* Barra de arriba (si la hay), escritorio y barra o dock de abajo (si lo hay). */
		grid-template-rows: auto 1fr auto;
		background: var(--os-desk);
		background-image: var(--bg-image);
		font-family: var(--os-font);
	}

	.desk {
		min-height: 0;
	}

	/* Si un aspecto no tiene barra arriba o abajo, su hueco mide 0. */
	.top,
	.bottom {
		min-width: 0;
	}

	/* Mac: el dock flota sobre el fondo, sin franja propia. */
	[data-os-skin='mac'] .bottom {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}
</style>
