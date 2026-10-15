<!--
	Campo de número que acepta coma decimal («2,5»), para HIPOTECA y AHORRO (lógica en src/lib/decimal.ts).
	Se usa como un input con v-model: <DecimalInput bind:value={form.rate} />. Guarda lo que escribes tal cual
	(«2,» mientras tecleas) y solo lo reescribe si el número cambia desde fuera (al cargar lo guardado).
	Sin estilos propios: los pone la vista que lo usa, como a sus demás campos.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { parseDecimal, showDecimal } from '#lib/decimal.ts';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'type'> {
		/** NaN si está vacío o no es un número (las cuentas ya lo tratan como «sin dato»). */
		value: number;
		/** Importes en euros: el punto separa miles («150.000»). */
		thousands?: boolean;
	}

	let { value = $bindable(), thousands = false, ...rest }: Props = $props();

	let text = $state(untrack(() => showDecimal(value)));

	// Como un watch de Vue sobre `value`: si cambia desde fuera y no es lo que dice el texto, se reescribe.
	$effect(() => {
		const v = value;
		untrack(() => {
			if (!Object.is(parseDecimal(text, thousands) ?? NaN, v)) text = showDecimal(v);
		});
	});
</script>

<input
	{...rest}
	type="text"
	inputmode="decimal"
	autocomplete="off"
	bind:value={
		() => text,
		(t) => {
			text = t;
			value = parseDecimal(t, thousands) ?? NaN;
		}
	}
/>
