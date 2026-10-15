<!--
	Noticias de la app Sencilla: historias legibles, una debajo de otra (no una tabla). Cada una con el icono de su
	tema, el titular en español si hay traducción, de quién es y cuándo. Abre la noticia en el medio.
-->
<script lang="ts" module>
	export interface Story {
		title: string;
		url: string;
		source: string;
		/** ISO 8601 */
		time?: string | null;
		/** Clave de tema: geo, eco, ws, tech, ai, es… (elige el icono). */
		topic?: string;
		/** Cuántos medios lo cuentan. */
		count?: number;
	}
</script>

<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let { stories, big = false, label = true }: { stories: Story[]; big?: boolean; label?: boolean } = $props();

	const ICON: Record<string, IconName> = { geo: 'globe', eco: 'chart', ws: 'chart', tech: 'cpu', ai: 'spark', es: 'flag' };
	const TOPIC: Record<string, string> = { geo: 'Mundo', eco: 'Economía', ws: 'Bolsa', tech: 'Tecnología', ai: 'Inteligencia artificial', es: 'España' };
</script>

<ol class="stories" class:big>
	{#each stories as s (s.url)}
		<li>
			<a href={s.url} target="_blank" rel="noopener">
				<span class="ic t-{s.topic ?? 'x'}"><Icon name={ICON[s.topic ?? ''] ?? 'news'} /></span>
				<span class="txt">
					{#if label && s.topic && TOPIC[s.topic]}<span class="topic">{TOPIC[s.topic]}</span>{/if}
					<span class="title">{s.title}</span>
					<span class="meta">
						{s.source}{#if s.count && s.count > 1}&nbsp;y {s.count - 1} medios más{/if}{#if s.time}&nbsp;· {when(s.time, clock.now)}{/if}
					</span>
				</span>
			</a>
		</li>
	{/each}
</ol>

<style>
	.stories {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}

	li + li {
		border-top: var(--border);
	}

	a {
		display: flex;
		gap: var(--sp-14);
		align-items: flex-start;
		padding: var(--sp-14) 0;
		color: var(--fg);
		text-decoration: none;
	}

	.ic {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--app-icon-l);
		height: var(--app-icon-l);
		border-radius: var(--app-radius-s);
		background: var(--amber-soft);
		color: var(--amber);
	}

	.txt {
		display: grid;
		gap: var(--sp-3);
		min-width: 0;
	}

	.topic {
		color: var(--amber);
		font-size: var(--app-fs-small);
		font-weight: var(--fw-medium);
	}

	.title {
		font-size: var(--app-fs-body);
		font-weight: var(--fw-medium);
		line-height: var(--lh-snug);
	}

	.big .title {
		font-size: var(--app-fs-h2);
	}

	.meta {
		color: var(--muted);
		font-size: var(--app-fs-small);
	}
</style>
