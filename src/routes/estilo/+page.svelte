<!-- ESTILO: elegir la estética (Terminal o Moderna). La lógica está en src/lib/taste.svelte.ts; el aspecto, en
	los tokens de src/styles/tokens.css ([data-style='modern']). «ESTILO moderna» llega con ?s=moderna. -->
<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import { parseStyle } from '#lib/taste.ts';
	import { setStyle, STYLES, taste } from '#lib/taste.svelte.ts';

	$effect(() => {
		const wanted = parseStyle(page.url.searchParams.get('s'));
		if (wanted && wanted !== taste.style) setStyle(wanted);
	});

	const about = {
		terminal: 'La de siempre, al estilo Bloomberg: fondo casi negro, letra monoespaciada, paneles pegados con líneas de 1 px y mucha información en poco sitio.',
		modern: 'Más fina y actual: paneles como tarjetas separadas, esquinas suaves, una sombra muy leve y la letra Inter, con las cifras alineadas.'
	};
</script>

<svelte:head><title>ESTILO · Arc Terminal</title></svelte:head>

<ViewHeader code="ESTILO" title="Estética" sub="Cambia el aspecto de toda la web" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Estética">
			<div class="pick">
				<Seg label="Estética" options={STYLES} bind:value={() => taste.style, setStyle} />
				<dl>
					{#each STYLES as s (s.value)}
						<dt class:on={taste.style === s.value}>{s.label}</dt>
						<dd>{about[s.value]}</dd>
					{/each}
				</dl>
			</div>
			<Note>Se combina con el tema de día o de noche (◐) y con el acento y la densidad de HELP, «A tu gusto».</Note>
		</Panel>
	</div>
</div>

<style>
	.pick {
		padding: var(--sp-10) var(--pad-x);
	}

	dl {
		margin: var(--sp-12) 0 0;
	}

	dt {
		font-weight: var(--fw-bold);
		color: var(--muted);
	}

	dt.on {
		color: var(--amber);
	}

	dd {
		margin: var(--sp-2) 0 var(--sp-10);
		font-family: var(--sans);
		line-height: var(--lh-text);
	}
</style>
