<!--
	Arc OS: Arc Terminal como un sistema operativo, con escritorios y ventanas. Es un modo opcional (arc-shell,
	src/lib/os/mode.svelte.ts), junto al Terminal clásico. Aquí solo se colocan las piezas: el fondo y la barra son de «OS 2», las ventanas del núcleo
	(src/lib/os/, src/lib/components/os/WindowLayer.svelte). Ocupa toda la pantalla, por encima de la cabecera de la web.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import WindowLayer from '#lib/components/os/WindowLayer.svelte';
	import { apps, navigate, open } from '#lib/os/shell/bridge.ts';
	import Desktop from '#lib/os/shell/Desktop.svelte';
	import OsChrome from '#lib/os/shell/OsChrome.svelte';
	import { osLook } from '#lib/os/look.ts';
	import { loadShell, shell } from '#lib/os/shell/shell.svelte.ts';

	// La shell de «OS 2» (aspecto, barras, escritorio con iconos y widgets) alrededor de las ventanas del núcleo.
	$effect(() => loadShell(['top', 'imp', 'eco', 'ws', 'geo']));
	// Dentro de Arc OS, los colores y la letra son los del aspecto, no la estética de la web (src/lib/os/look.ts).
	let look: ReturnType<typeof osLook> | undefined;
	$effect(() => {
		look = untrack(() => osLook(() => shell.skin));
		return () => look?.stop();
	});
	$effect(() => {
		void shell.skin;
		look?.refresh();
	});
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

<style>
	.os {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		/* Barra de arriba (si la hay), escritorio y barra o dock de abajo (si lo hay). */
		grid-template-rows: auto 1fr auto;
		background: var(--os-desk);
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
