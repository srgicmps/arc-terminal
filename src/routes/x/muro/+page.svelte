<!--
	Muro (experiencia 7): para dejarlo puesto en una tele o un segundo monitor. Ocupa toda la pantalla y no
	hay que tocar nada: hora grande, relojes de las bolsas (abiertas o cerradas), un titular enorme que cambia
	cada 12 s, la cinta de cotizaciones y, si pasa algo gordo (los mismos umbrales que los avisos P1), un
	aviso a pantalla completa 15 s de cada minuto. Los datos se vuelven a pedir cada 2 min (/data/muro.json).
	Esc vuelve a la portada. A diferencia del modo TV, no rota vistas: es una pantalla propia.
-->
<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { signed } from '#lib/format.ts';
	import { MARKETS, marketStatus, until } from '#lib/markets.ts';
	import { alertShowing, rotation, type WallData } from '#lib/exp/muro.ts';

	const HEADLINE_SECONDS = 12;
	const CODES = ['TYO', 'HKG', 'FRA', 'LON', 'MAD', 'NYC'];
	const markets = MARKETS.filter((m) => CODES.includes(m.code));

	let now = $state(0);
	let wall = $state<WallData | null>(null);
	let fetchedAt = $state<string | null>(null);
	let full = $state(false);

	async function load() {
		try {
			const r = await fetch(asset('data/muro.json' as Parameters<typeof asset>[0]), { cache: 'no-store' });
			if (!r.ok) return;
			const body = (await r.json()) as { fetchedAt: string; data: WallData };
			wall = body.data;
			fetchedAt = body.fetchedAt;
		} catch {}
	}

	onMount(() => {
		now = Date.now();
		load();
		const tick = setInterval(() => (now = Date.now()), 1000);
		const refresh = setInterval(load, 120_000);
		// Que la pantalla no se apague sola (si el navegador lo permite).
		let lock: { release(): Promise<void> } | null = null;
		const wake = () => {
			if (document.visibilityState !== 'visible') return;
			(navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<typeof lock> } }).wakeLock
				?.request('screen')
				.then((l) => (lock = l))
				.catch(() => {});
		};
		wake();
		document.addEventListener('visibilitychange', wake);
		// Que la web de debajo no se desplace ni asome por los bordes.
		const html = document.documentElement;
		const overflow = html.style.overflow;
		html.style.overflow = 'hidden';
		const onFull = () => (full = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onFull);
		onFull();
		return () => {
			clearInterval(tick);
			clearInterval(refresh);
			document.removeEventListener('visibilitychange', wake);
			document.removeEventListener('fullscreenchange', onFull);
			lock?.release().catch(() => {});
			html.style.overflow = overflow;
		};
	});

	const time = $derived(now ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(now) : '--:--');
	const day = $derived(
		now ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(now) : ''
	);
	const clocks = $derived(
		markets.map((mk) => {
			const st = now ? marketStatus(mk, now) : null;
			return {
				mk,
				time: now ? new Intl.DateTimeFormat('es-ES', { timeZone: mk.tz, hour: '2-digit', minute: '2-digit' }).format(now) : '--:--',
				open: !!st?.isOpen,
				next: st?.next ? `${st.isOpen ? 'cierra' : 'abre'} en ${until(st.next - now)}` : st?.holiday ? 'festivo' : ''
			};
		})
	);
	const headlines = $derived(wall?.headlines ?? []);
	const index = $derived(rotation(headlines.length, now, HEADLINE_SECONDS));
	const headline = $derived(headlines[index]);
	const alert = $derived(wall?.alerts.length && alertShowing(now) ? wall.alerts[rotation(wall.alerts.length, now, 60)] : null);
	const tape = $derived(wall?.tape ?? []);
	const age = $derived(fetchedAt && now ? Math.max(0, Math.round((now - Date.parse(fetchedAt)) / 60_000)) : null);
	const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	function goFull() {
		document.documentElement.requestFullscreen?.().catch(() => {});
	}
</script>

<svelte:head><title>Muro · Arc Terminal</title></svelte:head>

<div class="wall" aria-live="off">
	<header>
		<div class="now">
			<div class="time">{time}</div>
			<div class="day">{day}</div>
		</div>
		<ul class="clocks" aria-label="Bolsas">
			{#each clocks as c (c.mk.code)}
				<li class:open={c.open}>
					<span class="city"><i aria-hidden="true"></i>{c.mk.name}</span>
					<span class="t">{c.time}</span>
					<span class="next">{c.open ? 'abierta' : 'cerrada'}{c.next ? ` · ${c.next}` : ''}</span>
				</li>
			{/each}
		</ul>
	</header>

	<section class="mid">
		{#if headline}
			{#key headline.title}
				<p class="headline">{headline.title}</p>
			{/key}
			<p class="meta">{index + 1}/{headlines.length} · {headline.sources} {headline.sources === 1 ? 'medio' : 'medios'} · lo más importante ahora</p>
		{:else}
			<p class="headline mut">Esperando titulares…</p>
		{/if}
	</section>

	{#if tape.length}
		<div class="tape" aria-label="Cotizaciones">
			<div class="run" style:--n={tape.length}>
				{#each [0, 1] as copy (copy)}
					<span class="set" aria-hidden={copy === 1}>
						{#each tape as q (q.symbol)}
							<span class="q"
								><b>{q.symbol}</b> {fmt(q.price)}
								<span class:up={(q.changePct ?? 0) > 0} class:down={(q.changePct ?? 0) < 0}
									>{q.changePct == null ? '' : `${signed(q.changePct, 2)} %`}</span
								></span
							>
						{/each}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<footer>
		<a class="back" href={resolve('/')}>✕ Salir</a>
		<span>MURO</span>
		<span>{age === null ? '' : `datos de hace ${age} min · `}Esc para salir</span>
		{#if !full}<button type="button" onclick={goFull}>Pantalla completa</button>{/if}
	</footer>

	{#if alert}
		<div class="alert" role="alert">
			<span class="kind">{alert.kind === 'terremoto' ? 'Terremoto' : 'Última hora'}</span>
			<p>{alert.title}</p>
			<span class="detail">{alert.detail}</span>
		</div>
	{/if}
</div>

<style>
	/* Encima de toda la web (cabecera, barra, pie): el muro es la pantalla entera. */
	.wall {
		--wall-pad: clamp(var(--sp-16), 3vw, calc(var(--sp-16) * 4));
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--mono);
		overflow: hidden;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: var(--wall-pad);
		padding: var(--wall-pad);
		border-bottom: var(--border);
	}
	.time {
		font-size: clamp(var(--fs-xxl), 9vw, calc(var(--fs-xxl) * 6));
		line-height: 1;
		letter-spacing: var(--track-tight);
		font-variant-numeric: tabular-nums;
	}
	.day {
		margin-top: var(--sp-6);
		color: var(--muted);
		font-size: clamp(var(--fs-s), 1.4vw, var(--fs-xxl));
	}
	.day::first-letter {
		text-transform: uppercase;
	}
	.clocks {
		display: grid;
		grid-template-columns: repeat(3, auto);
		gap: var(--sp-10) clamp(var(--sp-16), 3vw, calc(var(--sp-16) * 4));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.clocks li {
		display: grid;
		gap: var(--sp-2);
	}
	.city {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		color: var(--muted);
		font-size: clamp(var(--fs-xs), 1.1vw, var(--fs-xl));
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
	}
	.city i {
		width: var(--sp-8);
		height: var(--sp-8);
		border-radius: 50%;
		background: var(--faint);
	}
	.open .city i {
		background: var(--up);
	}
	.t {
		font-size: clamp(var(--fs-l), 2.6vw, calc(var(--fs-xxl) * 2));
		font-variant-numeric: tabular-nums;
	}
	.next {
		color: var(--faint);
		font-size: clamp(var(--fs-xxs), 0.9vw, var(--fs-l));
	}
	.mid {
		display: grid;
		align-content: center;
		gap: var(--sp-16);
		padding: var(--wall-pad);
		min-height: 0;
	}
	.headline {
		margin: 0;
		font-family: var(--sans);
		font-size: clamp(var(--fs-xl), 5vw, calc(var(--fs-xxl) * 4));
		line-height: var(--lh-tight);
		text-wrap: balance;
		animation: in 0.6s ease-out;
	}
	.meta {
		margin: 0;
		color: var(--amber);
		font-size: clamp(var(--fs-xs), 1.2vw, var(--fs-xl));
		letter-spacing: var(--track-code);
	}
	@keyframes in {
		from {
			opacity: 0;
			transform: translateY(var(--sp-8));
		}
	}
	.tape {
		overflow: hidden;
		border-top: var(--border);
		border-bottom: var(--border);
		font-size: clamp(var(--fs-m), 1.8vw, calc(var(--fs-xxl) * 1.5));
		white-space: nowrap;
	}
	.run {
		display: inline-flex;
		animation: tape calc(var(--n) * 4s) linear infinite;
	}
	.set {
		display: inline-flex;
	}
	.q {
		padding: var(--sp-10) clamp(var(--sp-16), 2vw, calc(var(--sp-16) * 3));
		font-variant-numeric: tabular-nums;
	}
	.q b {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}
	@keyframes tape {
		to {
			transform: translateX(-50%);
		}
	}
	footer {
		display: flex;
		align-items: center;
		gap: var(--sp-16);
		padding: var(--sp-8) var(--wall-pad);
		color: var(--faint);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}
	footer .back {
		color: var(--amber);
		text-decoration: none;
	}
	footer span:first-of-type {
		color: var(--amber);
		letter-spacing: var(--track-brand);
	}
	footer span:nth-of-type(2) {
		margin-left: auto;
	}
	footer button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		cursor: pointer;
	}
	.alert {
		position: absolute;
		inset: 0;
		display: grid;
		align-content: center;
		gap: var(--sp-16);
		padding: var(--wall-pad);
		background: var(--bg);
		border: calc(var(--hair) * 2) solid var(--amber);
		animation: in 0.4s ease-out;
	}
	.alert .kind {
		color: var(--amber);
		font-size: clamp(var(--fs-m), 2vw, calc(var(--fs-xxl) * 1.5));
		text-transform: uppercase;
		letter-spacing: var(--track-label);
	}
	.alert p {
		margin: 0;
		font-family: var(--sans);
		font-size: clamp(var(--fs-xxl), 7vw, calc(var(--fs-xxl) * 5));
		line-height: var(--lh-tight);
		text-wrap: balance;
	}
	.alert .detail {
		color: var(--muted);
		font-size: clamp(var(--fs-m), 2vw, calc(var(--fs-xxl) * 1.5));
	}
	@media (max-width: 720px) {
		.clocks {
			width: 100%;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.run {
			animation: none;
		}
	}
</style>
