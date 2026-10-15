<!--
	Centro de paquetes de Arc OS: todas las apps (vistas, experiencias, herramientas) y los widgets del escritorio,
	con «Instalar», «Quitar» y «Abrir». Una app quitada solo sale de los menús (packages.svelte.ts); los widgets se
	ponen y se quitan del escritorio con la misma API que el Panel de control (widgets.ts + setWidgets).
	A la izquierda, las categorías; arriba, el buscador; al pulsar una tarjeta, su ficha.
-->
<script lang="ts">
	import Search from '../../../components/ui/Search.svelte';
	import OsIcon from '../../icons/OsIcon.svelte';
	import { hasWords, queryWords } from '../../../search.ts';
	import { APPS, type AppProps } from '../../apps.ts';
	import { openApp, os } from '../../os.svelte.ts';
	import { installApp, isEssential, isInstalled, removeApp } from '../../packages.svelte.ts';
	import { setWidgets, shell } from '../../shell/shell.svelte.ts';
	import {
		addWidget,
		defaultWidgets,
		removeWidget,
		WIDGET_KINDS,
		WIDGET_LABEL,
		type WidgetKind
	} from '../../shell/widgets.ts';
	import Tool from '../kit/Tool.svelte';

	let { win }: AppProps = $props();

	type Kind = 'vista' | 'exp' | 'herramienta' | 'widget';
	interface Item {
		key: string;
		id: string;
		kind: Kind;
		name: string;
		/** Id del icono SVG (OsIcon). */
		icon: string;
		desc: string;
		code?: string;
	}

	const KIND_LABEL: Record<Kind, string> = {
		vista: 'Vista',
		exp: 'Experiencia',
		herramienta: 'Herramienta',
		widget: 'Widget'
	};

	// Icono SVG (OsIcon) de cada widget: el de la app que le corresponde.
	const WIDGET_ICON: Record<WidgetKind, string> = {
		reloj: 'reloj',
		cotizaciones: 'ws',
		tiempo: 'wx',
		titulares: 'news',
		luz: 'luz',
		manana: 'calendario',
		sistema: 'status',
		registro: 'registros',
		datos: 'monitor'
	};
	const WIDGET_DESC: Record<WidgetKind, string> = {
		reloj: 'La hora en varias ciudades del mundo',
		cotizaciones: 'Tus valores y los índices principales',
		tiempo: 'El tiempo de tu sitio',
		titulares: 'Los últimos titulares importantes',
		luz: 'Las horas más baratas de la luz',
		manana: 'Tu resumen del día',
		sistema: 'Salud de las fuentes de datos',
		registro: 'Lo último que ha pasado en el sistema',
		datos: 'Cuándo se descargaron los datos'
	};

	const ITEMS: Item[] = [
		...APPS.map((a): Item => ({
			key: `app:${a.id}`,
			id: a.id,
			kind: a.kind,
			name: a.name,
			icon: a.id,
			desc: a.desc,
			code: a.code
		})),
		...WIDGET_KINDS.map((k): Item => ({
			key: `w:${k}`,
			id: k,
			kind: 'widget',
			name: WIDGET_LABEL[k],
			icon: WIDGET_ICON[k],
			desc: WIDGET_DESC[k]
		}))
	].sort((a, b) => a.name.localeCompare(b.name, 'es'));

	const CATS = [
		{ id: 'todo', label: 'Todo' },
		{ id: 'vista', label: 'Vistas' },
		{ id: 'exp', label: 'Experiencias' },
		{ id: 'herramienta', label: 'Herramientas' },
		{ id: 'widget', label: 'Widgets del escritorio' },
		{ id: 'on', label: 'Instaladas' },
		{ id: 'off', label: 'Disponibles' }
	] as const;
	type Cat = (typeof CATS)[number]['id'];

	let cat = $state<Cat>('todo');
	let query = $state('');
	let selected = $state<string | null>(null);

	// Widgets: los guardados o, si aún no se ha tocado nada, los de por defecto (como el Panel de control).
	const widgets = $derived(shell.widgets ?? defaultWidgets(os.area.w, shell.skin));
	const installed = (it: Item) => (it.kind === 'widget' ? widgets.some((w) => w.kind === it.id) : isInstalled(it.id));
	const essential = (it: Item) => it.kind !== 'widget' && isEssential(it.id);

	function inCat(it: Item, c: Cat) {
		if (c === 'todo') return true;
		if (c === 'on') return installed(it);
		if (c === 'off') return !installed(it);
		return it.kind === c;
	}

	const words = $derived(queryWords(query));
	const shown = $derived(
		ITEMS.filter((it) => inCat(it, cat) && (!words.length || hasWords(`${it.name} ${it.desc} ${it.code ?? ''}`, words)))
	);
	const count = (c: Cat) => ITEMS.filter((it) => inCat(it, c)).length;
	const detail = $derived(selected ? ITEMS.find((it) => it.key === selected) : undefined);

	function setInstalled(it: Item, on: boolean) {
		if (it.kind === 'widget') {
			const k = it.id as WidgetKind;
			setWidgets(on ? addWidget(widgets, k, os.area.w) : removeWidget(widgets, k));
		} else if (on) installApp(it.id);
		else removeApp(it.id);
	}

	function pick(c: Cat) {
		cat = c;
		selected = null;
	}
</script>

{#snippet actions(it: Item)}
	{#if installed(it)}
		{#if it.kind !== 'widget'}<button type="button" class="main-btn" onclick={() => openApp(it.id)}>Abrir</button>{/if}
		{#if essential(it)}
			<span class="tag" title="Es parte del sistema: no se puede quitar">Del sistema</span>
		{:else}
			<button type="button" onclick={() => setInstalled(it, false)}>Quitar</button>
		{/if}
	{:else}
		<button type="button" class="main-btn" onclick={() => setInstalled(it, true)}>Instalar</button>
	{/if}
{/snippet}

<Tool {win}>
	<div class="wrap">
		<div class="pkg">
			<nav class="side" aria-label="Categorías">
				{#each CATS as c (c.id)}
					<button
						type="button"
						class:on={cat === c.id}
						aria-current={cat === c.id ? 'true' : undefined}
						onclick={() => pick(c.id)}
					>
						<span>{c.label}</span><span class="n">{count(c.id)}</span>
					</button>
				{/each}
			</nav>

			<section class="body">
				{#if detail}
					<button type="button" class="back" onclick={() => (selected = null)}
						>‹ {CATS.find((c) => c.id === cat)?.label}</button
					>
					<div class="detail">
						<span class="icon" aria-hidden="true"><OsIcon id={detail.icon} size={64} /></span>
						<div class="info">
							<h2>{detail.name}</h2>
							<p class="mut">
								{KIND_LABEL[detail.kind]}{#if detail.code}
									· <code>{detail.code}</code>{/if} · {installed(detail) ? 'Instalada' : 'Disponible'}
							</p>
							<div class="row">{@render actions(detail)}</div>
						</div>
					</div>
					<p class="desc">{detail.desc}</p>
					<p class="mut note">
						{#if detail.kind === 'widget'}
							Un widget instalado sale en el escritorio; se mueve arrastrándolo.
						{:else if essential(detail)}
							Es parte del núcleo de Arc OS y siempre está instalada.
						{:else}
							Quitar una app solo la saca del menú Inicio, el lanzador y el buscador. Sigue abriéndose por su comando{#if detail.code}
								({detail.code}){/if} o por su enlace.
						{/if}
					</p>
				{:else}
					<div class="q">
						<Search label="Buscar un paquete" placeholder="Buscar app o widget…" bind:value={query} />
					</div>
					{#if shown.length}
						<ul class="grid">
							{#each shown as it (it.key)}
								<li class="card">
									<button
										type="button"
										class="open"
										onclick={() => (selected = it.key)}
										aria-label="Ficha de {it.name}"
									>
										<span class="icon" aria-hidden="true"><OsIcon id={it.icon} size={40} /></span>
										<span class="txt">
											<span class="name">{it.name}</span>
											<span class="kind mut">{KIND_LABEL[it.kind]}</span>
										</span>
									</button>
									<p class="d mut">{it.desc}</p>
									<div class="row">{@render actions(it)}</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mut">Nada con «{query}» en {CATS.find((c) => c.id === cat)?.label.toLowerCase()}.</p>
					{/if}
				{/if}
			</section>
		</div>
	</div>
</Tool>

<style>
	.wrap {
		container-type: inline-size;
		min-height: 100%;
	}

	.pkg {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: var(--sp-16);
		min-height: 100%;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		border-right: var(--border);
		padding-right: var(--sp-8);
	}

	.side button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--sp-8);
		min-height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-s);
		text-align: left;
		color: var(--muted);
		background: none;
		border: 0;
		border-left: var(--hair) solid transparent;
		cursor: pointer;
	}

	.side button:hover {
		color: var(--fg);
		background: var(--raise);
	}

	.side button.on {
		color: var(--fg);
		background: var(--amber-soft);
		border-left-color: var(--amber);
	}

	.n {
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.body {
		min-width: 0;
	}

	.q {
		margin-bottom: var(--sp-12);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: var(--sp-8);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-10);
		border: var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}

	.card:hover {
		border-color: var(--amber-edge);
	}

	.open {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		padding: 0;
		font: inherit;
		text-align: left;
		color: var(--fg);
		background: none;
		border: 0;
		cursor: pointer;
	}

	.icon {
		flex: none;
		line-height: 0;
	}

	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-family: var(--sans);
		font-size: var(--fs-l);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kind {
		font-size: var(--fs-xs);
	}

	.d {
		flex: 1;
		margin: 0;
		font-size: var(--fs-s);
		line-height: var(--lh);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
	}

	.row button,
	.back {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		font: inherit;
		font-size: var(--fs-s);
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.row .main-btn {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	.row button:hover,
	.back:hover {
		background: var(--amber-soft);
	}

	.tag {
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.back {
		margin-bottom: var(--sp-12);
	}

	.detail {
		display: flex;
		gap: var(--sp-16);
		align-items: flex-start;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-family: var(--sans);
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}

	.info p,
	.desc,
	.note {
		margin: 0;
	}

	.desc {
		margin-top: var(--sp-16);
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh);
	}

	.note {
		margin-top: var(--sp-8);
		font-size: var(--fs-s);
	}

	.mut {
		color: var(--muted);
	}

	/* Estrecho (móvil o ventana pequeña): las categorías, en una fila que se desliza encima. */
	@container (max-width: 560px) {
		.pkg {
			grid-template-columns: 1fr;
			gap: var(--sp-12);
		}

		.side {
			flex-direction: row;
			overflow-x: auto;
			padding: 0 0 var(--sp-6);
			border-right: 0;
			border-bottom: var(--border);
		}

		.side button {
			flex: none;
			border-left: 0;
			border-bottom: var(--hair) solid transparent;
		}

		.side button.on {
			border-bottom-color: var(--amber);
		}

		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
