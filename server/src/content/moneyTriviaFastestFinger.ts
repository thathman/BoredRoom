// Money Trivia — dedicated Fastest Finger ORDERING questions.
//
// Fastest Finger asks players to put four items in the correct order (chronological, numeric,
// alphabetical, size…). These are structurally different from the multiple-choice hot-seat bank,
// so they live here. Options are authored IN the correct order; the runtime shuffles the display
// and remembers the correct sequence. At least 15 per age band. Approved-only; the `order` field
// (and these questions) are stripped from public settings so the sequence never leaks.

import type { AgeBand, TriviaQuestion } from './moneyTriviaBank.js';

const W = 'https://en.wikipedia.org/wiki/';
const REVIEW_DATE = '2026-07-01';

// [prompt, [first, second, third, fourth] in correct order, category, sourceSlug, explanation]
type Row = [string, [string, string, string, string], string, string, string];

const PRE_TEEN: Row[] = [
  ['Order these numbers from smallest to largest', ['2', '5', '9', '14'], 'Maths', 'Natural_number', 'Ascending order.'],
  ['Order these from shortest to tallest', ['Ant', 'Cat', 'Human', 'Giraffe'], 'Animals', 'Giraffe', 'By typical height.'],
  ['Put these days in order starting from Monday', ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], 'General', 'Week', 'Order of the week.'],
  ['Order these from lightest to heaviest', ['Feather', 'Apple', 'Brick', 'Car'], 'Science', 'Mass', 'By mass.'],
  ['Order the alphabet letters', ['A', 'B', 'C', 'D'], 'Language', 'Alphabet', 'Alphabetical order.'],
  ['Order these meals through the day', ['Breakfast', 'Lunch', 'Dinner', 'Supper'], 'General', 'Meal', 'Order eaten in a day.'],
  ['Order these from coldest to hottest', ['Ice', 'Cold water', 'Warm water', 'Boiling water'], 'Science', 'Temperature', 'By temperature.'],
  ['Order these life stages', ['Baby', 'Child', 'Teenager', 'Adult'], 'Biology', 'Human_development_(biology)', 'By age.'],
  ['Order these Nigerian coins/notes by value (low to high)', ['₦5', '₦10', '₦50', '₦100'], 'Nigeria', 'Nigerian_naira', 'By denomination.'],
  ['Order these from fewest to most legs', ['Snake', 'Human', 'Dog', 'Spider'], 'Animals', 'Arthropod_leg', '0, 2, 4, 8 legs.'],
  ['Order these planets from the Sun outward', ['Mercury', 'Venus', 'Earth', 'Mars'], 'Science', 'Solar_System', 'By distance from the Sun.'],
  ['Order these numbers of sides (fewest first)', ['Triangle', 'Square', 'Pentagon', 'Hexagon'], 'Maths', 'Polygon', '3, 4, 5, 6 sides.'],
  ['Order these from morning to night', ['Sunrise', 'Noon', 'Sunset', 'Midnight'], 'General', 'Time', 'Through the day.'],
  ['Order these by number of wheels (fewest first)', ['Bicycle', 'Tricycle', 'Car', 'Lorry (6)'], 'General', 'Wheel', '2, 3, 4, 6 wheels.'],
  ['Order these seasons of the year (Jan first)', ['Harmattan', 'Dry season', 'Rainy season', 'Late rains'], 'Nigeria', 'Harmattan', 'Roughly through the Nigerian year.'],
];

const TEEN: Row[] = [
  ['Order these Nigerian leaders by time in office (earliest first)', ['Balewa', 'Gowon', 'Obasanjo (1976)', 'Buhari (1984)'], 'History', 'List_of_heads_of_state_of_Nigeria', 'By first term start.'],
  ['Order these events (earliest first)', ['Amalgamation 1914', 'Independence 1960', 'Civil War 1967', 'Fourth Republic 1999'], 'History', 'History_of_Nigeria', 'Chronological.'],
  ['Order these numbers smallest to largest', ['12', '48', '144', '1024'], 'Maths', 'Number', 'Ascending.'],
  ['Order these African countries by population (smallest first)', ['The Gambia', 'Ghana', 'Egypt', 'Nigeria'], 'Africa', 'List_of_African_countries_by_population', 'By population.'],
  ['Order these by distance from the Sun', ['Earth', 'Mars', 'Jupiter', 'Saturn'], 'Science', 'Solar_System', 'Outward from the Sun.'],
  ['Order these music eras (earliest first)', ['Highlife', 'Afrobeat', 'Hip-hop', 'Afrobeats'], 'Music', 'Music_of_Nigeria', 'By emergence.'],
  ['Order these lengths smallest to largest', ['Millimetre', 'Centimetre', 'Metre', 'Kilometre'], 'Science', 'Unit_of_length', 'By size.'],
  ['Order these Nigerian cities by latitude (south to north)', ['Port Harcourt', 'Lagos', 'Abuja', 'Kano'], 'Geography', 'Geography_of_Nigeria', 'Roughly south to north.'],
  ['Order these historical periods (earliest first)', ['Nok culture', 'Benin Empire', 'Colonial era', 'Independence'], 'History', 'Nok_culture', 'Chronological.'],
  ['Order these by boiling point (lowest first)', ['Nitrogen', 'Water', 'Iron', 'Tungsten'], 'Science', 'Boiling_point', 'By boiling point.'],
  ['Order these numbers of players (fewest first)', ['Singles tennis (1)', 'Basketball (5)', 'Football (11)', 'Rugby union (15)'], 'Sports', 'Team_sport', 'By players per side.'],
  ['Order these decades (earliest first)', ['1960s', '1980s', '2000s', '2020s'], 'History', 'Decade', 'Chronological.'],
  ['Order these currencies alphabetically', ['Cedi', 'Naira', 'Rand', 'Shilling'], 'Africa', 'Currency', 'Alphabetical.'],
  ['Order these by area (smallest first)', ['Lagos State', 'Nigeria', 'Africa', 'Earth'], 'Geography', 'Earth', 'By land area.'],
  ['Order these exam levels (earliest first)', ['Primary', 'JSS', 'SSS', 'University'], 'Education', 'Education_in_Nigeria', 'By stage.'],
];

const ADULT: Row[] = [
  ['Order these Nigerian republics (earliest first)', ['First Republic', 'Second Republic', 'Third Republic', 'Fourth Republic'], 'History', 'Politics_of_Nigeria', 'Chronological.'],
  ['Order these Nobel/achievements by year (earliest first)', ['Soyinka Nobel 1986', 'Okonjo-Iweala WTO 2021', 'Osimhen CAF 2023', 'None (2025)'], 'History', 'Wole_Soyinka', 'By year.'],
  ['Order these by atomic number (lowest first)', ['Hydrogen', 'Carbon', 'Iron', 'Gold'], 'Science', 'Atomic_number', '1, 6, 26, 79.'],
  ['Order these empires (earliest first)', ['Ghana Empire', 'Mali Empire', 'Songhai Empire', 'Sokoto Caliphate'], 'Africa', 'Mali_Empire', 'Chronological.'],
  ['Order these planets by size (smallest first)', ['Mercury', 'Mars', 'Earth', 'Jupiter'], 'Science', 'Solar_System', 'By diameter.'],
  ['Order these Nigerian censuses/eras (earliest first)', ['1914', '1960', '1999', '2015'], 'History', 'History_of_Nigeria', 'Chronological.'],
  ['Order these distances (smallest first)', ['Lagos–Ibadan', 'Lagos–Abuja', 'Lagos–Kano', 'Lagos–London'], 'Geography', 'Lagos', 'By distance.'],
  ['Order these by year founded (earliest first)', ['University of Ibadan (1948)', 'FESTAC (1977)', 'Nollywood boom (1990s)', 'Afrobeats global (2010s)'], 'Culture', 'University_of_Ibadan', 'Chronological.'],
  ['Order these SI prefixes (smallest first)', ['Milli', 'Centi', 'Kilo', 'Mega'], 'Science', 'Metric_prefix', 'By magnitude.'],
  ['Order these leaders by term start (earliest first)', ['Obasanjo (1999)', 'Yar’Adua (2007)', 'Jonathan (2010)', 'Buhari (2015)'], 'History', 'President_of_Nigeria', 'Fourth Republic order.'],
  ['Order these by boiling point (lowest first)', ['Helium', 'Nitrogen', 'Water', 'Iron'], 'Science', 'Boiling_point', 'By boiling point.'],
  ['Order these mountains by height (lowest first)', ['Chappal Waddi', 'Mount Cameroon', 'Mount Kenya', 'Kilimanjaro'], 'Africa', 'Mount_Kilimanjaro', 'By elevation.'],
  ['Order these mathematical constants (smallest first)', ['1 (unity)', 'φ 1.618', 'e 2.718', 'π 3.142'], 'Maths', 'Mathematical_constant', 'By value.'],
  ['Order these African lakes by area (smallest first)', ['Lake Chad', 'Lake Malawi', 'Lake Tanganyika', 'Lake Victoria'], 'Africa', 'Lake_Victoria', 'By area.'],
  ['Order these composers by birth year (earliest first)', ['Bach', 'Mozart', 'Beethoven', 'Verdi'], 'Music', 'List_of_classical_music_composers_by_era', 'Chronological.'],
];

const BANDS: Record<AgeBand, Row[]> = { pre_teen: PRE_TEEN, teen: TEEN, adult: ADULT };

export function buildFastestFingerBank(): TriviaQuestion[] {
  const out: TriviaQuestion[] = [];
  for (const [ageBand, rows] of Object.entries(BANDS) as [AgeBand, Row[]][]) {
    rows.forEach((row, i) => {
      const [prompt, options, category, slug, explanation] = row;
      out.push({
        id: `mtff-${ageBand}-${i + 1}`,
        prompt,
        options, // authored in correct order; runtime shuffles the display
        answer: 0, // unused for ordering
        // order defaults to ascending [0,1,2,3] in the runtime, matching the authored order.
        category,
        ageBand,
        difficulty: 8, // fastest finger sits mid-difficulty
        explanation,
        sourceUrl: `${W}${slug}`,
        reviewStatus: 'approved',
        reviewDate: REVIEW_DATE,
      });
    });
  }
  return out;
}

export const MONEY_TRIVIA_FF_SEED = buildFastestFingerBank();
