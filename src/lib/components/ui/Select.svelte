<!--
	Desplegable con su etiqueta delante: «Zona [Menorca ▾]». Las <option> van dentro, como en un <select>.
	Uso: <Select label="Municipio" bind:value={town}><option value="ALL">Todos</option>…</Select>
	Con onchange en vez de bind:value, avisa del valor elegido y el padre decide qué hacer.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		value: string;
		onchange?: (value: string) => void;
		children: Snippet;
	}

	let { label, value = $bindable(), onchange, children }: Props = $props();
</script>

<label>
	{label}
	<select bind:value onchange={() => onchange?.(value)}>
		{@render children()}
	</select>
</label>

<style>
	label {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	select {
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		padding: var(--sp-4) var(--sp-8);
		font-size: var(--fs-s);
		max-width: var(--select-max);
	}
</style>
