<!--
	Icono de interfaz de Arc OS (ui.ts): trazo en currentColor, decorativo (el nombre lo lleva el botón). El tamaño
	sale de la letra (1em) o de `size`.
-->
<script lang="ts">
	import { UI, type UiIconId } from './ui.ts';

	let { id, size }: { id: UiIconId; size?: number } = $props();
</script>

<svg class="ui-icon" viewBox="0 0 24 24" width={size ?? '1em'} height={size ?? '1em'} aria-hidden="true" focusable="false">
	<path d={UI[id]} />
</svg>

<style>
	.ui-icon {
		display: block;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
