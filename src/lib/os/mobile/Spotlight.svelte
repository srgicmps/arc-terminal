<!--
	Spotlight del teléfono (deslizar hacia abajo en la pantalla de inicio, o «Buscar»): la barra de comandos con
	cara de buscador. Arriba, la respuesta rápida o la cuenta («=2*21», «euribor», «hora tokio»); debajo, las apps y
	lo que abriría la barra con lo escrito («NEWS inflación», «NVDA»), y el resto del buscador universal de Arc OS
	(searchAll de OS 5: valores, países, líderes y ajustes).
-->
<script lang="ts">
	import { calcInput, canonical, resolveInput, suggest, targetPath, type Option } from '#lib/cmdline.ts';
	import { answerFor, answerNeeds } from '#lib/bar/answers.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { COMMANDS } from '#lib/commands.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { parseConversion } from '#lib/calc.ts';
	import { fxLive, loadFxRates } from '#lib/fxlive.svelte.ts';
	import { searchAll, type Hit } from '../system/search.ts';
	import type { OsApp } from '../apps.ts';
	import type { PhoneApp } from './home.ts';
	import PhoneIcon from './PhoneIcon.svelte';

	let {
		apps,
		now,
		onapp,
		onpath,
		onhit,
		onclose
	}: { apps: PhoneApp[]; now: number; onapp: (a: PhoneApp) => void; onpath: (path: string) => void; onhit: (h: Hit) => void; onclose: () => void } = $props();

	const ALL: Option[] = [
		...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases })),
		...TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }))
	];

	let q = $state('');
	let input: HTMLInputElement;
	$effect(() => input.focus());
	$effect(() => {
		loadBarData(answerNeeds(q));
		if (parseConversion(q)) loadFxRates();
	});

	const calc = $derived(q.trim() ? calcInput(q, fxLive) : null);
	const ans = $derived(q.trim() && !calc ? answerFor(q, { get: (n) => barData[n], now }) : null);
	const hits = $derived(q.trim() ? searchAll(q, apps as OsApp[], 16) : []);
	const found = $derived(hits.flatMap((h) => ('app' in h.action ? apps.filter((a) => a.id === (h.action as { app: string }).app) : [])));
	/** El resto, por tipo («Valor», «País»…), sin las apps ni lo que ya sale en «Abrir». */
	const groups = $derived.by(() => {
		const out = new Map<string, Hit[]>();
		for (const h of hits) if (!('app' in h.action) && h.kind !== 'Comando') out.set(h.kind, [...(out.get(h.kind) ?? []), h]);
		return [...out];
	});
	const target = $derived(q.trim() && !calc ? resolveInput(q, suggest(q, ALL)) : null);
	// Un valor adivinado («BLOQUEAR») no tapa lo que sí encuentra el buscador: searchAll ya ofrece el valor si no hay nada.
	const go = $derived(target && !(target.kind === 'symbol' && hits.length) ? { label: canonical(target), path: (({ route, search }) => route + search)(targetPath(target)) } : null);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (found[0] && !go) onapp(found[0]);
		else if (go) onpath(go.path);
		else if (hits[0]) onhit(hits[0]);
	}
</script>

<div class="spot" role="dialog" aria-modal="true" aria-label="Buscar">
	<form onsubmit={submit}>
		<input bind:this={input} bind:value={q} type="search" placeholder="Buscar o escribir un comando" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Buscar o escribir un comando" />
		<button type="button" class="x" onclick={onclose}>Cancelar</button>
	</form>
	<div class="res">
		{#if calc || ans}
			<button class="card" disabled={!ans?.open} onclick={() => ans?.open && onpath(COMMANDS.find((c) => c.code === ans.open)?.route ?? '/')}>
				<span class="k">{calc ? 'Calculadora' : ans!.code}</span>
				<span class="v">{calc ? calc.text : ans!.desc}</span>
			</button>
		{/if}
		{#if found.length}
			<h3>Apps</h3>
			<div class="apps">
				{#each found.slice(0, 4) as a (a.id)}<PhoneIcon app={a} onopen={onapp} />{/each}
			</div>
		{/if}
		{#if go}
			<h3>Abrir</h3>
			<button class="card row" onclick={() => onpath(go.path)}><span class="v">{go.label}</span><span class="k">↵</span></button>
		{/if}
		{#each groups as [kind, list] (kind)}
			<h3>{kind === 'País' ? 'Países' : kind === 'Líder' ? 'Líderes' : kind + 's'}</h3>
			<div class="list">
				{#each list.slice(0, 5) as h (h.id)}
					<button class="card row" onclick={() => onhit(h)}>
						<span class="ico" aria-hidden="true">{h.icon}</span>
						<span class="t">{h.title}<small>{h.detail}</small></span>
					</button>
				{/each}
			</div>
		{/each}
		{#if !q.trim()}
			<p class="hint">Escribe una app, un valor (NVDA), una cuenta (=2*21) o una pregunta («euribor», «hora tokio»).</p>
		{/if}
	</div>
</div>

<style>
	.spot {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) + 2);
		display: flex;
		flex-direction: column;
		padding: calc(env(safe-area-inset-top, 0px) + var(--sp-16)) var(--sp-16) var(--sp-16);
		background: var(--os-glass-strong);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		font-family: var(--os-phone-font);
		color: var(--fg);
		animation: drop var(--dur-ui) var(--ease);
	}
	form {
		display: flex;
		gap: var(--sp-10);
		align-items: center;
	}
	input {
		flex: 1;
		min-width: 0;
		height: var(--touch);
		padding: 0 var(--sp-14);
		border: 0;
		border-radius: var(--radius);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-field);
	}
	.x {
		min-height: var(--touch);
		padding: 0;
		background: none;
		border: 0;
		color: var(--amber);
		font: inherit;
		font-size: var(--fs-m);
		cursor: pointer;
	}
	.res {
		flex: 1;
		overflow-y: auto;
		padding-top: var(--sp-16);
	}
	h3 {
		margin: var(--sp-16) 0 var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
	}
	.apps {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-12);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-4);
		width: 100%;
		padding: var(--sp-14);
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.card.row {
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--hair);
		border-radius: var(--os-radius-l);
		overflow: hidden;
	}
	.list .card {
		justify-content: flex-start;
		gap: var(--sp-12);
		padding: var(--sp-10) var(--sp-14);
		border-radius: 0;
	}
	.ico {
		flex: none;
		width: var(--sp-20);
		color: var(--os-icon-fg);
		text-align: center;
	}
	.t {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-size: var(--fs-m);
	}
	.t small {
		overflow: hidden;
		color: var(--muted);
		font-size: var(--fs-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.k {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.v {
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}
	.hint {
		color: var(--muted);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(calc(-1 * var(--sp-16)));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spot {
			animation: none;
		}
	}
</style>
