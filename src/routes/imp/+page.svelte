<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import AutoTag from '#lib/components/AutoTag.svelte';
	import TitleLang from '#lib/components/TitleLang.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { IMP_PERIODS, aggregate, minus, topImportant, type ImpTotal } from '#lib/imp.ts';
	import { NEWS_SECTIONS } from '#lib/news.ts';
	import { headlineList } from '#lib/titles.svelte.ts';
	import type { ImpCurrent, ImpEntry } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const imp = $derived(data.imp?.data);
	// La pestaña va en la URL (?periodo=semana…): un enlace o un favorito abre la misma.
	type Period = (typeof IMP_PERIODS)[number]['key'];
	const periodSel = urlState<Period>('periodo', 'day', (v) => IMP_PERIODS.some((p) => p.key === v));
	const period = $derived(periodSel.value);
	const span = $derived(IMP_PERIODS.find((p) => p.key === period)!.span);

	// Hoy: los 5 temas del día. Semana, mes y año: el histórico diario sumado (ver src/lib/imp.ts).
	const items = $derived<(ImpEntry | ImpTotal)[]>(
		!imp ? [] : period === 'day' ? topImportant(imp, 5) : aggregate(imp.days, imp.date, span, 10)
	);
	// Detalle de los temas que siguen en el top de ahora (secciones, confirmación oficial, Wikipedia).
	const live = $derived(new Map<string, ImpCurrent>((imp?.current ?? []).map((c) => [c.k, c])));
	const label: Record<string, string> = Object.fromEntries(NEWS_SECTIONS.map((s) => [s.key, s.label.toUpperCase()]));
	// Días del periodo de los que hay histórico (al principio, menos que los del periodo).
	const recorded = $derived(imp ? imp.days.filter((d) => d.date > minus(imp.date, span) && d.date <= imp.date).length : 0);

	// Titulares en español (ES / EN, titles.svelte.ts): de la Action o, si no, del navegador.
	const list = headlineList<string>(() => items);

	const periods = IMP_PERIODS.map((p) => ({ value: p.key, label: p.label }));
	const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
	const outlets = (s: string[]) => (s.length > 3 ? `${s.slice(0, 3).join(', ')} +${s.length - 3}` : s.join(', '));
</script>

<ViewHeader code="IMP" title="Lo más importante" sub="Lo que cuentan más medios, en más secciones y durante más tiempo; sin IA" />

<div class="controls">
	<Seg label="Periodo" options={periods} bind:value={periodSel.value} />
	{#if list.toggle}<TitleLang />{/if}
</div>

{#if !imp}
	<p class="empty">Sin datos todavía.</p>
{:else}
	<div class="grid">
		<div class="col">
			<Panel
				title={period === 'day' ? 'Hoy' : `Últimos ${span} días`}
				meta={period === 'day'
					? `${items.length} temas`
					: `${recorded} ${recorded === 1 ? 'día' : 'días'} con datos`}
			>
				{#if items.length}
					<ol class="imp">
						{#each items as item, i (item.k)}
							{@const now = period === 'day' ? live.get(item.k) : undefined}
							{@const t = list.link(item, item.k)}
							<li>
								<span class="rk">{i + 1}</span>
								<div>
									<a
										class="h"
										href={item.url}
										target="_blank"
										rel="noopener"
										lang={t.lang}
										title={t.title}
										{@attach list.press(item, item.k)}>{t.text}</a
									>
									<div class="m">
										{#each now?.sections ?? [] as s (s)}<span class="tag">{label[s] ?? s}</span>{/each}
										<span>{outlets(item.sources)}</span>
										{#if t.translated}<AutoTag {item} />{/if}
										{#if now?.official}<span class="ok">✓ {now.official}</span>{/if}
										{#if now?.wiki}<span class="ok">✓ Wikipedia</span>{/if}
										{#if 'days' in item}<span>{item.days} {item.days === 1 ? 'día' : 'días'}</span>{/if}
									</div>
								</div>
								<span class="pts" title="Puntuación">{fmt(item.score)}</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="empty">Sin temas en este periodo.</p>
				{/if}
				{#snippet note()}
					Puntos: 2 por cada medio más, 1,5 por cada sección más, hasta 4 por seguir vivo (1 cada 6 h) y 3 si lo
					confirma una fuente oficial o «In the news» de Wikipedia. Semana, mes y año suman los de cada día ·
					<Updated at={data.imp?.fetchedAt} source="imp" />
				{/snippet}
			</Panel>
		</div>
	</div>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-8);
		margin-bottom: var(--sp-12);
	}

	.imp {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.imp li {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) auto;
		gap: var(--sp-10);
		align-items: start;
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	.imp li:last-child {
		border-bottom: 0;
	}

	.rk {
		padding-top: var(--sp-3);
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.h {
		display: block;
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-tight);
		text-wrap: pretty;
	}

	.h:hover {
		color: var(--amber);
	}

	.h:visited {
		color: var(--muted);
	}

	.m {
		margin: var(--sp-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-8);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.tag {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
	}

	.ok {
		color: var(--faint);
	}

	.pts {
		padding-top: var(--sp-2);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		white-space: nowrap;
	}
</style>
