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
	import type { AppProps } from '../../apps.ts';

	let { win }: AppProps = $props();

	let tab = $state<'normal' | 'fin' | 'fx'>('normal');
	const TABS = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'fin', label: 'Financiera' },
		{ value: 'fx', label: 'Divisas' }
	] as const;
</script>

<Tool {win}>
	{#snippet bar()}<Seg label="Tipo de calculadora" options={TABS} bind:value={tab} />{/snippet}
	{#if tab === 'normal'}<Basic />{:else if tab === 'fin'}<Finance />{:else}<Currency />{/if}
</Tool>
