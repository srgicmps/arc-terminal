<!--
	Calendario de Arc OS: el mes con puntos de colores por día y, al lado (o debajo, si es estrecho), lo de ese día:
	festivos, publicaciones de datos, resultados (de tus valores de MIS o de todos), tus alarmas y tus eventos, que
	se añaden aquí y se guardan en la cuenta.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import { initWatchlist, watchlist } from '../../../watchlist.svelte.ts';
	import { openApp } from '../../os.svelte.ts';
	import type { AppProps } from '../../apps.ts';
	import { alarms, startAlarms } from '../clock/alarms.svelte.ts';
	import Tool from '../kit/Tool.svelte';
	import { readJson, writeJson } from '../kit/store.ts';
	import { bareSymbol, dayItems, EVENTS_KEY, isEvents, isoDay, kindsOf, MAX_EVENTS, monthGrid, type CalFeed, type Kind, type MyEvent } from './cal.ts';

	let { win }: AppProps = $props();

	// La hora se renueva cada minuto: pasada la medianoche cambia «hoy» y las alarmas de una vez pasan a mañana.
	const opened = new Date();
	let now = $state(opened);
	const today = $derived(isoDay(now));
	let year = $state(opened.getFullYear());
	let month = $state(opened.getMonth());
	let picked = $state(isoDay(opened));
	let days: HTMLDivElement;
	let feed = $state<CalFeed | null>(null);
	let events = $state<MyEvent[]>([]);
	let scope = $state<'mis' | 'all'>('mis');
	let title = $state('');
	let time = $state('');

	onMount(() => {
		startAlarms();
		initWatchlist();
		events = readJson(EVENTS_KEY, [], isEvents);
		fetch(asset('data/os-cal.json' as Parameters<typeof asset>[0]))
			.then((r) => (r.ok ? r.json() : null))
			.then((d: { data: CalFeed } | null) => (feed = d?.data ?? null))
			.catch(() => {});
		const onStorage = (e: StorageEvent) => {
			if (e.key === EVENTS_KEY) events = readJson(EVENTS_KEY, [], isEvents);
		};
		addEventListener('storage', onStorage);
		const tickTimer = setInterval(() => (now = new Date()), 60_000);
		return () => {
			removeEventListener('storage', onStorage);
			clearInterval(tickTimer);
		};
	});

	const mine = $derived(scope === 'mis' && watchlist.codes.length ? new Set(watchlist.codes.map(bareSymbol)) : scope === 'mis' ? new Set<string>() : null);
	const grid = $derived(monthGrid(year, month));
	/** El día al que se llega con Tab: el elegido si está en la rejilla; si no, el 1 del mes. */
	const tabDay = $derived(grid.some((d) => isoDay(d) === picked) ? picked : isoDay(new Date(year, month, 1)));
	const items = (day: string) => dayItems(day, feed, events, alarms.list, mine, now);
	const list = $derived(items(picked));
	const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
	const monthName = $derived(cap(new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })));
	const pickedName = $derived.by(() => cap(new Date(`${picked}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })));

	function go(delta: number) {
		const d = new Date(year, month + delta, 1);
		year = d.getFullYear();
		month = d.getMonth();
	}
	function goToday() {
		now = new Date();
		year = now.getFullYear();
		month = now.getMonth();
		picked = isoDay(now);
	}
	function save() {
		writeJson(EVENTS_KEY, $state.snapshot(events));
	}
	function add(e: SubmitEvent) {
		e.preventDefault();
		const t = title.trim().slice(0, 80);
		if (!t || events.length >= MAX_EVENTS) return;
		events = [...events, { id: Math.random().toString(36).slice(2, 10), date: picked, time, title: t }];
		title = '';
		time = '';
		save();
	}
	function remove(id: string) {
		events = events.filter((x) => x.id !== id);
		save();
	}
	/** Con las flechas se mueve el día elegido (como en un calendario de escritorio). */
	async function key(e: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
		if (!step) return;
		e.preventDefault();
		const d = new Date(`${picked}T12:00:00`);
		d.setDate(d.getDate() + step);
		picked = isoDay(d);
		year = d.getFullYear();
		month = d.getMonth();
		// El foco va con el día elegido (si no, se quedaba en el de antes).
		await tick();
		days.querySelector<HTMLButtonElement>(`[data-day="${picked}"]`)?.focus();
	}

	const LABEL: Record<Kind, string> = { fiesta: 'Festivo', dato: 'Dato', resultado: 'Resultados', alarma: 'Alarma', tuyo: 'Tuyo' };
	const SCOPES = [
		{ value: 'mis', label: 'Resultados de MIS' },
		{ value: 'all', label: 'Todos' }
	] as const;
	const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
</script>

<Tool {win}>
	{#snippet bar()}
		<button type="button" onclick={() => go(-1)} aria-label="Mes anterior">‹</button>
		<b class="month">{monthName}</b>
		<button type="button" onclick={() => go(1)} aria-label="Mes siguiente">›</button>
		<button type="button" onclick={goToday}>Hoy</button>
		<span class="gap"></span>
		<Seg label="Resultados" options={SCOPES} bind:value={scope} />
	{/snippet}
	<div class="wrap"><div class="cal">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="days" bind:this={days} role="grid" aria-label={monthName} tabindex="-1" onkeydown={key}>
			{#each WEEK as w (w)}<span class="wd" role="columnheader">{w}</span>{/each}
			{#each grid as d (d.getTime())}
				{@const day = isoDay(d)}
				{@const ks = kindsOf(items(day))}
				<button
					type="button"
					role="gridcell"
					class:out={d.getMonth() !== month}
					class:today={day === today}
					class:holiday={ks.includes('fiesta') || d.getDay() === 0}
					aria-selected={day === picked}
					data-day={day}
					tabindex={day === tabDay ? 0 : -1}
					aria-label="{d.getDate()}{ks.length ? `, ${ks.map((k) => LABEL[k]).join(', ')}` : ''}"
					onclick={() => (picked = day)}
				>
					<span class="n">{d.getDate()}</span>
					<span class="dots" aria-hidden="true">{#each ks as k (k)}<i class={k}></i>{/each}</span>
				</button>
			{/each}
		</div>
		<section aria-label="Lo del día">
			<h3>{pickedName}</h3>
			{#if list.length}
				<ul>
					{#each list as it, i (i)}
						<li>
							<i class={it.kind} aria-hidden="true"></i>
							<span class="t">{it.time || 'Todo el día'}</span>
							<span>{it.text}</span>
							{#if it.id}<button type="button" class="x" onclick={() => remove(it.id!)} aria-label="Quitar «{it.text}»">×</button>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mut">Nada este día.</p>
			{/if}
			<form onsubmit={add}>
				<input bind:value={title} placeholder="Evento nuevo…" maxlength="80" aria-label="Evento nuevo" />
				<input type="time" bind:value={time} aria-label="Hora (opcional)" />
				<button type="submit" disabled={events.length >= MAX_EVENTS}>Añadir</button>
			</form>
			{#if events.length >= MAX_EVENTS}<p class="mut note">Como mucho {MAX_EVENTS} eventos: quita alguno para añadir más.</p>{/if}
			<p class="mut note">
				{#if !feed}Sin la agenda de la web: solo tus eventos y alarmas.{:else if scope === 'mis' && !watchlist.codes.length}Sin valores en MIS: no salen resultados.{/if}
				Agenda completa en <button type="button" class="link" onclick={() => openApp('cal')}>CAL</button>.
			</p>
		</section>
	</div></div>
</Tool>

<style>
	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.month {
		min-width: 150px;
		text-align: center;
		font-weight: var(--fw-medium);
	}

	.gap {
		flex: 1;
	}

	.wrap {
		container-type: inline-size;
	}

	.cal {
		display: grid;
		grid-template-columns: minmax(280px, 1.3fr) minmax(220px, 1fr);
		gap: var(--sp-16);
	}

	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: var(--sp-2);
		align-content: start;
		outline: none;
	}

	.wd {
		padding: var(--sp-4) 0;
		text-align: center;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.days button {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: var(--sp-2);
		height: auto;
		aspect-ratio: 1.2;
		padding: 0;
		background: none;
		border-color: transparent;
	}

	@media (hover: hover) {
		.days button:hover {
			border-color: var(--line);
		}
	}

	.out {
		opacity: 0.4;
	}

	.holiday .n {
		color: var(--down);
	}

	.today .n {
		color: var(--amber);
		font-weight: var(--fw-bold);
	}

	.days [aria-selected='true'] {
		background: var(--amber-soft);
		border-color: var(--amber-dim);
	}

	.dots {
		display: flex;
		gap: var(--sp-2);
		min-height: var(--sp-4);
	}

	i {
		display: inline-block;
		width: var(--sp-4);
		height: var(--sp-4);
		border-radius: 50%;
	}

	.fiesta {
		background: var(--down);
	}

	.dato {
		background: var(--amber);
	}

	.resultado {
		background: var(--up);
	}

	.alarma {
		background: var(--muted);
	}

	.tuyo {
		background: var(--fg);
	}

	h3 {
		margin: 0 0 var(--sp-8);
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--row-y) 0;
		border-bottom: var(--border);
	}

	.t {
		white-space: nowrap;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.x {
		height: auto;
		padding: 0 var(--sp-4);
		background: none;
		border: 0;
		color: var(--muted);
	}

	form {
		display: flex;
		gap: var(--sp-4);
		margin-top: var(--sp-12);
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

	input:first-child {
		flex: 1;
	}

	.mut {
		color: var(--muted);
	}

	p {
		margin: var(--sp-8) 0 0;
	}

	.note {
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.link {
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
	}

	@container (max-width: 560px) {
		.cal {
			grid-template-columns: minmax(0, 1fr);
		}

		/* En el móvil, el título del evento en una fila y la hora con «Añadir» debajo. */
		form {
			flex-wrap: wrap;
		}

		form input:first-child {
			flex: 1 0 100%;
		}

		form input[type='time'] {
			flex: 1;
		}
	}
</style>
