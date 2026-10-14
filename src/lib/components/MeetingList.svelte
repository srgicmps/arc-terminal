<!--
	Reuniones de política monetaria del BCE y de la Fed (src/lib/meetings.ts).
	«next»: la próxima de cada banco, con lo que descuenta Polymarket si hay mercado. «list»: las siguientes N, mezcladas.
	Los días que faltan dependen de la fecha, así que solo se pintan en el navegador (clock.now vale 0 al construir).
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, period, weekday } from '#lib/format.ts';
	import { BANKS, daysBetween, decisionTime, inDays, madridDate, meetingOdds, upcoming, type MeetingOdds } from '#lib/meetings.ts';
	import type { Prediction } from '#lib/types.ts';

	interface Props {
		mode?: 'next' | 'list';
		/** En «list», cuántas reuniones enseña. */
		limit?: number;
		/** Mercados de Polymarket donde buscar el de cada reunión. */
		markets?: Prediction[];
	}

	let { mode = 'next', limit = 6, markets = [] }: Props = $props();

	const today = $derived(clock.now ? madridDate(clock.now) : '');
	const rows = $derived.by(() => {
		if (!today) return [];
		const list =
			mode === 'next'
				? (['ecb', 'fed'] as const).map((b) => upcoming(today, b)[0]).filter(Boolean)
				: upcoming(today).slice(0, limit);
		return list.map((m) => ({ ...m, days: daysBetween(today, m.date), odds: meetingOdds(m, markets) }));
	});

	const pct = (p: number) => `${nf(p * 100, 0)} %`;
	/** «Mantener 80 % · Bajar 18 % · Subir 2 %», sin las opciones que no llegan al 1 %. */
	function oddsText(o: MeetingOdds): string {
		const parts: [string, number][] = [
			['Mantener', o.hold],
			['Bajar', o.cut],
			['Subir', o.hike]
		];
		return parts
			.filter(([, p]) => p >= 0.01)
			.map(([l, p]) => `${l} ${pct(p)}`)
			.join(' · ');
	}
</script>

{#if rows.length}
	<ul class="mini">
		{#each rows as m (m.bank + m.date)}
			<li>
				{#if mode === 'next'}
					<span class="l">
						Próxima reunión {BANKS[m.bank].of}: {period(m.date)} ({inDays(m.days)})
						{#if m.odds}
							<small><a href={m.odds.url} target="_blank" rel="noopener">Polymarket: {oddsText(m.odds)}</a></small>
						{:else}
							<small>{BANKS[m.bank].long}{m.sep ? ' · con proyecciones' : ''}</small>
						{/if}
					</span>
					<b>{decisionTime(m)}</b>
				{:else}
					<span class="l">
						Reunión {BANKS[m.bank].of}
						<small>{inDays(m.days)} · {decisionTime(m)}{m.sep ? ' · con proyecciones' : ''}</small>
					</span>
					<b>{weekday(m.date)} {period(m.date).split(' ')[1]}</b>
				{/if}
			</li>
		{/each}
	</ul>
{:else if today}
	<p class="empty">No hay más reuniones en el calendario: toca añadir las del año que viene.</p>
{/if}
