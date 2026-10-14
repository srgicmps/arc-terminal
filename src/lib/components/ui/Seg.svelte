<!--
	Control segmentado: una fila de botones en la que solo uno está activo, como un grupo de radios.
	Uso: <Seg label="Combustible" options={[{ value: 'g95', label: 'Gasolina 95' }, …]} bind:value={fuel} />
	(bind:value es el v-model de Svelte).
	Con bind:values en lugar de bind:value, cada botón se enciende y se apaga por su cuenta y `values` es la
	lista de los encendidos (capas de un mapa, filtros); los encendidos se marcan con un ámbar suave.
	Accesibilidad: con un solo activo es un grupo de radios (role=radiogroup, aria-checked) y se mueve con las
	flechas; con varios, botones que se encienden y se apagan (aria-pressed).
-->
<script lang="ts" generics="T extends string">
	interface Props {
		/** Nombre del grupo para lectores de pantalla. */
		label: string;
		options: readonly { value: T; label: string }[];
		/** El activo, si solo puede haber uno. */
		value?: T;
		/** Los encendidos, si pueden ser varios. */
		values?: T[];
	}

	let { label, options, value = $bindable(), values = $bindable() }: Props = $props();

	const pressed = (v: T) => (values ? values.includes(v) : value === v);

	function press(v: T) {
		if (values) values = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
		else value = v;
	}

	/* Radios: ← → (y ↑ ↓) cambian la opción y le pasan el foco, como en un grupo de radios nativo. */
	function move(e: KeyboardEvent, i: number) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const next = (i + step + options.length) % options.length;
		value = options[next].value;
		((e.currentTarget as HTMLElement).parentElement?.children[next] as HTMLElement | undefined)?.focus();
	}
</script>

{#if values}
	<div class="seg multi" role="group" aria-label={label}>
		{#each options as o (o.value)}
			<button type="button" aria-pressed={pressed(o.value)} onclick={() => press(o.value)}>{o.label}</button>
		{/each}
	</div>
{:else}
	<div class="seg" role="radiogroup" aria-label={label}>
		{#each options as o, i (o.value)}
			<button
				type="button"
				role="radio"
				aria-checked={value === o.value}
				tabindex={value === o.value || (i === 0 && !options.some((x) => x.value === value)) ? 0 : -1}
				onclick={() => press(o.value)}
				onkeydown={(e) => move(e, i)}>{o.label}</button
			>
		{/each}
	</div>
{/if}

<style>
	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		border: var(--border);
	}

	button {
		background: none;
		border: 0;
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		cursor: pointer;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	button[aria-checked='true'] {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: var(--fw-medium);
	}

	/* Con varios encendidos (al principio, todos), el ámbar macizo pesa demasiado: fondo suave y texto ámbar. */
	.multi button[aria-pressed='true'] {
		background: var(--amber-soft);
		color: var(--amber);
		font-weight: var(--fw-regular);
	}
</style>
