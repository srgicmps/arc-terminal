<!--
	Lo que va por encima del escritorio de Arc OS, en cualquier aspecto: panel de control, buscador (Ctrl+Espacio),
	Launchpad, Actividades (Linux) y la elección de aspecto del primer arranque. Escucha Ctrl+Espacio y, en Linux,
	la tecla Super (Meta) sola para Actividades.
-->
<script lang="ts">
	import Activities from './Activities.svelte';
	import ControlPanel from './ControlPanel.svelte';
	import FirstRun from './FirstRun.svelte';
	import Launchpad from './Launchpad.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import { isSpotlightKey } from './skins.ts';
	import Spotlight from './Spotlight.svelte';

	let metaAlone = false;
	function down(e: KeyboardEvent) {
		metaAlone = e.key === 'Meta';
		if (isSpotlightKey(e)) {
			e.preventDefault();
			toggle(shell.skin === 'linux' ? 'activities' : 'spotlight');
		}
	}
	function up(e: KeyboardEvent) {
		if (e.key === 'Meta' && metaAlone && shell.skin === 'linux') toggle('activities');
		metaAlone = false;
	}
</script>

<svelte:window onkeydown={down} onkeyup={up} />

{#if shell.ready && !shell.skinChosen}
	<FirstRun />
{:else if shell.open === 'control'}
	<ControlPanel />
{:else if shell.open === 'spotlight'}
	<Spotlight />
{:else if shell.open === 'launchpad'}
	<Launchpad />
{:else if shell.open === 'activities'}
	<Activities />
{/if}
