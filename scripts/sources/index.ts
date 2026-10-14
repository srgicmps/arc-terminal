// Lista de todas las fuentes que descarga `pnpm data`.
import type { Source } from '../lib.ts';
import { bls } from './bls.ts';
import { boe } from './boe.ts';
import { ecb } from './ecb.ts';
import { eurostat } from './eurostat.ts';
import { fedreg } from './fedreg.ts';
import { fuel } from './fuel.ts';
import { newsSources } from './news.ts';
import { uscurve, usdebt } from './treasury.ts';
import { crypto, hn, power, quakes, weather } from './world.ts';

export const sources: Source<any>[] = [
	// España
	fuel,
	boe,
	power,
	// Europa
	ecb,
	eurostat,
	// EE. UU.
	fedreg,
	bls,
	usdebt,
	uscurve,
	// Mundo
	quakes,
	weather,
	crypto,
	hn,
	...newsSources
];
