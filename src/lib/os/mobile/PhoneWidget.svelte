<!--
	Widgets de la pantalla de inicio, entre los iconos: «Hoy» (grande: fecha, hora y dos datos), «Mundo» (relojes) y
	«Mercados», «Cripto», «Bonos», «Macro» y «Gasolina» (dos cifras cada uno) y «Avisos» (lo último del centro de
	notificaciones). Los datos son las respuestas rápidas de la barra (src/lib/bar/answers.ts): se descargan
	solos. Tocar un dato abre su vista.
-->
<script lang="ts">
	import { answerFor, answerNeeds, type Answer } from '#lib/bar/answers.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { WIDGETS, type WidgetId } from './home.ts';
	import type { Notice } from '../shell/notices.ts';

	let {
		id,
		now,
		notices = [],
		onopen,
		onpath
	}: { id: WidgetId; now: number; notices?: Notice[]; onopen: (code: string) => void; onpath?: (path: string) => void } = $props();

	const ASK: Record<WidgetId, string[]> = {
		hoy: ['euribor', 'prima'],
		mundo: ['hora nueva york', 'hora tokio'],
		mercados: ['btc', 'prima'],
		cripto: ['btc', 'eth'],
		bonos: ['us10y', 'prima'],
		macro: ['paro', 'ipc'],
		gasolina: ['gasolina', 'diesel'],
		avisos: []
	};
	const TITLE = $derived(WIDGETS.find((w) => w.id === id)?.name ?? id);

	$effect(() => loadBarData(ASK[id].flatMap((q) => answerNeeds(q))));
	const items = $derived(ASK[id].map((q) => answerFor(q, { get: (n) => barData[n], now })).filter((a): a is Answer => !!a));
	const d = $derived(new Date(now));
	const day = $derived(d.toLocaleDateString('es-ES', { weekday: 'long' }));
	const date = $derived(d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }));
	const time = $derived(d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
	/** «08:51 · −6 h…» → «08:51» para el reloj; el resto, debajo. */
	const split = (s: string) => {
		const [a, ...b] = s.split(' · ');
		return { a, b: b.join(' · ') };
	};
</script>

<section class="w {id}" aria-label={TITLE}>
	{#if id === 'hoy'}
		<div class="head">
			<span class="day">{day}</span>
			<span class="big">{time}</span>
			<span class="date">{date}</span>
		</div>
		<div class="rows">
			{#each items as a (a.code)}
				<button class="row" disabled={!a.open} onclick={() => a.open && onopen(a.open)}>
					<span class="k">{a.code}</span><span class="v">{split(a.desc).a}</span>
				</button>
			{/each}
		</div>
	{:else if id === 'avisos'}
		<h3>{TITLE}</h3>
		{#each notices.slice(0, 2) as n (n.id)}
			<button class="row s" onclick={() => n.href && onpath?.(n.href)}>
				<span class="k">{n.kind === 'aviso' ? 'Aviso' : 'Novedad'}</span>
				<span class="v note">{n.title}</span>
			</button>
		{:else}
			<p class="none">Nada nuevo.</p>
		{/each}
	{:else}
		<h3>{TITLE}</h3>
		{#each items as a (a.code)}
			<button class="row s" disabled={!a.open} onclick={() => a.open && onopen(a.open)}>
				<span class="k">{a.code}</span>
				<span class="v">{split(a.desc).a}</span>
			</button>
		{/each}
	{/if}
</section>

<style>
	.w {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		height: 100%;
		min-width: 0;
		padding: var(--sp-14);
		border-radius: var(--os-radius-l);
		background: var(--os-glass);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		font-family: var(--os-phone-font);
		color: var(--fg);
		overflow: hidden;
	}
	.hoy {
		flex-direction: row;
		gap: var(--sp-16);
	}
	.head {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.day {
		color: var(--amber);
		font-size: var(--fs-s);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
	}
	.big {
		font-size: var(--fs-big);
		font-weight: var(--fw-medium);
		line-height: var(--lh-tight);
		font-variant-numeric: tabular-nums;
	}
	.date,
	.k {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.rows {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--sp-8);
	}
	h3 {
		margin: 0;
		color: var(--amber);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
	}
	.row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		padding: 0;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:disabled {
		cursor: default;
	}
	.k,
	.v {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.v {
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
		font-variant-numeric: tabular-nums;
	}
	.s .v {
		font-size: var(--fs-m);
	}
	.v.note {
		display: -webkit-box;
		font-size: var(--fs-s);
		white-space: normal;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.none {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-s);
	}
</style>
