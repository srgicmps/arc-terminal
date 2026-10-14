<!--
	«Mi mañana»: lo que conviene saber al empezar el día, en una fila compacta. Antes de las 11:00 (hora
	de Madrid) sale entera; a partir de las 11 se pliega en una línea, que se abre al tocarla.
	Solo usa datos que ya existen: tiempo (WX), luz (PVPC), resultados (Finnhub), reuniones del BCE y la
	Fed, festivos, días sin bolsa y avisos meteorológicos. Lo monta la portada pasándole los datos.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf } from '#lib/format.ts';
	import { bmeHolidays, nyseHolidays } from '#lib/markets.ts';
	import { BANKS, MEETINGS, madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { cheapestWindow, hourly, madridNow } from '#lib/power.ts';
	import type { Earnings, HolidaysData, PowerData, WeatherData } from '#lib/types.ts';
	import { ALERT_NAMES, sky, type AlertsData } from '#lib/weather.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';

	interface Props {
		weather?: WeatherData | null;
		power?: PowerData | null;
		earnings?: Earnings[];
		holidays?: HolidaysData | null;
		alerts?: AlertsData | null;
		/** Ciudad del tiempo (la de WX por defecto). */
		city?: string;
	}

	let { weather = null, power = null, earnings = [], holidays = null, alerts = null, city = 'Maó' }: Props = $props();

	// Hasta que arranca el reloj en el navegador se usa la hora de construcción de la página.
	const now = $derived(clock.now || Date.now());
	const today = $derived(madridDate(now));
	const hour = $derived(madridNow(now).hour);
	let open = $state(false);
	const folded = $derived(hour >= 11 && !open);

	const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

	// Tiempo de hoy en la ciudad elegida.
	const place = $derived(weather?.places.find((p) => p.name === city) ?? weather?.places[0] ?? null);
	const day = $derived(place?.daily.find((d) => d.date === today) ?? place?.daily[0] ?? null);

	// Las dos horas seguidas más baratas de lo que queda de hoy (PVPC).
	const cheap = $derived.by(() => {
		const prices = hourly(power?.pvpc ?? []);
		return cheapestWindow(prices, today, 2, hour) ?? cheapestWindow(prices, today, 2);
	});

	// Agenda de hoy: reuniones de bancos centrales y resultados (los de tu lista primero), como mucho 3.
	const agenda = $derived.by(() => {
		const meetings = MEETINGS.filter((m) => m.date === today).map((m) => `Decisión de tipos ${BANKS[m.bank].of}`);
		const mine = myEarnings(earnings, watchlist.codes, today).filter((e) => e.date === today);
		const mineSymbols = new Set(mine.map((e) => e.symbol));
		const others = earnings
			.filter((e) => e.date === today && !mineSymbols.has(e.symbol))
			.map((e) => ({ code: e.symbol, symbol: e.symbol, date: e.date, hour: e.hour }));
		// Ya están bajo «Hoy»: «JPM · resultados hoy, antes de…» → «JPM · resultados antes de…».
		const lines = [...mine, ...others].map((e) => earningsLine(e, today).replace(/ hoy,?/, ''));
		return [...meetings, ...lines].slice(0, 3);
	});

	// Festivo de hoy (España o Baleares) o día sin bolsa en Nueva York o Madrid.
	const closed = $derived.by(() => {
		const year = Number(today.slice(0, 4));
		const fest = (holidays?.items ?? []).find((h) => h.date === today);
		const markets = [...nyseHolidays(year), ...bmeHolidays(year)].filter((h) => h.date === today).map((h) => h.market);
		return [fest ? `Festivo: ${fest.name}` : '', markets.length ? `Sin bolsa en ${markets.join(' y ')}` : '']
			.filter(Boolean)
			.join(' · ');
	});

	// Avisos meteorológicos en vigor, el más alto primero.
	const ORDER = { red: 0, orange: 1, yellow: 2 } as const;
	const warning = $derived.by(() => {
		const active = (alerts?.alerts ?? [])
			.filter((a) => Date.parse(a.expires) > now)
			.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
		return active[0] ? `${ALERT_NAMES[active[0].level]}: ${active[0].hazard}${active.length > 1 ? ` y ${active.length - 1} más` : ''}` : '';
	});

	const items = $derived(
		[
			place && day
				? {
						label: place.name,
						value: `${sky(day.code).icon} ${nf(day.min, 0)}–${nf(day.max, 0)} °C`,
						sub: sky(day.code).label + (day.rain ? ` · ${nf(day.rain, 1)} mm` : '')
					}
				: null,
			cheap ? { label: 'Luz más barata', value: `${hh(cheap.start)}–${hh(cheap.end)}`, sub: `${nf(cheap.avg, 3)} €/kWh` } : null,
			agenda.length ? { label: 'Hoy', value: agenda[0], sub: agenda.slice(1).join(' · ') } : null,
			closed ? { label: 'Calendario', value: closed, sub: '' } : null,
			warning ? { label: 'Aviso', value: warning, sub: '', warn: true } : null
		].filter((i) => i !== null)
	);
</script>

{#if items.length}
	<section class="morning" class:folded aria-label="Mi mañana">
		{#if folded}
			<button type="button" class="line" onclick={() => (open = true)} aria-expanded="false">
				<span class="lbl">Mi mañana</span>
				{items.map((i) => i.value).join(' · ')}
			</button>
		{:else}
			{#each items as item (item.label)}
				<div class="cell" class:warn={'warn' in item && item.warn}>
					<span class="lbl">{item.label}</span>
					<b>{item.value}</b>
					{#if item.sub}<span class="sub">{item.sub}</span>{/if}
				</div>
			{/each}
			{#if hour >= 11}
				<button type="button" class="close" onclick={() => (open = false)} aria-label="Plegar «Mi mañana»">−</button>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.morning {
		display: flex;
		flex-wrap: wrap;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.cell {
		flex: 1 1 12em;
		display: flex;
		flex-direction: column;
		gap: 0.15em;
		padding: 0.6em 0.9em;
		background: var(--panel);
		min-width: 0;
	}

	.lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.cell b {
		font-weight: 500;
		overflow-wrap: anywhere;
	}

	.sub {
		color: var(--faint);
		font-size: var(--fs-xs);
		overflow-wrap: anywhere;
	}

	.warn b {
		color: var(--amber);
	}

	.line,
	.close {
		font: inherit;
		color: inherit;
		background: var(--panel);
		border: 0;
		cursor: pointer;
	}

	.line {
		flex: 1;
		display: flex;
		gap: 0.8em;
		align-items: baseline;
		padding: 0.45em 0.9em;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--fs-s);
	}

	.line:hover .lbl,
	.close:hover {
		color: var(--amber);
	}

	.close {
		padding: 0 0.9em;
		color: var(--muted);
	}
</style>
