<!--
	TV: prepara el modo TV (qué vistas rotan y cada cuántos segundos) y lo arranca. El botón «Empezar» es
	un toque del usuario, así que el navegador deja poner la pantalla completa. También se puede arrancar
	con una URL: /?tv=TOP,WS,GEO,LUZ&s=30, o desde la barra con «TV TOP,WS,GEO».
-->
<script lang="ts">
	import { routeHref } from '#lib/routes.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { startTv } from '#lib/tv.svelte.ts';
	import { TV_DEFAULT, parseTv, routeOf, tvCandidates, tvQuery } from '#lib/tv.ts';

	const KEY = 'arc-tv';
	const SECONDS = [
		{ value: '15', label: '15 s' },
		{ value: '30', label: '30 s' },
		{ value: '60', label: '1 min' },
		{ value: '120', label: '2 min' }
	] as const;

	let codes = $state<string[]>([...TV_DEFAULT]);
	let seconds = $state<(typeof SECONDS)[number]['value']>('30');

	// Lo último que se eligió, guardado en este navegador.
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (saved) {
				const p = parseTv(saved.codes, String(saved.seconds));
				codes = p.codes;
				const s = SECONDS.find((o) => Number(o.value) === p.seconds);
				if (s) seconds = s.value;
			}
		} catch {}
	});

	/** Mantiene el orden de la lista de comandos. */
	function toggle(code: string) {
		const next = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
		codes = tvCandidates()
			.map((c) => c.code)
			.filter((c) => next.includes(c));
	}

	function start() {
		if (!codes.length) return;
		try {
			localStorage.setItem(KEY, JSON.stringify({ codes: codes.join(','), seconds: Number(seconds) }));
		} catch {}
		startTv([...codes], Number(seconds));
		goto(routeHref(routeOf(codes[0])));
	}

	const link = $derived(`${resolve('/')}${tvQuery(codes, Number(seconds))}`);
</script>

<ViewHeader code="TV" title="Modo TV" sub="Las vistas van rotando solas, encajadas y a pantalla completa" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Vistas" meta="{codes.length} elegidas">
			<ul class="views">
				{#each tvCandidates() as c (c.code)}
					<li>
						<label>
							<input type="checkbox" checked={codes.includes(c.code)} onchange={() => toggle(c.code)} />
							<b>{c.code}</b>
							<span>{c.key}</span>
						</label>
					</li>
				{/each}
			</ul>
		</Panel>
	</div>
	<div class="col">
		<Panel title="Empezar">
			<div class="opts">
				<Seg label="Cada cuánto cambia" options={SECONDS} bind:value={seconds} />
				<button type="button" class="go" onclick={start} disabled={!codes.length}>Empezar</button>
			</div>
			<ul class="mini">
				<li><span class="l">Pausar</span><b>Toque · Espacio</b></li>
				<li><span class="l">Salir</span><b>Esc · «Salir»</b></li>
			</ul>
			<!-- El enlace va en su propia fila: es largo y en el móvil no cabe al lado de una etiqueta. -->
			<p class="link">Enlace directo<span class="url">{link}</span></p>
			{#snippet note()}
				Desde la barra también vale «TV TOP,WS,GEO». La pantalla completa solo se pone si el navegador lo permite;
				«encajar» solo cambia algo en pantallas de 1280 px o más.
			{/snippet}
		</Panel>
	</div>
</div>

<style>
	.views {
		list-style: none;
		margin: 0;
		padding: var(--sp-4) 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16em), 1fr));
	}

	label {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		cursor: pointer;
		min-height: var(--control-h);
	}

	input {
		accent-color: var(--amber);
	}

	b {
		color: var(--amber);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-code);
	}

	label span {
		color: var(--muted);
		font-family: var(--sans);
	}

	.opts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-10);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}

	.mini b {
		color: var(--fg);
		font-weight: var(--fw-regular);
	}

	.link {
		margin: 0;
		padding: var(--sp-6) var(--pad-x) var(--sp-10);
		border-top: var(--border);
		font-family: var(--sans);
	}

	.link .url {
		display: block;
		margin-top: var(--sp-2);
		color: var(--muted);
		font-family: var(--mono);
		word-break: break-all;
		font-size: var(--fs-s);
	}

	@media (pointer: coarse) {
		label,
		.go {
			min-height: var(--touch);
		}
	}
</style>
