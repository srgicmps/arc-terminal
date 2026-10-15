<!--
	La calculadora normal: la cuenta se escribe con los botones o el teclado y sale con evaluate() (calc.ts, sin eval).
	El estado vive en state.svelte.ts para no perderlo al cambiar de pestaña o cerrar la ventana.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { evaluate, formatResult, plainResult } from '../../../calc.ts';
	import { afterResult, percentOf } from './basic.ts';
	import { calc } from './state.svelte.ts';

	const run = (e: string) => evaluate(percentOf(e));
	/** formatResult() da 5 cifras con exponente («1,0000e+24» para 9,9999997e+23): aquí se ve con todas. */
	const show = (v: number) => {
		const f = formatResult(v);
		return f.includes('e') ? plainResult(v).replace('.', ',') : f;
	};
	const preview = $derived(calc.expr ? run(calc.expr) : null);
	let box: HTMLDivElement;

	const KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '%', '0', ',', '='];

	function press(k: string) {
		const fresh = calc.fresh;
		calc.fresh = false;
		if (k === 'C') calc.expr = '';
		else if (k === '⌫') calc.expr = fresh ? '' : calc.expr.slice(0, -1);
		else if (k === '=') equals();
		else calc.expr = fresh ? afterResult(calc.expr, k) : calc.expr + k;
	}

	function equals() {
		const v = run(calc.expr);
		if (v === null) return;
		const value = plainResult(v).replace('.', ',');
		calc.history = [{ expr: calc.expr, result: show(v), value }, ...calc.history].slice(0, 20);
		calc.expr = value;
		calc.fresh = true;
	}

	function use(value: string) {
		calc.expr = value;
		calc.fresh = true;
		box.focus();
	}

	function key(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
		const map: Record<string, string> = { Enter: '=', '=': '=', Escape: 'C', Backspace: '⌫', Delete: 'C', '*': '×', x: '×', '/': '÷', '-': '−', '.': ',' };
		const k = map[e.key] ?? (/^[\d+%(),^]$/.test(e.key) ? e.key : '');
		if (!k) return;
		e.preventDefault();
		press(k);
	}

	// Se puede escribir con el teclado nada más abrirla, sin hacer clic antes.
	onMount(() => box.focus({ preventScroll: true }));
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="calc" bind:this={box} tabindex="0" onkeydown={key} role="application" aria-label="Calculadora">
	<output class="screen" aria-live="polite">
		<span class="expr">{calc.expr || '0'}</span>
		<span class="res">{preview === null ? (calc.expr ? '…' : '') : calc.fresh ? '' : `= ${show(preview)}`}</span>
	</output>
	<div class="keys">
		{#each KEYS as k (k)}
			<button type="button" class:op={'÷×−+=%()'.includes(k)} class:eq={k === '='} onclick={() => press(k)}>{k}</button>
		{/each}
	</div>
	<button type="button" class="back" onclick={() => press('⌫')} aria-label="Borrar la última cifra">⌫ Borrar</button>
	{#if calc.history.length}
		<ol class="hist" aria-label="Historial">
			{#each calc.history as h, i (i)}
				<li><button type="button" onclick={() => use(h.value)} title="Usar este resultado">{h.expr} <b>= {h.result}</b></button></li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.calc {
		display: grid;
		gap: var(--sp-8);
		max-width: 360px;
		margin: 0 auto;
		outline: none;
	}

	.screen {
		display: grid;
		justify-items: end;
		gap: var(--sp-4);
		padding: var(--sp-10) var(--sp-12);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
		overflow-wrap: anywhere;
	}

	.expr {
		font-size: var(--fs-xl);
	}

	.res {
		min-height: 1lh;
		color: var(--amber);
	}

	.keys {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-4);
	}

	button {
		min-height: var(--control-h);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.keys button {
		min-height: calc(var(--control-h) + var(--sp-12));
		font-size: var(--fs-l);
	}

	.op {
		color: var(--amber);
	}

	.eq {
		background: var(--amber);
		color: var(--on-amber);
	}

	button:hover {
		border-color: var(--amber-dim);
	}

	.back {
		justify-self: end;
		padding: 0 var(--sp-10);
		color: var(--muted);
	}

	.hist {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--border);
	}

	.hist button {
		width: 100%;
		text-align: right;
		background: none;
		border: 0;
		color: var(--muted);
	}

	.hist b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}
</style>
