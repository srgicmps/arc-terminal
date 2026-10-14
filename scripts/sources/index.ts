// Lista de todas las fuentes que descarga `pnpm data`.
import type { Source } from '../lib.ts';
import { bls } from './bls.ts';
import { bis } from './bis.ts';
import { boe } from './boe.ts';
import { ecb } from './ecb.ts';
import { eurostat } from './eurostat.ts';
import { fedreg } from './fedreg.ts';
import { finnhub } from './finnhub.ts';
import { fred } from './fred.ts';
import { fuel, fuelSpain } from './fuel.ts';
import { hazards, quakesEs } from './hazards.ts';
import { newsSources } from './news.ts';
import { predictions } from './predictions.ts';
import { powerMix } from './ree-mix.ts';
import { uscurve, usdebt } from './treasury.ts';
import { wiki } from './wiki.ts';
import { crypto, hn, power, quakes, weather } from './world.ts';

export const sources: Source<any>[] = [
	// España
	fuel,
	fuelSpain,
	boe,
	power,
	powerMix,
	// Europa
	ecb,
	bis,
	eurostat,
	// EE. UU.
	fedreg,
	bls,
	usdebt,
	uscurve,
	fred,
	finnhub,
	// Mundo
	quakes,
	quakesEs,
	hazards,
	predictions,
	weather,
	crypto,
	hn,
	wiki,
	...newsSources
];
