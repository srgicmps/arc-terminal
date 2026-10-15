<!--
	BIENVENIDA: tres preguntas (qué te interesa, tu ciudad, cómo lo quieres) y un resumen. Al montar, escribe tu
	portada, tu vista de inicio, una lista de valores de ejemplo y una propuesta de avisos (plan.ts) y arranca el
	recorrido (Tour). Sale sola la primera vez (TOP la abre con ?primera=1) y se repite desde HELP.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { COMMANDS } from '#lib/commands.ts';
	import { GROUPS } from '#lib/alertconfig.ts';
	import { locate, place, searchPlaces, setPlace, type Place } from '#lib/place.svelte.ts';
	import { routeHref } from '#lib/routes.ts';
	import { TOP_MODULES } from '#lib/topmodules.ts';
	import {
		applyPlan,
		buildPlan,
		findProfile,
		INTERESTS,
		PROFILES,
		readWelcome,
		SIMPLE_KEY,
		skipWelcome,
		WELCOME_KEY,
		type InterestId,
		type ProfileId
	} from '#lib/onboarding/plan.ts';
	import { startTour } from '#lib/onboarding/tour.svelte.ts';

	const STEPS = ['Qué te interesa', 'Tu ciudad', 'Cómo lo quieres', 'Listo'];
	let step = $state(0);
	let profile = $state<ProfileId | null>(null);
	let interests = $state<InterestId[]>([]);
	let simple = $state<'1' | '0'>('1');
	let again = $state(false);

	// Al abrir: lo que elegiste la otra vez. Si llegó sola (?primera=1) y tus ajustes ya la traían hecha (de tu
	// cuenta, en otro dispositivo), a la portada.
	$effect(() => {
		try {
			const w = readWelcome(localStorage.getItem(WELCOME_KEY));
			if (w && new URLSearchParams(location.search).has('primera')) {
				goto(resolve('/'), { replaceState: true });
				return;
			}
			if (w) {
				again = true;
				profile = w.profile;
				interests = [...w.interests];
			}
			if (localStorage.getItem(SIMPLE_KEY) === '0') simple = '0';
		} catch {}
	});

	function pickProfile(id: ProfileId) {
		profile = id;
		interests = [...findProfile(id)!.interests];
	}

	function toggle(id: InterestId) {
		interests = interests.includes(id) ? interests.filter((i) => i !== id) : [...interests, id];
		const p = findProfile(profile);
		if (p && (p.interests.length !== interests.length || p.interests.some((i) => !interests.includes(i)))) profile = null;
	}

	// Ciudad: buscar al escribir (pausa de 250 ms), como el chip «Tu sitio».
	let query = $state('');
	let results = $state<Place[]>([]);
	let status = $state('');
	$effect(() => {
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			status = '';
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			status = 'Buscando…';
			try {
				results = await searchPlaces(q, ctrl.signal);
				status = results.length ? '' : 'Sin resultados';
			} catch {
				if (!ctrl.signal.aborted) status = 'No se pudo buscar';
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	function choose(p: Place) {
		setPlace(p);
		query = '';
		results = [];
		step = 2;
	}

	async function useMyLocation() {
		status = 'Buscando tu ubicación…';
		try {
			choose(await locate());
			status = '';
		} catch (e) {
			status = e instanceof Error ? e.message : 'No se pudo';
		}
	}

	const plan = $derived(buildPlan(interests, profile, TOP_MODULES.map((m) => m.id), simple === '1'));
	const homeCmd = $derived(COMMANDS.find((c) => c.code === plan.home));
	const shown = $derived(plan.layout.order.filter((id) => !plan.layout.hidden.includes(id)));
	const titleOf = (id: string) => TOP_MODULES.find((m) => m.id === id)?.title ?? id;
	const groupLabel = (id: string) => GROUPS.find((g) => g.id === id)?.label ?? id;

	function finish() {
		try {
			applyPlan(localStorage, plan);
		} catch {}
		// La portada y las listas leen lo guardado al arrancar: se entra de nuevo con todo puesto.
		const href = homeCmd && homeCmd.code !== 'TOP' ? routeHref(homeCmd.route) : resolve('/');
		location.assign(href + '#recorrido');
	}

	function later() {
		try {
			skipWelcome(localStorage);
		} catch {}
		goto(resolve('/'), { replaceState: true });
	}
</script>

<ViewHeader code="BIENVENIDA" title={again ? 'Vuelve a ajustar Arc' : 'Bienvenido a Arc Terminal'} sub="Tres preguntas y Arc se ajusta a ti" />

<div class="wrap">
	<ol class="steps" aria-label="Pasos">
		{#each STEPS as s, i (s)}
			<li class:on={i === step} class:done={i < step} aria-current={i === step ? 'step' : undefined}>
				<button type="button" disabled={i > step} onclick={() => (step = i)}>{i + 1}. {s}</button>
			</li>
		{/each}
	</ol>

	{#if step === 0}
		<section aria-labelledby="q1">
			<h2 id="q1">¿Qué te interesa?</h2>
			<p class="lead">Elige un perfil ya hecho o marca los temas que quieras. Todo se puede cambiar después.</p>
			<div class="cards" role="radiogroup" aria-label="Perfiles">
				{#each PROFILES as p (p.id)}
					<button type="button" class="card" role="radio" aria-checked={profile === p.id} onclick={() => pickProfile(p.id)}>
						<strong>{p.label}</strong>
						<span>{p.desc}</span>
					</button>
				{/each}
			</div>
			<h3>O, tema a tema</h3>
			<div class="cards topics">
				{#each INTERESTS as i (i.id)}
					<button type="button" class="card" aria-pressed={interests.includes(i.id)} onclick={() => toggle(i.id)}>
						<strong>{i.label}</strong>
						<span>{i.hint}</span>
					</button>
				{/each}
			</div>
			<div class="actions">
				<button type="button" class="ghost" onclick={later}>Ahora no</button>
				<button type="button" class="go" onclick={() => (step = 1)}>{interests.length ? 'Siguiente' : 'Quiero verlo todo'}</button>
			</div>
		</section>
	{:else if step === 1}
		<section aria-labelledby="q2">
			<h2 id="q2">¿Dónde estás?</h2>
			<p class="lead">Para el tiempo, la hora y lo más cerca de ti. Ahora: <strong>{place.current.name}</strong>{place.current.country ? `, ${place.current.country}` : ''}.</p>
			<div class="search">
				<input type="search" placeholder="Escribe tu ciudad" aria-label="Tu ciudad" bind:value={query} />
				<button type="button" onclick={useMyLocation}>Usar mi ubicación</button>
			</div>
			{#if status}<p class="status" role="status">{status}</p>{/if}
			{#if results.length}
				<ul class="results">
					{#each results as r (`${r.lat},${r.lon}`)}
						<li><button type="button" onclick={() => choose(r)}>{r.name}<span>{[r.admin1, r.country].filter(Boolean).join(', ')}</span></button></li>
					{/each}
				</ul>
			{/if}
			<div class="actions">
				<button type="button" class="ghost" onclick={() => (step = 0)}>Atrás</button>
				<button type="button" class="go" onclick={() => (step = 2)}>Siguiente</button>
			</div>
		</section>
	{:else if step === 2}
		<section aria-labelledby="q3">
			<h2 id="q3">¿Cómo lo quieres?</h2>
			<Seg
				label="Modo"
				options={[
					{ value: '1', label: 'Sencillo' },
					{ value: '0', label: 'Terminal' }
				]}
				bind:value={simple}
			/>
			<p class="lead">
				{simple === '1'
					? 'Sencillo: menos cifras a la vez y una explicación corta de cada cosa. Ideal para empezar.'
					: 'Terminal: todo a la vista, denso, al estilo Bloomberg. Para quien ya sabe lo que busca.'}
			</p>
			<div class="actions">
				<button type="button" class="ghost" onclick={() => (step = 1)}>Atrás</button>
				<button type="button" class="go" onclick={() => (step = 3)}>Siguiente</button>
			</div>
		</section>
	{:else}
		<section aria-labelledby="q4">
			<h2 id="q4">Esto es lo que vamos a montar</h2>
			<dl class="summary">
				<dt>Al entrar</dt>
				<dd>{homeCmd ? `${homeCmd.code} · ${homeCmd.key}` : 'TOP · Portada'}</dd>
				<dt>Tu portada</dt>
				<dd>{plan.layout.hidden.length ? shown.map(titleOf).join(' · ') : 'La de siempre, completa'}</dd>
				<dt>Tus valores</dt>
				<dd>{plan.mis.length ? `${plan.mis.join(' · ')} (solo si tu lista está vacía)` : 'Ninguno por ahora (MIS)'}</dd>
				<dt>Avisos al móvil</dt>
				<dd>Te dejamos una propuesta en AVISOS: {plan.alerts.groups.map(groupLabel).join(' · ')}. Tú decides si la activas.</dd>
				<dt>Tu ciudad</dt>
				<dd>{place.current.name}</dd>
				<dt>Modo</dt>
				<dd>{simple === '1' ? 'Sencillo' : 'Terminal'}</dd>
			</dl>
			<p class="lead">Después, un recorrido de cinco pasos (te lo puedes saltar).</p>
			<div class="actions">
				<button type="button" class="ghost" onclick={() => (step = 2)}>Atrás</button>
				<button type="button" class="go" onclick={finish}>Montar mi Arc</button>
			</div>
		</section>
	{/if}

	<p class="foot">¿Solo quieres el recorrido? <button type="button" class="link" onclick={startTour}>Ver el recorrido</button></p>
</div>

<style>
	.wrap {
		max-width: 760px;
		padding: var(--sp-8) 0 var(--sp-24);
		font-family: var(--sans);
	}
	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-12);
		margin: 0 0 var(--sp-16);
		padding: 0;
		list-style: none;
		font: var(--fs-xs) var(--mono);
		letter-spacing: var(--track-code);
	}
	.steps button {
		padding: 0;
		font: inherit;
		color: var(--faint);
		background: none;
		border: 0;
		cursor: pointer;
	}
	.steps button:disabled {
		cursor: default;
	}
	.steps .done button {
		color: var(--muted);
	}
	.steps .on button {
		color: var(--amber);
	}
	h2 {
		margin: 0 0 var(--sp-6);
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--fg);
	}
	h3 {
		margin: var(--sp-18) 0 var(--sp-8);
		font: var(--fs-xs) var(--mono);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
	}
	.lead {
		margin: var(--sp-8) 0 var(--sp-14);
		font-size: var(--fs-l);
		line-height: var(--lh-loose);
		color: var(--muted);
	}
	.lead strong {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--hair);
		background: var(--line);
		border: var(--border);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-height: var(--touch);
		padding: var(--sp-12) var(--pad-x);
		text-align: left;
		font-family: var(--sans);
		color: var(--fg);
		background: var(--panel);
		border: 0;
		box-shadow: inset var(--sp-2) 0 0 transparent;
		cursor: pointer;
	}
	.card strong {
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}
	.card span {
		font-size: var(--fs-s);
		color: var(--muted);
	}
	.card:hover {
		background: var(--raise);
	}
	.card[aria-checked='true'],
	.card[aria-pressed='true'] {
		background: var(--raise);
		box-shadow: inset var(--sp-2) 0 0 var(--amber);
	}
	.card[aria-checked='true'] strong,
	.card[aria-pressed='true'] strong {
		color: var(--amber);
	}
	.search {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
	}
	input,
	.search button,
	.actions button {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		font: var(--fs-m) var(--mono);
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
	}
	input {
		flex: 1 1 200px;
		background: var(--panel);
	}
	input:focus {
		outline: none;
		border-color: var(--amber-edge);
	}
	.status {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
		color: var(--muted);
	}
	.results {
		margin: var(--sp-8) 0 0;
		padding: 0;
		list-style: none;
		border: var(--border);
	}
	.results li + li {
		border-top: var(--border);
	}
	.results button {
		display: flex;
		gap: var(--sp-8);
		align-items: baseline;
		width: 100%;
		min-height: var(--control-h);
		padding: var(--row-y) var(--pad-x);
		text-align: left;
		font: var(--fs-m) var(--sans);
		color: var(--fg);
		background: var(--panel);
		border: 0;
		cursor: pointer;
	}
	.results button:hover {
		background: var(--raise);
	}
	.results span {
		font-size: var(--fs-s);
		color: var(--muted);
	}
	.summary {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--sp-8) var(--sp-16);
		margin: var(--sp-8) 0 var(--sp-14);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}
	.summary dt {
		font: var(--fs-xs) var(--mono);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
		padding-top: var(--sp-2);
	}
	.summary dd {
		margin: 0;
		color: var(--fg);
	}
	@media (max-width: 720px) {
		.summary {
			grid-template-columns: 1fr;
			gap: var(--sp-2);
		}
		.summary dd {
			margin-bottom: var(--sp-8);
		}
	}
	.actions {
		display: flex;
		gap: var(--sp-8);
		margin-top: var(--sp-18);
	}
	.actions button {
		cursor: pointer;
	}
	.actions .ghost {
		margin-right: auto;
		color: var(--muted);
		background: none;
		border-color: transparent;
	}
	.actions .go {
		color: var(--on-amber);
		background: var(--amber);
		border-color: var(--amber);
	}
	.foot {
		margin: var(--sp-24) 0 0;
		font-size: var(--fs-s);
		color: var(--faint);
	}
	.link {
		padding: 0;
		font: inherit;
		color: var(--amber-dim);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: var(--sp-2);
	}
</style>
