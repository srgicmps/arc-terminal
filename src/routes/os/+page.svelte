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
	import { osLook } from '#lib/os/look.ts';
	import { loadShell, shell } from '#lib/os/shell/shell.svelte.ts';
	import { loadFiles } from '#lib/os/fs/fs.svelte.ts';
	import SystemLayer from '#lib/os/system/SystemLayer.svelte';
	import MobileHome from '#lib/os/mobile/MobileHome.svelte';
	import { coverViewport } from '#lib/os/mobile/viewport.ts';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	// En el móvil (≤ 900 px), pantalla de inicio de teléfono (OS 3); sin el escritorio, así no carga sus iframes.
	// También un teléfono grande girado (932 × 430): si no, al girarlo salía el escritorio y se cerraban las apps.
	const phone = new MediaQuery('(max-width: 900px), (pointer: coarse) and (max-height: 500px)', false);

	// La shell de «OS 2» (aspecto, barras, escritorio con iconos y widgets) alrededor de las ventanas del núcleo.
	// Luego, las carpetas del escritorio (la primera vez, con las apps ancladas y en las casillas que tenían).
	$effect(() =>
		untrack(() => {
			loadShell(['top', 'imp', 'eco', 'ws', 'geo']);
			// Al volver de la web clásica, sin el panel o el menú que quedó abierto al salir (el estado vive en memoria).
			shell.open = null;
			loadFiles(shell.pinned.map((id) => apps.find((a) => a.id === id)).filter((a) => !!a).map((a) => ({ id: a.id, name: a.title })));
		})
	);
	// En iPhone y iPad, hasta los bordes: sin esto, Safari pone a 0 las zonas seguras (muesca y barra de inicio).
	$effect(() => coverViewport());
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

{#if phone.current}
	<MobileHome />
{:else}
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
{/if}
<!-- Arranque, bloqueo y Alt+Tab de «OS 5», por encima de todo (también en el móvil). -->
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
