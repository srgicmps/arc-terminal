<!--
	Calculadora de Arc OS: normal (teclado en pantalla y del ordenador, con historial), financiera (interés
	compuesto, cuota de un préstamo, rentabilidad) y divisas con los cambios del BCE que ya descarga la web.
-->
<script lang="ts">
	import Seg from '../../../components/ui/Seg.svelte';
	import Tool from '../kit/Tool.svelte';
	import Basic from './Basic.svelte';
	import Currency from './Currency.svelte';
	import Finance from './Finance.svelte';
	import { calc } from './state.svelte.ts';
	import type { AppProps } from '../../apps.ts';

	let { win }: AppProps = $props();

	const TABS = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'fin', label: 'Financiera' },
		{ value: 'fx', label: 'Divisas' }
	] as const;
</script>

<Tool {win}>
	{#snippet bar()}<Seg label="Tipo de calculadora" options={TABS} bind:value={calc.tab} />{/snippet}
	{#if calc.tab === 'normal'}<Basic />{:else if calc.tab === 'fin'}<Finance />{:else}<Currency />{/if}
</Tool>
