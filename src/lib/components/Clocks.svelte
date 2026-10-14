<!--
	Hora en las bolsas principales y si están abiertas: horario normal, fines de semana y festivos de NYSE y BME.
	Delante, la hora de «Tu sitio» si su zona horaria no es la de Madrid ni la de una de esas bolsas.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { hmIn } from '#lib/format.ts';
	import { CLOCK_MARKETS, clockState } from '#lib/markets.ts';
	import { place } from '#lib/place.svelte.ts';

	const siteTz = $derived(place.current.tz);
	const showSite = $derived(!!siteTz && siteTz !== 'Europe/Madrid' && !CLOCK_MARKETS.some((mk) => mk.tz === siteTz));
	const siteTime = $derived(clock.now ? hmIn(new Date(clock.now).toISOString(), siteTz) : '--:--');

	const rows = $derived(
		CLOCK_MARKETS.map((mk) =>
			clock.now ? { code: mk.code, ...clockState(mk, clock.now) } : { code: mk.code, time: '--:--', isOpen: false, holiday: null }
		)
	);
	const label = (r: { isOpen: boolean; holiday: string | null }) =>
		r.isOpen ? 'abierta' : r.holiday ? `cerrada · festivo (${r.holiday})` : 'cerrada';
</script>

<div class="clocks" aria-label="Hora y estado de las bolsas">
	{#if showSite}
		<span class="clock site" title="Hora en {place.current.name}">{place.current.name} <b>{siteTime}</b></span>
	{/if}
	{#each rows as r (r.code)}
		<span class="clock" title="Bolsa {label(r)}">
			<i class="dot" class:on={r.isOpen} class:holiday={!!r.holiday}></i>{r.code} <b>{r.time}</b>
			<span class="sr">{label(r)}</span>
		</span>
	{/each}
</div>

<style>
	.clocks {
		display: flex;
		align-items: center;
		gap: var(--sp-14);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.clock {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		white-space: nowrap;
	}

	.site {
		max-width: 14ch;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.dot {
		display: inline-block;
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		background: var(--faint);
	}

	.dot.on {
		background: var(--up);
	}

	/* Festivo: punto hueco, para distinguirlo de un simple «fuera de horario». */
	.dot.holiday {
		background: transparent;
		box-shadow: inset 0 0 0 var(--hair) var(--faint);
	}

	@media (max-width: 720px) {
		.clocks {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
