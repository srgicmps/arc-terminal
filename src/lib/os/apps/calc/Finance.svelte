<!-- Calculadora financiera: interés compuesto, cuota de un préstamo y rentabilidad anual. Las cuentas, en fin.ts. -->
<script lang="ts">
	import Seg from '../../../components/ui/Seg.svelte';
	import { cagr, compound, loanPayment, parseNum } from './fin.ts';

	let mode = $state<'comp' | 'loan' | 'cagr'>('comp');
	const MODES = [
		{ value: 'comp', label: 'Interés compuesto' },
		{ value: 'loan', label: 'Préstamo' },
		{ value: 'cagr', label: 'Rentabilidad' }
	] as const;

	let capital = $state('10.000');
	let rate = $state('4');
	let years = $state('10');
	let monthly = $state('100');
	let end = $state('15.000');

	const eur = (n: number) => (Number.isFinite(n) ? n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' }) : '—');
	const pct = (n: number) => (Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %` : '—');

	const out = $derived.by(() => {
		const c = parseNum(capital), r = parseNum(rate), y = parseNum(years), m = parseNum(monthly || '0');
		if (mode === 'comp') {
			const v = compound(c, r, y, m);
			const put = c + m * Math.round(y * 12);
			return [
				['Valor final', eur(v)],
				['Has puesto', eur(put)],
				['Intereses', eur(v - put)]
			];
		}
		if (mode === 'loan') {
			const q = loanPayment(c, r, y);
			return [
				['Cuota mensual', eur(q)],
				['Pagas en total', eur(q * Math.round(y * 12))],
				['Intereses', eur(q * Math.round(y * 12) - c)]
			];
		}
		return [['Rentabilidad anual', pct(cagr(c, parseNum(end), y))]];
	});
</script>

<div class="fin">
	<Seg label="Cálculo" options={MODES} bind:value={mode} />
	<div class="form">
		<label>{mode === 'cagr' ? 'Valor al empezar (€)' : mode === 'loan' ? 'Importe del préstamo (€)' : 'Capital inicial (€)'}<input inputmode="decimal" bind:value={capital} /></label>
		{#if mode === 'cagr'}
			<label>Valor al acabar (€)<input inputmode="decimal" bind:value={end} /></label>
		{:else}
			<label>Interés anual (%)<input inputmode="decimal" bind:value={rate} /></label>
		{/if}
		<label>Años<input inputmode="decimal" bind:value={years} /></label>
		{#if mode === 'comp'}<label>Aportación al mes (€)<input inputmode="decimal" bind:value={monthly} /></label>{/if}
	</div>
	<dl>
		{#each out as [k, v], i (k)}
			<div class:main={i === 0}><dt>{k}</dt><dd>{v}</dd></div>
		{/each}
	</dl>
	<p class="note">{mode === 'loan' ? 'Sistema francés, cuota fija. Para tu hipoteca con el euríbor de hoy, abre HIPOTECA.' : mode === 'comp' ? 'Interés compuesto cada mes; aportación al final de cada mes. Sin impuestos ni comisiones.' : 'Lo que tendría que rendir cada año, compuesto, para pasar de un valor al otro.'}</p>
</div>

<style>
	.fin {
		display: grid;
		gap: var(--sp-12);
		max-width: 480px;
	}

	.form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--sp-8);
	}

	label {
		display: grid;
		gap: var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	input {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-field);
		color: var(--fg);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
	}

	dl {
		margin: 0;
		display: grid;
		gap: var(--sp-4);
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-8);
		padding: var(--sp-4) 0;
		border-bottom: var(--border);
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
	}

	.main dd {
		color: var(--amber);
		font-size: var(--fs-xl);
	}

	.note {
		margin: 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}
</style>
