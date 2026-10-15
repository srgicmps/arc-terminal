<script lang="ts">
	import EuPowerTable from '#lib/components/EuPowerTable.svelte';
	import FedProjections from '#lib/components/FedProjections.svelte';
	import FinancialStress from '#lib/components/FinancialStress.svelte';
	import { resolve } from '$app/paths';
	import BalanceSheets from '#lib/components/BalanceSheets.svelte';
	import HousingTable from '#lib/components/HousingTable.svelte';
	import ImfTable from '#lib/components/ImfTable.svelte';
	import IndeedPanel from '#lib/components/IndeedPanel.svelte';
	import LineChart from '#lib/components/LineChart.svelte';
	import MortgageCalc from '#lib/components/MortgageCalc.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import MeetingList from '#lib/components/MeetingList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PredictionList from '#lib/components/PredictionList.svelte';
	import RecessionSignals from '#lib/components/RecessionSignals.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { summaryLine, trend } from '#lib/summary.ts';
	import { compact, dm, nf, period, signed } from '#lib/format.ts';
	import { change, diffDays, last, seriesMap, spread } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Diferenciales de crédito de ICE BofA (FRED): id, nombre y color de la línea del gráfico.
	const CREDIT = [
		['hy-us', 'Alto rendimiento EE. UU.', '--amber'],
		['hy-eu', 'Alto rendimiento euro', '--muted'],
		['ig-us', 'Grado de inversión EE. UU.', '--faint']
	] as const;

	const get = $derived(seriesMap(data.eurostat, data.ecb, data.bls, data.usdebt, data.fred));
	const creditLines = $derived(
		CREDIT.flatMap(([id, label, color]) => {
			const points = get(id)?.points;
			return points?.length ? [{ label, color, points }] : [];
		})
	);
	const geos = ['es', 'ea', 'de', 'fr', 'it', 'pt'];
	const byGeo = (id: string) => geos.map((g) => ({ series: get(`${id}-${g}`), inverse: !id.startsWith('gdp') }));
	// Confianza: más es mejor (sube en verde) y una cifra decimal.
	const confidence = (id: string) => geos.map((g) => ({ series: get(`${id}-${g}`), decimals: 1 }));

	// EE. UU., Reino Unido, Japón y China, detrás de los europeos. EE. UU. sale de BLS (va al día); los demás, de
	// la OCDE vía DBnomics (oecd-g4) o de la inflación del G20, que van unos meses por detrás. Aparte de `get`
	// porque FRED ya tiene otro «gdp-us» (anualizado).
	const g4 = $derived(seriesMap(data.g4));
	const g20 = (code: string) => data.g20?.data.series.find((s) => s.id === `g20cpi-${code}`);
	const MAJORS = [
		{ geo: 'us', iso: 'usa', name: 'EE. UU.' },
		{ geo: 'gb', iso: 'gbr', name: 'Reino Unido' },
		{ geo: 'jp', iso: 'jpn', name: 'Japón' },
		{ geo: 'cn', iso: 'chn', name: 'China' }
	];
	const majors = $derived({
		unemployment: MAJORS.map((m) => ({ series: m.geo === 'us' ? get('unemployment-us') : g4(`unemployment-${m.geo}`), name: m.name, inverse: true })),
		inflation: MAJORS.map((m) => ({ series: m.geo === 'us' ? get('cpi-us') : g20(m.iso), name: m.name, decimals: 1, inverse: true })),
		gdp: MAJORS.map((m) => ({ series: g4(`gdp-${m.geo}`), name: m.name }))
	});

	// Primas de riesgo: diferencia con el bono alemán a 10 años, en puntos básicos.
	const PREMIUMS = [
		{ geo: 'es', name: 'España' },
		{ geo: 'it', name: 'Italia' },
		{ geo: 'fr', name: 'Francia' },
		{ geo: 'pt', name: 'Portugal' },
		{ geo: 'gr', name: 'Grecia' }
	];
	const premiums = $derived(
		PREMIUMS.map((p) => ({
			series: spread(get(`bond10-${p.geo}`), get('bond10-de'), `premium-${p.geo}`, `Prima de ${p.name}`),
			name: p.name,
			decimals: 0,
			inverse: true
		}))
	);
	const debtUs = $derived(last(get('debt-us')));

	// Prima de España a diario (Banco de España): último día hábil y cambio en una semana.
	const daily = $derived(seriesMap(data.bde));
	// Diferencial SOFR − IORB en pb: si el repo cobra más que las reservas en la Fed, falta liquidez.
	const sofrIorb = $derived(spread(get('sofr-us'), get('iorb-us'), 'sofr-iorb', 'SOFR − IORB'));
	const premiumDay = $derived(last(daily('premium-es-d')));
	const premiumWeek = $derived(diffDays(daily('premium-es-d'), 7));
	const headlines = $derived(data.news?.data.items ?? []);

	// Tira de arriba: inflación y paro de la zona euro y el tipo del BCE, con el dato anterior para comparar.
	const strip = $derived(
		[
			{ id: 'inflation-ea', label: 'Inflación zona euro', d: 1, inverse: true },
			{ id: 'unemployment-ea', label: 'Paro zona euro', d: 1, inverse: true },
			{ id: 'ecb-dfr', label: 'Tipo del BCE (depósito)', d: 2, inverse: null }
		].flatMap((x) => {
			const pts = get(x.id)?.points ?? [];
			const now = pts.at(-1);
			if (!now) return [];
			// El tipo del BCE es diario y casi nunca cambia: su «antes» es el último valor distinto (el último cambio).
			const prev = x.inverse === null ? pts.findLast((p) => p.v !== now.v) : pts.at(-2);
			const diff = prev ? now.v - prev.v : 0;
			// Paro e inflación: bajar es buena noticia. Un tipo de interés va sin color (ni bueno ni malo).
			const tone: 'up' | 'down' | 'flat' | undefined =
				x.inverse === null ? undefined : !diff ? 'flat' : (diff > 0) !== x.inverse ? 'up' : 'down';
			return [{ ...x, now, prev, tone }];
		})
	);
	const fedNow = $derived(last(get('fedfunds-us')));
	// Resumen en una línea (src/lib/summary.ts): inflación y paro de la zona euro y de EE. UU.
	const summary = $derived(
		summaryLine([
			trend('Inflación euro', get('inflation-ea')?.points),
			trend('paro euro', get('unemployment-ea')?.points),
			trend('IPC EE. UU.', get('cpi-us')?.points),
			trend('paro EE. UU.', get('unemployment-us')?.points)
		])
	);
</script>

<ViewHeader code="ECO" title="Economía y macro" sub="Eurostat, Banco Central Europeo, BLS, Tesoro de EE. UU. y FRED" {summary} />

{#if strip.length}
	<Tiles cols={3}>
		{#each strip as x (x.id)}
			<Tile
				label={x.label}
				value="{nf(x.now.v, x.d)} %"
				tone={x.tone}
				sub="{period(x.now.t)}{x.prev ? ` · ${x.inverse === null ? `hasta el ${dm(`${x.prev.t}T12:00:00Z`)}` : 'antes'} ${nf(x.prev.v, x.d)} %` : ''}{x.id === 'ecb-dfr' && fedNow ? ` · Fed ${nf(fedNow.v, 2)} %` : ''}"
			/>
		{/each}
	</Tiles>
{/if}

<div class="grid grid-2">
	<div class="col">
		<Panel title="Paro" meta="% de la población activa">
			<SeriesTable next={data.next} head="País" rows={[...byGeo('unemployment'), ...majors.unemployment]} />
			{#snippet note()}EE. UU.: BLS. Reino Unido y Japón: OCDE, vía DBnomics, con unos meses de retraso. China no publica una tasa comparable.{/snippet}
		</Panel>
		<Panel title="Inflación" meta="IPCA, variación anual">
			<SeriesTable next={data.next} head="País" rows={[...byGeo('inflation'), ...majors.inflation]} />
			{#snippet note()}EE. UU., Reino Unido, Japón y China: IPC nacional, no IPCA (el índice armonizado de la UE). EE. UU.: BLS; los demás: OCDE, vía DBnomics, con unos meses de retraso.{/snippet}
		</Panel>
		{#if data.g20}
			{@const g20 = data.g20}
			<Panel title="Inflación del G20" meta="IPC, variación anual">
				<SeriesTable
					head="País"
					rows={g20.data.series.map((series) => ({ series, name: series.label, decimals: 1, inverse: true }))}
					spark={12}
				/>
				{#snippet note()}
					Fuente: {g20.data.via === 'oecd' ? 'OCDE' : 'OCDE, vía DBnomics'} · <Updated at={g20.fetchedAt} source="oecd" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="PIB" meta="Variación trimestral">
			<SeriesTable next={data.next} head="País" rows={[...byGeo('gdp'), ...majors.gdp]} />
			{#snippet note()}EE. UU., Reino Unido, Japón y China: OCDE, vía DBnomics, con un trimestre de retraso · <Updated at={data.g4?.fetchedAt} source="oecd-g4" />{/snippet}
		</Panel>
		{#if get('gdp-yoy-es')}
			<Panel title="PIB interanual" meta="Frente al mismo trimestre del año anterior">
				<SeriesTable head="País" rows={byGeo('gdp-yoy')} />
			</Panel>
		{/if}
		<Panel title="Paro juvenil" meta="Menores de 25 años">
			<SeriesTable next={data.next} head="País" rows={byGeo('youth-unemployment')} />
		</Panel>
		<IndeedPanel series={data.indeed?.data.series ?? []} fetchedAt={data.indeed?.fetchedAt} />
		<Panel title="Deuda pública" meta="% del PIB">
			<SeriesTable next={data.next} head="País" rows={byGeo('debt')} />
			{#snippet note()}Fuente: Eurostat · <Updated at={data.eurostat?.fetchedAt} source="eurostat" />{/snippet}
		</Panel>
		{#if get('esi-ea')}
			<Panel title="Sentimiento económico" meta="Encuestas de la Comisión Europea · mensual">
				<SeriesTable head="ESI · 100 = media" rows={confidence('esi')} spark={12} />
				<SeriesTable head="Consumidor · saldo" rows={confidence('consumer-conf')} spark={12} />
				{#snippet note()}
					El ESI junta la confianza de industria, servicios, consumidores, comercio y construcción; por encima de 100, mejor
					que la media a largo plazo. La confianza del consumidor es el saldo entre optimistas y pesimistas, en puntos. Fuente:
					Eurostat · <Updated at={data.eurostat?.fetchedAt} source="eurostat" />
				{/snippet}
			</Panel>
		{/if}
		{#if data.fao?.data.series.length}
			{@const fao = data.fao}
			<Panel title="Precios de los alimentos" meta="Índice FAO · 2014–2016 = 100">
				<SeriesTable
					head="Índice"
					rows={fao.data.series.map((series) => ({ series, name: series.label, inverse: true }))}
					spark={36}
					pct
					extra={[{ head: 'Año', value: (s) => change(s, 12), unit: ' %', digits: 1 }]}
				/>
				{#snippet note()}
					Fuente: <a href="https://www.fao.org/worldfoodsituation/foodpricesindex/en/" target="_blank" rel="noopener">FAO</a>, precios
					internacionales en dólares · variación mensual y anual{fao.data.released ? ` · publicado el ${dm(fao.data.released)}` : ''} ·
					<Updated at={fao.fetchedAt} source="fao" />
				{/snippet}
			</Panel>
		{/if}
		{#if data.uncertainty?.data.series.length}
			{@const epu = data.uncertainty}
			<Panel title="Incertidumbre económica" meta="Índice EPU · 100 = media histórica">
				<SeriesTable head="Índice" rows={epu.data.series.map((series) => ({ series, name: series.label, inverse: true }))} spark={36} />
				{#snippet note()}
					Fuente: <a href="https://www.policyuncertainty.com/" target="_blank" rel="noopener">Economic Policy Uncertainty</a> (Baker,
					Bloom y Davis), menciones en prensa de la incertidumbre sobre la política económica ·
					<Updated at={epu.fetchedAt} source="uncertainty" />
				{/snippet}
			</Panel>
		{/if}
	</div>
	<div class="col">
		<Panel title="Próximas reuniones" meta="Decisión de tipos · hora de Madrid" jump={{ code: 'CAL', href: resolve('/cal') }}>
			<MeetingList
				markets={[
					...(data.predictions?.data.rates ?? []),
					...(data.predictions?.data.economy ?? []),
					...(data.predictions?.data.geopolitics ?? [])
				]}
			/>
			{#snippet note()}Calendarios oficiales del BCE y de la Fed. Probabilidades: Polymarket, apuestas y no pronósticos.{/snippet}
		</Panel>
		<Panel title="BCE" meta="Tipos y euríbor">
			<SeriesTable next={data.next}
				head="Tipo"
				rows={[
					{ series: get('ecb-dfr'), name: 'Facilidad de depósito', decimals: 2 },
					{ series: get('ecb-mro'), name: 'Refinanciación', decimals: 2 },
					{ series: get('estr'), name: '€STR', decimals: 3 },
					{ series: get('euribor-12m'), name: 'Euríbor 12 meses', decimals: 3 },
					{ series: get('mortgage-es'), name: 'Hipotecas nuevas España', decimals: 2, inverse: true },
					{ series: get('mortgage-ea'), name: 'Hipotecas nuevas zona euro', decimals: 2, inverse: true }
				]}
			/>
		</Panel>
		<Panel title="Lo que esperan los expertos" meta="Zona euro · encuesta SPF del BCE · %">
			<SeriesTable
				head="Previsión"
				rows={(['hicp', 'gdp', 'unem'] as const).flatMap((t) =>
					(['y0', 'y1', 'lt'] as const).map((h) => {
						const series = get(`spf-${t}-${h}`);
						return { series, name: series?.label, decimals: 1, inverse: t !== 'gdp' };
					})
				)}
			/>
			{#snippet note()}
				Media de unos 50 expertos, cada trimestre; la variación es la revisión frente a la encuesta anterior. Largo plazo: dentro
				de 5 años. Fuente: BCE · <Updated at={data.ecb?.fetchedAt} source="ecb" />
			{/snippet}
		</Panel>
		{#if data.housing}
			<Panel title="Vivienda en el mundo" meta="Precio, variación interanual">
				<HousingTable series={data.housing.data.series} />
				{#if get('mortgage30-us')}
					<SeriesTable head="EE. UU." rows={[{ series: get('mortgage30-us'), name: 'Hipoteca fija a 30 años', decimals: 2, inverse: true }]} />
				{/if}
				{#snippet note()}
					Real: descontada la inflación. Fuentes: BIS, precios de la vivienda; Freddie Mac vía FRED ·
					<Updated at={data.housing?.fetchedAt} source="housing" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Tu hipoteca" meta="Variable · euríbor a 12 meses">
			<MortgageCalc euribor={get('euribor-12m')} />
			{#snippet note()}Cuota con el último euríbor mensual del BCE más tu diferencial. Se calcula y se guarda solo en este navegador.{/snippet}
		</Panel>
		{#if data.imf?.data.rows.length}
			{@const imf = data.imf}
			<Panel title="Previsiones del FMI" meta="PIB real e inflación media · %">
				<ImfTable data={imf.data} />
				{#snippet note()}
					Fuente: FMI, World Economic Outlook ({imf.data.edition ?? 'WEO'}) ·
					<Updated at={imf.fetchedAt} source="imf" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Discursos de banqueros centrales" meta="Los más recientes">
			<NewsList items={data.speeches?.data.items ?? []} />
			{#snippet note()}Recopilados por el BIS · <Updated at={data.speeches?.fetchedAt} source="speeches" />{/snippet}
		</Panel>
		<Panel title="Bancos centrales" meta="Tipo oficial · último cambio" pin="pin:eco:bancos">
			<SeriesTable next={data.next}
				head="Banco"
				rows={(data.bis?.data.series ?? []).map((series) => ({ series, name: series.label, decimals: 2 }))}
			/>
			{#snippet note()}Fuente: BIS, tipos oficiales de los bancos centrales · <Updated at={data.bis?.fetchedAt} source="bis" />{/snippet}
		</Panel>
		<Panel title="Balances de los bancos centrales" meta="Total del activo y liquidez neta · semanal">
			<BalanceSheets
				rows={[
					{ name: 'BCE (Eurosistema)', series: get('ecb-balance'), currency: '€' },
					{ name: 'Reserva Federal', series: get('fed-balance'), currency: '$' },
					{ name: 'Fed: liquidez neta', series: get('fed-net-liquidity'), currency: '$' }
				]}
			/>
			{#snippet note()}
				Sube cuando el banco central compra deuda (QE, expansión cuantitativa) y baja cuando la deja vencer o la vende (QT).
				Liquidez neta: balance de la Fed menos la cuenta del Tesoro (TGA) y las repos inversas (RRP), dinero que está en la Fed pero no circula.
				Fuentes: BCE · <Updated at={data.ecb?.fetchedAt} source="ecb" /> y FRED · <Updated at={data.fred?.fetchedAt} source="fred" />
			{/snippet}
		</Panel>
		<Panel title="Bonos a 10 años" meta="Rentabilidad media mensual">
			<SeriesTable next={data.next}
				head="País"
				rows={[
					{ series: get('bond10-es'), decimals: 2 },
					{ series: get('bond10-de'), decimals: 2 },
					{ series: get('bond10-fr'), decimals: 2 },
					{ series: get('bond10-it'), decimals: 2 },
					{ series: get('bond10-pt'), decimals: 2 },
					{ series: get('bond10-gr'), name: 'Grecia', decimals: 2 }
				]}
			/>
			{#snippet note()}Fuente: BCE · <Updated at={data.ecb?.fetchedAt} source="ecb" />{/snippet}
		</Panel>
		<Panel title="Primas de riesgo" meta="Frente al bono alemán · pb">
			{#if premiumDay}
				{@const es = last(daily('bond10-es-d'))}
				{@const de = last(daily('bond10-de-d'))}
				<Tiles cols={3}>
					<Tile
						label="Prima de España"
						value="{nf(premiumDay.v, 0)} pb"
						tone={premiumWeek === null || Math.round(premiumWeek) === 0 ? undefined : premiumWeek > 0 ? 'down' : 'up'}
						sub="{period(premiumDay.t)}{premiumWeek === null ? '' : ` · ${signed(premiumWeek, 0)} pb en 7 días`}"
					/>
					<Tile label="Bono español 10A" value="{nf(es?.v, 2)} %" sub={es ? period(es.t) : ''} />
					<Tile label="Bono alemán 10A" value="{nf(de?.v, 2)} %" sub={de ? period(de.t) : ''} />
				</Tiles>
			{/if}
			<SeriesTable head="País" rows={premiums} spark={12} />
			{#snippet note()}
				{#if premiumDay}Arriba, el último día hábil: Banco de España · <Updated at={data.bde?.fetchedAt} source="bde" />.{' '}{/if}La tabla, diferencia de rentabilidad a 10 años con Alemania en media mensual. Fuente: BCE
			{/snippet}
		</Panel>
		<Panel title="EE. UU." meta="BLS y Tesoro">
			<SeriesTable next={data.next}
				head="Indicador"
				rows={[
					{ series: get('cpi-us'), name: 'Inflación (IPC)', inverse: true },
					{ series: get('core-cpi-us'), name: 'Inflación subyacente', inverse: true },
					{ series: get('unemployment-us'), name: 'Paro', inverse: true },
					{ series: get('payrolls-us'), name: 'Empleo creado (miles)', decimals: 0 }
				]}
			/>
			{#if debtUs}
				<ul class="mini">
					<li>
						<span class="l">Deuda pública total<small>{period(debtUs.t)}</small></span>
						<b>{compact(debtUs.v)} $</b>
					</li>
				</ul>
			{/if}
			{#snippet note()}Fuentes: BLS y Tesoro de EE. UU. · <Updated at={data.bls?.fetchedAt} source="bls" />{/snippet}
		</Panel>
		<Panel title="Fed y mercados" meta="EE. UU. · FRED">
			{#if data.fred}
				<SeriesTable next={data.next}
					head="Indicador"
					rows={[
						{ series: get('fedfunds-us'), name: 'Fondos federales', decimals: 2 },
						{ series: get('t10y2y-us'), name: 'Diferencial 10 a − 2 a', decimals: 2 },
						{ series: get('core-pce-us'), name: 'PCE subyacente, interanual', inverse: true },
						{ series: get('gdp-us'), name: 'PIB real, anualizado' },
						{ series: get('gdpnow-us'), name: 'GDPNow: PIB del trimestre en curso' },
						{ series: get('claims-us'), name: 'Peticiones de paro (miles)', decimals: 0, inverse: true },
						{ series: get('m2-us'), name: 'M2, interanual' },
						{ series: get('vix'), name: 'VIX', decimals: 1, inverse: true },
						{ series: get('wti'), name: 'Petróleo WTI ($)', decimals: 2 },
						{ series: get('dollar-broad'), name: 'Dólar, índice amplio', decimals: 1 }
					]}
				/>
			{:else}
				<p class="empty">{data.fredMissing}</p>
			{/if}
			{#snippet note()}
				Fuente: FRED, Fed de San Luis (usa su API sin estar respaldado por ella)
				{#if data.fred}· <Updated at={data.fred.fetchedAt} source="fred" />{/if}
			{/snippet}
		</Panel>
		{#if data.sep}<FedProjections data={data.sep} />{/if}
		{#if data.recession}<RecessionSignals data={data.recession} />{/if}
		{#if get('bankcredit-us') || get('consumercredit-us') || get('ccdelinq-us')}
			<Panel title="Crédito y morosidad en EE. UU." meta="FRED · bancos y consumo">
				<SeriesTable
					next={data.next}
					head="Indicador"
					rows={[
						{ series: get('bankcredit-us'), name: 'Crédito bancario, interanual', decimals: 1 },
						{ series: get('consumercredit-us'), name: 'Crédito al consumo, interanual', decimals: 1 },
						{ series: get('ccdelinq-us'), name: 'Morosidad de tarjetas', decimals: 2, inverse: true }
					]}
				/>
				{#snippet note()}
					Crédito bancario: préstamos e inversiones de todos los bancos comerciales (semanal). Crédito al consumo: el
					que tienen o han titulizado las familias (mensual). Morosidad: % de los saldos de tarjetas con retrasos
					(trimestral, desestacionalizada); si sube, más familias no llegan. Fuente: FRED, Fed de San Luis (usa su API
					sin estar respaldado por ella) · <Updated at={data.fred?.fetchedAt} source="fred" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Mercado monetario" meta="Tipos a corto plazo · zona euro y EE. UU.">
			<SeriesTable
				next={data.next}
				head="Tipo"
				rows={[
					{ series: get('estr'), name: '€STR (a un día)', decimals: 3 },
					{ series: get('euribor-3m'), name: 'Euríbor 3 meses', decimals: 3 },
					{ series: get('euribor-12m'), name: 'Euríbor 12 meses', decimals: 3 },
					{ series: get('sofr-us'), name: 'SOFR (repo a un día)', decimals: 2 },
					{ series: get('fedfunds-us'), name: 'Fondos federales (EFFR)', decimals: 2 },
					{ series: get('iorb-us'), name: 'Reservas en la Fed (IORB)', decimals: 2 },
					{ series: get('tbill3m-us'), name: 'Letra a 3 meses', decimals: 2 },
					{ series: sofrIorb, name: 'SOFR − IORB (pb)', decimals: 0, inverse: true }
				]}
			/>
			{#snippet note()}
				SOFR por encima de IORB es señal de tensión en la liquidez del dólar. Fuentes: BCE y FRED (Fed de San Luis)
			{/snippet}
		</Panel>
		{#if data.fred}
			<Panel title="Inflación esperada y tipos reales" meta="EE. UU. · mercado de bonos">
				<SeriesTable
					next={data.next}
					head="Indicador"
					spark={60}
					rows={[
						{ series: get('breakeven5-us'), name: 'Inflación esperada a 5 años', decimals: 2, inverse: true },
						{ series: get('breakeven10-us'), name: 'Inflación esperada a 10 años', decimals: 2, inverse: true },
						{ series: get('forward5y5y-us'), name: 'A 5 años, dentro de 5', decimals: 2, inverse: true },
						{ series: get('real10-us'), name: 'Tipo real a 10 años (TIPS)', decimals: 2 }
					]}
				/>
				{#snippet note()}
					Inflación esperada: diferencia entre el bono del Tesoro y el ligado a la inflación (TIPS) del mismo plazo.
					Fuente: FRED · <Updated at={data.fred?.fetchedAt} source="fred" />
				{/snippet}
			</Panel>
		{/if}
		{#if get('hy-us')}
			<Panel title="Diferenciales de crédito" meta="Bonos de empresa sobre la deuda pública · último año">
				<SeriesTable
					head="Bonos"
					spark={60}
					rows={CREDIT.map(([id, name]) => ({ series: get(id), name, decimals: 2, inverse: true }))}
					extra={[
						{ head: '7 días', value: (s) => diffDays(s, 7) },
						{ head: '1 año', value: (s) => diffDays(s, 365) }
					]}
				/>
				<LineChart lines={creditLines} unit=" %" height={160} />
				{#snippet note()}
					Diferencial ajustado por opciones (OAS), en puntos porcentuales: lo que pagan de más los bonos de empresa.
					Si sube, el mercado pide más prima por el riesgo de impago. Fuente: ICE Data Indices, LLC, vía FRED ·
					<Updated at={data.fred?.fetchedAt} source="fred" />
				{/snippet}
			</Panel>
		{/if}
		<FinancialStress ecb={data.stress.ecb} fred={data.stress.fred} />
		{#if data.gie?.data.series.length}
			<Panel title="Gas almacenado" meta="% de llenado · en puntos">
				<SeriesTable
					head="Zona"
					spark={90}
					rows={data.gie.data.series.map((series) => ({ series, name: series.label, decimals: 1 }))}
					extra={[
						{ head: '7 días', value: (s) => diffDays(s, 7) },
						{ head: '1 año', value: (s) => diffDays(s, 365) }
					]}
				/>
				{#snippet note()}Fuente: GIE AGSI+ · <Updated at={data.gie?.fetchedAt} source="gie" />{/snippet}
			</Panel>
		{/if}
		{#if data.eupower?.data.zones.length}
			<Panel title="Luz en Europa" meta="Mayorista · €/MWh · media del día" jump={{ code: 'LUZ', href: resolve('/luz') }}>
				<EuPowerTable zones={data.eupower.data.zones} />
				{#snippet note()}Fuentes: Energy-Charts / SMARD (Bundesnetzagentur), CC BY 4.0; España, Red Eléctrica · <Updated at={data.eupower?.fetchedAt} source="energycharts" />{/snippet}
			</Panel>
		{/if}
		{#if data.predictions?.data.economy.length}
			<Panel title="Lo que descuenta el mercado" meta="Polymarket">
				<PredictionList items={data.predictions.data.economy.slice(0, 6)} />
				{#snippet note()}Precios de mercados de predicción: reflejan apuestas, no pronósticos oficiales.{/snippet}
			</Panel>
		{/if}
		<Panel title="Titulares" meta={headlines.length > 25 ? `25 de ${headlines.length}` : 'Economía'} jump={{ code: 'NEWS', href: `${resolve('/news')}?s=eco` }}>
			<NewsList items={headlines.slice(0, 25)} />
		</Panel>
	</div>
</div>
