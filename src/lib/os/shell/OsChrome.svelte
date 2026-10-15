<!--
	Las piezas de Arc OS alrededor de las ventanas, según el aspecto (skins.ts) y la posición de la barra:
	arriba (barra de menús del Mac, barra con «Actividades» de Linux o la de tareas si se ha subido), abajo (barra
	de tareas de Windows o dock del Mac) y por encima (panel de control, buscador, Launchpad, Actividades y la
	elección de aspecto del primer arranque). /os la pone tres veces: where="top", "bottom" y "over".
-->
<script lang="ts">
	import * as os from './bridge.ts';
	import Dock from './Dock.svelte';
	import MenuBar from './MenuBar.svelte';
	import Overlays from './Overlays.svelte';
	import { shell } from './shell.svelte.ts';
	import { layoutOf } from './skins.ts';
	import Taskbar from './Taskbar.svelte';

	interface Props {
		where: 'top' | 'bottom' | 'over';
	}
	let { where }: Props = $props();

	const layout = $derived(layoutOf(shell.skin, shell.bar));
	const piece = $derived(where === 'top' ? layout.top : where === 'bottom' ? layout.bottom : null);
</script>

{#if where === 'over'}
	<Overlays />
{:else if piece === 'taskbar'}
	<Taskbar
		apps={os.apps}
		windows={os.windows()}
		desks={os.desks()}
		onopen={os.open}
		onactivate={os.activate}
		ondesk={os.switchDesk}
		onnavigate={os.navigate}
		status={os.status()}
	/>
{:else if piece === 'menubar' || piece === 'topbar'}
	<MenuBar mode={piece === 'menubar' ? 'mac' : 'linux'} />
{:else if piece === 'dock'}
	<Dock />
{/if}
