<!--
	Fila de botones iguales separados por líneas de 1 px, a todo el ancho del panel (CHESS: deshacer, girar…).
	Uso: <ButtonRow><button type="button" onclick={…}>Girar</button>…</ButtonRow>. Un botón con la clase
	.warn sale en ámbar (p. ej. «¿Seguro?» antes de una acción que no se puede deshacer).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="row">
	{@render children()}
</div>

<style>
	.row {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--hair);
		background: var(--line);
		border-bottom: var(--border);
	}

	.row :global(button) {
		background: var(--panel);
		border: 0;
		min-height: var(--control-h);
		padding: 0 var(--sp-4);
		font-size: var(--fs-s);
		color: var(--fg);
		cursor: pointer;
	}

	.row :global(button:hover:not(:disabled)) {
		background: var(--raise);
		color: var(--amber);
	}

	.row :global(button:disabled) {
		color: var(--faint);
		cursor: default;
	}

	.row :global(button.warn) {
		background: var(--amber-soft);
		color: var(--amber);
	}

	@media (pointer: coarse) {
		.row :global(button) {
			min-height: var(--touch);
		}
	}
</style>
