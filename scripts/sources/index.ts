// Lista de todas las fuentes que descarga `pnpm data`.
import type { Source } from '../lib.ts';
import { air } from './air.ts';
import { alerts } from './alerts.ts';
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
import { hfpapers } from './hfpapers.ts';
import { holidays } from './holidays.ts';
import { ine } from './ine.ts';
import { newsSources } from './news.ts';
import { predictions } from './predictions.ts';
import { powerMix } from './ree-mix.ts';
import { reliefweb } from './reliefweb.ts';
import { releases } from './releases.ts';
import { sec } from './sec.ts';
import { uscurve, usdebt } from './treasury.ts';
import { water } from './water.ts';
import { wiki } from './wiki.ts';
import { crypto, hn, power, quakes, weather } from './world.ts';

export const sources: Source<any>[] = [
	// España
	fuel,
	fuelSpain,
	boe,
	power,
	powerMix,
	water,
	holidays,
	ine,
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
	sec,
	// Mundo
	quakes,
	quakesEs,
	hazards,
	reliefweb,
	predictions,
	weather,
	air,
	alerts,
	crypto,
	hn,
	hfpapers,
	releases,
	wiki,
	...newsSources
];
