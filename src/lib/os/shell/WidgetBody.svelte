<!--
	Lo de dentro de cada widget del escritorio de Arc OS, con datos que ya existen: reloj mundial (zones.ts),
	cotizaciones y titulares (/data/muro.json), tiempo de «Tu sitio», la franja más barata de la luz y «Tu mañana»,
	que junta en cuatro líneas lo de los demás.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, signed, when } from '#lib/format.ts';
	import { MARKETS, marketStatus, until } from '#lib/markets.ts';
	import { place } from '#lib/place.svelte.ts';
	import { cheapestNow, hourLabel } from '#lib/power.ts';
	import { sky } from '#lib/weather.ts';
	import { shell } from './shell.svelte.ts';
	import { wdata } from './widgetdata.svelte.ts';
	import { statusSummary, type WidgetKind } from './widgets.ts';
	import { timeIn, ZONES } from './zones.ts';

	interface Props {
		kind: WidgetKind;
		onnavigate: (href: string) => void;
	}
	let { kind, onnavigate }: Props = $props();

	const cities = ZONES.filter((z) => ['America/New_York', 'Europe/London', 'Europe/Madrid', 'Asia/Tokyo'].includes(z.tz));
	const luz = $derived(clock.now && wdata.power.length ? cheapestNow(wdata.power, clock.now) : null);
	const wx = $derived(wdata.weather?.weather ?? null);
	const nyc = MARKETS.find((m) => m.code === 'NYC')!;
	const ny = $derived(clock.now ? marketStatus(nyc, clock.now) : null);
	const hour = $derived(clock.now ? Number(timeIn(Intl.DateTimeFormat().resolvedOptions().timeZone, clock.now).slice(0, 2)) : 12);
	const hello = $derived(hour < 6 ? 'Buenas noches' : hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches');
	const luzLine = $derived(luz ? `${hourLabel(luz.first)}–${hourLabel(luz.after)} ${luz.tomorrow ? 'mañana' : 'hoy'} · ${nf(luz.avg, 3)} €/kWh` : null);

	const sys = $derived(statusSummary(wdata.status));
	const health = $derived(sys.total ? Math.round((sys.ok / sys.total) * 100) : null);

	function go(e: MouseEvent, href: string) {
		e.preventDefault();
		onnavigate(href);
	}
</script>

{#if kind === 'reloj'}
	<ul class="rows">
		{#each cities as z (z.tz)}
			{@const open = z.market && clock.now ? marketStatus(z.market, clock.now).isOpen : false}
			<li><span>{z.label}</span><b class="big">{clock.now ? timeIn(z.tz, clock.now) : '--:--'}</b><i class="dot" class:on={open} title={open ? 'Bolsa abierta' : 'Bolsa cerrada'}></i></li>
		{/each}
	</ul>
{:else if kind === 'cotizaciones'}
	{#if wdata.wall?.tape.length}
		<ul class="rows">
			{#each wdata.wall.tape.slice(0, 6) as q (q.symbol)}
				<li><span class="sym">{q.symbol}</span><b>{nf(q.price)}</b><span class:up={(q.changePct ?? 0) > 0} class:down={(q.changePct ?? 0) < 0}>{signed(q.changePct)}%</span></li>
			{/each}
		</ul>
		<a href="/mis" onclick={(e) => go(e, '/mis')}>Mis valores →</a>
	{:else}<p class="mut">Sin cotizaciones ahora.</p>{/if}
{:else if kind === 'tiempo'}
	{#if wx}
		{@const s = sky(wx.current.code)}
		<p class="wx"><span class="icon" aria-hidden="true">{s.icon}</span><b class="big">{Math.round(wx.current.temp)}°</b> <span>{s.label}</span></p>
		<p class="mut">{place.current.name} · {wx.daily[0] ? `${Math.round(wx.daily[0].min)}° / ${Math.round(wx.daily[0].max)}°` : ''}</p>
		<a href="/wx" onclick={(e) => go(e, '/wx')}>Tiempo →</a>
	{:else}<p class="mut">Cargando el tiempo de {place.current.name}…</p>{/if}
{:else if kind === 'titulares'}
	{#if wdata.wall?.headlines.length}
		<ol class="news">
			{#each wdata.wall.headlines.slice(0, 5) as h (h.title)}<li>{h.title}</li>{/each}
		</ol>
		<a href="/imp" onclick={(e) => go(e, '/imp')}>Lo importante →</a>
	{:else}<p class="mut">Sin titulares ahora.</p>{/if}
{:else if kind === 'luz'}
	{#if luzLine}
		<p>Lo más barato: <b>{luzLine}</b></p>
		<a href="/luz" onclick={(e) => go(e, '/luz')}>Luz →</a>
	{:else}<p class="mut">Aún no hay precios de la luz.</p>{/if}
{:else if kind === 'sistema'}
	{#if sys.total}
		<p class="gauge"><b class="big">{health}%</b> <span class="mut">fuentes al día</span></p>
		<span class="meter" aria-hidden="true"><i style:width={`${health}%`}></i></span>
		<ul class="rows small">
			<li><span>Al día</span><b>{sys.ok}</b><span></span></li>
			<li><span>Con copia anterior</span><b class:warn={sys.stale}>{sys.stale}</b><span></span></li>
			<li><span>Sin datos</span><b class:bad={sys.error}>{sys.error}</b><span></span></li>
			<li><span>Sin clave</span><b>{sys.off}</b><span></span></li>
		</ul>
		<a href="/status" onclick={(e) => go(e, '/status')}>Estado de las fuentes →</a>
	{:else}<p class="mut">Sin estado de las fuentes.</p>{/if}
{:else if kind === 'registro'}
	{#if shell.notices.length || sys.failing.length}
		<ul class="lines small">
			{#each sys.failing.slice(0, 3) as f (f)}<li><span class="warn">●</span> {f}: falla, se usa la copia anterior</li>{/each}
			{#each shell.notices.slice(0, 5) as n (n.id)}<li><span class:warn={n.kind === 'aviso'}>●</span> {n.title} <span class="mut">· {when(n.time, clock.now)}</span></li>{/each}
		</ul>
	{:else}<p class="mut">Nada que contar.</p>{/if}
{:else if kind === 'datos'}
	{#if sys.total}
		<p><b class="big">{sys.total}</b> <span class="mut">fuentes de datos</span></p>
		<p class="mut">Última descarga: {when(sys.last, clock.now)}. Se refrescan cada 5–30 min con GitHub Actions.</p>
	{:else}<p class="mut">Sin datos.</p>{/if}
{:else if kind === 'manana'}
	<p><b>{hello}.</b></p>
	<ul class="lines">
		{#if wx}<li>{sky(wx.current.code).label}, {Math.round(wx.current.temp)}° en {place.current.name}.</li>{/if}
		{#if ny?.next}<li>Wall Street {ny.isOpen ? 'cierra' : 'abre'} en {until(ny.next - clock.now)}.</li>{/if}
		{#if luzLine}<li>Luz barata: {luzLine}.</li>{/if}
		{#if wdata.wall?.headlines[0]}<li>{wdata.wall.headlines[0].title}</li>{/if}
	</ul>
	<a href="/avisos" onclick={(e) => go(e, '/avisos')}>Tu mañana al móvil →</a>
{/if}

<style>
	ul,
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--sp-8);
		align-items: baseline;
		padding: var(--sp-2) 0;
	}
	b {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}
	.big {
		font-size: var(--fs-l);
	}
	.sym {
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}
	.dot {
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		background: var(--faint);
	}
	.small {
		font-size: var(--fs-xs);
	}
	.gauge {
		display: flex;
		align-items: baseline;
		gap: var(--sp-6);
	}
	.meter {
		display: block;
		height: var(--sp-4);
		margin: var(--sp-4) 0 var(--sp-8);
		border-radius: var(--radius-s);
		background: var(--raise);
		overflow: hidden;
	}
	.meter i {
		display: block;
		height: 100%;
		background: var(--up);
	}
	.warn {
		color: var(--amber);
	}
	.bad {
		color: var(--down);
	}
	.dot.on {
		background: var(--up);
	}
	.wx {
		display: flex;
		align-items: baseline;
		gap: var(--sp-6);
		margin: 0;
	}
	.icon {
		font-size: var(--fs-l);
	}
	p {
		margin: 0 0 var(--sp-4);
		line-height: var(--lh-snug);
	}
	.news {
		list-style: decimal inside;
		display: grid;
		gap: var(--sp-4);
		line-height: var(--lh-snug);
	}
	.lines {
		display: grid;
		gap: var(--sp-4);
		line-height: var(--lh-snug);
	}
	a {
		display: inline-block;
		margin-top: var(--sp-6);
		color: var(--amber);
		font-size: var(--fs-xs);
	}
</style>
