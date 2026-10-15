<!--
	Franja de estado del aspecto «Mando», bajo el escritorio: «ARC · USO PRIVADO», los pilotos de las fuentes en
	vivo por grupo (mando.ts → feeds, de /data/status.json), cuántas van, el último aviso del sistema y la fecha.
	Tocar un piloto abre STATUS.
-->
<script lang="ts">
	import { when } from '#lib/format.ts';
	import * as os from './bridge.ts';
	import { dateTag, feeds, sourcesLive } from './mando.ts';
	import { wdata } from './widgetdata.svelte.ts';

	const HEALTH = { ok: 'en vivo', degradado: 'con copia o fallos', caido: 'caído', 'sin-datos': 'sin datos' } as const;
	const list = $derived(feeds(wdata.status));
	const count = $derived(sourcesLive(wdata.status));
	const msg = $derived(os.status());
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(id);
	});
</script>

<footer class="strip" aria-label="Estado del centro de mando">
	<span class="cls">ARC · USO PRIVADO</span>
	<ul class="feeds" aria-label="Fuentes en vivo">
		{#each list as f (f.id)}
			<li>
				<button type="button" data-health={f.health} title="{f.label}: {HEALTH[f.health]}{f.at ? ` · ${when(f.at, now)}` : ''}" onclick={() => os.navigate('/status')}>
					<i aria-hidden="true"></i>{f.label}<span class="sr">: {HEALTH[f.health]}</span>
				</button>
			</li>
		{/each}
	</ul>
	{#if count.total}<span class="n">FUENTES {count.live}/{count.total}</span>{/if}
	<span class="msg" role="status">{msg ?? ''}</span>
	<span class="date">{dateTag('Europe/Madrid', now)}</span>
</footer>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.strip {
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		height: var(--sp-24);
		padding: 0 var(--sp-10);
		background: var(--cmd-deck);
		border-top: var(--hair) solid var(--cmd-cold-dim);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		white-space: nowrap;
	}
	.cls {
		padding: 0 var(--sp-6);
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
	}
	.feeds {
		display: flex;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.feeds button {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 0 var(--sp-6);
	}
	@media (hover: hover) {
		.feeds button:hover {
			color: var(--fg);
		}
	}
	.feeds i {
		width: var(--sp-6);
		height: var(--sp-6);
		border-radius: 50%;
		background: var(--faint);
	}
	[data-health='ok'] i {
		background: var(--up);
		box-shadow: 0 0 var(--sp-4) var(--up);
	}
	[data-health='degradado'] i {
		background: var(--amber);
	}
	[data-health='caido'] i {
		background: var(--down);
	}
	.n {
		color: var(--cmd-cold);
	}
	.msg {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--amber);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (max-width: 700px) {
		.n,
		.date {
			display: none;
		}
	}
</style>
