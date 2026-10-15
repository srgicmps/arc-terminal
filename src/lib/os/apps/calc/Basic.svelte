<!-- La calculadora normal: la cuenta se escribe con los botones o el teclado y sale con evaluate() (calc.ts, sin eval). -->
<script lang="ts">
	import { evaluate, formatResult, plainResult } from '../../../calc.ts';

	let expr = $state('');
	let history = $state<{ expr: string; result: string }[]>([]);
	const preview = $derived(expr ? evaluate(expr) : null);

	const KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '%', '0', ',', '='];

	function press(k: string) {
		if (k === 'C') expr = '';
		else if (k === '⌫') expr = expr.slice(0, -1);
		else if (k === '=') equals();
		else expr += k;
	}

	function equals() {
		const v = evaluate(expr);
		if (v === null) return;
		history = [{ expr, result: formatResult(v) }, ...history].slice(0, 20);
		expr = plainResult(v).replace('.', ',');
	}

	function key(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const map: Record<string, string> = { Enter: '=', '=': '=', Escape: 'C', Backspace: '⌫', '*': '×', '/': '÷', '-': '−', '.': ',' };
		const k = map[e.key] ?? (/^[\d+%(),^]$/.test(e.key) ? e.key : '');
		if (!k) return;
		e.preventDefault();
		press(k);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="calc" tabindex="0" onkeydown={key} role="application" aria-label="Calculadora">
	<output class="screen" aria-live="polite">
		<span class="expr">{expr || '0'}</span>
		<span class="res">{preview === null ? (expr ? '…' : '') : `= ${formatResult(preview)}`}</span>
	</output>
	<div class="keys">
		{#each KEYS as k (k)}
			<button type="button" class:op={'÷×−+=%()'.includes(k)} class:eq={k === '='} onclick={() => press(k)}>{k}</button>
		{/each}
	</div>
	<button type="button" class="back" onclick={() => press('⌫')} aria-label="Borrar la última cifra">⌫ Borrar</button>
	{#if history.length}
		<ol class="hist" aria-label="Historial">
			{#each history as h, i (i)}
				<li><button type="button" onclick={() => (expr = h.result.replace(/\./g, ''))} title="Usar este resultado">{h.expr} <b>= {h.result}</b></button></li>
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
