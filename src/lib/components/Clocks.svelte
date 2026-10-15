<!--
	Hora en las bolsas principales y si están abiertas: horario normal, fines de semana y festivos de NYSE y BME.
	Delante, la hora de «Tu sitio» si su zona horaria no es la de Madrid ni la de una de esas bolsas.
	Para no recargar la cabecera, se ven dos (tu sitio o Madrid, y Nueva York; en el móvil, uno) y al pulsar se
	despliegan todas con su estado.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { hmIn } from '#lib/format.ts';
	import { CLOCK_MARKETS, clockState } from '#lib/markets.ts';
	import { place } from '#lib/place.svelte.ts';
	import Menu from '#lib/components/ui/Menu.svelte';

	const siteTz = $derived(place.current.tz);
	const showSite = $derived(!!siteTz && siteTz !== 'Europe/Madrid' && !CLOCK_MARKETS.some((mk) => mk.tz === siteTz));
	const siteTime = $derived(clock.now ? hmIn(new Date(clock.now).toISOString(), siteTz) : '--:--');

	const rows = $derived(
		CLOCK_MARKETS.map((mk) =>
			clock.now ? { code: mk.code, ...clockState(mk, clock.now) } : { code: mk.code, time: '--:--', isOpen: false, holiday: null }
		)
	);
	// A la vista: tu sitio (si tiene hora propia) o Madrid, y Nueva York.
	const shown = $derived([
		...(showSite ? [] : rows.filter((r) => r.code === 'MAD')),
		...rows.filter((r) => r.code === 'NYC')
	]);
	const label = (r: { isOpen: boolean; holiday: string | null }) =>
		r.isOpen ? 'abierta' : r.holiday ? `cerrada · festivo (${r.holiday})` : 'cerrada';
</script>

<div class="clocks" data-ui="clocks">
	<Menu label="Hora y estado de las bolsas" cls="clocks-btn" title="Hora y estado de las bolsas · toca para verlas todas">
		{#snippet button()}
			{#if showSite}
				<span class="clock site"><span class="code">{place.current.name}</span> <b>{siteTime}</b></span>
			{/if}
			{#each shown as r (r.code)}
				<span class="clock"><i class="dot" class:on={r.isOpen} class:holiday={!!r.holiday}></i><span class="code">{r.code}</span> <b>{r.time}</b></span>
			{/each}
			<span class="caret" aria-hidden="true">▾</span>
		{/snippet}
		{#snippet children()}
			{#if showSite}
				<span class="row"><span>{place.current.name}</span><b>{siteTime}</b></span>
			{/if}
			{#each rows as r (r.code)}
				<span class="row">
					<span><i class="dot" class:on={r.isOpen} class:holiday={!!r.holiday}></i>{r.code} <small>{label(r)}</small></span>
					<b>{r.time}</b>
				</span>
			{/each}
		{/snippet}
	</Menu>
</div>

<style>
	.clocks {
		display: flex;
		align-items: center;
		font-size: var(--fs-s);
		color: var(--muted);
	}

	/* El botón no parece botón: solo las horas, con un ▾ tenue que dice que hay más. */
	.clocks :global(.clocks-btn) {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-14);
		min-height: var(--control-h);
		padding: 0 var(--sp-4);
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.clocks :global(.clocks-btn:hover .caret),
	.clocks :global(.clocks-btn[aria-expanded='true'] .caret) {
		color: var(--amber);
	}

	.caret {
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-18);
		min-height: var(--control-h);
		padding: 0 var(--sp-12);
		white-space: nowrap;
	}

	.row .dot {
		margin-right: var(--sp-6);
	}

	.row small {
		margin-left: var(--sp-4);
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

	/* En el móvil, un solo reloj y solo la hora (al lado está el chip de tu sitio); el resto, al pulsar. */
	@media (max-width: 720px) {
		.clock + .clock,
		.clock .code,
		.caret {
			display: none;
		}
	}
</style>
