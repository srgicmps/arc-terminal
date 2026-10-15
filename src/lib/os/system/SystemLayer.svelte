<!--
	Capa del sistema de Arc OS («OS 5»): pantalla de inicio la primera vez del día, bloqueo (también con
	Ctrl+Alt+L), Alt+Tab visual y, más adelante, sonidos y el resto de la experiencia de sistema. Se monta una vez en
	src/routes/os/+page.svelte, encima del escritorio. Estado en system.svelte.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { isShortcut } from '#lib/shortcuts.ts';
	import { startAlerts } from './alerts.svelte.ts';
	import { shell } from '../shell/shell.svelte.ts';
	import Boot from './Boot.svelte';
	import Lock from './Lock.svelte';
	import { shell } from '../shell/shell.svelte.ts';
	import Switcher from './Switcher.svelte';
	import { cancel, commit, sw } from './switcher.svelte.ts';
	import { bootDone, lock, sound, startSystem, sys, unlock } from './system.svelte.ts';

	// Arranque y, mientras dure, los avisos P1–P2 de Arc como toasts (alerts.svelte.ts).
	onMount(() => {
		startSystem();
		// Las alarmas de la app Reloj (OS 4) suenan aunque la app esté cerrada; se cargan aparte, sin pesar.
		import('../apps/clock/alarms.svelte.ts').then((m) => m.startAlarms()).catch(() => {});
		return startAlerts();
	});

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

<!-- Va fuera del escritorio (por encima de todo): lleva el aspecto de Arc OS para tener sus tokens. -->
<div class="sys" data-os-skin={shell.skin}>
	{#if sys.phase === 'boot'}
		<Boot ondone={bootDone} />
	{:else if sys.phase === 'lock'}
		<Lock onunlock={unlock} />
	{:else if sw.open}
		<Switcher />
	{/if}
</div>

<style>
	.sys {
		display: contents;
	}
</style>
