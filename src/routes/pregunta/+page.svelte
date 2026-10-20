<!--
	PREGUNTA («Pregunta a Arc»): la única vista con IA, y siempre etiquetada. Se escribe una pregunta y /api/ask
	(cloud/ask.ts) la contesta con Workers AI usando SOLO los datos de hoy de la terminal; si la respuesta trae una
	cifra que no está en esos datos, sale «No lo sé con los datos de hoy». Solo en arcterminal.dev, con cuenta: en
	local lo dice. Sin Workers AI configurado, /api/ask da 503 y la vista lo explica. La respuesta y los errores se
	anuncian solos (role=status) y los botones no pierden el foco mientras espera.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ButtonRow from '#lib/components/ui/ButtonRow.svelte';
	import Search from '#lib/components/ui/Search.svelte';

	const url = asset('api/ask' as Parameters<typeof asset>[0]);
	/** Los topes de cloud/ask.ts (ASK_LIMITS): no se importan para no meter código del servidor en la vista. */
	const MAX = 300;
	const LABEL = 'Generado con IA (Workers AI). Puede equivocarse; las cifras salen de los datos de hoy';
	const EXAMPLES = [
		{ label: 'Euríbor', q: '¿Cómo está el euríbor a 12 meses?' },
		{ label: 'Diésel', q: '¿Cuánto cuesta el diésel en España?' },
		{ label: 'Luz', q: '¿Cuánto cuesta hoy la luz?' },
		{ label: 'Hoy', q: '¿Qué es lo más importante de hoy?' }
	];

	interface Source {
		name: string;
		label: string;
		fetchedAt: string;
	}
	interface Reply {
		answer: string;
		sources: Source[];
		rejected?: boolean;
		used?: number;
		limit?: number;
	}

	// Como ref() en Vue: cada $state es reactivo y la plantilla se repinta sola al cambiarlo.
	let phase = $state<'loading' | 'none' | 'off' | 'error' | 'ready'>('loading');
	let used = $state(0);
	let limit = $state(20);
	let q = $state('');
	let asked = $state('');
	let busy = $state(false);
	let reply = $state<Reply | null>(null);
	let msg = $state('');

	// Como computed() en Vue.
	const left = $derived(Math.max(0, limit - used));
	const long = $derived(q.trim().length > MAX);
	// Los botones no llevan `disabled` mientras espera: un botón desactivado pierde el foco (se va a <body> y el
	// siguiente Tab vuelve al principio). Llevan aria-disabled, y ask() no hace nada si no toca.
	const can = $derived(phase === 'ready' && !busy && left > 0);
	/** Lo que dice «Respuesta» antes de preguntar. */
	const idle = $derived(
		phase === 'off'
			? 'PREGUNTA no está activada en esta web: falta Workers AI (Cloudflare). Lo demás funciona igual.'
			: phase === 'none'
				? 'PREGUNTA está en arcterminal.dev, con tu cuenta.'
				: phase === 'error'
					? 'No se ha podido conectar con PREGUNTA. Recarga la página.'
					: 'Aquí sale la respuesta, con las fuentes que ha usado y su hora.'
	);

	// «PREGUNTA euríbor» en la barra abre /pregunta?q=euríbor: rellena el campo, sin preguntar todavía. Lee page.url,
	// que es reactivo (como watch(() => route.query.q) en Vue): también vale si ya estás aquí y lo vuelves a escribir.
	$effect(() => {
		const fromUrl = page.url.searchParams.get('q');
		if (fromUrl) q = fromUrl.slice(0, MAX);
	});

	// Como onMounted(): solo en el navegador y una sola vez (no lee nada reactivo). Cuántas lleva hoy.
	$effect(() => {
		if (new URL(url, location.href).pathname !== '/api/ask') {
			phase = 'none';
			return;
		}
		fetch(url, { cache: 'no-store', redirect: 'manual' })
			.then(async (res) => {
				const json = res.headers.get('content-type')?.includes('application/json');
				const body = (json ? await res.json() : null) as { used?: number; limit?: number; error?: string } | null;
				// Sin la Function (en local, con `pnpm preview`): aquí no hay PREGUNTA.
				if (res.status === 404 || (res.ok && !body)) return void (phase = 'none');
				if (res.status === 503 && body?.error === 'sin configurar') return void (phase = 'off');
				// La sesión de Access caducada (redirección), la base que falla o sin red: 'error'.
				if (!res.ok || typeof body?.used !== 'number') throw new Error(String(res.status));
				used = body.used;
				limit = body.limit ?? limit;
				phase = 'ready';
			})
			.catch(() => (phase = 'error'));
	});

	async function ask(text: string) {
		const question = text.trim();
		if (!question || !can || question.length > MAX) return;
		// En el móvil, fuera el teclado: si no, tapa la respuesta.
		if (matchMedia('(pointer: coarse)').matches) (document.activeElement as HTMLElement | null)?.blur();
		q = question;
		asked = question;
		busy = true;
		msg = '';
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ q: question }),
				redirect: 'manual'
			});
			const body = (res.headers.get('content-type')?.includes('application/json') ? await res.json() : {}) as Partial<Reply>;
			if (typeof body.used === 'number') used = body.used;
			if (res.status === 429) throw new Error(`Ya has hecho las ${limit} preguntas de hoy. Mañana, más.`);
			if (res.status === 413) throw new Error(`Como mucho ${MAX} caracteres.`);
			if (res.status === 503) throw new Error('La IA no responde ahora (puede que se haya acabado la cuota de hoy). Prueba más tarde.');
			if (!res.ok || typeof body.answer !== 'string') throw new Error('No se ha podido preguntar. Prueba otra vez.');
			reply = body as Reply;
		} catch (e) {
			reply = null;
			msg = (e as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<ViewHeader code="PREGUNTA" title="Pregunta a Arc" sub="Con IA, solo sobre los datos de hoy" />

<div class="grid grid-2">
	<Panel title="Tu pregunta" meta={phase === 'ready' ? `Te quedan ${left} de ${limit} hoy` : undefined}>
		<!-- El formulario sale desde el principio (sin saltos al cargar); hasta que /api/ask responde, no pregunta. -->
		<form
			class="ask"
			onsubmit={(e) => {
				e.preventDefault();
				void ask(q);
			}}
		>
			<Search label="Tu pregunta" placeholder="¿Cómo está el euríbor?" bind:value={q} />
			<button type="submit" class="go" aria-disabled={!can || !q.trim() || long}>{busy ? 'Buscando…' : 'Preguntar'}</button>
		</form>
		<div class="examples">
			<ButtonRow>
				{#each EXAMPLES as ex (ex.label)}
					<button type="button" aria-disabled={!can} title={ex.q} onclick={() => ask(ex.q)}>{ex.label}</button>
				{/each}
			</ButtonRow>
		</div>
		{#snippet note()}
			Sobre economía, mercados, la luz, la gasolina, el tiempo o las noticias de hoy. Como mucho {MAX} caracteres y
			{limit} preguntas al día; no se guardan ni la pregunta ni la respuesta.
			<span role="status">{long ? `Te pasas de ${MAX} caracteres.` : ''}</span>
		{/snippet}
	</Panel>

	<Panel title="Respuesta" meta="IA" accent>
		<!-- role=status: el lector de pantalla dice solo «Buscando…», la respuesta o el error, sin mover el foco. -->
		<div role="status">
			{#if busy}
				<p class="empty">Buscando en los datos de hoy…</p>
			{:else if msg}
				<p class="asked">{asked}</p>
				<p class="answer">{msg}</p>
			{:else if reply}
				<p class="asked">{asked}</p>
				<p class="answer">{reply.answer}</p>
				{#if reply.rejected}
					<p class="why">La respuesta citaba cifras que no están en los datos de hoy, así que se ha descartado.</p>
				{/if}
				{#if reply.sources.length}
					<ul class="mini">
						{#each reply.sources as s (s.name)}
							<li><span class="l">{s.label}</span><small class="mut"><Updated at={s.fetchedAt} source={s.name} /></small></li>
						{/each}
					</ul>
				{:else}
					<p class="why">Ningún dato de hoy trata de eso. Prueba con economía, mercados, la luz, la gasolina, el tiempo o las noticias.</p>
				{/if}
			{/if}
		</div>
		<!-- Fuera del role=status: que no lo lea solo al cargar. -->
		{#if !busy && !msg && !reply}<p class="empty">{idle}</p>{/if}
		{#snippet note()}{LABEL}{/snippet}
	</Panel>
</div>

<style>
	.ask {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		padding: var(--sp-10) var(--pad-x);
	}

	/* Sin `disabled` (perdería el foco): se ve como desactivado. */
	.go[aria-disabled='true'] {
		background: var(--raise);
		color: var(--faint);
		cursor: default;
	}

	.examples :global(.row > button[aria-disabled='true']),
	.examples :global(.row > button[aria-disabled='true']:hover) {
		background: var(--panel);
		color: var(--faint);
		cursor: default;
	}

	.asked,
	.answer,
	.why {
		margin: 0;
		padding: 0 var(--pad-x);
		font-family: var(--sans);
		/* Una URL o una palabra larga, a la línea siguiente: si no, se sale del panel. */
		overflow-wrap: anywhere;
	}

	.asked {
		padding-top: var(--sp-10);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.answer {
		padding-top: var(--sp-6);
		padding-bottom: var(--sp-10);
		font-size: var(--fs-l);
		line-height: var(--lh-loose);
	}

	.why {
		padding-bottom: var(--sp-10);
		color: var(--faint);
		font-size: var(--fs-s);
	}

	.mini {
		border-top: var(--border);
	}
</style>
