<!--
	Marco común de las apps del sistema de Arc OS (Calculadora, Reloj, Notas…): una barra opcional arriba (pestañas,
	botones) y el contenido con su scroll. Llena la ventana, y en el móvil la pantalla entera.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	/** win: uid de la ventana (AppProps), para quien lo necesite (data-win). */
	let { win, bar, children }: { win?: string; bar?: Snippet; children: Snippet } = $props();
</script>

<div class="tool" data-ui="os-tool" data-win={win}>
	{#if bar}<div class="bar">{@render bar()}</div>{/if}
	<div class="main">{@render children()}</div>
</div>

<style>
	.tool {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100%;
		min-height: 0;
		background: var(--panel);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-m);
	}

	.tool:not(:has(.bar)) {
		grid-template-rows: 1fr;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}

	.main {
		min-height: 0;
		overflow: auto;
		padding: var(--sp-12) var(--pad-x);
	}
</style>
