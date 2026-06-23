export * from './contracts/index.js';
export * from './rules/index.js';
export * from './votes/engine.js';
export * from './games/whot.js';
export * from './games/whotEngine.js';
export * from './games/trivia/questions.js';
export * from './games/trivia/engine.js';
export * from './games/connect4/engine.js';
export * from './games/ettt/engine.js';
export {
  brandPoolFor,
  createInitialLogoState,
  fuzzyMatchBrand,
  hashString as logoHashString,
  levenshtein,
  normalizeGuess,
  pickBrandsForMatch,
  pickDistractors,
  resolveLogoRound,
  brandById,
} from './games/logo/engine.js';
export * from './games/logo/brands.js';
export {
  createInitialLandlordState,
  startLandlord,
  rollAndMove as landlordRollAndMove,
  buyProperty as landlordBuy,
  declinePurchase as landlordDecline,
  acknowledgeCard as landlordAckCard,
  payJailFine as landlordPayJailFine,
  useJailCard as landlordUseJailCard,
  endTurn as landlordEndTurn,
  buildHouse as landlordBuildHouse,
  sellHouse as landlordSellHouse,
  mortgageProperty as landlordMortgage,
  unmortgageProperty as landlordUnmortgage,
  createDecks as landlordCreateDecks,
  DEFAULT_LANDLORD_SETTINGS,
} from './games/landlord/engine.js';
export type {
  LandlordPhase,
  LandlordPlayerState,
  LandlordPropertyOwnership,
  LandlordCardEvent,
  LandlordPublicState,
  LandlordSettings,
} from './games/landlord/engine.js';
export {
  LANDLORD_PROPERTIES,
  LANDLORD_BOARD_SIZE,
  LANDLORD_GO_BONUS,
  LANDLORD_JAIL_FINE,
  LANDLORD_JAIL_POSITION,
  LANDLORD_GOTO_JAIL_POSITION,
  LANDLORD_STARTING_CASH,
  propertyAt as landlordPropertyAt,
  propertyById as landlordPropertyById,
} from './games/landlord/properties.js';
export type {
  LandlordPropertyDef,
  LandlordPropertyType,
  LandlordGroup,
} from './games/landlord/properties.js';
export { OWAMBE_CARDS, COMMUNITY_POT_CARDS, shuffleDeck as landlordShuffleDeck } from './games/landlord/cards.js';
export type { LandlordCard, CardAction as LandlordCardAction, CardDeck as LandlordCardDeck } from './games/landlord/cards.js';

// Half & Half
export {
  DEFAULT_HALFHALF_SETTINGS,
  createInitialHalfHalfState,
  pickObjectsForMatch as halfHalfPickObjects,
  pointsForGuess as halfHalfPointsForGuess,
  resolveHalfHalfRound,
  sanitizePosition as halfHalfSanitizePosition,
  toPublicObject as halfHalfToPublicObject,
} from './games/halfhalf/engine.js';
export type {
  HalfHalfPhase,
  HalfHalfPlayerGuess,
  HalfHalfPlayerResult,
  HalfHalfPlayerState,
  HalfHalfPrivateState,
  HalfHalfPublicObject,
  HalfHalfPublicState,
  HalfHalfSettings,
} from './games/halfhalf/engine.js';
export { HALFHALF_OBJECTS, objectById as halfHalfObjectById } from './games/halfhalf/objects.js';
export type { HalfHalfAxis, HalfHalfCategory, HalfHalfObject, HalfHalfShape } from './games/halfhalf/objects.js';

// Color Wahala
export {
  DEFAULT_COLORWAHALA_SETTINGS,
  createInitialColorWahalaState,
  generatePrompt as colorWahalaGeneratePrompt,
  resolveColorWahalaRound,
  scoreTap as colorWahalaScoreTap,
} from './games/colorwahala/engine.js';
export type {
  ColorWahalaMode,
  ColorWahalaPhase,
  ColorWahalaPlayerResult,
  ColorWahalaPlayerState,
  ColorWahalaPrivateState,
  ColorWahalaPrompt,
  ColorWahalaPublicState,
  ColorWahalaSettings,
  ColorWahalaTap,
} from './games/colorwahala/engine.js';
export { COLOR_PALETTE, COLOR_IDS, colorById, isColorId } from './games/colorwahala/palette.js';
export type { ColorEntry, ColorId } from './games/colorwahala/palette.js';

// Word Wahala
export {
  DEFAULT_WORDWAHALA_SETTINGS,
  createInitialWordWahalaState,
  validateAndScore as wordWahalaValidateAndScore,
  applyPlay as wordWahalaApplyPlay,
  applyPass as wordWahalaApplyPass,
  advanceTurn as wordWahalaAdvanceTurn,
  finishGame as wordWahalaFinish,
  makeInitialPlayer as wordWahalaMakePlayer,
  shuffleBag as wordWahalaShuffleBag,
  drawTiles as wordWahalaDrawTiles,
} from './games/wordwahala/engine.js';
export type {
  WordWahalaPhase,
  WordWahalaSettings,
  WordWahalaPlayerState,
  WordWahalaPrivateState,
  WordWahalaPublicState,
  WordWahalaLastBanner,
  PlacementIntent as WordWahalaPlacementIntent,
  ScoredWord as WordWahalaScoredWord,
  BoardCell as WordWahalaBoardCell,
  BoardTile as WordWahalaBoardTile,
} from './games/wordwahala/engine.js';
export {
  TILE_DEFS as WORDWAHALA_TILE_DEFS,
  RACK_SIZE as WORDWAHALA_RACK_SIZE,
  BINGO_BONUS as WORDWAHALA_BINGO_BONUS,
  buildTileBag as wordWahalaBuildTileBag,
  tileDef as wordWahalaTileDef,
  tileBagSize as wordWahalaTileBagSize,
} from './games/wordwahala/tiles.js';
export type { TileLetter as WordWahalaTileLetter, TileDef as WordWahalaTileDef } from './games/wordwahala/tiles.js';
export {
  BOARD_SIZE as WORDWAHALA_BOARD_SIZE,
  CENTER as WORDWAHALA_CENTER,
  BOARD_BONUSES as WORDWAHALA_BOARD_BONUSES,
  BONUS_LABEL as WORDWAHALA_BONUS_LABEL,
  BONUS_SHORT as WORDWAHALA_BONUS_SHORT,
  bonusAt as wordWahalaBonusAt,
} from './games/wordwahala/board.js';
export type { BoardBonus as WordWahalaBoardBonus } from './games/wordwahala/board.js';
export {
  TIER_CONFIGS as WORDWAHALA_TIER_CONFIGS,
  lookupWord as wordWahalaLookupWord,
  tierConfig as wordWahalaTierConfig,
} from './games/wordwahala/dictionary.js';
export type { DictionaryTier as WordWahalaDictionaryTier } from './games/wordwahala/dictionary.js';

