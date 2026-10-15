<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Primer cron de deploy.yml en palabras: «7,22,37,52 * * * *» → cada 15 min.
	const cron = $derived(data.cron[0] ?? '');
	const every = $derived.by(() => {
		const m = cron.match(/^([\d,]+) \* \* \* \*$/);
		if (!m) return '';
		const minutes = m[1].split(',');
		return `cada ${60 / minutes.length} min (minutos ${minutes.join(', ')} de cada hora, UTC)`;
	});

	// Qué fuentes usa cada clave, sacado de status.json.
	const usedBy = (secret: string) =>
		data.sources
			.filter((s) => s.requires === secret)
			.map((s) => s.name)
			.join(', ');

	const age = (min?: number) => (min === undefined ? '—' : min < 60 ? `${min} min` : `${Math.round(min / 60)} h`);

	const VS: [string, string][] = [
		['$state', 'ref() / reactive()'],
		['$derived', 'computed()'],
		['$effect', 'watchEffect()'],
		['$props()', 'defineProps()'],
		['{#snippet} + {@render}', 'slots (<slot>, v-slot)'],
		['{#if} / {#each}', 'v-if / v-for'],
		['bind:value', 'v-model'],
		['+page.server.ts → load', 'pedir los datos antes de pintar (useAsyncData en Nuxt)']
	];

	const s = $derived(data.snippets);
	const examples = $derived(
		[
			{ title: '$state y $derived ≈ ref y computed', parts: [s.state, s.derived] },
			{ title: '$props ≈ defineProps', parts: [s.props] },
			{ title: '{@render} de un snippet ≈ <slot name="note">', parts: [s.snippet] },
			{ title: '$state en un .svelte.ts ≈ un composable con ref() o un store de Pinia', parts: [s.store] }
		].filter((e) => e.parts.every(Boolean))
	);

	// Piezas que cuidan los datos. Si un fragmento ya no está en el código, se oculta solo él.
	const pieces = $derived([
		{
			tag: 'Guardia',
			title: 'Datos vacíos o encogidos',
			text: 'Una API puede responder «200 OK» con la lista vacía. checkShrink lo trata como fallo y se publica la copia anterior. allowEmpty: la fuente puede venir vacía (avisos, alertas). minItems: mínimo para darla por buena.',
			file: 'scripts/lib.ts',
			code: s.shrink
		},
		{
			tag: 'Claves',
			title: 'Claves opcionales',
			text: 'Una fuente con requires necesita esa clave de GitHub Secrets. Si falta, se salta sin llamar a la API y STATUS la marca «Sin clave», sin contar como fallo.',
			file: 'scripts/lib.ts · src/routes/status',
			code: s.requires
		},
		{
			tag: 'Cluster',
			title: 'Titulares agrupados',
			text: 'La misma noticia en varios medios sale una vez. cluster compara las palabras de los titulares (Jaccard ≥ 0,5, menos de 12 h) y guarda los demás medios en also. NewsList los despliega con «+3 medios».',
			file: 'scripts/cluster.ts',
			code: s.cluster,
			extra: s.also
		}
	]);
</script>

<ViewHeader code="DOC" title="Cómo funciona" sub="Cómo está hecho Arc Terminal, de la descarga de datos a la pantalla" />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="1 · Arquitectura">
			<ul class="mini">
				<li>
					<span class="l">
						Cloudflare Pages sirve la web ya construida: HTML, JS, CSS y los JSON de datos, con Cloudflare Access
						delante (solo entra Sergi).
						<small>Las Actions la publican con <code>wrangler</code>; la URL está en <code>scripts/site.ts</code>.</small>
					</span>
					<b>Pages</b>
				</li>
				<li>
					<span class="l">
						GitHub Actions hace de servidor{#if every}: {every}{/if}. Descarga los datos, comprueba,
						construye y publica.
						<small>Pasos de <code>.github/workflows/deploy.yml</code>: {#each data.steps as step, i (i)}<code>{step}</code>{i < data.steps.length - 1 ? ' → ' : ''}{/each}</small>
					</span>
					<b>Actions</b>
				</li>
				<li>
					<span class="l">
						Las claves viven en GitHub Secrets y solo las ve la Action. Al navegador llegan los JSON ya descargados.
						{#each data.secrets as secret (secret)}
							<small><code>{secret}</code>{#if usedBy(secret)}{` → ${usedBy(secret)}`}{/if}</small>
						{/each}
					</span>
					<b>Secrets</b>
				</li>
				<li>
					<span class="l">
						Se instala en el móvil y funciona sin conexión. Al instalar solo guarda la build, los iconos y TOP; cada vista se guarda al abrirla (las últimas 40 copias, que sobreviven a las publicaciones). Páginas y datos: primero la red y, si no hay, la copia guardada; una vista nunca abierta cae en TOP. Con Cloudflare Access, /cdn-cgi/ no pasa por el service worker y, si la sesión caduca, no sirve copias viejas: recarga y lleva al login.
						<small><code>src/service-worker/index.ts</code> · <code>static/manifest.webmanifest</code></small>
					</span>
					<b>PWA</b>
				</li>
				<li>
					<span class="l">
						GitHub apaga los cron tras 60 días sin actividad: cada lunes otra Action los vuelve a activar.
						<small><code>.github/workflows/keepalive.yml</code></small>
					</span>
					<b>Cron</b>
				</li>
			</ul>
		</Panel>

		<Panel title="2 · Cómo viajan los datos" meta="Ejemplo: FUEL">
			<ul class="mini">
				<li>
					<span class="l">Cada fuente es un objeto <code>Source</code>: nombre, etiqueta, <code>maxAgeMinutes</code> y <code>fetch()</code>. La de Menorca pide la API del Ministerio y se queda con los códigos postales 077.
						<small><code>scripts/sources/fuel.ts</code></small></span>
					<b>1</b>
				</li>
				<li>
					<span class="l">Todas las fuentes, sin lista a mano: se descubren los archivos de la carpeta.<small><code>scripts/registry.ts</code></small></span>
					<b>2</b>
				</li>
				<li>
					<span class="l">
						<code>pnpm data</code> recorre la lista. Si la copia publicada es más reciente que <code>maxAgeMinutes</code>, la reutiliza; si la descarga falla, se queda con la anterior.
						<small><code>scripts/update.ts</code></small>
					</span>
					<b>3</b>
				</li>
				<li>
					<span class="l">Escribe un JSON por fuente y el resumen de todas.<small><code>static/data/fuel.json</code> · <code>static/data/status.json</code></small></span>
					<b>4</b>
				</li>
				<li>
					<span class="l">
						<code>dataset('fuel')</code> lee ese JSON al construir la web, en el <code>load</code> de <code>+page.server.ts</code>.
						<small><code>src/lib/data.ts</code></small>
					</span>
					<b>5</b>
				</li>
				<li>
					<span class="l">
						La función <code>load</code> elige lo que la vista pinta (y nada más): ese recorte va dentro del HTML y en <code>__data.json</code>, así el móvil no descarga los JSON enteros.
						{#if s.load}<small><code>{s.load.file}:{s.load.line}</code></small><!-- svelte-ignore a11y_no_noninteractive_tabindex (se puede desplazar con el teclado) --><pre tabindex="0" role="region" aria-label="Código de {s.load.file}"><code>{s.load.code}</code></pre>{/if}
					</span>
					<b>6</b>
				</li>
				<li>
					<span class="l">
						El componente los recibe en <code>data</code> con <code>$props()</code> y los pinta.
						<small><code>src/routes/fuel/+page.svelte</code></small>
					</span>
					<b>7</b>
				</li>
			</ul>
			{#snippet note()}
				Todas las vistas usan <code>+page.server.ts</code> en lugar de <code>+page.ts</code>: se ejecuta solo al construir
				y el navegador recibe el resultado ya recortado. Esta, además, lee el código del repo.
			{/snippet}
		</Panel>
	</div>

	<div class="col">
		<Panel title="3 · Fuentes" meta="{data.sources.length} fuentes">
			{#if data.sources.length}
				<Table>
					<thead><tr><th>Fuente</th><th class="l">Qué trae</th><th>Reutiliza</th></tr></thead>
					<tbody>
						{#each data.sources as src (src.name)}
							<tr>
								<td class="mut">{src.name}</td>
								<td class="l wrap">{src.label}{#if src.requires}<small>Clave {src.requires}</small>{/if}</td>
								<td class="mut">{age(src.maxAgeMinutes)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía: se generan con <code>pnpm data</code>.</p>
			{/if}
			{#snippet note()}
				Sale de <code>status.json</code>. «Reutiliza» es <code>maxAgeMinutes</code>: mientras la copia publicada sea más
				reciente, no se vuelve a llamar a la API. Como la Action pasa cada 15 min, una fuente de 12 min se descarga
				en cada pasada y una de 25, en una de cada dos. Estado en directo:
				<a href={resolve('/status')}>STATUS</a>.
			{/snippet}
		</Panel>

		<Panel title="4 · Svelte 5 frente a Vue 3">
			<Table>
				<thead><tr><th>Svelte 5</th><th class="l">Vue 3</th></tr></thead>
				<tbody>
					{#each VS as [svelte, vue] (svelte)}
						<tr><td><code>{svelte}</code></td><td class="l wrap">{vue}</td></tr>
					{/each}
				</tbody>
			</Table>
			<ul class="mini">
				{#each examples as ex (ex.title)}
					<li>
						<span class="l">
							{ex.title}
							{#each ex.parts as part (part!.line)}
								<small><code>{part!.file}:{part!.line}</code></small>
								<!-- svelte-ignore a11y_no_noninteractive_tabindex (se puede desplazar con el teclado) -->
								<pre tabindex="0" role="region" aria-label="Código"><code>{part!.code}</code></pre>
							{/each}
						</span>
					</li>
				{/each}
			</ul>
			{#snippet note()}
				Las runas ($state, $derived…) solo funcionan en archivos <code>.svelte</code> y <code>.svelte.ts</code>.
			{/snippet}
		</Panel>

		<Panel title="5 · Cuidar los datos" meta="3 piezas">
			<ul class="mini">
				{#each pieces as p (p.tag)}
					<li>
						<span class="l">
							{p.title}. {p.text}
							<small><code>{p.file}</code></small>
							{#each [p.code, p.extra].filter(Boolean) as part (part!.file + part!.line)}
								<small><code>{part!.file}:{part!.line}</code></small>
								<!-- svelte-ignore a11y_no_noninteractive_tabindex (se puede desplazar con el teclado) -->
								<pre tabindex="0" role="region" aria-label="Código"><code>{part!.code}</code></pre>
							{/each}
						</span>
						<b>{p.tag}</b>
					</li>
				{/each}
			</ul>
			{#snippet note()}
				Fragmentos copiados del código al construir: si cambian, esta vista cambia con ellos.
			{/snippet}
		</Panel>
	</div>
</div>

<style>
	code {
		font-family: var(--mono);
		font-size: var(--fs-s);
		color: var(--fg);
	}

	small code,
	:global(.pnote) code {
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	pre {
		margin: 0;
		overflow-x: auto;
		max-width: 100%;
	}

	pre code {
		color: var(--muted);
		line-height: var(--lh-loose);
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.wrap small {
		display: block;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}
</style>
