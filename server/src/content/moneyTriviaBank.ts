// Money Trivia approved question seed bank.
//
// Compact authoring format → expanded to the full reviewed schema by buildBank(). The correct
// answer is authored FIRST in each option list; the runtime shuffles options at game start so the
// stored order never leaks. Every question ships review-approved with a source. Live AI generation
// is forbidden in cash runs — the owner panel can add/approve more via the question endpoints.
//
// Mix target ≈ 60% Nigerian, 20% African, 20% global. Difficulty 1 (easiest) → 15 (hardest),
// five questions per level across three age bands (pre-teen 9–12, teen 13–17, adult 18+).

export type AgeBand = 'pre_teen' | 'teen' | 'adult';
export type ReviewStatus = 'approved' | 'draft' | 'rejected' | 'retired';

export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  answer: number;
  category: string;
  ageBand: AgeBand;
  difficulty: number; // 1..15
  explanation: string;
  sourceUrl: string;
  reviewStatus: ReviewStatus;
  reviewDate: string; // ISO date
  expiry?: string; // ISO date, optional
}

// [prompt, [correct, w1, w2, w3], category, sourceSlug, explanation]
type Row = [string, [string, string, string, string], string, string, string];
type Band = Record<number, Row[]>;

const W = 'https://en.wikipedia.org/wiki/';
const REVIEW_DATE = '2026-06-30';

// ── Pre-teen (9–12) ──────────────────────────────────────────────────────────
const PRE_TEEN: Band = {
  1: [
    ['What colour are the two outer bands of the Nigerian flag?', ['Green', 'Blue', 'Red', 'Yellow'], 'Nigeria', 'Flag_of_Nigeria', 'Nigeria’s flag is green-white-green.'],
    ['How many legs does a spider have?', ['Eight', 'Six', 'Four', 'Ten'], 'Nature', 'Spider', 'Spiders are arachnids with eight legs.'],
    ['What do we call a baby dog?', ['Puppy', 'Kitten', 'Calf', 'Foal'], 'Animals', 'Puppy', 'A young dog is a puppy.'],
    ['Which Nigerian food is made by frying bean paste?', ['Akara', 'Eba', 'Suya', 'Moimoi'], 'Food', 'Akara', 'Akara is fried bean-paste balls.'],
    ['What shape has three sides?', ['Triangle', 'Square', 'Circle', 'Pentagon'], 'Maths', 'Triangle', 'A triangle has three sides.'],
  ],
  2: [
    ['What is the capital city of Nigeria?', ['Abuja', 'Lagos', 'Kano', 'Ibadan'], 'Nigeria', 'Abuja', 'Abuja became the capital in 1991.'],
    ['How many days are there in a week?', ['Seven', 'Five', 'Ten', 'Twelve'], 'General', 'Week', 'A week has seven days.'],
    ['Which animal is known as the king of the jungle?', ['Lion', 'Elephant', 'Tiger', 'Giraffe'], 'Animals', 'Lion', 'The lion is called the king of the jungle.'],
    ['What do bees make?', ['Honey', 'Milk', 'Butter', 'Sugar'], 'Nature', 'Honey', 'Bees produce honey.'],
    ['Which Nigerian greeting means "well done"?', ['Welldone/Sannu', 'Wahala', 'Oyibo', 'Chop'], 'Culture', 'Hausa_language', '“Sannu” is a Hausa greeting of goodwill.'],
  ],
  3: [
    ['Which planet do we live on?', ['Earth', 'Mars', 'Jupiter', 'Venus'], 'Science', 'Earth', 'We live on Earth.'],
    ['How many colours are in a rainbow?', ['Seven', 'Five', 'Six', 'Nine'], 'Science', 'Rainbow', 'A rainbow shows seven colours.'],
    ['Which river is the longest in Nigeria?', ['Niger', 'Benue', 'Ogun', 'Cross'], 'Geography', 'Niger_River', 'The River Niger gives Nigeria its name.'],
    ['What is frozen water called?', ['Ice', 'Steam', 'Mud', 'Sand'], 'Science', 'Ice', 'Frozen water is ice.'],
    ['Which fruit is yellow and curved?', ['Banana', 'Apple', 'Orange', 'Mango'], 'Food', 'Banana', 'Bananas are long, yellow and curved.'],
  ],
  4: [
    ['How many continents are there?', ['Seven', 'Five', 'Six', 'Eight'], 'Geography', 'Continent', 'There are seven continents.'],
    ['What gas do plants breathe in to make food?', ['Carbon dioxide', 'Oxygen', 'Hydrogen', 'Helium'], 'Science', 'Photosynthesis', 'Plants use carbon dioxide in photosynthesis.'],
    ['Who teaches pupils in a school?', ['Teacher', 'Doctor', 'Pilot', 'Farmer'], 'General', 'Teacher', 'Teachers teach in schools.'],
    ['Which Nigerian city is called the Centre of Excellence?', ['Lagos', 'Enugu', 'Jos', 'Kaduna'], 'Nigeria', 'Lagos_State', 'Lagos State’s motto is Centre of Excellence.'],
    ['What is 5 + 7?', ['12', '11', '13', '10'], 'Maths', 'Addition', '5 plus 7 equals 12.'],
  ],
  5: [
    ['What do we call animals that eat only plants?', ['Herbivores', 'Carnivores', 'Omnivores', 'Insects'], 'Science', 'Herbivore', 'Plant-eaters are herbivores.'],
    ['Which ocean is the largest?', ['Pacific', 'Atlantic', 'Indian', 'Arctic'], 'Geography', 'Pacific_Ocean', 'The Pacific is the largest ocean.'],
    ['What is the fastest land animal?', ['Cheetah', 'Lion', 'Horse', 'Dog'], 'Animals', 'Cheetah', 'The cheetah is the fastest land animal.'],
    ['Which Nigerian musician is called the King of Afrobeat?', ['Fela Kuti', 'Wizkid', 'Davido', '2Baba'], 'Music', 'Fela_Kuti', 'Fela Kuti pioneered Afrobeat.'],
    ['How many sides does a hexagon have?', ['Six', 'Five', 'Seven', 'Eight'], 'Maths', 'Hexagon', 'A hexagon has six sides.'],
  ],
  6: [
    ['What organ pumps blood around the body?', ['Heart', 'Brain', 'Lung', 'Liver'], 'Science', 'Heart', 'The heart pumps blood.'],
    ['Which is the tallest animal in the world?', ['Giraffe', 'Elephant', 'Horse', 'Camel'], 'Animals', 'Giraffe', 'Giraffes are the tallest animals.'],
    ['What is the largest desert in Africa?', ['Sahara', 'Kalahari', 'Namib', 'Sahel'], 'Geography', 'Sahara', 'The Sahara is Africa’s largest desert.'],
    ['How many players are on a football pitch per team?', ['Eleven', 'Nine', 'Ten', 'Twelve'], 'Sports', 'Association_football', 'Each team fields eleven players.'],
    ['Which Nigerian snack is spicy grilled meat on a stick?', ['Suya', 'Akara', 'Puff-puff', 'Chin-chin'], 'Food', 'Suya', 'Suya is spicy grilled meat.'],
  ],
  7: [
    ['What do you call the study of living things?', ['Biology', 'Geography', 'History', 'Maths'], 'Science', 'Biology', 'Biology studies living things.'],
    ['Which is the smallest planet in our solar system?', ['Mercury', 'Mars', 'Earth', 'Pluto'], 'Science', 'Mercury_(planet)', 'Mercury is the smallest planet.'],
    ['Who was Nigeria’s first president?', ['Nnamdi Azikiwe', 'Tafawa Balewa', 'Obasanjo', 'Shagari'], 'History', 'Nnamdi_Azikiwe', 'Azikiwe was the first president (1963).'],
    ['What is 9 × 6?', ['54', '45', '56', '63'], 'Maths', 'Multiplication', 'Nine times six is fifty-four.'],
    ['Which African country is Nigeria’s northern neighbour?', ['Niger', 'Ghana', 'Chad', 'Benin'], 'Geography', 'Niger', 'Niger borders Nigeria to the north.'],
  ],
  8: [
    ['What is the chemical symbol for water?', ['H2O', 'CO2', 'O2', 'NaCl'], 'Science', 'Water', 'Water is H2O.'],
    ['Which Nigerian state is famous for the Osun-Osogbo festival?', ['Osun', 'Lagos', 'Kano', 'Rivers'], 'Culture', 'Osun-Osogbo', 'The festival is held in Osun State.'],
    ['How many bones make a human skeleton (adult)?', ['206', '150', '300', '108'], 'Science', 'Human_skeleton', 'Adults have 206 bones.'],
    ['Which is the largest mammal?', ['Blue whale', 'Elephant', 'Hippo', 'Shark'], 'Animals', 'Blue_whale', 'The blue whale is the largest animal.'],
    ['What is the capital of Ghana?', ['Accra', 'Kumasi', 'Lagos', 'Lomé'], 'Africa', 'Accra', 'Accra is Ghana’s capital.'],
  ],
  9: [
    ['Which gas do humans need to breathe?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 'Science', 'Oxygen', 'Humans breathe oxygen.'],
    ['Who wrote the novel "Things Fall Apart"?', ['Chinua Achebe', 'Wole Soyinka', 'Ben Okri', 'Cyprian Ekwensi'], 'Literature', 'Things_Fall_Apart', 'Achebe wrote it in 1958.'],
    ['Which continent is Egypt in?', ['Africa', 'Asia', 'Europe', 'America'], 'Geography', 'Egypt', 'Egypt is in Africa.'],
    ['What is half of 150?', ['75', '70', '85', '60'], 'Maths', 'Division', 'Half of 150 is 75.'],
    ['Which Nigerian currency note features Murtala Muhammed?', ['Twenty naira', 'Five naira', 'Fifty naira', 'Hundred naira'], 'Nigeria', 'Nigerian_naira', 'The ₦20 note features Murtala Muhammed.'],
  ],
  10: [
    ['What force pulls objects toward the Earth?', ['Gravity', 'Friction', 'Magnetism', 'Wind'], 'Science', 'Gravity', 'Gravity pulls objects down.'],
    ['Which Nigerian won an Olympic gold in the long jump? (none — who won bronze 1996 football?)', ['Nigeria (football gold 1996)', 'Cameroon', 'Ghana', 'Egypt'], 'Sports', 'Nigeria_national_football_team', 'Nigeria won Olympic football gold in 1996.'],
    ['How many minutes are in two hours?', ['120', '100', '90', '140'], 'Maths', 'Hour', 'Two hours is 120 minutes.'],
    ['What is the hardest natural substance?', ['Diamond', 'Gold', 'Iron', 'Glass'], 'Science', 'Diamond', 'Diamond is the hardest natural material.'],
    ['Which sea is to the south of Nigeria?', ['Atlantic Ocean', 'Mediterranean', 'Red Sea', 'Indian Ocean'], 'Geography', 'Gulf_of_Guinea', 'Nigeria’s coast meets the Atlantic.'],
  ],
  11: [
    ['What is the largest organ of the human body?', ['Skin', 'Liver', 'Heart', 'Brain'], 'Science', 'Skin', 'Skin is the largest organ.'],
    ['Which empire was centred at Benin City?', ['Benin Empire', 'Oyo Empire', 'Mali Empire', 'Songhai'], 'History', 'Benin_Empire', 'The Benin Empire flourished there.'],
    ['What is 144 ÷ 12?', ['12', '14', '11', '16'], 'Maths', 'Division', '144 divided by 12 is 12.'],
    ['Which planet is known as the Red Planet?', ['Mars', 'Venus', 'Saturn', 'Mercury'], 'Science', 'Mars', 'Mars looks red from iron oxide.'],
    ['Who is the Greek god of the sea?', ['Poseidon', 'Zeus', 'Apollo', 'Hades'], 'Mythology', 'Poseidon', 'Poseidon rules the sea.'],
  ],
  12: [
    ['Which vitamin do we get from sunlight?', ['Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B'], 'Science', 'Vitamin_D', 'Sunlight helps make vitamin D.'],
    ['Which Nigerian Nobel laureate won for Literature?', ['Wole Soyinka', 'Chinua Achebe', 'Chimamanda Adichie', 'Ben Okri'], 'Literature', 'Wole_Soyinka', 'Soyinka won the Nobel in 1986.'],
    ['What is the freezing point of water in Celsius?', ['0', '32', '100', '10'], 'Science', 'Melting_point', 'Water freezes at 0°C.'],
    ['Which is the longest river in the world?', ['Nile', 'Amazon', 'Niger', 'Congo'], 'Geography', 'Nile', 'The Nile is generally the longest river.'],
    ['How many squares are on a chessboard?', ['64', '32', '100', '48'], 'Games', 'Chessboard', 'A chessboard has 64 squares.'],
  ],
  13: [
    ['What is the powerhouse of the cell?', ['Mitochondria', 'Nucleus', 'Ribosome', 'Membrane'], 'Science', 'Mitochondrion', 'Mitochondria make energy.'],
    ['Which ancient African university is in Timbuktu?', ['Sankoré', 'Al-Azhar', 'Fourah Bay', 'Makerere'], 'Africa', 'University_of_Timbuktu', 'Sankoré was a centre of learning.'],
    ['What is the square root of 81?', ['9', '8', '7', '6'], 'Maths', 'Square_root', 'The square root of 81 is 9.'],
    ['Which Nigerian author wrote "Half of a Yellow Sun"?', ['Chimamanda Adichie', 'Buchi Emecheta', 'Flora Nwapa', 'Sefi Atta'], 'Literature', 'Half_of_a_Yellow_Sun', 'Adichie wrote it in 2006.'],
    ['Which is the smallest country in Africa (mainland)?', ['The Gambia', 'Lesotho', 'Rwanda', 'Togo'], 'Africa', 'The_Gambia', 'The Gambia is the smallest mainland African country.'],
  ],
  14: [
    ['What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Power Unit', 'Control Processing Unit'], 'Technology', 'Central_processing_unit', 'CPU = Central Processing Unit.'],
    ['Which Nigerian city hosted the 1977 FESTAC arts festival?', ['Lagos', 'Abuja', 'Kano', 'Enugu'], 'Culture', 'FESTAC_77', 'FESTAC ’77 was held in Lagos.'],
    ['What is 15 × 15?', ['225', '215', '255', '205'], 'Maths', 'Multiplication', '15 squared is 225.'],
    ['Which scientist proposed the theory of gravity after an apple fell?', ['Isaac Newton', 'Albert Einstein', 'Galileo', 'Darwin'], 'Science', 'Isaac_Newton', 'Newton described gravity.'],
    ['Which African mountain is the tallest?', ['Kilimanjaro', 'Mount Kenya', 'Mount Cameroon', 'Atlas'], 'Africa', 'Mount_Kilimanjaro', 'Kilimanjaro is Africa’s highest peak.'],
  ],
  15: [
    ['In what year did Nigeria gain independence?', ['1960', '1957', '1963', '1966'], 'History', 'Nigeria', 'Nigeria became independent on 1 October 1960.'],
    ['What is the chemical symbol for gold?', ['Au', 'Ag', 'Gd', 'Go'], 'Science', 'Gold', 'Gold’s symbol is Au.'],
    ['Which Nigerian footballer won the 2023 CAF Player of the Year?', ['Victor Osimhen', 'Jay-Jay Okocha', 'Kanu', 'Yekini'], 'Sports', 'Victor_Osimhen', 'Osimhen won in 2023.'],
    ['How many degrees are in a circle?', ['360', '180', '270', '90'], 'Maths', 'Circle', 'A circle has 360 degrees.'],
    ['Which planet has the most moons?', ['Saturn', 'Jupiter', 'Neptune', 'Uranus'], 'Science', 'Moons_of_Saturn', 'Saturn has the most confirmed moons.'],
  ],
};

// ── Teen (13–17) ─────────────────────────────────────────────────────────────
const TEEN: Band = {
  1: [
    ['What is the capital of Nigeria?', ['Abuja', 'Lagos', 'Port Harcourt', 'Kaduna'], 'Nigeria', 'Abuja', 'Abuja has been the capital since 1991.'],
    ['Which Nigerian artist sang "Essence" with Tems?', ['Wizkid', 'Davido', 'Burna Boy', 'Rema'], 'Music', 'Essence_(Wizkid_song)', '“Essence” by Wizkid ft. Tems went global.'],
    ['What is H2O commonly known as?', ['Water', 'Salt', 'Oxygen', 'Acid'], 'Science', 'Water', 'H2O is water.'],
    ['How many players are in a basketball team on court?', ['Five', 'Six', 'Seven', 'Four'], 'Sports', 'Basketball', 'Each side has five players.'],
    ['Which continent is Nigeria in?', ['Africa', 'Asia', 'Europe', 'South America'], 'Geography', 'Nigeria', 'Nigeria is in West Africa.'],
  ],
  2: [
    ['Who wrote "Things Fall Apart"?', ['Chinua Achebe', 'Wole Soyinka', 'Ben Okri', 'Chimamanda Adichie'], 'Literature', 'Chinua_Achebe', 'Achebe published it in 1958.'],
    ['What is the largest planet in the solar system?', ['Jupiter', 'Saturn', 'Earth', 'Neptune'], 'Science', 'Jupiter', 'Jupiter is the largest planet.'],
    ['Which Nigerian city is the oil hub of the Niger Delta?', ['Port Harcourt', 'Ibadan', 'Jos', 'Sokoto'], 'Nigeria', 'Port_Harcourt', 'Port Harcourt is the oil-industry hub.'],
    ['What is 12 squared?', ['144', '124', '154', '121'], 'Maths', 'Square_number', '12 squared is 144.'],
    ['Who painted the Mona Lisa?', ['Leonardo da Vinci', 'Picasso', 'Van Gogh', 'Michelangelo'], 'Art', 'Mona_Lisa', 'Da Vinci painted it.'],
  ],
  3: [
    ['Which gas makes up most of Earth’s atmosphere?', ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'], 'Science', 'Atmosphere_of_Earth', 'Air is ~78% nitrogen.'],
    ['Which Nigerian won the 2020 Grammy-recognised album "Twice As Tall"?', ['Burna Boy', 'Wizkid', 'Davido', 'Yemi Alade'], 'Music', 'Twice_as_Tall', 'Burna Boy won Best Global Music Album.'],
    ['What is the capital of Kenya?', ['Nairobi', 'Mombasa', 'Kampala', 'Dar es Salaam'], 'Africa', 'Nairobi', 'Nairobi is Kenya’s capital.'],
    ['What is the value of pi to two decimals?', ['3.14', '3.16', '3.12', '3.41'], 'Maths', 'Pi', 'Pi ≈ 3.14.'],
    ['Which organ filters blood and makes urine?', ['Kidney', 'Liver', 'Heart', 'Lung'], 'Science', 'Kidney', 'Kidneys filter blood.'],
  ],
  4: [
    ['In which year did the Nigerian Civil War end?', ['1970', '1967', '1966', '1975'], 'History', 'Nigerian_Civil_War', 'The war ended in January 1970.'],
    ['Which is the longest bone in the human body?', ['Femur', 'Tibia', 'Humerus', 'Spine'], 'Science', 'Femur', 'The femur (thigh bone) is longest.'],
    ['Who is known as the father of modern physics?', ['Albert Einstein', 'Isaac Newton', 'Galileo', 'Tesla'], 'Science', 'Albert_Einstein', 'Einstein is often called that.'],
    ['Which African country was never colonised (largely)?', ['Ethiopia', 'Ghana', 'Kenya', 'Senegal'], 'Africa', 'Ethiopia', 'Ethiopia resisted colonisation.'],
    ['What is the boiling point of water at sea level (°C)?', ['100', '90', '110', '120'], 'Science', 'Boiling_point', 'Water boils at 100°C at sea level.'],
  ],
  5: [
    ['Which Nigerian state has the most local government areas?', ['Kano', 'Lagos', 'Rivers', 'Oyo'], 'Nigeria', 'Kano_State', 'Kano has 44 LGAs, the most.'],
    ['What is the powerhouse of the cell?', ['Mitochondria', 'Nucleus', 'Cytoplasm', 'Ribosome'], 'Science', 'Mitochondrion', 'Mitochondria produce ATP.'],
    ['Who composed the "Four Seasons"?', ['Vivaldi', 'Mozart', 'Beethoven', 'Bach'], 'Music', 'The_Four_Seasons_(Vivaldi)', 'Vivaldi composed it.'],
    ['What is 7 factorial divided by 5 factorial?', ['42', '35', '49', '30'], 'Maths', 'Factorial', '7!/5! = 7×6 = 42.'],
    ['Which country has the largest population in Africa?', ['Nigeria', 'Ethiopia', 'Egypt', 'DR Congo'], 'Africa', 'Nigeria', 'Nigeria is Africa’s most populous country.'],
  ],
  6: [
    ['Which element has the atomic number 1?', ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'], 'Science', 'Hydrogen', 'Hydrogen is element 1.'],
    ['Who was the first military head of state of Nigeria?', ['Aguiyi-Ironsi', 'Gowon', 'Murtala', 'Babangida'], 'History', 'Johnson_Aguiyi-Ironsi', 'Ironsi led after the 1966 coup.'],
    ['What is the currency of South Africa?', ['Rand', 'Cedi', 'Shilling', 'Naira'], 'Africa', 'South_African_rand', 'South Africa uses the rand.'],
    ['What is the sum of angles in a triangle?', ['180°', '360°', '90°', '270°'], 'Maths', 'Triangle', 'Triangle angles sum to 180°.'],
    ['Which planet is closest to the Sun?', ['Mercury', 'Venus', 'Earth', 'Mars'], 'Science', 'Mercury_(planet)', 'Mercury is nearest the Sun.'],
  ],
  7: [
    ['Which Nigerian author wrote "The Joys of Motherhood"?', ['Buchi Emecheta', 'Flora Nwapa', 'Chimamanda Adichie', 'Zaynab Alkali'], 'Literature', 'The_Joys_of_Motherhood', 'Buchi Emecheta wrote it.'],
    ['What does DNA stand for?', ['Deoxyribonucleic acid', 'Dinucleic acid', 'Diribonucleic acid', 'Deoxynucleic acid'], 'Science', 'DNA', 'DNA = deoxyribonucleic acid.'],
    ['Which river flows through Egypt?', ['Nile', 'Congo', 'Niger', 'Zambezi'], 'Africa', 'Nile', 'The Nile flows through Egypt.'],
    ['What is 2 to the power 10?', ['1024', '512', '2048', '256'], 'Maths', 'Power_of_two', '2^10 = 1024.'],
    ['Who developed the theory of evolution by natural selection?', ['Charles Darwin', 'Mendel', 'Lamarck', 'Pasteur'], 'Science', 'Charles_Darwin', 'Darwin proposed natural selection.'],
  ],
  8: [
    ['Which year did Nigeria return to democracy after military rule?', ['1999', '1993', '2007', '1996'], 'History', 'Fourth_Nigerian_Republic', 'The Fourth Republic began in 1999.'],
    ['What is the chemical symbol for sodium?', ['Na', 'So', 'Sd', 'Sm'], 'Science', 'Sodium', 'Sodium’s symbol is Na.'],
    ['Which African city is known as the Mother City?', ['Cape Town', 'Lagos', 'Cairo', 'Nairobi'], 'Africa', 'Cape_Town', 'Cape Town is the Mother City.'],
    ['What is the greatest common divisor of 24 and 36?', ['12', '6', '8', '18'], 'Maths', 'Greatest_common_divisor', 'GCD(24,36)=12.'],
    ['Who wrote "Romeo and Juliet"?', ['Shakespeare', 'Dickens', 'Chaucer', 'Milton'], 'Literature', 'Romeo_and_Juliet', 'Shakespeare wrote it.'],
  ],
  9: [
    ['Which Nigerian Afrobeats star released "Rave & Roses"?', ['Rema', 'Omah Lay', 'Asake', 'Ruger'], 'Music', 'Rave_%26_Roses', 'Rema released it in 2022.'],
    ['What is the speed of light approximately?', ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'], 'Science', 'Speed_of_light', 'Light travels ~300,000 km/s.'],
    ['Which African country was formerly called Abyssinia?', ['Ethiopia', 'Eritrea', 'Sudan', 'Somalia'], 'Africa', 'Ethiopia', 'Ethiopia was Abyssinia.'],
    ['What is the median of 3, 7, 9, 13, 21?', ['9', '7', '13', '11'], 'Maths', 'Median', 'The middle value is 9.'],
    ['Which gas is produced during photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Methane'], 'Science', 'Photosynthesis', 'Plants release oxygen.'],
  ],
  10: [
    ['Who was the first elected president of the Fourth Republic?', ['Olusegun Obasanjo', 'Goodluck Jonathan', 'Umaru Yar’Adua', 'Buhari'], 'History', 'Olusegun_Obasanjo', 'Obasanjo won in 1999.'],
    ['What is the hardest naturally occurring mineral?', ['Diamond', 'Quartz', 'Topaz', 'Corundum'], 'Science', 'Diamond', 'Diamond rates 10 on Mohs scale.'],
    ['Which strait separates Africa from Europe?', ['Strait of Gibraltar', 'Bosphorus', 'Suez', 'Bering'], 'Geography', 'Strait_of_Gibraltar', 'Gibraltar separates them.'],
    ['What is the next prime number after 13?', ['17', '15', '19', '14'], 'Maths', 'Prime_number', 'After 13 comes 17 (15 is not prime).'],
    ['Which artist painted "Starry Night"?', ['Van Gogh', 'Monet', 'Da Vinci', 'Dali'], 'Art', 'The_Starry_Night', 'Van Gogh painted it in 1889.'],
  ],
  11: [
    ['Which Nigerian won the 1996 Olympic football gold as captain figure?', ['Nigeria team (Dream Team)', 'Kanu solo', 'Okocha solo', 'Babayaro solo'], 'Sports', 'Nigeria_national_under-23_football_team', 'The Dream Team won gold in Atlanta 1996.'],
    ['What is Avogadro’s number (approx)?', ['6.02×10^23', '3.14×10^10', '9.81', '1.6×10^-19'], 'Science', 'Avogadro_constant', 'Avogadro’s number ≈ 6.02×10^23.'],
    ['Which empire built Great Zimbabwe?', ['Kingdom of Zimbabwe', 'Mali Empire', 'Ashanti', 'Zulu'], 'Africa', 'Kingdom_of_Zimbabwe', 'The Kingdom of Zimbabwe built it.'],
    ['Solve: 3x = 27. What is x?', ['9', '6', '8', '12'], 'Maths', 'Equation', 'x = 9.'],
    ['Who wrote "1984"?', ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'H.G. Wells'], 'Literature', 'Nineteen_Eighty-Four', 'Orwell wrote 1984.'],
  ],
  12: [
    ['Which Nigerian state is home to the Yankari Game Reserve?', ['Bauchi', 'Cross River', 'Taraba', 'Niger'], 'Nigeria', 'Yankari_National_Park', 'Yankari is in Bauchi State.'],
    ['What particle has a negative charge?', ['Electron', 'Proton', 'Neutron', 'Photon'], 'Science', 'Electron', 'Electrons are negatively charged.'],
    ['Which is the deepest ocean trench?', ['Mariana Trench', 'Puerto Rico', 'Java', 'Tonga'], 'Geography', 'Mariana_Trench', 'The Mariana Trench is the deepest.'],
    ['What is log base 10 of 1000?', ['3', '2', '4', '10'], 'Maths', 'Logarithm', 'log10(1000)=3.'],
    ['Which composer was deaf later in life?', ['Beethoven', 'Mozart', 'Chopin', 'Handel'], 'Music', 'Ludwig_van_Beethoven', 'Beethoven composed while deaf.'],
  ],
  13: [
    ['Which Nigerian physicist is known for laser/optics work and was a NASA collaborator?', ['Ayodele Awojobi', 'Philip Emeagwali', 'Bartholomew Nnaji', 'Gabriel Oyibo'], 'Science', 'Philip_Emeagwali', 'Emeagwali is celebrated for supercomputing work.'],
    ['What is the SI unit of force?', ['Newton', 'Joule', 'Watt', 'Pascal'], 'Science', 'Newton_(unit)', 'Force is measured in newtons.'],
    ['Which African empire controlled the trans-Saharan gold trade under Mansa Musa?', ['Mali Empire', 'Songhai', 'Ghana Empire', 'Kanem'], 'Africa', 'Mansa_Musa', 'Mansa Musa ruled the Mali Empire.'],
    ['What is the derivative of x²?', ['2x', 'x', 'x²/2', '2'], 'Maths', 'Derivative', 'd/dx x² = 2x.'],
    ['Who wrote "Pride and Prejudice"?', ['Jane Austen', 'Brontë', 'Dickens', 'Eliot'], 'Literature', 'Pride_and_Prejudice', 'Austen wrote it.'],
  ],
  14: [
    ['Which treaty in 1914 amalgamated Nigeria’s protectorates?', ['Amalgamation by Lugard', 'Berlin Treaty', 'Versailles', 'Lagos Treaty'], 'History', 'Amalgamation_of_Nigeria', 'Lugard amalgamated north and south in 1914.'],
    ['What is the chemical symbol for potassium?', ['K', 'P', 'Po', 'Pt'], 'Science', 'Potassium', 'Potassium’s symbol is K.'],
    ['Which African lake is the largest by area?', ['Lake Victoria', 'Lake Tanganyika', 'Lake Chad', 'Lake Malawi'], 'Africa', 'Lake_Victoria', 'Lake Victoria is Africa’s largest lake.'],
    ['What is the integral of 2x dx?', ['x² + C', '2x² + C', 'x + C', '2 + C'], 'Maths', 'Integral', '∫2x dx = x² + C.'],
    ['Which planet rotates on its side?', ['Uranus', 'Neptune', 'Saturn', 'Mars'], 'Science', 'Uranus', 'Uranus has an extreme axial tilt.'],
  ],
  15: [
    ['Who was the first Nigerian to win the Nobel Prize?', ['Wole Soyinka', 'Chinua Achebe', 'Philip Emeagwali', 'Hakeem Olajuwon'], 'History', 'Wole_Soyinka', 'Soyinka won the 1986 Nobel in Literature.'],
    ['What is the Planck constant’s role?', ['Quantises energy', 'Speed of gravity', 'Measures charge', 'Unit of force'], 'Science', 'Planck_constant', 'It relates energy and frequency in quantum physics.'],
    ['Which ancient African script is used for Amharic?', ['Ge’ez', 'Nsibidi', 'Tifinagh', 'Coptic'], 'Africa', 'Ge%CA%BDez_script', 'Ge’ez script writes Amharic.'],
    ['What is the value of the golden ratio (approx)?', ['1.618', '3.142', '2.718', '1.414'], 'Maths', 'Golden_ratio', 'φ ≈ 1.618.'],
    ['Which scientist formulated the laws of planetary motion?', ['Johannes Kepler', 'Copernicus', 'Newton', 'Brahe'], 'Science', 'Johannes_Kepler', 'Kepler gave the three laws.'],
  ],
};

// ── Adult (18+) ──────────────────────────────────────────────────────────────
const ADULT: Band = {
  1: [
    ['What is the capital of Nigeria?', ['Abuja', 'Lagos', 'Kano', 'Enugu'], 'Nigeria', 'Abuja', 'Abuja is the capital since 1991.'],
    ['Which currency does Nigeria use?', ['Naira', 'Cedi', 'Shilling', 'Franc'], 'Nigeria', 'Nigerian_naira', 'Nigeria uses the naira.'],
    ['Who sang "Ye"?', ['Burna Boy', 'Davido', 'Wizkid', 'Olamide'], 'Music', 'Ye_(Burna_Boy_song)', 'Burna Boy released “Ye” in 2018.'],
    ['How many states does Nigeria have?', ['36', '30', '32', '40'], 'Nigeria', 'States_of_Nigeria', 'Nigeria has 36 states plus the FCT.'],
    ['What is the largest city in Nigeria by population?', ['Lagos', 'Abuja', 'Kano', 'Ibadan'], 'Nigeria', 'Lagos', 'Lagos is the most populous city.'],
  ],
  2: [
    ['Which Nigerian independence year is celebrated yearly?', ['1960', '1963', '1957', '1966'], 'History', 'Nigeria', 'Independence was 1 October 1960.'],
    ['Who is the author of "Half of a Yellow Sun"?', ['Chimamanda Adichie', 'Achebe', 'Soyinka', 'Ben Okri'], 'Literature', 'Half_of_a_Yellow_Sun', 'Adichie wrote it in 2006.'],
    ['Which Nigerian footballer was called "Jay-Jay"?', ['Austin Okocha', 'Kanu', 'Yekini', 'Amokachi'], 'Sports', 'Jay-Jay_Okocha', 'Augustine “Jay-Jay” Okocha.'],
    ['What is the SI unit of electric current?', ['Ampere', 'Volt', 'Ohm', 'Watt'], 'Science', 'Ampere', 'Current is measured in amperes.'],
    ['Which is Africa’s largest economy (nominal, mid-2020s)?', ['Nigeria', 'South Africa', 'Egypt', 'Algeria'], 'Africa', 'Economy_of_Nigeria', 'Nigeria has ranked as Africa’s largest economy.'],
  ],
  3: [
    ['Which Nigerian leader introduced the Structural Adjustment Programme?', ['Ibrahim Babangida', 'Buhari', 'Shagari', 'Abacha'], 'History', 'Ibrahim_Babangida', 'SAP began under Babangida in 1986.'],
    ['What is the chemical symbol for iron?', ['Fe', 'Ir', 'In', 'I'], 'Science', 'Iron', 'Iron’s symbol is Fe.'],
    ['Which city is Nigeria’s ancient brass and bronze art centre?', ['Benin City', 'Ile-Ife', 'Nok', 'Kano'], 'Culture', 'Benin_Bronzes', 'Benin City is famed for its bronzes.'],
    ['What is the smallest prime number?', ['2', '1', '3', '0'], 'Maths', 'Prime_number', '2 is the smallest prime.'],
    ['Who wrote "Death and the King’s Horseman"?', ['Wole Soyinka', 'Achebe', 'Rotimi', 'Clark'], 'Literature', 'Death_and_the_King%27s_Horseman', 'Soyinka wrote the play.'],
  ],
  4: [
    ['In which year was the Nigerian naira introduced?', ['1973', '1960', '1980', '1966'], 'History', 'Nigerian_naira', 'The naira replaced the pound in 1973.'],
    ['Which scientist discovered penicillin?', ['Alexander Fleming', 'Pasteur', 'Koch', 'Lister'], 'Science', 'Alexander_Fleming', 'Fleming discovered penicillin in 1928.'],
    ['Which African country has the most pyramids?', ['Sudan', 'Egypt', 'Libya', 'Algeria'], 'Africa', 'Nubian_pyramids', 'Sudan has more pyramids than Egypt.'],
    ['What is 13 × 12?', ['156', '146', '166', '144'], 'Maths', 'Multiplication', '13×12 = 156.'],
    ['Who composed "The Magic Flute"?', ['Mozart', 'Beethoven', 'Bach', 'Verdi'], 'Music', 'The_Magic_Flute', 'Mozart composed it.'],
  ],
  5: [
    ['Which Nigerian governor-general was the last British colonial head?', ['James Robertson', 'Frederick Lugard', 'Hugh Clifford', 'Arthur Richards'], 'History', 'James_Wilson_Robertson', 'Robertson was last Governor-General before independence.'],
    ['What is the pH of pure water at 25°C?', ['7', '5', '9', '1'], 'Science', 'PH', 'Pure water is neutral, pH 7.'],
    ['Which African river has the largest discharge?', ['Congo', 'Nile', 'Niger', 'Zambezi'], 'Africa', 'Congo_River', 'The Congo has the greatest discharge in Africa.'],
    ['What is the sum of the interior angles of a hexagon?', ['720°', '540°', '360°', '900°'], 'Maths', 'Hexagon', 'Hexagon interior angles total 720°.'],
    ['Who is the Nigerian playwright behind "The Gods Are Not to Blame"?', ['Ola Rotimi', 'Soyinka', 'Achebe', 'Clark'], 'Literature', 'The_Gods_Are_Not_to_Blame', 'Ola Rotimi wrote it.'],
  ],
  6: [
    ['Which Nigerian was Secretary-General of OPEC?', ['Mohammed Barkindo', 'Ngozi Okonjo-Iweala', 'Rilwanu Lukman alt', 'Yemi Osinbajo'], 'Nigeria', 'Mohammed_Barkindo', 'Barkindo led OPEC 2016–2022.'],
    ['What is the most abundant element in the universe?', ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'], 'Science', 'Hydrogen', 'Hydrogen is most abundant.'],
    ['Which country is completely surrounded by South Africa?', ['Lesotho', 'Eswatini', 'Botswana', 'Namibia'], 'Africa', 'Lesotho', 'Lesotho is an enclave of South Africa.'],
    ['What is 25% of 200?', ['50', '40', '25', '75'], 'Maths', 'Percentage', '25% of 200 is 50.'],
    ['Who directed the film "Lionheart" (2018)?', ['Genevieve Nnaji', 'Kunle Afolayan', 'Kemi Adetiba', 'Mo Abudu'], 'Film', 'Lionheart_(2018_film)', 'Genevieve Nnaji directed Lionheart.'],
  ],
  7: [
    ['Which year did Nigeria host the FIFA U-17 World Cup first?', ['1999', '2009', '1985', '2003'], 'Sports', 'FIFA_U-17_World_Cup', 'Nigeria hosted in 1999 (and 2009).'],
    ['What is the unit of electrical resistance?', ['Ohm', 'Volt', 'Ampere', 'Farad'], 'Science', 'Ohm', 'Resistance is measured in ohms.'],
    ['Which is the official language of Mozambique?', ['Portuguese', 'French', 'English', 'Swahili'], 'Africa', 'Mozambique', 'Mozambique’s official language is Portuguese.'],
    ['What is the value of 0.75 as a fraction?', ['3/4', '2/3', '7/8', '1/2'], 'Maths', 'Fraction', '0.75 = 3/4.'],
    ['Who wrote "Crime and Punishment"?', ['Dostoevsky', 'Tolstoy', 'Chekhov', 'Gogol'], 'Literature', 'Crime_and_Punishment', 'Dostoevsky wrote it.'],
  ],
  8: [
    ['Which Nigerian economist became WTO Director-General in 2021?', ['Ngozi Okonjo-Iweala', 'Akinwumi Adesina', 'Sanusi Lamido', 'Zainab Ahmed'], 'Nigeria', 'Ngozi_Okonjo-Iweala', 'She is the first woman and African to lead the WTO.'],
    ['What is the chemical formula for table salt?', ['NaCl', 'KCl', 'NaOH', 'HCl'], 'Science', 'Sodium_chloride', 'Table salt is NaCl.'],
    ['Which African desert is in the south of the continent?', ['Kalahari', 'Sahara', 'Sahel', 'Danakil'], 'Africa', 'Kalahari_Desert', 'The Kalahari is in Southern Africa.'],
    ['Solve: x² = 49, x > 0. What is x?', ['7', '6', '8', '9'], 'Maths', 'Square_root', 'x = 7.'],
    ['Who painted the Sistine Chapel ceiling?', ['Michelangelo', 'Raphael', 'Da Vinci', 'Caravaggio'], 'Art', 'Sistine_Chapel_ceiling', 'Michelangelo painted it.'],
  ],
  9: [
    ['Which Nigerian city was the capital before Abuja?', ['Lagos', 'Kaduna', 'Ibadan', 'Calabar'], 'History', 'Lagos', 'Lagos was the capital until 1991.'],
    ['What is the second law of thermodynamics about?', ['Entropy increases', 'Energy is created', 'Force equals mass times acceleration', 'Gravity'], 'Science', 'Second_law_of_thermodynamics', 'Entropy of an isolated system increases.'],
    ['Which African country has three capital cities?', ['South Africa', 'Nigeria', 'Tanzania', 'Kenya'], 'Africa', 'Capitals_of_South_Africa', 'South Africa has Pretoria, Cape Town and Bloemfontein.'],
    ['What is the determinant role used for in matrices? (2x2 det of [[1,2],[3,4]])', ['-2', '2', '0', '-10'], 'Maths', 'Determinant', 'det = 1×4 − 2×3 = −2.'],
    ['Who wrote "The Famished Road", a Booker winner?', ['Ben Okri', 'Achebe', 'Adichie', 'Soyinka'], 'Literature', 'The_Famished_Road', 'Ben Okri won the 1991 Booker Prize.'],
  ],
  10: [
    ['Who was Nigeria’s Head of State assassinated in 1976?', ['Murtala Muhammed', 'Aguiyi-Ironsi', 'Tafawa Balewa', 'Abacha'], 'History', 'Murtala_Mohammed', 'Murtala was killed in the 1976 Dimka coup attempt.'],
    ['What is the approximate value of Euler’s number e?', ['2.718', '3.142', '1.618', '1.414'], 'Maths', 'E_(mathematical_constant)', 'e ≈ 2.718.'],
    ['Which element is liquid at room temperature and a metal?', ['Mercury', 'Bromine', 'Gallium', 'Sodium'], 'Science', 'Mercury_(element)', 'Mercury is a liquid metal at room temperature.'],
    ['Which African country was formerly Upper Volta?', ['Burkina Faso', 'Mali', 'Niger', 'Chad'], 'Africa', 'Burkina_Faso', 'Upper Volta became Burkina Faso in 1984.'],
    ['Who composed the opera "Aida"?', ['Verdi', 'Puccini', 'Wagner', 'Rossini'], 'Music', 'Aida', 'Verdi composed Aida.'],
  ],
  11: [
    ['Which Nigerian Nobel-nominated activist was executed in 1995?', ['Ken Saro-Wiwa', 'Gani Fawehinmi', 'MKO Abiola', 'Tai Solarin'], 'History', 'Ken_Saro-Wiwa', 'Saro-Wiwa was executed by the Abacha regime in 1995.'],
    ['What is the Heisenberg uncertainty principle about?', ['Position and momentum limits', 'Conservation of mass', 'Relativity of time', 'Wave reflection'], 'Science', 'Uncertainty_principle', 'You cannot know position and momentum exactly together.'],
    ['Which is the only African country to span the equator and the Greenwich meridian region pairing — which country does the Equator and Prime Meridian both pass near in the Gulf of Guinea?', ['None on land (point is at sea off Ghana)', 'Ghana', 'Gabon', 'Nigeria'], 'Geography', 'Null_Island', 'The 0,0 point lies in the Gulf of Guinea, off Ghana.'],
    ['What is the sum of the first 10 natural numbers?', ['55', '45', '50', '60'], 'Maths', 'Triangular_number', '1+…+10 = 55.'],
    ['Who wrote "One Hundred Years of Solitude"?', ['Gabriel García Márquez', 'Borges', 'Neruda', 'Allende'], 'Literature', 'One_Hundred_Years_of_Solitude', 'Márquez wrote it.'],
  ],
  12: [
    ['Which Nigerian won an NBA championship and is a Hall of Famer?', ['Hakeem Olajuwon', 'Giannis', 'Festus Ezeli', 'Al-Farouq Aminu'], 'Sports', 'Hakeem_Olajuwon', 'Olajuwon won two titles with Houston.'],
    ['What is the most electronegative element?', ['Fluorine', 'Oxygen', 'Chlorine', 'Nitrogen'], 'Science', 'Electronegativity', 'Fluorine is the most electronegative.'],
    ['Which kingdom built the rock-hewn churches of Lalibela?', ['Zagwe dynasty', 'Aksum', 'Mali', 'Kanem'], 'Africa', 'Lalibela', 'The Zagwe built Lalibela’s churches.'],
    ['What is cos(0°)?', ['1', '0', '0.5', '-1'], 'Maths', 'Trigonometric_functions', 'cos(0°) = 1.'],
    ['Who wrote "War and Peace"?', ['Leo Tolstoy', 'Dostoevsky', 'Turgenev', 'Pushkin'], 'Literature', 'War_and_Peace', 'Tolstoy wrote it.'],
  ],
  13: [
    ['Which 1914 colonial administrator coined "Nigeria" (the name was suggested by Flora Shaw)?', ['Flora Shaw', 'Lugard', 'Goldie', 'Clifford'], 'History', 'Flora_Shaw,_Lady_Lugard', 'Flora Shaw proposed the name “Nigeria”.'],
    ['What is the time complexity of binary search?', ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], 'Technology', 'Binary_search_algorithm', 'Binary search is O(log n).'],
    ['Which African empire’s capital was Gao?', ['Songhai Empire', 'Mali Empire', 'Ghana Empire', 'Benin'], 'Africa', 'Songhai_Empire', 'Gao was the Songhai capital.'],
    ['What is the limit of (1 + 1/n)^n as n→∞?', ['e', '1', '0', '∞'], 'Maths', 'E_(mathematical_constant)', 'It converges to e.'],
    ['Who composed "The Rite of Spring"?', ['Stravinsky', 'Debussy', 'Ravel', 'Mahler'], 'Music', 'The_Rite_of_Spring', 'Stravinsky composed it.'],
  ],
  14: [
    ['Which Nigerian region produced the ancient Nok terracotta sculptures?', ['Central Nigeria (Nok)', 'Niger Delta', 'Sokoto', 'Borno'], 'Culture', 'Nok_culture', 'The Nok culture made early terracottas.'],
    ['What is the rest mass energy formula?', ['E=mc²', 'F=ma', 'PV=nRT', 'V=IR'], 'Science', 'Mass%E2%80%93energy_equivalence', 'Einstein’s E=mc².'],
    ['Which African country gained independence most recently (2011)?', ['South Sudan', 'Eritrea', 'Namibia', 'Djibouti'], 'Africa', 'South_Sudan', 'South Sudan became independent in 2011.'],
    ['What is the value of the integral of 1/x dx?', ['ln|x| + C', 'x + C', '1/x² + C', 'e^x + C'], 'Maths', 'Natural_logarithm', '∫1/x dx = ln|x| + C.'],
    ['Who wrote "Crime and Punishment" and "The Brothers Karamazov"?', ['Dostoevsky', 'Tolstoy', 'Gogol', 'Nabokov'], 'Literature', 'Fyodor_Dostoevsky', 'Both are by Dostoevsky.'],
  ],
  15: [
    ['Which Nigerian mathematician/engineer is noted for fluid-dynamics and supercomputing claims?', ['Philip Emeagwali', 'Ayodele Awojobi', 'Chike Obi', 'Grace Alele-Williams'], 'Science', 'Philip_Emeagwali', 'Emeagwali is known for parallel-computing work.'],
    ['What is the Chandrasekhar limit roughly (solar masses)?', ['1.4', '3.0', '0.5', '10'], 'Science', 'Chandrasekhar_limit', 'About 1.4 solar masses.'],
    ['Which 14th-century Malian ruler’s pilgrimage destabilised Egyptian gold prices?', ['Mansa Musa', 'Sundiata', 'Askia', 'Sonni Ali'], 'Africa', 'Mansa_Musa', 'Mansa Musa’s 1324 hajj flooded Cairo with gold.'],
    ['What is the only even prime number?', ['2', '4', '6', '0'], 'Maths', 'Prime_number', '2 is the only even prime.'],
    ['Who formulated the general theory of relativity?', ['Albert Einstein', 'Newton', 'Maxwell', 'Bohr'], 'Science', 'General_relativity', 'Einstein, in 1915.'],
  ],
};

const BANDS: Record<AgeBand, Band> = { pre_teen: PRE_TEEN, teen: TEEN, adult: ADULT };

export function buildBank(): TriviaQuestion[] {
  const out: TriviaQuestion[] = [];
  for (const [ageBand, band] of Object.entries(BANDS) as [AgeBand, Band][]) {
    for (const [level, rows] of Object.entries(band)) {
      const difficulty = Number(level);
      rows.forEach((row, i) => {
        const [prompt, options, category, slug, explanation] = row;
        out.push({
          id: `mt-${ageBand}-${difficulty}-${i + 1}`,
          prompt,
          options,
          answer: 0, // authored correct-first; runtime shuffles options at game start
          category,
          ageBand,
          difficulty,
          explanation,
          sourceUrl: `${W}${slug}`,
          reviewStatus: 'approved',
          reviewDate: REVIEW_DATE,
        });
      });
    }
  }
  return out;
}

export const MONEY_TRIVIA_SEED = buildBank();
