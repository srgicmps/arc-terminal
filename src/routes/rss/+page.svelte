<!--
	RSS («Mis RSS», como Feedly): cada usuario añade sus feeds y aquí salen sus titulares juntos. La lista se guarda
	en su cuenta (/api/rss, cloud/rss.ts) y la Function lee los feeds por él, con caché y topes. Solo en
	arcterminal.dev, con cuenta: en local lo dice y no llama a nada.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import type { NewsItem } from '#lib/types.ts';

	const MAX = 20;
	const url = asset('api/rss' as Parameters<typeof asset>[0]);

	interface Feed {
		url: string;
		title: string;
		ok: boolean;
	}
	interface Item {
		feed: string;
		title: string;
		link: string;
		at: number | null;
	}

	let phase = $state<'loading' | 'none' | 'ready' | 'error'>('loading');
	let feeds = $state<Feed[]>([]);
	let items = $state<Item[]>([]);
	let msg = $state('');
	let busy = $state(false);

	const host = (u: string) => new URL(u).hostname.replace(/^www\./, '');

	async function load() {
		const res = await fetch(`${url}?items=1`, { cache: 'no-store', redirect: 'manual' });
		if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
		const body = (await res.json()) as { feeds: Feed[]; items: Item[] };
		feeds = body.feeds;
		items = body.items;
	}

	$effect(() => {
		// Sin cuenta (en local, por ejemplo): ni se intenta.
		if (new URL(url, location.href).pathname !== '/api/rss') {
			phase = 'none';
			return;
		}
		load()
			.then(() => (phase = 'ready'))
			.catch(() => (phase = 'error'));
	});

	async function save(next: string[]) {
		busy = true;
		msg = '';
		try {
			const res = await fetch(url, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ feeds: next }),
				redirect: 'manual'
			});
			if (res.status === 400) throw new Error('Esa dirección no vale: tiene que ser un feed público (https://…).');
			if (!res.ok) throw new Error('No se ha podido guardar. Prueba otra vez.');
			await load();
		} catch (e) {
			msg = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function add(raw: string) {
		const u = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		if (feeds.length >= MAX) msg = `Como mucho ${MAX} feeds.`;
		else void save([...feeds.map((f) => f.url), u]);
	}

	const names = $derived(new Map(feeds.map((f) => [f.url, f.title])));
	const news = $derived<NewsItem[]>(
		items.map((i) => ({
			title: i.title,
			url: i.link,
			source: names.get(i.feed) ?? host(i.feed),
			time: i.at ? new Date(i.at).toISOString() : null,
			summary: ''
		}))
	);
</script>

<ViewHeader code="RSS" title="Mis RSS" sub="Tus feeds, juntos y al día" />

{#if phase !== 'ready'}
	<div class="grid">
		<Panel title="Mis RSS">
			<p class="empty">
				{#if phase === 'loading'}Cargando…
				{:else if phase === 'none'}Mis RSS está en arcterminal.dev, con tu cuenta.
				{:else}No se han podido leer tus feeds. Recarga la página.{/if}
			</p>
		</Panel>
	</div>
{:else}
	<div class="grid grid-2">
		<Panel title="Titulares" meta={String(news.length)}>
			{#if news.length}
				<NewsList items={news} />
			{:else}
				<p class="empty">{feeds.length ? 'Tus feeds no traen titulares ahora mismo.' : 'Añade un feed para empezar.'}</p>
			{/if}
		</Panel>
		<Panel title="Tus feeds" meta="{feeds.length} de {MAX}">
			<ChipInput label="Añadir un feed" placeholder="https://… (RSS o Atom)" onadd={add} />
			{#if feeds.length}
				<ul class="mini">
					{#each feeds as f (f.url)}
						<li>
							<span class="l">{f.title}<small class:down={!f.ok}>{host(f.url)}{f.ok ? '' : ' · no responde'}</small></span>
							<button
								type="button"
								disabled={busy}
								aria-label="Quitar {f.title}"
								onclick={() => save(feeds.filter((x) => x.url !== f.url).map((x) => x.url))}>×</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			{#snippet note()}
				Pega la dirección del feed (RSS o Atom) de un blog o un medio. Se guarda en tu cuenta; se leen cada 15 min y
				solo se guardan titulares y enlaces. {busy ? 'Guardando…' : msg}
			{/snippet}
		</Panel>
	</div>
{/if}

<style>
	button {
		height: var(--control-h);
		min-width: var(--control-h);
		background: var(--bg);
		color: var(--muted);
		border: var(--border);
		font: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--fg);
	}
</style>
