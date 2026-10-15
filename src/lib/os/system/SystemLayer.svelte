<!--
	Capa del sistema de Arc OS («OS 5»): pantalla de inicio la primera vez del día, bloqueo (también con
	Ctrl+Alt+L) y, más adelante, Alt+Tab, sonidos y el resto de la experiencia de sistema. Se monta una vez en
	src/routes/os/+page.svelte, encima del escritorio. Estado en system.svelte.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { isShortcut } from '#lib/shortcuts.ts';
	import { startAlerts } from './alerts.svelte.ts';
	import Boot from './Boot.svelte';
	import Lock from './Lock.svelte';
	import { bootDone, lock, startSystem, sys, unlock } from './system.svelte.ts';

	// Arranque y, mientras dure, los avisos P1–P2 de Arc como toasts (alerts.svelte.ts).
	onMount(() => (startSystem(), startAlerts()));

	function key(e: KeyboardEvent) {
		if (sys.phase === 'on' && isShortcut(e, 'os-lock')) {
			e.preventDefault();
			lock();
		}
	}
</script>

<svelte:window onkeydown={key} />

{#if sys.phase === 'boot'}
	<Boot ondone={bootDone} />
{:else if sys.phase === 'lock'}
	<Lock onunlock={unlock} />
{/if}
