<!-- Hora en las bolsas principales y si están abiertas (horario normal, sin festivos). -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';

	const MARKETS = [
		{ code: 'NYC', tz: 'America/New_York', open: [570, 960] },
		{ code: 'LON', tz: 'Europe/London', open: [480, 990] },
		{ code: 'MAD', tz: 'Europe/Madrid', open: [540, 1050] },
		{ code: 'TYO', tz: 'Asia/Tokyo', open: [540, 930], lunch: [690, 750] }
	];

	function local(tz: string, now: number) {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			hour: '2-digit',
			minute: '2-digit',
			weekday: 'short',
			hourCycle: 'h23'
		}).formatToParts(new Date(now));
		const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
		return { h: Number(get('hour')), m: Number(get('minute')), wd: get('weekday') };
	}

	const rows = $derived(
		MARKETS.map((mk) => {
			if (!clock.now) return { code: mk.code, time: '--:--', isOpen: false };
			const { h, m, wd } = local(mk.tz, clock.now);
			const mins = h * 60 + m;
			let isOpen = wd !== 'Sat' && wd !== 'Sun' && mins >= mk.open[0] && mins < mk.open[1];
			if (isOpen && mk.lunch && mins >= mk.lunch[0] && mins < mk.lunch[1]) isOpen = false;
			return {
				code: mk.code,
				time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
				isOpen
			};
		})
	);
</script>

<div class="clocks" aria-label="Hora y estado de las bolsas">
	{#each rows as r (r.code)}
		<span class="clock" title="Bolsa {r.isOpen ? 'abierta' : 'cerrada'} (horario normal, sin festivos)">
			<i class="dot" class:on={r.isOpen}></i>{r.code} <b>{r.time}</b>
			<span class="sr">{r.isOpen ? 'abierta' : 'cerrada'}</span>
		</span>
	{/each}
</div>

<style>
	.clocks {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.clock {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	b {
		color: var(--fg);
		font-weight: 500;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--faint);
	}

	.dot.on {
		background: var(--up);
	}

	@media (max-width: 720px) {
		.clocks {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
