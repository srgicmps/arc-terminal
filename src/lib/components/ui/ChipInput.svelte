<!--
	Lista editable de palabras o códigos: chips «X ×» (tocar uno lo quita), un campo y «Añadir».
	Todo a --control-h. Sin items, solo el campo y el botón (MIS, que tiene su propia lista ordenable).
	Uso: <ChipInput label="Añadir una palabra vigilada" items={words} onadd={addWord} onremove={removeWord} />
-->
<script lang="ts">
	interface Props {
		/** Nombre del campo para lectores de pantalla. */
		label: string;
		placeholder?: string;
		items?: string[];
		onadd: (value: string) => void;
		onremove?: (value: string) => void;
		/** Escribe en mayúsculas (códigos de valores). */
		upper?: boolean;
	}

	let { label, placeholder = '', items, onadd, onremove, upper = false }: Props = $props();
	let value = $state('');

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const v = value.trim();
		if (v) onadd(upper ? v.toUpperCase() : v);
		value = '';
	}
</script>

<form class="chip-input" onsubmit={submit}>
	{#each items ?? [] as item (item)}
		<button type="button" class="chip" onclick={() => onremove?.(item)} aria-label="Quitar «{item}»">
			{item} <span aria-hidden="true">×</span>
		</button>
	{/each}
	<input
		bind:value
		{placeholder}
		aria-label={label}
		enterkeyhint="done"
		spellcheck="false"
		autocapitalize={upper ? 'characters' : 'off'}
		class:upper
	/>
	<button type="submit" class="add">Añadir</button>
</form>

<style>
	.chip-input {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}

	.chip {
		height: var(--control-h);
		padding: 0 var(--sp-9);
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.chip span {
		color: var(--faint);
	}

	.chip:hover,
	.chip:focus-visible {
		border-color: var(--amber);
	}

	.chip:hover span,
	.chip:focus-visible span {
		color: var(--amber);
	}

	input {
		flex: 1 1 10em;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--raise);
		border: var(--border);
	}

	input.upper {
		text-transform: uppercase;
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.add {
		height: var(--control-h);
		padding: 0 var(--pad-x);
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.add:hover,
	.add:focus-visible {
		border-color: var(--amber);
	}
</style>
