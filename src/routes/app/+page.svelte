<!--
	Inicio de la app Sencilla: un saludo, «Hoy en un minuto» (de 3 a 5 frases) y una tarjeta grande por pestaña:
	tu dinero, tu casa, el mundo y tus avisos. Cada una lleva a su pestaña con «Ver más».
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import AlertsSummary from '#lib/components/sencillo/AlertsSummary.svelte';
	import FactCard from '#lib/components/sencillo/FactCard.svelte';
	import HomeCards from '#lib/components/sencillo/HomeCards.svelte';
	import Section from '#lib/components/sencillo/Section.svelte';
	import Stories from '#lib/components/sencillo/Stories.svelte';
	import { place } from '#lib/place.svelte.ts';
	import { phrases } from '#lib/plain.ts';
	import { luzFact, weatherPhrase } from '#lib/sencillo/casa.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hour = $derived(clock.now ? Number(new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(clock.now)) : 9);
	const hello = $derived(hour < 6 || hour >= 21 ? 'Buenas noches' : hour < 14 ? 'Buenos días' : 'Buenas tardes');
	const today = $derived(
		clock.now ? new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(clock.now) : ''
	);

	const fact = (id: string) => data.money.facts.find((f) => f.id === id);
	const w = $derived(data.home.weather.find((p) => p.name === place.current.name) ?? data.home.weather[0]);
	// «Hoy en un minuto»: lo más importante, el tiempo, la luz y dos cifras del bolsillo, contadas en una frase cada una.
	const minute = $derived(
		phrases([
			data.important[0] && `Lo más importante de hoy: ${data.important[0].title.replace(/\.$/, '')}.`,
			w && weatherPhrase(w).replace(/^Ahora/, `En ${w.name}, ahora`),
			clock.now ? luzFact(data.home.pvpc, clock.now)?.phrase : null,
			fact('inflacion')?.phrase,
			fact('euribor')?.phrase
		]).slice(0, 5)
	);
</script>

<svelte:head>
	<title>Arc · Inicio</title>
</svelte:head>

<div class="home">
	<header class="hello">
		<p class="date">{today}</p>
		<h1>{hello}</h1>
	</header>

	<section class="minute" aria-labelledby="minute-h">
		<h2 id="minute-h">Hoy en un minuto</h2>
		{#if minute.length}
			<ul>
				{#each minute as p (p)}<li>{p}</li>{/each}
			</ul>
		{:else}
			<p>Todavía no hay datos de hoy. Vuelve en unos minutos.</p>
		{/if}
	</section>

	<div class="sections">
		<Section title="Tu dinero" icon="euro" href={resolve('/app/dinero')} card={false}>
			<div class="rail" data-noswipe>
				{#each data.money.facts.slice(0, 3) as f (f.id)}<div class="slot"><FactCard fact={f} /></div>{/each}
			</div>
		</Section>

		<Section title="Tu casa" icon="house" href={resolve('/app/casa')} card={false}>
			<HomeCards data={data.home} />
		</Section>

		<Section title="El mundo" icon="globe" href={resolve('/app/mundo')}>
			{#if data.important.length}
				<Stories stories={data.important} />
			{:else}
				<p class="mut">Aún no hay noticias de hoy.</p>
			{/if}
		</Section>

		<Section title="Tus avisos" icon="bell" href={resolve('/app/avisos')} more="Elegir">
			<AlertsSummary weather={data.home.alerts} />
		</Section>
	</div>
</div>

<style>
	.home {
		display: grid;
		gap: var(--sp-20);
	}

	.hello {
		display: grid;
		gap: var(--sp-2);
	}

	.date {
		margin: 0;
		color: var(--muted);
		font-size: var(--app-fs-small);
	}

	.date::first-letter {
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: var(--app-fs-h1);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-tight);
	}

	.minute {
		padding: var(--sp-18) var(--sp-20);
		border-radius: var(--app-radius);
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber-edge);
	}

	.minute h2 {
		margin: 0 0 var(--sp-8);
		color: var(--amber);
		font-size: var(--app-fs-h2);
	}

	.minute ul {
		margin: 0;
		padding-left: var(--sp-18);
		display: grid;
		gap: var(--sp-8);
	}

	.minute p {
		margin: 0;
	}

	.sections {
		display: grid;
		gap: var(--sp-16);
	}

	@media (min-width: 900px) {
		.sections {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}

		/* En el ordenador, las tarjetas de «Tu dinero» se apilan en vez de deslizarse. */
		.rail {
			grid-auto-flow: row;
			margin-inline: 0;
			padding-inline: 0;
			overflow: visible;
		}
	}

	/* Tarjetas en fila que se deslizan con el dedo (y se encajan una a una). */
	.rail {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(250px, 80%);
		gap: var(--sp-12);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		margin-inline: calc(-1 * var(--sp-16));
		padding-inline: var(--sp-16);
	}

	.rail::-webkit-scrollbar {
		display: none;
	}

	.slot {
		scroll-snap-align: center;
		display: grid;
	}

	.mut {
		color: var(--muted);
		margin: 0;
	}
</style>
