<!--
	App «Fondo de pantalla» de Arc OS: galería de fondos incluidos y vivos, color sólido, degradado y tus propias
	imágenes (arrastrar o elegir; se comprimen y se guardan en este navegador), cómo se colocan y qué parte se ve,
	fondo para todos los escritorios o solo para este, presentación que cambia sola y el fondo de la pantalla de
	bloqueo. La abre el clic derecho del escritorio («Cambiar fondo…»), el Panel de control y el buscador.
-->
<script lang="ts">
	import Seg from '#lib/components/ui/Seg.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { desk } from '../../os.svelte.ts';
	import { addImage, deleteImage, forgetUrl, imageUrl, listImages, type StoredImage } from './images.ts';
	import WallLayer from './WallLayer.svelte';
	import { activeSource, clearDesk, deskHasOwn, dropImage, loadWall, setLockSame, setShow, setSource, wall } from './wall.svelte.ts';
	import { FITS, PRESETS, SHOW_MINUTES, sameSource, type Fit, type WallSource } from './wall.ts';

	loadWall();

	let scope = $state<'all' | 'desk'>(deskHasOwn() ? 'desk' : 'all');
	const SCOPES = $derived([
		{ value: 'all', label: 'Todos los escritorios' },
		{ value: 'desk', label: `Solo «${desk().name}»` }
	] as const);

	const current = $derived(activeSource());
	const apply = (s: WallSource) => setSource(s, scope === 'desk');
	const isOn = (s: WallSource) => sameSource(s, current);

	// Color y degradado.
	let color = $state(current.kind === 'color' ? current.color : '#1d2430');
	let from = $state(current.kind === 'gradient' ? current.from : '#1d2430');
	let to = $state(current.kind === 'gradient' ? current.to : '#c99447');
	let angle = $state(current.kind === 'gradient' ? current.angle : 160);

	// Imágenes propias.
	let images = $state<StoredImage[]>([]);
	let thumbs = $state<Record<string, string>>({});
	let error = $state('');
	let busy = $state(false);
	let over = $state(false);
	async function refresh() {
		images = (await listImages()).sort((a, b) => b.added.localeCompare(a.added));
		const t: Record<string, string> = {};
		for (const i of images) t[i.id] = (await imageUrl(i.id, true)) ?? '';
		thumbs = t;
	}
	$effect(() => void refresh());

	async function add(files: FileList | File[] | null | undefined) {
		error = '';
		busy = true;
		let last: string | null = null;
		for (const f of Array.from(files ?? [])) {
			const r = await addImage(f);
			if ('error' in r) error = r.error;
			else last = r.id;
		}
		busy = false;
		await refresh();
		if (last) apply({ kind: 'image', img: last, fit: 'cover', x: 50, y: 50 });
	}
	async function remove(id: string) {
		await deleteImage(id);
		forgetUrl(id);
		dropImage(id);
		await refresh();
	}
	function drop(e: DragEvent) {
		e.preventDefault();
		over = false;
		add(e.dataTransfer?.files);
	}

	// Cómo se coloca la imagen actual y qué parte se ve (toca la vista previa).
	function setFit(fit: Fit) {
		if (current.kind === 'image') apply({ ...current, fit });
	}
	function focus(e: PointerEvent) {
		if (current.kind !== 'image') return;
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = Math.round(((e.clientX - r.left) / r.width) * 100);
		const y = Math.round(((e.clientY - r.top) / r.height) * 100);
		apply({ ...current, x, y });
	}
	let fit = $state<Fit>(current.kind === 'image' ? current.fit : 'cover');
	$effect(() => {
		if (current.kind === 'image' && current.fit !== fit) setFit(fit);
	});

	// Presentación.
	const inShow = (s: WallSource) => wall.cfg.show.list.some((x) => sameSource(x, s));
	function toggleShow(s: WallSource) {
		const list = inShow(s) ? wall.cfg.show.list.filter((x) => !sameSource(x, s)) : [...wall.cfg.show.list, s];
		setShow({ list });
	}
	let minutes = $state(String(wall.cfg.show.minutes));

	const preset = (id: (typeof PRESETS)[number]['id']): WallSource => ({ kind: 'preset', id });
	const imageSource = (id: string): WallSource => ({ kind: 'image', img: id, fit: 'cover', x: 50, y: 50 });
	const groups = ['Incluidos', 'Vivos'] as const;
</script>

<div class="app">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="preview" class:pick={current.kind === 'image'} onpointerdown={focus} title={current.kind === 'image' ? 'Toca para elegir qué parte se ve' : undefined}>
		<WallLayer source={current} preview />
		{#if current.kind === 'image' && current.fit !== 'tile' && current.fit !== 'center'}
			<i class="dot" style:left="{current.x}%" style:top="{current.y}%"></i>
		{/if}
	</div>

	<div class="row">
		<Seg label="Dónde se aplica" options={SCOPES} bind:value={scope} />
		{#if deskHasOwn()}<button type="button" class="btn" onclick={() => (clearDesk(), (scope = 'all'))}>Quitar el de este escritorio</button>{/if}
	</div>

	{#each groups as g (g)}
		<h3>{g}</h3>
		<ul class="tiles">
			{#each PRESETS.filter((p) => p.group === g) as p (p.id)}
				{@const s = preset(p.id)}
				<li>
					<button type="button" class="tile" aria-pressed={isOn(s)} onclick={() => apply(s)} title={'live' in p ? p.live : p.label}>
						<span class="mini"><WallLayer source={s} preview /></span>
						<span class="name">{p.label}</span>
					</button>
					<button type="button" class="add" aria-pressed={inShow(s)} onclick={() => toggleShow(s)} title={inShow(s) ? 'Quitar de la presentación' : 'Añadir a la presentación'}>{inShow(s) ? '✓' : '+'}</button>
				</li>
			{/each}
		</ul>
	{/each}

	<h3>Color y degradado</h3>
	<div class="row">
		<label class="field">Color <input type="color" bind:value={color} /></label>
		<button type="button" class="btn" onclick={() => apply({ kind: 'color', color })}>Usar color</button>
	</div>
	<div class="row">
		<label class="field">De <input type="color" bind:value={from} /></label>
		<label class="field">a <input type="color" bind:value={to} /></label>
		<label class="field">Ángulo <input type="range" min="0" max="360" step="15" bind:value={angle} /></label>
		<button type="button" class="btn" onclick={() => apply({ kind: 'gradient', from, to, angle })}>Usar degradado</button>
	</div>

	<h3>Tus imágenes</h3>
	<label
		class="drop"
		class:over
		ondragover={(e) => (e.preventDefault(), (over = true))}
		ondragleave={() => (over = false)}
		ondrop={drop}
	>
		<input type="file" accept="image/*" multiple onchange={(e) => add((e.currentTarget as HTMLInputElement).files)} />
		{busy ? 'Guardando…' : 'Arrastra aquí una imagen o toca para elegirla'}
	</label>
	{#if error}<p class="err" role="alert">{error}</p>{/if}
	{#if images.length}
		<ul class="tiles">
			{#each images as i (i.id)}
				{@const s = imageSource(i.id)}
				<li>
					<button type="button" class="tile" aria-pressed={current.kind === 'image' && current.img === i.id} onclick={() => apply(s)} title={i.name}>
						<span class="mini"><img src={thumbs[i.id]} alt="" /></span>
						<span class="name">{i.name}</span>
					</button>
					<button type="button" class="add" aria-pressed={inShow(s)} onclick={() => toggleShow(s)} title="Presentación">{inShow(s) ? '✓' : '+'}</button>
					<button type="button" class="del" onclick={() => remove(i.id)} aria-label="Borrar {i.name}" title="Borrar">×</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if current.kind === 'image'}
		<div class="row"><Seg label="Cómo se coloca" options={FITS} bind:value={fit} /></div>
	{/if}
	<p class="note">Se guardan comprimidas solo en este navegador: no se sincronizan con tu cuenta porque no caben. En otro dispositivo verás el fondo del aspecto hasta que la subas allí.</p>

	<h3>Presentación</h3>
	<div class="row">
		<label class="check"><input type="checkbox" checked={wall.cfg.show.on} onchange={(e) => setShow({ on: (e.currentTarget as HTMLInputElement).checked })} /> Cambiar de fondo sola</label>
		<Select label="Cada" bind:value={minutes} onchange={(v) => setShow({ minutes: Number(v) })}>
			{#each SHOW_MINUTES as m (m)}<option value={String(m)}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>{/each}
		</Select>
	</div>
	<p class="note">{wall.cfg.show.list.length < 2 ? 'Añade al menos dos fondos con «+».' : `${wall.cfg.show.list.length} fondos en la presentación.`}</p>

	<h3>Pantalla de bloqueo</h3>
	<label class="check"><input type="checkbox" checked={wall.cfg.lock} onchange={(e) => setLockSame((e.currentTarget as HTMLInputElement).checked)} /> Usar el mismo fondo que el escritorio</label>
</div>

<style>
	.app {
		height: 100%;
		overflow: auto;
		padding: var(--sp-12) var(--pad-x) var(--sp-24);
		font-family: var(--sans);
		font-size: var(--fs-m);
		color: var(--fg);
		background: var(--panel);
	}

	.preview {
		position: relative;
		aspect-ratio: 16 / 9;
		max-height: var(--os-wall-preview);
		margin: 0 auto var(--sp-12);
		border: var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.preview.pick {
		cursor: crosshair;
	}

	.dot {
		position: absolute;
		width: var(--sp-12);
		height: var(--sp-12);
		margin: calc(var(--sp-6) * -1) 0 0 calc(var(--sp-6) * -1);
		border: var(--hair) solid var(--fg);
		border-radius: 50%;
		background: var(--amber);
		pointer-events: none;
	}

	h3 {
		margin: var(--sp-16) 0 var(--sp-8);
		font-family: var(--title-font);
		font-size: var(--fs-title);
		color: var(--title-color);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		font-weight: var(--fw-medium);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		margin-bottom: var(--sp-8);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--os-wall-tile), 1fr));
		gap: var(--sp-8);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		width: 100%;
		padding: var(--sp-4);
		background: none;
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.tile[aria-pressed='true'] {
		border-color: var(--amber);
		background: var(--amber-soft);
	}

	.mini {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		border: var(--border);
		overflow: hidden;
	}

	.mini img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.name {
		font-size: var(--fs-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add,
	.del {
		position: absolute;
		top: var(--sp-8);
		width: var(--sp-20);
		height: var(--sp-20);
		padding: 0;
		border: var(--border);
		border-radius: 50%;
		background: var(--panel);
		color: var(--fg);
		font-size: var(--fs-xs);
		line-height: 1;
		cursor: pointer;
	}

	.add {
		right: var(--sp-8);
	}

	.add[aria-pressed='true'] {
		background: var(--amber);
		color: var(--bg);
	}

	.del {
		left: var(--sp-8);
	}

	.btn {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.field,
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	input[type='color'] {
		width: var(--control-h);
		height: var(--control-h);
		padding: 0;
		border: var(--border);
		background: none;
	}

	.drop {
		display: grid;
		place-items: center;
		min-height: var(--os-wall-drop);
		padding: var(--sp-12);
		border: var(--hair) dashed var(--line);
		border-radius: var(--radius);
		color: var(--muted);
		text-align: center;
		cursor: pointer;
	}

	.drop.over {
		border-color: var(--amber);
		background: var(--amber-soft);
	}

	.drop input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}

	.err {
		color: var(--down);
		font-size: var(--fs-s);
	}

	.note {
		margin: var(--sp-6) 0 0;
		font-size: var(--fs-xs);
		color: var(--muted);
	}
</style>
