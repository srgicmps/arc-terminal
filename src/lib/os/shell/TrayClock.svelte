<!--
	Reloj de la bandeja de Arc OS: la hora de aquí y cuántas bolsas hay abiertas. Al tocarlo se despliega con
	otras ciudades, su diferencia horaria y si su bolsa está abierta (src/lib/markets.ts).
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { marketStatus } from '#lib/markets.ts';
	import { shell, toggle } from './shell.svelte.ts';
	import { offsetFrom, openMarkets, timeIn, ZONES } from './zones.ts';

	const here = $derived(typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Madrid');
	const isOpen = $derived(shell.open === 'clock');
	const open = $derived(clock.now ? openMarkets(clock.now) : 0);
</script>

<div class="clock">
	<button type="button" class="tray-btn" aria-expanded={isOpen} aria-controls="os-clock" onclick={() => toggle('clock')}>
		<span class="mk" title="Bolsas abiertas ahora">{open ? `${open} abiertas` : 'Bolsas cerradas'}</span>
		<b>{clock.now ? timeIn(here, clock.now) : '--:--'}</b>
	</button>
	{#if isOpen}
		<div id="os-clock" class="pop" role="region" aria-label="Relojes del mundo">
			<ul>
				{#each ZONES as z (z.tz)}
					{@const st = z.market && clock.now ? marketStatus(z.market, clock.now) : null}
					<li>
						<span class="city">{z.label}</span>
						<span class="off mut">{clock.now ? offsetFrom(z.tz, here, clock.now) : ''}</span>
						<b>{clock.now ? timeIn(z.tz, clock.now) : '--:--'}</b>
						<span class="st" class:on={st?.isOpen}>{st ? (st.isOpen ? 'abierta' : 'cerrada') : ''}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.clock {
		position: relative;
	}
	b {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}
	.mk {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.pop {
		right: 0;
		width: 300px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: 1fr auto auto 64px;
		gap: var(--sp-8);
		align-items: baseline;
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--hair) solid var(--line);
		font-size: var(--fs-s);
	}
	li:last-child {
		border-bottom: 0;
	}
	.off {
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}
	.st {
		color: var(--muted);
		font-size: var(--fs-xs);
		text-align: right;
	}
	.st.on {
		color: var(--up);
	}
</style>
