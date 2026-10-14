<!--
	Fila de interruptores: como Seg, pero se pueden encender varios a la vez (capas de un mapa, filtros).
	Uso: <Toggles label="Capas" options={[{ value: 'quakes', label: 'Terremotos' }, …]} bind:value={on} />
	donde `on` es la lista de los que están encendidos.
-->
<script lang="ts" generics="T extends string">
	interface Props {
		/** Nombre del grupo para lectores de pantalla. */
		label: string;
		options: readonly { value: T; label: string }[];
		value: T[];
	}

	let { label, options, value = $bindable() }: Props = $props();

	const toggle = (v: T) => (value = value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
</script>

<div class="toggles" role="group" aria-label={label}>
	{#each options as o (o.value)}
		<button type="button" aria-pressed={value.includes(o.value)} onclick={() => toggle(o.value)}>{o.label}</button>
	{/each}
</div>

<style>
	/* Mismo aspecto que Seg. */
	.toggles {
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
