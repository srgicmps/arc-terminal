<!--
	Bitácora (experiencia 10): tu diario de mercado. Escribes notas, ideas con su precio de entrada y
	recordatorios, cada una sobre un valor, una serie, un país o un tema. Las ideas se siguen solas con el
	precio de ahora. Todo vive en tu navegador (y en tu cuenta, si tienes): no lo ve nadie más.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import Change from '#lib/components/ui/Change.svelte';
	import Search from '#lib/components/ui/Search.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { madridDate } from '#lib/meetings.ts';
	import { queryWords } from '#lib/search.ts';
	import { dueReminders, filterEntries, ideaMove, MAX_TEXT, topics, type Entry, type Kind } from '#lib/exp/bitacora.ts';
	import { addToJournal, deleteFromJournal, initJournal, journal, toggleJournalDone } from '#lib/exp/bitacora.svelte.ts';
	import { priceOf, type Price } from '#lib/exp/prices.ts';

	const exp = EXPERIENCES.find((e) => e.id === 'bitacora')!;

	$effect(initJournal);

	const KINDS = [
		{ value: 'nota', label: 'Nota' },
		{ value: 'idea', label: 'Idea' },
		{ value: 'aviso', label: 'Recordatorio' }
	] as const;
	const SIDES = [
		{ value: 'larga', label: 'Que suba' },
		{ value: 'corta', label: 'Que baje' }
	] as const;
	const KIND_LABEL: Record<Kind, string> = { nota: 'Nota', idea: 'Idea', aviso: 'Recordatorio' };

	// Lo que se está escribiendo.
	let kind = $state<Kind>('nota');
	let about = $state('');
	let text = $state('');
	let price = $state('');
	let side = $state<'larga' | 'corta'>('larga');
	let due = $state('');

	const today = $derived(madridDate(clock.now || Date.now()));

	// Precios de ahora, por tema (en mayúsculas). undefined: sin pedir; null: no hay.
	let prices = $state<Record<string, Price | null>>({});
	function want(key: string) {
		const k = key.trim().toUpperCase();
		if (!k || k in prices) return;
		prices[k] = null;
		priceOf(k).then((p) => (prices[k] = p));
	}
	const priceFor = (key?: string) => (key ? prices[key.trim().toUpperCase()] ?? null : null);

	// Al escribir de qué va una idea, se propone su precio de ahora (se puede cambiar).
	let suggested = $state('');
	$effect(() => {
		if (kind !== 'idea') return;
		const k = about.trim();
		const t = setTimeout(() => want(k), 400);
		return () => clearTimeout(t);
	});
	$effect(() => {
		const p = priceFor(about);
		const v = p ? String(p.value) : '';
		if (kind === 'idea' && (price === '' || price === suggested)) price = v;
		suggested = v;
	});

	const ideas = $derived(journal.entries.filter((e) => e.kind === 'idea' && !e.done));
	$effect(() => ideas.forEach((e) => e.about && want(e.about)));

	const pending = $derived(dueReminders(journal.entries, today));

	let filter = $state<Kind | 'todo'>('todo');
	let query = $state('');
	const shown = $derived(filterEntries(journal.entries, filter, queryWords(query)));
	const themes = $derived(topics(journal.entries).slice(0, 12));

	const num = (s: string) => Number(s.replace(',', '.'));
	const valid = $derived(
		text.trim().length > 0 && (kind !== 'idea' || (num(price) > 0 && !!about.trim())) && (kind !== 'aviso' || !!due)
	);

	function submit(ev: SubmitEvent) {
		ev.preventDefault();
		if (!valid) return;
		addToJournal({
			kind,
			text: text.trim(),
			about: about.trim() || undefined,
			...(kind === 'idea' ? { price: num(price), side } : {}),
			...(kind === 'aviso' ? { due } : {})
		});
		text = '';
		if (kind !== 'nota') price = due = '';
	}

	// Borrar pide un segundo toque («¿Seguro?»): en el móvil es fácil tocar sin querer.
	let confirming = $state<string | null>(null);
	$effect(() => {
		if (!confirming) return;
		const t = setTimeout(() => (confirming = null), 4000);
		return () => clearTimeout(t);
	});
	function remove(id: string) {
		if (confirming !== id) return void (confirming = id);
		confirming = null;
		deleteFromJournal(id);
	}

	const fmtDate = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Europe/Madrid' });
	const fmtDay = (day: string) => fmtDate(`${day}T12:00:00Z`);
	const fmtNum = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: v < 10 ? 3 : 2 });
	const daysSince = (iso: string) => Math.max(0, Math.round(((clock.now || Date.now()) - Date.parse(iso)) / 86_400_000));
</script>

<ExpHeader {exp} sub="Notas, ideas que se siguen solas y recordatorios. Solo lo ves tú" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Escribir">
			<form class="write" onsubmit={submit}>
				<Seg label="Qué es" options={KINDS} bind:value={kind} />
				<label class="field">
					<span>De qué va</span>
					<input
						bind:value={about}
						maxlength="40"
						placeholder={kind === 'idea' ? 'NVDA, US10, BTC…' : 'Un valor, un país o un tema'}
						autocapitalize="off"
						spellcheck="false"
					/>
				</label>
				<label class="field">
					<span>{kind === 'idea' ? 'Por qué' : kind === 'aviso' ? 'Qué recordar' : 'Nota'}</span>
					<textarea bind:value={text} maxlength={MAX_TEXT} rows="3"></textarea>
				</label>
				{#if kind === 'idea'}
					<div class="row">
						<label class="field">
							<span>Precio de entrada</span>
							<input bind:value={price} inputmode="decimal" />
						</label>
						<Seg label="Apuestas a" options={SIDES} bind:value={side} />
					</div>
					{#if about.trim() && !priceFor(about)}
						<p class="hint">Sin precio automático para «{about.trim()}»: escribe tú el de entrada (no se podrá seguir sola).</p>
					{:else if priceFor(about)}
						<p class="hint">Ahora: {fmtNum(priceFor(about)!.value)} · {priceFor(about)!.label}</p>
					{/if}
				{:else if kind === 'aviso'}
					<label class="field">
						<span>Qué día</span>
						<input type="date" bind:value={due} min={today} />
					</label>
				{/if}
				<button class="save" type="submit" disabled={!valid}>Guardar</button>
			</form>
		</Panel>

		{#if pending.length}
			<Panel title="Para hoy" meta={String(pending.length)} accent>
				<ul class="todo">
					{#each pending as e (e.id)}
						<li>
							<button class="tick" type="button" onclick={() => toggleJournalDone(e.id)} aria-label="Hecho: {e.text}">✓</button>
							<span class="txt">{e.text}{#if e.about}<span class="mut"> · {e.about}</span>{/if}</span>
							<span class="mut">{e.due === today ? 'hoy' : fmtDay(e.due!)}</span>
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		<Panel title="Tus ideas" meta={ideas.length ? `${ideas.length} abiertas` : ''}>
			{#if ideas.length}
				<Table csv={false}>
					<thead>
						<tr><th>Idea</th><th>Entrada</th><th>Ahora</th><th>Desde que la anotaste</th><th></th></tr>
					</thead>
					<tbody>
						{#each ideas as e (e.id)}
							{@const p = priceFor(e.about)}
							{@const move = ideaMove(e, p?.value, p?.unit)}
							<tr>
								<td class="name" title={e.text}>{e.about}<span class="sub"> {e.side === 'corta' ? '↓' : '↑'} · hace {daysSince(e.at)} d</span></td>
								<td>{fmtNum(e.price!)}</td>
								<td>{p ? fmtNum(p.value) : '—'}</td>
								<td>{#if move}<Change value={move.value} unit={move.unit} />{:else}<span class="mut">sin precio</span>{/if}</td>
								<td><button class="link" type="button" onclick={() => toggleJournalDone(e.id)}>Cerrar</button></td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Anota una idea con su precio y aquí verás cómo va, sola.</p>
			{/if}
			{#snippet note()}Precio de ahora: valores de EE. UU. (Finnhub, cada 10 min) o series de G por su atajo (US10, BTC, WTI…).{/snippet}
		</Panel>
	</div>

	<div class="col">
		<Panel title="Diario" meta={String(journal.entries.length)}>
			<div class="tools">
				<Seg label="Mostrar" options={[{ value: 'todo', label: 'Todo' }, ...KINDS]} bind:value={filter} />
				<Search label="Buscar en la bitácora" placeholder="Buscar" bind:value={query} />
			</div>
			{#if themes.length > 1}
				<div class="themes">
					{#each themes as t (t.about)}
						<button type="button" class="theme" aria-pressed={query.toUpperCase() === t.about} onclick={() => (query = query.toUpperCase() === t.about ? '' : t.about)}>
							{t.about} <span>{t.n}</span>
						</button>
					{/each}
				</div>
			{/if}
			{#if shown.length}
				<ol class="entries">
					{#each shown as e (e.id)}
						<li class:done={e.done}>
							<div class="head">
								<span class="kind">{KIND_LABEL[e.kind]}</span>
								{#if e.about}<b>{e.about}</b>{/if}
								<time datetime={e.at}>{fmtDate(e.at)}</time>
								<button class="link del" type="button" onclick={() => remove(e.id)}>{confirming === e.id ? '¿Seguro?' : 'Borrar'}</button>
							</div>
							<p>{e.text}</p>
							{#if e.kind === 'idea'}
								<p class="mut">Entrada {fmtNum(e.price!)} · {e.side === 'corta' ? 'a que baje' : 'a que suba'}{e.done ? ' · cerrada' : ''}</p>
							{:else if e.kind === 'aviso'}
								<p class="mut">Para el {fmtDay(e.due!)}{e.done ? ' · hecho' : ''}</p>
							{/if}
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">{journal.entries.length ? 'Nada con ese filtro.' : 'Aún no has escrito nada.'}</p>
			{/if}
			{#snippet note()}Se guarda en este navegador y, si entras con tu cuenta, en ella: lo ves en todos tus dispositivos y nadie más.{/snippet}
		</Panel>
	</div>
</div>

<style>
	.write {
		display: grid;
		gap: var(--sp-10);
		padding: var(--sp-10) var(--pad-x);
	}
	.field {
		display: grid;
		gap: var(--sp-4);
		flex: 1 1 10em;
	}
	.field span {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.field input,
	.field textarea {
		min-width: 0;
		padding: var(--sp-4) var(--sp-10);
		background: var(--raise);
		border: var(--border);
		font: inherit;
		color: var(--fg);
	}
	.field input {
		height: var(--control-h);
	}
	.field textarea {
		resize: vertical;
		font-family: var(--sans);
		line-height: var(--lh);
	}
	.field input:focus,
	.field textarea:focus {
		outline: none;
		border-color: var(--amber);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--sp-10);
	}
	.hint {
		margin: 0;
		color: var(--faint);
		font-size: var(--fs-xs);
	}
	.save {
		justify-self: start;
		height: var(--control-h);
		padding: 0 var(--pad-x);
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		cursor: pointer;
	}
	.save:hover:not(:disabled),
	.save:focus-visible {
		border-color: var(--amber);
	}
	.save:disabled {
		color: var(--faint);
		border-color: var(--line);
		cursor: default;
	}
	.link {
		padding: 0;
		background: none;
		border: 0;
		color: var(--amber);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.tick {
		width: var(--control-h);
		height: var(--control-h);
		flex: none;
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		cursor: pointer;
	}
	.todo {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.todo li {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}
	.todo .txt {
		flex: 1;
		font-family: var(--sans);
	}
	.todo .mut {
		font-size: var(--fs-xs);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--pad-x) 0;
	}
	.themes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding: var(--sp-6) var(--pad-x) 0;
	}
	.theme {
		height: var(--control-h);
		padding: 0 var(--sp-9);
		background: none;
		border: var(--border);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.theme span {
		color: var(--faint);
	}
	.theme[aria-pressed='true'] {
		background: var(--amber-soft);
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.entries {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.entries li {
		padding: var(--sp-10) var(--pad-x);
		border-top: var(--border);
	}
	.entries li:first-child {
		margin-top: var(--sp-10);
	}
	.entries li.done {
		opacity: 0.6;
	}
	.entries .head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-6);
		font-size: var(--fs-xs);
	}
	.entries .kind {
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
	}
	.entries b {
		font-family: var(--mono);
	}
	.entries time {
		color: var(--faint);
	}
	.entries .del {
		margin-left: auto;
	}
	.entries p {
		margin: var(--sp-4) 0 0;
		font-family: var(--sans);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.entries p.mut {
		font-size: var(--fs-xs);
	}
	@media (pointer: coarse) {
		.link {
			min-height: var(--touch);
		}
	}
</style>
