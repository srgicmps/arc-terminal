<!--
	Variación con su color: verde si sube, rojo si baja, gris si no cambia o no hay dato.
	Por defecto escribe el valor con signo («+0,12 %»); con text, otro texto con el color de value.
-->
<script lang="ts">
	import { signed, trend } from '#lib/format.ts';

	interface Props {
		value: number | null | undefined;
		digits?: number;
		/** Se añade detrás del número: « %», « pb»… */
		unit?: string;
		/** Para series en las que bajar es bueno (el paro): invierte el color. */
		invert?: boolean;
		/** Texto en lugar del valor con signo. */
		text?: string;
	}

	let { value, digits = 2, unit = '', invert = false, text }: Props = $props();

	const shown = $derived(text ?? (value === null || value === undefined ? '—' : signed(value, digits) + unit));
</script>

<!-- El color sale del número que se ve: lo que se redondea a «0,0» va en gris, no en verde o rojo. -->
<span class={trend(invert && value ? -value : value, text === undefined ? digits : undefined)}>{shown}</span>
