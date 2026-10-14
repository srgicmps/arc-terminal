<!--
	Control segmentado: una fila de botones en la que solo uno está activo, como un grupo de radios.
	Uso: <Seg label="Combustible" options={[{ value: 'g95', label: 'Gasolina 95' }, …]} bind:value={fuel} />
	(bind:value es el v-model de Svelte).
-->
<script lang="ts" generics="T extends string">
	interface Props {
		/** Nombre del grupo para lectores de pantalla. */
		label: string;
		options: readonly { value: T; label: string }[];
		value: T;
	}

	let { label, options, value = $bindable() }: Props = $props();
</script>

<div class="seg" role="group" aria-label={label}>
	{#each options as o (o.value)}
		<button type="button" aria-pressed={value === o.value} onclick={() => (value = o.value)}>{o.label}</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		border: var(--border);
	}

	button {
		background: none;
		border: 0;
		padding: var(--sp-5) var(--sp-10);
		cursor: pointer;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	button[aria-pressed='true'] {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: var(--fw-medium);
	}
</style>
