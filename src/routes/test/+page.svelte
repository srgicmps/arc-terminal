<!--
	TEST (F24): el test de la semana. Las preguntas llegan hechas (src/lib/quiz.ts); aquí se contestan y la
	puntuación se guarda en localStorage (clave arc-quiz), que se sincroniza con la cuenta de cada usuario.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { verdict } from '#lib/quiz.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const KEY = 'arc-quiz';
	type Saved = Record<string, { answers: number[]; score: number; total: number }>;

	const quiz = $derived(data.quiz);
	let saved = $state<Saved>({});
	// Como onMounted en Vue: se lee lo guardado solo en el navegador.
	$effect(() => {
		try {
			saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
		} catch {
			saved = {};
		}
	});

	const answers = $derived(saved[quiz.week]?.answers ?? quiz.questions.map(() => -1));
	const done = $derived(answers.filter((a) => a >= 0).length);
	const score = $derived(answers.filter((a, i) => a === quiz.questions[i]?.answer).length);
	const finished = $derived(quiz.questions.length > 0 && done === quiz.questions.length);
	const history = $derived(
		Object.entries(saved)
			.filter(([w, s]) => w !== quiz.week && s.total)
			.sort(([a], [b]) => b.localeCompare(a))
			.slice(0, 8)
	);

	function pick(i: number, option: number) {
		if (answers[i] >= 0) return;
		const next = answers.map((a, j) => (j === i ? option : a));
		const total = quiz.questions.length;
		const right = next.filter((a, j) => a === quiz.questions[j].answer).length;
		// Solo se guardan las 12 últimas semanas.
		const all = Object.fromEntries(Object.entries({ ...saved, [quiz.week]: { answers: next, score: right, total } }).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12));
		saved = all;
		try {
			localStorage.setItem(KEY, JSON.stringify(all));
		} catch {
			// Sin almacenamiento (modo privado): se juega igual, sin guardar.
		}
	}

	const weekLabel = (w: string) => `Semana ${Number(w.slice(6))} de ${w.slice(0, 4)}`;
</script>

<ViewHeader code="TEST" title="Test de la semana" sub="{weekLabel(quiz.week)} · {quiz.questions.length} preguntas con lo que ha pasado" plain={finished ? [`Has acertado ${score} de ${quiz.questions.length}. ${verdict(score, quiz.questions.length)}`] : ['Cinco preguntas sobre la semana. Toca la respuesta que creas correcta.']} />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Preguntas" meta={finished ? `${score} de ${quiz.questions.length}` : `${done} de ${quiz.questions.length} contestadas`}>
			{#if quiz.questions.length}
				<ol class="qs">
					{#each quiz.questions as q, i (q.id)}
						{@const chosen = answers[i]}
						<li>
							<p class="topic mut">{i + 1} · {q.topic}</p>
							<p class="q">{q.q}</p>
							<div class="opts" role="group" aria-label="Respuestas a la pregunta {i + 1}">
								{#each q.options as o, j (o)}
									<button
										type="button"
										class:right={chosen >= 0 && j === q.answer}
										class:wrong={chosen === j && j !== q.answer}
										disabled={chosen >= 0}
										aria-pressed={chosen === j}
										onclick={() => pick(i, j)}>{o}</button
									>
								{/each}
							</div>
							{#if chosen >= 0}
								<p class="why">
									<b class={chosen === q.answer ? 'ok' : 'mut'}>{chosen === q.answer ? 'Correcto.' : 'No.'}</b>
									{q.explain}
									{#if q.url}<a href={q.url} target="_blank" rel="noopener">Ver ›</a>{/if}
								</p>
							{/if}
						</li>
					{/each}
				</ol>
				{#if finished}<p class="final">{score} de {quiz.questions.length}: {verdict(score, quiz.questions.length)}</p>{/if}
			{:else}
				<p class="empty">Esta semana aún no hay datos para hacer preguntas.</p>
			{/if}
			{#snippet note()}Preguntas hechas sin IA con IMP, mercados (FRED, BCE, CoinGecko), terremotos (USGS) y deporte (DEP). Las mismas para todos hasta el domingo{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Tus semanas">
			{#if history.length || finished}
				<ul class="mini">
					{#if finished}<li><b>{weekLabel(quiz.week)}</b> <span class="mut">{score} de {quiz.questions.length}</span></li>{/if}
					{#each history as [w, s] (w)}
						<li>{weekLabel(w)} <span class="mut">{s.score} de {s.total}</span></li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Aquí irán tus puntuaciones.</p>
			{/if}
			{#snippet note()}Se guarda en tu cuenta: la ves en todos tus dispositivos{/snippet}
		</Panel>
	</div>
</div>

<style>
	.qs {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.qs li {
		padding: var(--row-y) var(--pad-x) var(--sp-10);
		border-bottom: var(--border);
	}

	.topic {
		margin: 0;
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.q {
		margin: var(--sp-4) 0 var(--sp-8);
		font-family: var(--sans);
	}

	.opts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--sp-6);
	}

	.opts button {
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--border);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		text-align: left;
		cursor: pointer;
	}

	.opts button:hover:not(:disabled) {
		border-color: var(--amber);
	}

	.opts button:disabled {
		cursor: default;
		color: var(--muted);
	}

	/* Verde y rojo son solo para subidas y bajadas: el acierto va en ámbar y el fallo, tachado. */
	.opts button.right {
		color: var(--amber);
		border-color: var(--amber);
	}

	.opts button.wrong {
		text-decoration: line-through;
	}

	.ok {
		color: var(--amber);
	}

	.why {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
	}

	.why a {
		color: var(--amber);
		text-decoration: none;
	}

	.final {
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		font-family: var(--sans);
	}
</style>
