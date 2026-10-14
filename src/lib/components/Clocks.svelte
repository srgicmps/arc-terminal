<!-- Hora en las bolsas principales y si están abiertas: horario normal, fines de semana y festivos de NYSE y BME. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { CLOCK_MARKETS, clockState } from '#lib/markets.ts';

	const rows = $derived(
		CLOCK_MARKETS.map((mk) =>
			clock.now ? { code: mk.code, ...clockState(mk, clock.now) } : { code: mk.code, time: '--:--', isOpen: false, holiday: null }
		)
	);
	const label = (r: { isOpen: boolean; holiday: string | null }) =>
		r.isOpen ? 'abierta' : r.holiday ? `cerrada · festivo (${r.holiday})` : 'cerrada';
</script>

<div class="clocks" aria-label="Hora y estado de las bolsas">
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
