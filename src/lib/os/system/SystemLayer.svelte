<!--
	Capa del sistema de Arc OS («OS 5»): pantalla de inicio la primera vez del día, bloqueo (también con
	Ctrl+Alt+L), Alt+Tab visual y, más adelante, sonidos y el resto de la experiencia de sistema. Se monta una vez en
	src/routes/os/+page.svelte, encima del escritorio. Estado en system.svelte.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { isShortcut } from '#lib/shortcuts.ts';
	import Boot from './Boot.svelte';
	import Lock from './Lock.svelte';
	import { shell } from '../shell/shell.svelte.ts';
	import Switcher from './Switcher.svelte';
	import { cancel, commit, sw } from './switcher.svelte.ts';
	import { bootDone, lock, sound, startSystem, sys, unlock } from './system.svelte.ts';

	onMount(() => startSystem());

	// Un aviso nuevo (toast de la shell) suena, si los sonidos están encendidos.
	let toasts = 0;
	$effect(() => {
		const n = shell.toasts.length;
		if (n > toasts) sound('notify');
		toasts = n;
	});

	function key(e: KeyboardEvent) {
		if (sw.open && e.key === 'Escape') return (e.preventDefault(), cancel());
		if (sys.phase === 'on' && isShortcut(e, 'os-lock')) {
			e.preventDefault();
			lock();
		}
	}
</script>

<svelte:window onkeydown={key} onkeyup={(e) => sw.open && e.key === 'Alt' && commit()} onblur={commit} />

<!-- Fuera del escritorio, pero con el estilo único de Arc OS («Mando»): también en el móvil. -->
<div class="skin" data-os-skin="mando">
{#if sys.phase === 'boot'}
	<Boot ondone={bootDone} />
{:else if sys.phase === 'lock'}
	<Lock onunlock={unlock} />
{:else if sw.open}
	<Switcher />
{/if}
</div>

<style>
	.skin {
		display: contents;
	}
</style>
