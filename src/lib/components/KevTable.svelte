<!-- Vulnerabilidades explotadas (catálogo KEV de la CISA): fecha de alta, fabricante y producto, y el
     nombre con su CVE, que enlaza a la ficha del NVD. Marca discreta si se usa en campañas de ransomware. -->
<script lang="ts">
	import { dm } from '#lib/format.ts';
	import type { KevItem } from '#lib/types.ts';
	import Table from './ui/Table.svelte';

	let { items }: { items: KevItem[] } = $props();

	/**
	 * La CISA repite el fabricante y el producto al principio del nombre (ya están en su columna) y acaba
	 * casi siempre en «Vulnerability»: se quita lo uno y lo otro.
	 */
	function title(v: KevItem): string {
		const name = v.vulnerabilityName.replace(/\s+Vulnerability$/i, '');
		for (const prefix of [`${v.vendorProject} ${v.product}`, v.vendorProject]) {
			if (prefix && name.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
				const rest = name.slice(prefix.length + 1);
				return rest.charAt(0).toUpperCase() + rest.slice(1);
			}
		}
		return name;
	}
</script>

{#if items.length}
	<Table>
		<thead><tr><th>Fecha</th><th class="l">Fabricante</th><th class="l">Vulnerabilidad</th></tr></thead>
		<tbody>
			{#each items as v (v.cveID)}
				<tr>
					<td class="mut">{dm(`${v.dateAdded}T12:00:00Z`)}</td>
					<td class="l wrap">{v.vendorProject}<small>{v.product}</small></td>
					<td class="l wrap">
						<a href="https://nvd.nist.gov/vuln/detail/{v.cveID}" target="_blank" rel="noopener">{v.cveID}</a>
						<small>
							{title(v)}
							{#if v.ransomware}<span class="tag" title="La CISA sabe que se usa en campañas de ransomware">ransomware</span>{/if}
						</small>
					</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	td {
		vertical-align: top;
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-tight);
	}

	small {
		display: block;
		margin-top: var(--sp-2);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	a {
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-s);
		text-decoration: none;
	}

	a:hover {
		color: var(--amber);
	}

	.tag {
		margin-left: var(--sp-4);
		white-space: nowrap;
		padding: 0 var(--sp-4);
		border: var(--hair) solid var(--line);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}
</style>
