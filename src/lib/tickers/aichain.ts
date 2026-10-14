// La cadena de la IA en bolsa (AI): de quién diseña los chips a quién da la electricidad a los centros de datos.
// Solo bolsas de EE. UU. (en los widgets de TradingView las de Corea, como SK Hynix, salen vacías).

export interface ChainLink {
	/** Nombre del eslabón: la pestaña del widget. */
	name: string;
	symbols: { tv: string; name: string }[];
}

export const AI_CHAIN: ChainLink[] = [
	{
		name: 'Chips',
		symbols: [
			{ tv: 'NASDAQ:NVDA', name: 'NVIDIA' },
			{ tv: 'NASDAQ:AMD', name: 'AMD' },
			{ tv: 'NASDAQ:AVGO', name: 'Broadcom' },
			{ tv: 'NASDAQ:ARM', name: 'Arm' }
		]
	},
	{
		name: 'Fabricación',
		symbols: [
			{ tv: 'NYSE:TSM', name: 'TSMC' },
			{ tv: 'NASDAQ:ASML', name: 'ASML' },
			{ tv: 'NASDAQ:AMAT', name: 'Applied Materials' },
			{ tv: 'NASDAQ:LRCX', name: 'Lam Research' }
		]
	},
	{ name: 'Memoria', symbols: [{ tv: 'NASDAQ:MU', name: 'Micron' }] },
	{
		name: 'Servidores y redes',
		symbols: [
			{ tv: 'NASDAQ:SMCI', name: 'Super Micro' },
			{ tv: 'NYSE:ANET', name: 'Arista Networks' },
			{ tv: 'NYSE:DELL', name: 'Dell' }
		]
	},
	{
		name: 'Energía',
		symbols: [
			{ tv: 'NYSE:VRT', name: 'Vertiv' },
			{ tv: 'NASDAQ:CEG', name: 'Constellation Energy' },
			{ tv: 'NYSE:ETN', name: 'Eaton' }
		]
	}
];
