<!--
	Arc OS: Arc Terminal como un sistema operativo, con escritorios y ventanas. Es un modo opcional (arc-shell,
	src/lib/os/mode.svelte.ts), junto al Terminal clásico. Aquí solo se colocan las piezas: el fondo y la barra son de «OS 2», las ventanas del núcleo
	(src/lib/os/, src/lib/components/os/WindowLayer.svelte). Ocupa toda la pantalla, por encima de la cabecera de la web.
-->
<script lang="ts">
	import WindowLayer from '#lib/components/os/WindowLayer.svelte';
	import { APPS, openApp, openPath } from '#lib/os/os.svelte.ts';
	import Desktop from '#lib/os/shell/Desktop.svelte';
	import Taskbar from '#lib/os/shell/OsTaskbar.svelte';
	import { loadShell, shell } from '#lib/os/shell/shell.svelte.ts';
	import MobileHome from '#lib/os/mobile/MobileHome.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	// En el móvil (≤ 900 px), pantalla de inicio de teléfono (OS 3); sin el escritorio, así no carga sus iframes.
	const phone = new MediaQuery('max-width: 900px', false);

	// Escritorio de «OS 2» (fondo, iconos y widgets): los iconos son las apps ancladas en la barra.
	const icons = APPS.map((a) => ({ id: a.id, title: a.name, code: a.code, icon: a.icon, desc: a.desc }));
	$effect(() => loadShell(['top', 'imp', 'eco', 'ws', 'geo']));
</script>

<svelte:head>
	<title>Arc OS</title>
</svelte:head>

{#if phone.current}
	<MobileHome />
{:else}
	<div class="os" class:top={shell.bar === 'top'} data-ui="os" data-os-bar={shell.bar}>
		<div class="desk">
			<Desktop apps={icons} onopen={(id) => openApp(id)} onnavigate={openPath}>
				<WindowLayer />
			</Desktop>
		</div>
		<Taskbar />
	</div>
{/if}

<style>
	.os {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		grid-template-rows: 1fr auto;
		background: var(--os-desk);
		background-image: var(--bg-image);
	}

	.os.top {
		grid-template-rows: auto 1fr;
	}

	.desk {
		min-height: 0;
	}
</style>
