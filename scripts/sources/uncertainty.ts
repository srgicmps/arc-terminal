// Incertidumbre económica (EPU, policyuncertainty.com): mundial mensual (.xlsx) y EE. UU. diario (.csv). Sin clave.
// Ver src/lib/uncertainty.ts. El riesgo geopolítico (GPR) solo se publica en .xls antiguo (binario), que
// scripts/xlsx.ts no lee: solo lee .xlsx.
import { epuSeries, EPU_URL, parseDailyEpu, parseGlobalEpu, type UncertaintyData } from '../../src/lib/uncertainty.ts';
import { getText, request, type Source } from '../lib.ts';
import { readXlsx } from '../xlsx.ts';

const GLOBAL = `${EPU_URL}media/Global_Policy_Uncertainty_Data.xlsx`;
const DAILY = `${EPU_URL}media/All_Daily_Policy_Data.csv`;

/** La primera hoja del .xlsx mundial. */
async function globalCells(): Promise<unknown[][]> {
	const [sheet] = readXlsx(await (await request(GLOBAL)).arrayBuffer(), (_, i) => i === 0);
	return sheet?.rows ?? [];
}

export const uncertainty: Source<UncertaintyData> = {
	name: 'uncertainty',
	label: 'Incertidumbre económica (EPU)',
	// El diario se actualiza una vez al día; el mundial, una vez al mes.
	maxAgeMinutes: 720,
	async fetch() {
		const [global, daily] = await Promise.all([
			globalCells().then(parseGlobalEpu),
			getText(DAILY).then(parseDailyEpu).catch(() => [])
		]);
		if (!global.length) throw new Error('el .xlsx del EPU mundial no trae datos');
		return { series: epuSeries(global, daily) };
	}
};
