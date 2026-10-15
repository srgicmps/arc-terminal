<!--
	«Mi mañana»: lo que conviene saber al empezar el día, en una fila compacta. Antes de las 11:00 (hora
	de Madrid) sale entera; a partir de las 11 se pliega en una línea, que se abre al tocarla.
	Solo usa datos que ya existen: tiempo (WX), luz (PVPC), resultados (Finnhub), reuniones del BCE y la
	Fed, datos macro que se publican hoy (calendario de publicaciones), festivos, días sin bolsa y avisos
	meteorológicos. Lo monta la portada pasándole los datos.
	`tail`: la línea «hoy» de la portada (riesgo, titulares nuevos, luz de mañana). Va en la misma franja: plegada,
	al final de la línea; abierta, en una fila fina debajo de los recuadros. Así hay una franja y no dos.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { hm, nf } from '#lib/format.ts';
	import { bmeHolidays, nyseHolidays } from '#lib/markets.ts';
	import { BANKS, MEETINGS, madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { TOPIC_LABEL } from '#lib/nextrelease.ts';
	import { cheapestWindow, hourLabel, hourly, madridNow } from '#lib/power.ts';
	import type { Earnings, HolidaysData, PowerData, ReleaseEvent, WeatherData } from '#lib/types.ts';
	import { ALERT_NAMES, sky, type AlertsData } from '#lib/weather.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';
	import type { Snippet } from 'svelte';
	import Tile from './ui/Tile.svelte';

	interface Props {
		weather?: WeatherData | null;
		power?: PowerData | null;
		earnings?: Earnings[];
		holidays?: HolidaysData | null;
		alerts?: AlertsData | null;
		/** Publicaciones de datos macro (releases-cal): salen las de hoy. */
		releases?: ReleaseEvent[];
		/** Ciudad del tiempo: la de «Tu sitio», que pasa la portada. Sin ella, la primera de weather.json. */
		city?: string;
		/** Lo de «hoy» que añade la portada, en la misma franja. */
		tail?: Snippet;
	}

	let { weather = null, power = null, earnings = [], holidays = null, alerts = null, releases = [], city, tail }: Props = $props();

	// Hasta que arranca el reloj en el navegador se usa la hora de construcción de la página.
	const now = $derived(clock.now || Date.now());
	const today = $derived(madridDate(now));
	const hour = $derived(madridNow(now).hour);
	let open = $state(false);
	const folded = $derived(hour >= 11 && !open);

	// Tiempo de hoy en la ciudad elegida.
	const place = $derived(weather?.places.find((p) => p.name === city) ?? weather?.places[0] ?? null);
	const day = $derived(place?.daily.find((d) => d.date === today) ?? place?.daily[0] ?? null);

	// Las dos horas seguidas más baratas de lo que queda de hoy (PVPC). Si ya no cabe ninguna (desde las 23:00),
	// nada: una franja ya pasada no sirve.
	const cheap = $derived(cheapestWindow(hourly(power?.pvpc ?? []), today, 2, hour));

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

	// Datos macro que se publican hoy (hora de Madrid), en orden: «IPC de España 09:00».
	const macro = $derived(
		releases
			.filter((e) => madridDate(Date.parse(e.date)) === today)
			.map((e) => `${(e.topic && TOPIC_LABEL[e.topic]) || e.title}${e.allDay ? '' : ` ${hm(e.date)}`}`)
	);

	// Festivo de hoy (España o Baleares) o día sin bolsa en Nueva York o Madrid.
	const closed = $derived.by(() => {
		const year = Number(today.slice(0, 4));
		const fest = (holidays?.items ?? []).find((h) => h.date === today);
		const markets = [...nyseHolidays(year), ...bmeHolidays(year)].filter((h) => h.date === today).map((h) => h.market);
		return [fest ? `${fest.scope === 'IB' ? 'Festivo en Baleares' : 'Festivo'}: ${fest.name}` : '', markets.length ? `Sin bolsa en ${markets.join(' y ')}` : '']
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
			cheap ? { label: 'Luz más barata', value: `${hourLabel(cheap.first)}–${hourLabel(cheap.after)}`, sub: `${nf(cheap.avg, 3)} €/kWh` } : null,
			agenda.length ? { label: 'Hoy', value: agenda[0], sub: agenda.slice(1).join(' · ') } : null,
			macro.length ? { label: 'Datos de hoy', value: macro[0], sub: macro.slice(1, 3).join(' · ') } : null,
			closed ? { label: 'Calendario', value: closed, sub: '' } : null,
			warning ? { label: 'Aviso', value: warning, sub: '' } : null
		].filter((i) => i !== null)
	);
</script>

{#if items.length}
	<section class="morning" class:folded aria-label="Mi mañana">
		{#if folded}
			<button type="button" class="line" onclick={() => (open = true)} aria-expanded="false">
				<!-- Etiqueta en gris con la clase común .mut de app.css: sin CSS propio que copie el de Tile. -->
				<span class="mut">Mi mañana</span>
				<span class="text">{items.map((i) => i.value).join(' · ')}</span>{#if tail}<span class="tail">{@render tail()}</span>{/if}
			</button>
		{:else}
			{#each items as item (item.label)}
				<div class="cell">
					<Tile label={item.label} value={item.value} sub={item.sub || undefined} />
				</div>
			{/each}
			{#if hour >= 11}
				<button type="button" class="close" onclick={() => (open = false)} aria-label="Plegar «Mi mañana»">−</button>
			{/if}
			{#if tail}<p class="tail row">{@render tail()}</p>{/if}
		{/if}
	</section>
{:else if tail}
	<p class="tail alone">{@render tail()}</p>
{/if}

<style>
	.morning {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hair);
		margin-bottom: var(--sp-8);
		background: var(--line);
		border: var(--border);
	}

	/* Cada recuadro es un <Tile>; aquí solo se reparte el ancho (caben de 1 a 5 por fila). */
	.cell {
		flex: 1 1 12em;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--panel);
	}

	.cell > :global(*) {
		flex: 1;
	}

	.line,
	.close {
		font: inherit;
		color: inherit;
		background: var(--panel);
		border: 0;
		cursor: pointer;
	}

	/* Centrado en alto: en pantallas táctiles el botón mide --touch y el texto quedaba pegado arriba. */
	.line {
		flex: 1;
		display: flex;
		gap: var(--sp-12);
		align-items: center;
		padding: var(--sp-6) var(--pad-x);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--fs-s);
	}

	/* El texto se corta con «…» (en el móvil no cabe entero); la etiqueta no se encoge. */
	.line .mut {
		flex: none;
	}

	.line .text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.line:hover,
	.close:hover {
		color: var(--amber);
	}

	.close {
		padding: 0 var(--pad-x);
		color: var(--muted);
	}

	/* La parte de «hoy»: en letra pequeña y gris; lo que importa lleva su propio color (lo pone la portada). */
	.tail {
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.tail:empty {
		display: none;
	}

	.line .tail::before {
		content: '· ';
	}

	.line .tail {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row {
		flex: 1 0 100%;
		margin: 0;
		padding: var(--sp-4) var(--pad-x);
		background: var(--panel);
	}

	.alone {
		min-height: calc(var(--fs-xs) * var(--lh));
		margin: 0 0 var(--sp-8);
	}
</style>
