// Client-side mirror of shared/src/games/landlord/properties.ts.
// Same 40 Lagos-themed tiles. Used for display rendering only — engine logic
// lives on the server.

export type LandlordPropertyType =
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'community'
  | 'tax'
  | 'corner';

export type LandlordGroup =
  | 'brown' | 'light-blue' | 'purple' | 'orange' | 'red'
  | 'yellow' | 'green' | 'blue' | 'railroad' | 'utility'
  | 'special' | 'corner';

export interface LandlordTile {
  id: number;
  position: number;
  name: string;
  type: LandlordPropertyType;
  group: LandlordGroup;
  price: number;
  /** Display-only base rent (rent[0]). */
  baseRent: number;
  /** Cost to build a house (Pass C). 0 if N/A. */
  housePrice: number;
  /** Mortgage value (Pass C). 0 if N/A. */
  mortgageValue: number;
  emoji: string;
}

const E: Record<LandlordGroup, string> = {
  brown: '🏚️',
  'light-blue': '🏘️',
  purple: '🏬',
  orange: '🏙️',
  red: '🏛️',
  yellow: '🏨',
  green: '🌴',
  blue: '🏝️',
  railroad: '🚆',
  utility: '⚡',
  special: '🎉',
  corner: '🟢',
};

const half = (n: number) => Math.floor(n / 2);

const HOUSE_PRICE_BY_GROUP: Partial<Record<LandlordGroup, number>> = {
  brown: 50, 'light-blue': 50,
  purple: 100, orange: 100,
  red: 150, yellow: 150,
  green: 200, blue: 200,
};

const make = (
  id: number,
  name: string,
  type: LandlordPropertyType,
  group: LandlordGroup,
  price: number,
  baseRent: number,
  emoji?: string,
): LandlordTile => {
  const housePrice = type === 'property' ? (HOUSE_PRICE_BY_GROUP[group] ?? 0) : 0;
  let mortgageValue = 0;
  if (type === 'property') mortgageValue = half(price);
  else if (type === 'railroad') mortgageValue = 100;
  else if (type === 'utility') mortgageValue = 75;
  return {
    id, position: id, name, type, group, price, baseRent,
    housePrice, mortgageValue, emoji: emoji ?? E[group],
  };
};

export const LANDLORD_BOARD: LandlordTile[] = [
  make(0, 'GO', 'corner', 'corner', 0, 0, '🟢'),
  make(1, 'Ojuelegba', 'property', 'brown', 60, 2),
  make(2, 'Community Pot', 'community', 'special', 0, 0, '🎁'),
  make(3, 'Mushin', 'property', 'brown', 60, 4),
  make(4, 'Income Tax', 'tax', 'special', 0, 200, '🧾'),
  make(5, 'Iddo Terminal', 'railroad', 'railroad', 200, 25),
  make(6, 'Yaba', 'property', 'light-blue', 100, 6),
  make(7, 'Owambe', 'chance', 'special', 0, 0, '⚠️'),
  make(8, 'Surulere', 'property', 'light-blue', 100, 6),
  make(9, 'Ebute Metta', 'property', 'light-blue', 120, 8),
  make(10, 'Just Visiting', 'corner', 'corner', 0, 0, '🔒'),
  make(11, 'Bariga', 'property', 'purple', 140, 10),
  make(12, 'Lagos Water Corp', 'utility', 'utility', 150, 0, '💧'),
  make(13, 'Gbagada', 'property', 'purple', 140, 10),
  make(14, 'Ojota', 'property', 'purple', 160, 12),
  make(15, 'Apapa Port', 'railroad', 'railroad', 200, 25, '🚢'),
  make(16, 'Ikeja', 'property', 'orange', 180, 14),
  make(17, 'Community Pot', 'community', 'special', 0, 0, '🎁'),
  make(18, 'Maryland', 'property', 'orange', 180, 14),
  make(19, 'Ogba', 'property', 'orange', 200, 16),
  make(20, 'Free Parking', 'corner', 'corner', 0, 0, '🅿️'),
  make(21, 'Festac Town', 'property', 'red', 220, 18),
  make(22, 'Owambe', 'chance', 'special', 0, 0, '⚠️'),
  make(23, 'Amuwo Odofin', 'property', 'red', 220, 18),
  make(24, 'Satellite Town', 'property', 'red', 240, 20),
  make(25, 'Murtala Airport', 'railroad', 'railroad', 200, 25, '✈️'),
  make(26, 'Magodo', 'property', 'yellow', 260, 22),
  make(27, 'Omole', 'property', 'yellow', 260, 22),
  make(28, 'Eko Electric', 'utility', 'utility', 150, 0, '⚡'),
  make(29, 'GRA Ikeja', 'property', 'yellow', 280, 24),
  make(30, 'Go to Kirikiri', 'corner', 'corner', 0, 0, '🚓'),
  make(31, 'Lekki Phase 1', 'property', 'green', 300, 26),
  make(32, 'Ajah', 'property', 'green', 300, 26),
  make(33, 'Community Pot', 'community', 'special', 0, 0, '🎁'),
  make(34, 'Chevron Drive', 'property', 'green', 320, 28),
  make(35, 'Tin Can Port', 'railroad', 'railroad', 200, 25, '🚢'),
  make(36, 'Owambe', 'chance', 'special', 0, 0, '⚠️'),
  make(37, 'Ikoyi', 'property', 'blue', 350, 35),
  make(38, 'Luxury Tax', 'tax', 'special', 0, 100, '💎'),
  make(39, 'Banana Island', 'property', 'blue', 400, 50),
];

export const BOARD_SIZE = LANDLORD_BOARD.length;

/** Tailwind class for the colored band at the top of a property tile. */
export const GROUP_BAND_CLASS: Record<LandlordGroup, string> = {
  brown: 'bg-amber-900',
  'light-blue': 'bg-sky-300',
  purple: 'bg-fuchsia-600',
  orange: 'bg-orange-500',
  red: 'bg-red-600',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-600',
  blue: 'bg-blue-700',
  railroad: 'bg-slate-700',
  utility: 'bg-zinc-400',
  special: 'bg-transparent',
  corner: 'bg-transparent',
};

export function tileAt(position: number): LandlordTile {
  const p = ((position % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return LANDLORD_BOARD[p];
}
