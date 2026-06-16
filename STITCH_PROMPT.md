# BoredRoom Screen Design Prompt for Google Stitch

## Project Overview
BoredRoom is a browser-based social game platform for people in the same physical room. It uses a unique two-screen architecture: one shared display (TV/projector) shows the public game world, while each player uses their phone as a private controller.

## Core Design System

### Aesthetic Direction
- **Theme**: Dark Neon Arcade / Cyber-Social Lounge
- **Mood**: Energetic, social, premium, playful but polished
- **Visual Language**: Glassmorphism panels floating on deep space, punctuated by neon glow accents

### Color Palette
- **Background**: #0D0D12 (deep near-black)
- **Surface/Card**: #16161D (elevated glass panel)
- **Muted Surface**: #25252D (secondary panel)
- **Border**: #292932 (subtle separation)
- **Primary Neon**: #00FFAA (teal/cyan glow - actions, energy)
- **Secondary**: #995CD6 (purple - brand accent)
- **Accent**: #FF9933 (orange - highlights, warnings)
- **Destructive**: #E63D3D (red - errors, exits)
- **Player Colors**: Red #E63D3D, Green #22C761, Yellow #FFD11A, Blue #338CE0

### Typography
- **Display Font**: Space Grotesk (bold, geometric, modern)
- **Body Font**: Inter (clean, highly legible)
- **Scale**: Display XL (48px), Display LG (36px), Headline LG (28px), Headline MD (22px), Body (16px), Body SM (14px), Label (12px), Label Caps (11px uppercase tracking)

### Effects & Treatments
- **Glassmorphism**: Backdrop blur 12px, background rgba(22,22,29,0.7), border 1px solid rgba(255,255,255,0.08)
- **Neon Glow**: Text shadow 0 0 20px rgba(0,255,170,0.5), Box shadow 0 0 30px rgba(0,255,170,0.3)
- **Card Shadow**: 0 4px 24px rgba(0,0,0,0.4)
- **Border Radius**: SM 6px, MD 10px, LG 14px, XL 18px, 2XL 22px, Full 9999px

---

## Screen 1: Home / Game Selection

**Purpose**: Landing screen where users choose which game to play.

**Layout**:
- Centered vertical stack on dark background
- Large brand mark (Gamepad2 icon) at top
- "BoredRoom" wordmark with "Bored" in teal neon, "Room" in purple
- Tagline: "Pick a game. Share the screen. Play together in the same room."
- Two large glass game cards side-by-side (on desktop) or stacked (mobile)
- Footer with feature pills and "Built by" attribution

**Key Elements**:
- **Game Cards**: Glass panels with emoji (🎲 for Ludo, 🃏 for Whot), game name, "Beta" badge on Whot, tagline, arrow indicator
- **Feature Pills**: Three small neon dots with labels "No app install", "2–4 players", "Instant start"
- **Profile Link**: Subtle ghost button "View profile & stats"

**Visual Notes**:
- Ambient radial glows behind content (teal top-left, purple bottom-right)
- Cards have hover scale effect (1.02x) with border glow
- All text uses high contrast against dark background

---

## Screen 2: Host / Room Creation

**Purpose**: Screen for creating a new game room (typically on the shared display).

**Layout**:
- Centered card on dark background
- Game icon and "Host [Game Name]" title
- Room code displayed prominently in large monospace font
- QR code for phone scanning
- "Waiting for players..." status
- Player list showing joined players
- "Start Game" button (disabled until minimum players)

**Key Elements**:
- **Room Code Panel**: Large 4-character code (e.g., "A7B9") in glass panel, copy button
- **QR Panel**: Centered QR code with "Scan to join" label
- **Player List**: Vertical list of player names with colored avatars, ready status indicators
- **Start Button**: Primary neon button, pulses when active, disabled state when waiting

**Visual Notes**:
- Glass card has generous padding (24px+)
- Room code uses display font at 48px+
- Player avatars use the four player colors (red, green, yellow, blue)
- Status indicators use neon dots (green = ready, amber = waiting)

---

## Screen 3: Join / Room Entry

**Purpose**: Screen for joining an existing room (typically on mobile controllers).

**Layout**:
- Centered compact card
- "Join Game" title
- Room code input (4 characters, auto-capitalized)
- "Scan QR" button (opens camera)
- Player name input
- "Join Room" button
- Error message area (for invalid codes, full rooms, etc.)

**Key Elements**:
- **Code Input**: Four separate boxes or single auto-formatted field, accepts only A-Z, 0-9
- **QR Scanner**: Full-screen camera overlay with frame guide, back button
- **Name Input**: Text field with character limit (16 chars), default suggestions
- **Join Button**: Primary button, shows loading state during connection
- **Error Toast**: Red-bordered glass panel with error icon and message

**Visual Notes**:
- Optimized for thumb reach (primary actions in bottom half)
- Input fields have large touch targets (48px+ height)
- Keyboard-aware layout (no elements hidden by keyboard)
- QR scanner has dark overlay with clear frame guide

---

## Screen 4: Room Lobby (Controller View)

**Purpose**: Waiting room for players who have joined but game hasn't started.

**Layout**:
- Header with room code and player count
- Scrollable player list
- "Ready" toggle button (large, thumb-friendly)
- Reaction bar (emoji reactions)
- "Waiting for host..." status when ready

**Key Elements**:
- **Player List**: Cards showing player name, avatar, ready status (checkmark or clock icon)
- **Ready Button**: Large full-width button, green when ready, muted when not
- **Reaction Bar**: Horizontal scroll of emoji buttons (👍, 🔥, 😂, 😮, 👏)
- **Host Badge**: Special indicator for the room host

**Visual Notes**:
- Player cards use glass effect with colored avatar circles
- Ready button has satisfying press animation
- Reactions have burst animation on tap
- Status text is muted but readable

---

## Screen 5: Ludo Game Display (Host View)

**Purpose**: Main game board shown on the shared display during Ludo gameplay.

**Layout**:
- Full-screen game board (centered, max-width constrained)
- Four player zones (corners) with home areas
- Central cross path with colored tracks
- Turn indicator at top
- Dice animation area (center or corner)
- Commentary ticker at bottom
- Player score/progress sidebar

**Key Elements**:
- **Board**: Classic Ludo cross pattern with red, green, yellow, blue home bases
- **Tokens**: Four tokens per player, distinct shapes/colors, animated movement
- **Dice**: 3D or stylized 2D dice with roll animation
- **Turn Indicator**: Large player color banner or avatar with "Player's Turn" text
- **Commentary Ticker**: Scrolling or fading text feed of game events
- **Score Panel**: Tokens home count, captures, turn count

**Visual Notes**:
- Board uses the four player colors for paths and home zones
- Tokens have subtle glow when selected or movable
- Dice roll has satisfying physics animation
- Turn transitions are clear with color-coded banners
- Commentary uses muted text with occasional neon highlights for key moments

---

## Screen 6: Ludo Controller (Mobile View)

**Purpose**: Player's private controls for playing Ludo on their phone.

**Layout**:
- Compact header with game status
- Large "Roll Dice" button (primary action)
- Token selection grid (when dice rolled)
- Turn status indicator
- Mini board reference (optional)
- Action feedback area

**Key Elements**:
- **Roll Button**: Large, thumb-friendly, pulses when active, shows dice result after roll
- **Token Buttons**: Four buttons representing player's tokens, highlight when movable, disabled when blocked
- **Turn Banner**: "Your Turn" / "Waiting..." with color indicator
- **Move Feedback**: Text confirmation of moves, captures, entries to home
- **Dice Result**: Large dice face or number display

**Visual Notes**:
- Optimized for one-handed play (primary actions in thumb zone)
- Token buttons use player color with clear active/inactive states
- Roll button has tactile press feedback
- No clutter — only relevant actions shown for current game state

---

## Screen 7: Whot Game Display (Host View)

**Purpose**: Main game display for Whot card game on the shared screen.

**Layout**:
- Central discard pile (large, prominent)
- Active suit indicator (large icon)
- Player card counts (around the table)
- Turn indicator
- Event/commentary ticker
- Last card warnings

**Key Elements**:
- **Discard Pile**: Large top card with stack depth indicator
- **Suit Indicator**: Large shape icon (Circle, Square, Cross, Triangle, Star) with color
- **Player Positions**: Avatar + name + card count for each player
- **Turn Banner**: Current player highlight with "Playing..." text
- **Event Feed**: Card plays, picks, suspensions, general market, last card calls
- **Win Overlay**: Celebration when someone wins

**Visual Notes**:
- Card design follows Nigerian Whot conventions (shapes + numbers)
- Discard pile has satisfying card-play animation
- Suit indicator pulses when a suit is called
- Player positions arranged in a logical table layout
- Event feed uses icons + text for quick scanning

---

## Screen 8: Whot Controller (Mobile View)

**Purpose**: Player's private hand and controls for Whot on mobile.

**Layout**:
- Compact hand display (scrollable cards)
- Discard pile reference (mini)
- Active suit indicator
- Playable card highlighting
- Draw/Market button
- Suit selector (when playing 1/8/20)
- Last card button

**Key Elements**:
- **Hand Cards**: Scrollable row of cards, playable cards glow/bounce, illegal cards muted
- **Discard Reference**: Small top card + current suit
- **Suit Badge**: Large shape icon showing what's active
- **Play Action**: Tap card to play (with confirmation on special cards)
- **Draw Button**: "Go to Market" button when no playable cards
- **Suit Picker**: Modal/grid when playing shape-changer cards
- **Last Card**: Warning button when down to one card

**Visual Notes**:
- Hand optimized for thumb scrolling (horizontal on phone)
- Playable cards have neon border glow
- Card tap has satisfying press feedback
- Suit picker uses large, tappable shape buttons
- No hidden info leaks (hand is private, discard is public reference)

---

## Screen 9: Game Over / Results

**Purpose**: End-of-match summary shown on shared display.

**Layout**:
- Large winner celebration
- Final standings list
- Match statistics
- "Play Again" button
- Player reactions/emoji rain

**Key Elements**:
- **Winner Banner**: Large avatar, name, "Winner!" text with celebration effects
- **Standings**: Ranked list of all players with final positions
- **Stats**: Duration, turns, captures, etc.
- **Play Again**: Prominent button to return to lobby
- **New Game**: Option to switch games

**Visual Notes**:
- Celebration uses confetti, glow effects, animated elements
- Winner gets special treatment (larger, centered, glowing)
- Stats are scannable but not overwhelming
- Clear call-to-action for next steps

---

## Screen 10: Profile & Stats

**Purpose**: Player profile management and historical stats.

**Layout**:
- Avatar and username header
- Stats grid (games played, wins, win rate)
- Match history list
- Edit profile button

**Key Elements**:
- **Avatar**: Large circular avatar with edit option
- **Username**: Display name with edit capability
- **Stats Cards**: Three key metrics in glass cards
- **History**: Scrollable list of past matches with game type, result, date
- **Edit Mode**: Form for updating profile

**Visual Notes**:
- Personal but consistent with game aesthetic
- Stats use the same neon accent colors
- History items use game-specific icons/colors
- Edit mode maintains glass panel styling

---

## Design Principles Summary

1. **Dark First**: All designs assume dark backgrounds with light text
2. **Neon Accents**: Use teal (#00FFAA) and purple (#995CD6) sparingly for emphasis
3. **Glass Layers**: Panels float with backdrop blur and subtle borders
4. **Two Contexts**: Every game has a "Display" version (TV) and "Controller" version (phone)
5. **Thumb Optimized**: Mobile controls prioritize bottom-screen, large touch targets
6. **Readable at Distance**: TV displays use larger type and high contrast
7. **Playful Motion**: Animations feel physical but don't obstruct gameplay
8. **Player Identity**: Consistent color coding (Red, Green, Yellow, Blue) across all games

---

## Responsive Behavior

- **Desktop/Tablet (Host)**: Centered content, max-width containers, larger spacing
- **Mobile (Controller)**: Full-width, bottom-anchored actions, compact spacing
- **TV Display**: Extra-large text, simplified layouts, high contrast, no small touch targets

---

## Accessibility Considerations

- High contrast ratios (WCAG AA minimum)
- Touch targets minimum 44x44px
- Clear focus indicators for keyboard navigation
- Color not used as sole information carrier (icons + text)
- Reduced motion support for animations
