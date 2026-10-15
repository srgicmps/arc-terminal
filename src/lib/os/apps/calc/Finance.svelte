<!-- Calculadora financiera: interés compuesto, cuota de un préstamo y rentabilidad anual. Las cuentas, en fin.ts. -->
<script lang="ts">
	import Seg from '../../../components/ui/Seg.svelte';
	import { cagr, compound, loanPayment, parseNum } from './fin.ts';

	import { calc } from './state.svelte.ts';

	// Los campos viven en state.svelte.ts: no se pierden al cambiar de pestaña.
	const f = calc.fin;
	const MODES = [
		{ value: 'comp', label: 'Interés compuesto' },
		{ value: 'loan', label: 'Préstamo' },
		{ value: 'cagr', label: 'Rentabilidad' }
	] as const;


	const eur = (n: number) => (Number.isFinite(n) ? n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' }) : '—');
	const pct = (n: number) => (Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %` : '—');

	const out = $derived.by(() => {
		const c = parseNum(f.capital), r = parseNum(f.rate), y = parseNum(f.years), m = parseNum(f.monthly || '0');
		if (f.mode === 'comp') {
			const v = compound(c, r, y, m);
			const put = c + m * Math.round(y * 12);
			return [
				['Valor final', eur(v)],
				['Has puesto', eur(put)],
				['Intereses', eur(v - put)]
			];
		}
		if (f.mode === 'loan') {
			const q = loanPayment(c, r, y);
			return [
				['Cuota mensual', eur(q)],
				['Pagas en total', eur(q * Math.round(y * 12))],
				['Intereses', eur(q * Math.round(y * 12) - c)]
			];
		}
		return [['Rentabilidad anual', pct(cagr(c, parseNum(f.end), y))]];
	});
</script>

<div class="fin">
	<Seg label="Cálculo" options={MODES} bind:value={f.mode} />
	<div class="form">
		<label>{f.mode === 'cagr' ? 'Valor al empezar (€)' : f.mode === 'loan' ? 'Importe del préstamo (€)' : 'Capital inicial (€)'}<input inputmode="decimal" bind:value={f.capital} /></label>
		{#if f.mode === 'cagr'}
			<label>Valor al acabar (€)<input inputmode="decimal" bind:value={f.end} /></label>
		{:else}
			<label>Interés anual (%)<input inputmode="decimal" bind:value={f.rate} /></label>
		{/if}
		<label>Años<input inputmode="decimal" bind:value={f.years} /></label>
		{#if f.mode === 'comp'}<label>Aportación al mes (€)<input inputmode="decimal" bind:value={f.monthly} /></label>{/if}
	</div>
	<dl>
		{#each out as [k, v], i (k)}
			<div class:main={i === 0}><dt>{k}</dt><dd>{v}</dd></div>
		{/each}
	</dl>
	<p class="note">{f.mode === 'loan' ? 'Sistema francés, cuota fija. Para tu hipoteca con el euríbor de hoy, abre HIPOTECA.' : f.mode === 'comp' ? 'Interés compuesto cada mes; aportación al final de cada mes. Sin impuestos ni comisiones.' : 'Lo que tendría que rendir cada año, compuesto, para pasar de un valor al otro.'}</p>
</div>

<style>
	.fin {
		display: grid;
		gap: var(--sp-12);
		max-width: 480px;
		margin: 0 auto;
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
		min-width: 0;
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
