<!--
	Arc OS: Arc Terminal como un sistema operativo, con escritorios y ventanas. Es un modo opcional (arc-shell),
	junto al clásico. Aquí solo se colocan las piezas: el fondo y la barra son de «OS 2», las ventanas del núcleo
	(src/lib/os/, src/lib/components/os/WindowLayer.svelte). Ocupa toda la pantalla, por encima de la cabecera de la web.
-->
<script lang="ts">
	import Taskbar from '#lib/components/os/Taskbar.svelte';
	import WindowLayer from '#lib/components/os/WindowLayer.svelte';
	import { APPS, openApp, openPath, loadShell, setShell } from '#lib/os/os.svelte.ts';
	import Desktop from '#lib/os/shell/Desktop.svelte';
	import { loadShell as loadDesk, shell as desk } from '#lib/os/shell/shell.svelte.ts';

	// Escritorio (fondo, iconos y widgets) de «OS 2»: los iconos son las apps ancladas en la barra.
	const icons = APPS.map((a) => ({ id: a.id, title: a.name, code: a.code, icon: a.icon, desc: a.desc }));
	$effect(() => loadDesk(['top', 'imp', 'eco', 'ws', 'geo']));

	// Entrar en /os es elegir Arc OS: la próxima vez que abras la web, vuelve aquí.
	$effect(() => {
		loadShell();
		setShell('os');
	});
</script>

<svelte:head>
	<title>Arc OS</title>
</svelte:head>

<div class="os" class:top={desk.bar === 'top'} data-ui="os" data-os-bar={desk.bar}>
	<div class="desk">
		<Desktop apps={icons} onopen={(id) => openApp(id)} onnavigate={openPath}>
			<WindowLayer />
		</Desktop>
	</div>
	<Taskbar />
</div>

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
