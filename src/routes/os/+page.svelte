<!--
	Arc OS: Arc Terminal como un sistema operativo, con escritorios y ventanas. Es un modo opcional (arc-shell,
	src/lib/os/mode.svelte.ts), junto al Terminal clásico. Aquí solo se colocan las piezas: el fondo y la barra son de «OS 2», las ventanas del núcleo
	(src/lib/os/, src/lib/components/os/WindowLayer.svelte). Ocupa toda la pantalla, por encima de la cabecera de la web.
-->
<script lang="ts">
	import Taskbar from '#lib/components/os/Taskbar.svelte';
	import WindowLayer from '#lib/components/os/WindowLayer.svelte';
	import MobileHome from '#lib/os/mobile/MobileHome.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	// En el móvil (≤ 900 px), pantalla de inicio de teléfono (OS 3); sin WindowLayer, así no carga sus iframes.
	const phone = new MediaQuery('max-width: 900px', false);
</script>

<svelte:head>
	<title>Arc OS</title>
</svelte:head>

{#if phone.current}
	<MobileHome />
{:else}
	<div class="os" data-ui="os">
		<div class="desk"><WindowLayer /></div>
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

	.desk {
		min-height: 0;
	}
</style>
