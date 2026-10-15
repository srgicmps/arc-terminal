<!--
	AVISOS: los avisos al móvil de cada usuario (ntfy). Se guardan en su cuenta (/api/alerts, cloud/alerts.ts);
	la Action los reparte (scripts/alerts/users.ts). Solo en Cloudflare (arcterminal.dev), donde hay cuenta:
	en GitHub Pages lo dice y no llama a nada. El canal (tema de ntfy) es secreto: solo se enseña aquí.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ButtonRow from '#lib/components/ui/ButtonRow.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { DEFAULT_CONFIG, GROUPS, MIS_MAX, parseConfig, type AlertConfig, type GroupId } from '#lib/alertconfig.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';

	const url = asset('api/alerts' as Parameters<typeof asset>[0]);

	let phase = $state<'loading' | 'none' | 'ready' | 'error'>('loading');
	let config = $state<AlertConfig>({ ...DEFAULT_CONFIG });
	let topic = $state<string | null>(null);
	let saving = $state(false);
	let saved = $state('');
	let confirmOff = $state(false);

	$effect(() => {
		// Sin cuenta (GitHub Pages, en local): ni se intenta.
		if (new URL(url, location.href).pathname !== '/api/alerts') {
			phase = 'none';
			return;
		}
		fetch(url, { cache: 'no-store', redirect: 'manual' })
			.then(async (res) => {
				if (!res.ok || !res.headers.get('content-type')?.includes('application/json'))
					throw new Error(String(res.status));
				const body = (await res.json()) as { config: unknown; topic: string | null };
				config = parseConfig(body.config);
				topic = body.topic;
				phase = 'ready';
			})
			.catch(() => (phase = 'error'));
	});

	async function save(next: AlertConfig, rotate = false) {
		saving = true;
		saved = '';
		try {
			const res = await fetch(url, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ config: next, rotate }),
				redirect: 'manual'
			});
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { config: unknown; topic: string | null };
			config = parseConfig(body.config);
			topic = body.topic;
			saved = 'Guardado';
		} catch {
			saved = 'No se ha podido guardar. Prueba otra vez.';
		} finally {
			saving = false;
		}
	}

	const set = (patch: Partial<AlertConfig>) => save({ ...config, ...patch });

	const LEVELS = [
		{ value: '1', label: 'Urgentes' },
		{ value: '2', label: '+ Importantes' },
		{ value: '3', label: '+ Interesantes' },
		{ value: '4', label: 'Todo' }
	];
	const DAILY = [5, 10, 20, 30, 50, 100];
	const groups = GROUPS.map((g) => ({ value: g.id, label: g.label }));

	/** Los valores de EE. UU. de tu MIS («NASDAQ:NVDA» → «NVDA»): los que se pueden vigilar. */
	const fromMis = $derived(
		watchlist.codes.flatMap((c) => {
			const [ex, sym] = c.includes(':') ? c.split(':') : ['', c];
			return (!ex || /^(NASDAQ|NYSE|AMEX|NYSEARCA)$/.test(ex)) && /^[A-Z0-9.]{1,12}$/.test(sym) ? [sym] : [];
		})
	);

	const subscribe = $derived(topic ? `https://ntfy.sh/${topic}` : '');
</script>

<ViewHeader code="AVISOS" title="Tus avisos" sub="Avisos al móvil con ntfy, a tu gusto" />

{#if phase !== 'ready'}
	<div class="grid">
		<Panel title="Tus avisos">
			<p class="empty">
				{#if phase === 'loading'}Cargando…
				{:else if phase === 'none'}Los avisos por usuario están en arcterminal.dev, con tu cuenta.
				{:else}No se ha podido leer tu configuración. Recarga la página.{/if}
			</p>
		</Panel>
	</div>
{:else}
	<div class="grid grid-2e">
		<div class="col">
			<Panel title="Qué te llega" meta={config.on ? 'Activados' : 'Apagados'} accent={config.on}>
				<dl class="form">
					<dt>Avisos</dt>
					<dd>
						<Seg
							label="Avisos"
							options={[
								{ value: 'on', label: 'Activados' },
								{ value: 'off', label: 'Apagados' }
							]}
							bind:value={() => (config.on ? 'on' : 'off'), (v) => set({ on: v === 'on' })}
						/>
					</dd>
					<dt>Temas</dt>
					<dd>
						<Seg
							label="Temas"
							options={groups}
							bind:values={() => config.groups, (v: GroupId[]) => set({ groups: v })}
						/>
					</dd>
					<dt>Hasta</dt>
					<dd>
						<Seg
							label="Nivel"
							options={LEVELS}
							bind:value={() => String(config.level), (v) => set({ level: Number(v) as AlertConfig['level'] })}
						/>
					</dd>
					<dt>Tope al día</dt>
					<dd>
						<Select label="Avisos al día" bind:value={() => String(config.daily), (v) => set({ daily: Number(v) })}>
							{#each DAILY as n (n)}<option value={String(n)}>{n}</option>{/each}
						</Select>
					</dd>
					<dt>Silencio</dt>
					<dd class="quiet">
						<Seg
							label="Silencio"
							options={[
								{ value: 'no', label: 'Sin silencio' },
								{ value: 'yes', label: 'De noche' }
							]}
							bind:value={
								() => (config.quiet ? 'yes' : 'no'),
								(v) => set({ quiet: v === 'yes' ? { from: '23:00', until: '07:30' } : null })
							}
						/>
						{#if config.quiet}
							<label
								>De <input
									type="time"
									value={config.quiet.from}
									onchange={(e) => set({ quiet: { from: e.currentTarget.value, until: config.quiet!.until } })}
								/></label
							>
							<label
								>a <input
									type="time"
									value={config.quiet.until}
									onchange={(e) => set({ quiet: { from: config.quiet!.from, until: e.currentTarget.value } })}
								/></label
							>
						{/if}
					</dd>
				</dl>
				{#snippet note()}
					Por defecto, lo mismo que recibe Sergi. En el silencio (hora de España) solo llegan los urgentes. {saving
						? 'Guardando…'
						: saved}
				{/snippet}
			</Panel>
			<Panel title="Tus valores" meta="{config.mis.length} de {MIS_MAX}">
				<ChipInput
					label="Añadir valor"
					placeholder="NVDA"
					upper
					items={config.mis}
					onadd={(s) => set({ mis: [...config.mis, s] })}
					onremove={(s) => set({ mis: config.mis.filter((x) => x !== s) })}
				/>
				<dl class="form">
					<dt>Los de Sergi</dt>
					<dd>
						<Seg
							label="Valores de Sergi"
							options={[
								{ value: 'yes', label: 'También' },
								{ value: 'no', label: 'Solo los míos' }
							]}
							bind:value={() => (config.baseStocks ? 'yes' : 'no'), (v) => set({ baseStocks: v === 'yes' })}
						/>
					</dd>
				</dl>
				{#if fromMis.length}
					<ButtonRow
						><button type="button" onclick={() => set({ mis: [...new Set([...config.mis, ...fromMis])] })}
							>Copiar los de MIS ({fromMis.length})</button
						></ButtonRow
					>
				{/if}
				{#snippet note()}Valores de EE. UU. (NVDA, AAPL…): aviso cuando se mueven fuerte en el día.{/snippet}
			</Panel>
		</div>
		<div class="col">
			<Panel title="En tu móvil">
				{#if !topic}
					<p class="empty">Activa los avisos y aquí saldrá tu canal.</p>
				{:else}
					<ol class="steps">
						<li>
							Instala <strong>ntfy</strong>:
							<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener"
								>Android</a
							>
							· <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">iPhone</a>.
						</li>
						<li>
							Abre <a href={subscribe} target="_blank" rel="noopener">tu canal</a> desde el móvil y pulsa «Subscribe», o
							en la app: «+» y pega <code>{topic}</code>.
						</li>
						<li>En la próxima pasada (unos 15 min) te llega «Arc Terminal conectado ✅».</li>
					</ol>
					<ButtonRow>
						<button type="button" disabled={saving} onclick={() => save(config, true)}>Canal nuevo</button>
						<button
							type="button"
							class:warn={confirmOff}
							onclick={() => (confirmOff ? set({ on: false }) : (confirmOff = true))}
							>{confirmOff ? '¿Seguro?' : 'Apagar'}</button
						>
					</ButtonRow>
				{/if}
				{#snippet note()}Tu canal es secreto: quien lo sepa puede leer tus avisos. No lo compartas; si se escapa, «Canal
					nuevo».{/snippet}
			</Panel>
		</div>
	</div>
{/if}

<style>
	.form {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--sp-6) var(--sp-12);
		align-items: center;
		margin: 0;
		padding: var(--row-y) var(--pad-x);
	}
	.form dt {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.form dd {
		margin: 0;
		min-width: 0;
	}
	.quiet {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		align-items: center;
	}
	.quiet label {
		display: flex;
		gap: var(--sp-4);
		align-items: center;
		font-size: var(--fs-s);
		color: var(--muted);
	}
	.quiet input {
		height: var(--control-h);
		background: var(--bg);
		color: var(--fg);
		border: var(--border);
		font: inherit;
		padding: 0 var(--sp-4);
	}
	.steps {
		margin: 0;
		padding: var(--row-y) var(--pad-x) var(--row-y) calc(var(--pad-x) + var(--sp-16));
		display: grid;
		gap: var(--sp-6);
	}
	.steps code {
		word-break: break-all;
		color: var(--amber);
	}
	@media (max-width: 640px) {
		.form {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
