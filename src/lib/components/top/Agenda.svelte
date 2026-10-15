<!--
	Módulo de TOP «Hoy en la agenda»: la próxima reunión del BCE y de la Fed, los resultados de hoy
	(Finnhub, si hay clave) y si hoy es festivo o no abre la bolsa. Las fechas son de Madrid y se calculan
	en el navegador (al construir la página no hay «hoy»).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { bmeHolidays, nyseHolidays } from '#lib/markets.ts';
	import { madridDate } from '#lib/meetings.ts';
	import type { Earnings, Holiday } from '#lib/types.ts';
	import MeetingList from '../MeetingList.svelte';
	import Panel from '../Panel.svelte';

	interface Props {
		earnings?: Earnings[];
		holidays?: Holiday[];
	}

	let { earnings = [], holidays = [] }: Props = $props();

	const HOUR: Record<string, string> = { bmo: 'antes de la apertura', amc: 'tras el cierre', dmh: 'durante la sesión' };
	const SHOWN = 5;

	const today = $derived(clock.now ? madridDate(clock.now) : '');
	const results = $derived(
		// Sin repetidos: Finnhub a veces da el mismo valor dos veces el mismo día (trimestre fiscal y natural).
		today ? [...new Map(earnings.filter((e) => e.date === today).map((e) => [e.symbol, e])).values()].sort((a, b) => a.symbol.localeCompare(b.symbol)) : []
	);

	/** «Festivo: Fiesta Nacional de España · Sin bolsa en NYSE». */
	const closed = $derived.by(() => {
		if (!today) return '';
		const year = Number(today.slice(0, 4));
		const fest = holidays.find((h) => h.date === today);
		const markets = [...nyseHolidays(year), ...bmeHolidays(year)].filter((h) => h.date === today).map((h) => h.market);
		return [fest ? `${fest.scope === 'IB' ? 'Festivo en Baleares' : 'Festivo'}: ${fest.name}` : '', markets.length ? `Sin bolsa en ${markets.join(' y ')}` : '']
			.filter(Boolean)
			.join(' · ');
	});
</script>

<Panel
	id="agenda"
	title="Hoy en la agenda"
	meta="BCE, Fed y resultados"
	jump={{ code: 'CAL', href: resolve('/cal') }}
>
	{#if closed}<p class="closed">{closed}</p>{/if}
	<MeetingList mode="next" />
	{#if results.length}
		<ul class="mini">
			{#each results.slice(0, SHOWN) as e (e.symbol)}
				<li>
					<a class="l" href="{resolve('/s')}?sym={encodeURIComponent(e.symbol)}"
						>{e.symbol}<small>Resultados {HOUR[e.hour] ?? 'hoy'}</small></a
					>
				</li>
			{/each}
			{#if results.length > SHOWN}<li><span class="l mut">y {results.length - SHOWN} más en CAL</span></li>{/if}
		</ul>
	{/if}
</Panel>

<style>
	.closed {
		margin: 0;
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
		color: var(--amber);
		font-size: var(--fs-s);
	}
</style>
