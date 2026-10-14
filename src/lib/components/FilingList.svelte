<!--
	Lista compacta de documentos de una empresa (SEC, CNMV…): formulario, fecha y descripción con enlace.
	`strong` marca los formularios que merecen destacar (los 8-K, por ejemplo) en ámbar tenue.
-->
<script lang="ts">
	import { period } from '#lib/format.ts';

	interface Filing {
		form: string;
		/** «2026-10-14» */
		date: string;
		desc: string;
		url: string;
	}

	let { items, strong = () => false }: { items: Filing[]; strong?: (form: string) => boolean } = $props();

	const year = new Date().getFullYear();

	/** «14 oct», o «26 feb 25» si es de otro año. */
	function day(date: string): string {
		const y = Number(date.slice(0, 4));
		return y && y !== year ? `${period(date)} ${String(y).slice(2)}` : period(date);
	}
</script>

<ol class="filings">
	{#each items as f, i (f.url + i)}
		<li>
			<span class="form" class:strong={strong(f.form)}>{f.form}</span>
			<time datetime={f.date}>{day(f.date)}</time>
			<a href={f.url} target="_blank" rel="noopener">{f.desc}</a>
		</li>
	{/each}
</ol>

<style>
	.filings {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: 4.6em 4.4em minmax(0, 1fr);
		gap: var(--sp-10);
		align-items: baseline;
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}

	li:last-child {
		border-bottom: 0;
	}

	.form {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.form.strong {
		color: var(--amber);
		opacity: 0.8;
	}

	time {
		color: var(--faint);
		font-size: var(--fs-xs);
		white-space: nowrap;
	}

	a {
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-snug);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	a:hover {
		color: var(--amber);
	}
</style>
