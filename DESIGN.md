---
name: BoredRoom Design System
version: 1.0.0
summary: Dark neon social party-game interface for shared-screen play and mobile controllers.
metadata:
  product: BoredRoom
  category: social party game
  platforms:
    - web
    - mobile browser
    - shared display
  visual_style:
    - dark
    - neon
    - glassmorphism
    - arcade
    - high contrast
colors:
  palette:
    background:
      value: "#0D0D12"
      type: color
      description: Deep near-black application background.
    foreground:
      value: "#F2F2F2"
      type: color
      description: Primary text on dark surfaces.
    card:
      value: "#16161D"
      type: color
      description: Elevated panel and card surface.
    card_foreground:
      value: "#F2F2F2"
      type: color
      description: Text on card surfaces.
    popover:
      value: "#16161D"
      type: color
      description: Floating menu and overlay surface.
    popover_foreground:
      value: "#F2F2F2"
      type: color
      description: Text on floating surfaces.
    muted:
      value: "#25252D"
      type: color
      description: Secondary dark surface.
    muted_foreground:
      value: "#86868D"
      type: color
      description: Secondary copy, helper text, and metadata.
    border:
      value: "#292932"
      type: color
      description: Restrained borders on dark surfaces.
    input:
      value: "#292932"
      type: color
      description: Input and control border color.
    primary:
      value: "#00FFAA"
      type: color
      description: Neon teal brand energy and primary action color.
    primary_foreground:
      value: "#0D0D12"
      type: color
      description: Text on primary neon teal.
    secondary:
      value: "#995CD6"
      type: color
      description: Purple brand accent used for emphasis and secondary identity.
    secondary_foreground:
      value: "#FFFFFF"
      type: color
      description: Text on secondary purple.
    accent:
      value: "#FF9933"
      type: color
      description: Orange highlight for calls to attention and special actions.
    accent_foreground:
      value: "#0D0D12"
      type: color
      description: Text on orange accent.
    destructive:
      value: "#E63D3D"
      type: color
      description: Error, danger, blocked state, and red player identity.
    destructive_foreground:
      value: "#FFFFFF"
      type: color
      description: Text on destructive red.
    player_red:
      value: "#E63D3D"
      type: color
      description: Red player color.
    player_green:
      value: "#22C761"
      type: color
      description: Green player color.
    player_yellow:
      value: "#FFD11A"
      type: color
      description: Yellow player color.
    player_blue:
      value: "#338CE0"
      type: color
      description: Blue player color.
    whot_circle:
      value: "#00FFAA"
      type: color
      description: Circle suit color.
    whot_triangle:
      value: "#EB4747"
      type: color
      description: Triangle suit color.
    whot_cross:
      value: "#995CD6"
      type: color
      description: Cross suit color.
    whot_square:
      value: "#478FEB"
      type: color
      description: Square suit color.
    whot_star:
      value: "#FFCC33"
      type: color
      description: Star suit color.
  gradients:
    ambient_teal:
      value: "radial-gradient(circle, rgba(0, 255, 170, 0.10) 0%, rgba(0, 255, 170, 0.00) 70%)"
      type: gradient
    ambient_purple:
      value: "radial-gradient(circle, rgba(153, 92, 214, 0.10) 0%, rgba(153, 92, 214, 0.00) 70%)"
      type: gradient
    whot_special_card:
      value: "linear-gradient(135deg, rgba(255, 153, 51, 0.25) 0%, #16161D 100%)"
      type: gradient
    card_back_pattern:
      value: "repeating-linear-gradient(45deg, #25252D 0px, #25252D 6px, #16161D 6px, #16161D 12px)"
      type: gradient
typography:
  font_families:
    display:
      value: "Space Grotesk, sans-serif"
      type: fontFamily
      description: Bold geometric display face for brand, game names, room codes, and controls.
    body:
      value: "Inter, sans-serif"
      type: fontFamily
      description: Neutral interface font for readable supporting copy and metadata.
  scale:
    display_xl:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "6rem"
        lineHeight: "1"
        fontWeight: 700
        letterSpacing: "0em"
      type: typography
    display_lg:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "4.5rem"
        lineHeight: "1"
        fontWeight: 700
        letterSpacing: "0em"
      type: typography
    display_md:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "3rem"
        lineHeight: "1.05"
        fontWeight: 700
        letterSpacing: "0em"
      type: typography
    headline_lg:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "2rem"
        lineHeight: "2.25rem"
        fontWeight: 700
        letterSpacing: "0em"
      type: typography
    headline_md:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "1.5rem"
        lineHeight: "2rem"
        fontWeight: 700
        letterSpacing: "0em"
      type: typography
    headline_sm:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "1.25rem"
        lineHeight: "1.75rem"
        fontWeight: 600
        letterSpacing: "0em"
      type: typography
    body:
      value:
        fontFamily: "Inter, sans-serif"
        fontSize: "1rem"
        lineHeight: "1.5rem"
        fontWeight: 400
        letterSpacing: "0em"
      type: typography
    body_lg:
      value:
        fontFamily: "Inter, sans-serif"
        fontSize: "1.125rem"
        lineHeight: "1.75rem"
        fontWeight: 400
        letterSpacing: "0em"
      type: typography
    body_sm:
      value:
        fontFamily: "Inter, sans-serif"
        fontSize: "0.875rem"
        lineHeight: "1.25rem"
        fontWeight: 400
        letterSpacing: "0em"
      type: typography
    label:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "0.875rem"
        lineHeight: "1.25rem"
        fontWeight: 500
        letterSpacing: "0em"
      type: typography
    label_caps:
      value:
        fontFamily: "Space Grotesk, sans-serif"
        fontSize: "0.75rem"
        lineHeight: "1rem"
        fontWeight: 600
        letterSpacing: "0.08em"
        textTransform: uppercase
      type: typography
spacing:
  scale:
    0:
      value: "0px"
      type: dimension
    1:
      value: "4px"
      type: dimension
    2:
      value: "8px"
      type: dimension
    3:
      value: "12px"
      type: dimension
    4:
      value: "16px"
      type: dimension
    5:
      value: "20px"
      type: dimension
    6:
      value: "24px"
      type: dimension
    8:
      value: "32px"
      type: dimension
    10:
      value: "40px"
      type: dimension
    12:
      value: "48px"
      type: dimension
    16:
      value: "64px"
      type: dimension
    20:
      value: "80px"
      type: dimension
    24:
      value: "96px"
      type: dimension
  layout:
    page_padding_mobile:
      value: "24px"
      type: dimension
    page_padding_desktop:
      value: "32px"
      type: dimension
    card_padding:
      value: "24px"
      type: dimension
    control_gap:
      value: "8px"
      type: dimension
    section_gap:
      value: "40px"
      type: dimension
radii:
  sm:
    value: "8px"
    type: dimension
  md:
    value: "10px"
    type: dimension
  lg:
    value: "12px"
    type: dimension
  xl:
    value: "16px"
    type: dimension
  2xl:
    value: "24px"
    type: dimension
  full:
    value: "9999px"
    type: dimension
borders:
  default:
    value:
      width: "1px"
      style: solid
      color: "#292932"
    type: border
  neon:
    value:
      width: "1px"
      style: solid
      color: "rgba(0, 255, 170, 0.50)"
    type: border
  legal:
    value:
      width: "2px"
      style: solid
      color: "#00FFAA"
    type: border
  blocked:
    value:
      width: "2px"
      style: solid
      color: "rgba(230, 61, 61, 0.50)"
    type: border
shadows:
  sm:
    value: "0 1px 2px rgba(0, 0, 0, 0.30)"
    type: shadow
  md:
    value: "0 8px 24px rgba(0, 0, 0, 0.35)"
    type: shadow
  lg:
    value: "0 24px 48px rgba(0, 0, 0, 0.45)"
    type: shadow
  neon_text:
    value: "0 0 10px rgba(0, 255, 170, 0.60), 0 0 30px rgba(0, 255, 170, 0.30), 0 0 60px rgba(0, 255, 170, 0.10)"
    type: shadow
  neon_box:
    value: "0 0 10px rgba(0, 255, 170, 0.30), 0 0 30px rgba(0, 255, 170, 0.10), inset 0 0 10px rgba(0, 255, 170, 0.05)"
    type: shadow
  neon_border:
    value: "0 0 8px rgba(0, 255, 170, 0.20)"
    type: shadow
  legal_card:
    value: "0 0 0 1px rgba(0, 255, 170, 0.25), 0 8px 20px rgba(0, 255, 170, 0.20)"
    type: shadow
elevation:
  surface:
    value:
      background: "#16161D"
      border: "1px solid #292932"
      shadow: "0 1px 2px rgba(0, 0, 0, 0.30)"
    type: composition
  glass:
    value:
      background: "rgba(22, 22, 29, 0.60)"
      border: "1px solid rgba(41, 41, 50, 0.50)"
      backdropFilter: "blur(12px)"
      shadow: "0 8px 24px rgba(0, 0, 0, 0.35)"
    type: composition
  overlay:
    value:
      background: "rgba(22, 22, 29, 0.88)"
      border: "1px solid rgba(41, 41, 50, 0.70)"
      backdropFilter: "blur(16px)"
      shadow: "0 24px 48px rgba(0, 0, 0, 0.45)"
    type: composition
motion:
  durations:
    instant:
      value: "100ms"
      type: duration
    fast:
      value: "200ms"
      type: duration
    base:
      value: "350ms"
      type: duration
    entrance:
      value: "400ms"
      type: duration
    hero:
      value: "600ms"
      type: duration
    dice_roll:
      value: "600ms"
      type: duration
    pulse:
      value: "2000ms"
      type: duration
    float:
      value: "3000ms"
      type: duration
  easing:
    standard:
      value: "ease-out"
      type: cubicBezier
    accordion:
      value: "ease-out"
      type: cubicBezier
    playful:
      value: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      type: cubicBezier
  transforms:
    hover_lift:
      value: "translateY(-4px)"
      type: transform
    tap_press:
      value: "scale(0.93)"
      type: transform
    controller_press:
      value: "scale(0.95)"
      type: transform
    card_hover_scale:
      value: "scale(1.02)"
      type: transform
layout:
  max_widths:
    entry_content:
      value: "768px"
      type: dimension
    form_panel:
      value: "448px"
      type: dimension
    commentary:
      value: "768px"
      type: dimension
    container_2xl:
      value: "1400px"
      type: dimension
  breakpoints:
    mobile:
      value: "0px"
      type: dimension
    tablet:
      value: "640px"
      type: dimension
    desktop:
      value: "1024px"
      type: dimension
    wide:
      value: "1400px"
      type: dimension
  z_index:
    base:
      value: 0
      type: number
    content:
      value: 10
      type: number
    overlay:
      value: 30
      type: number
components:
  primary_button:
    value:
      background: "#00FFAA"
      color: "#0D0D12"
      minHeight: "40px"
      paddingInline: "16px"
      borderRadius: "10px"
      fontFamily: "Space Grotesk, sans-serif"
      fontWeight: 500
      hoverBackground: "#00E69A"
    type: composition
  secondary_button:
    value:
      background: "#995CD6"
      color: "#FFFFFF"
      minHeight: "40px"
      paddingInline: "16px"
      borderRadius: "10px"
      fontFamily: "Space Grotesk, sans-serif"
      fontWeight: 500
      hoverBackground: "#8A53C1"
    type: composition
  outline_button:
    value:
      background: "#0D0D12"
      color: "#F2F2F2"
      border: "1px solid #292932"
      minHeight: "40px"
      paddingInline: "16px"
      borderRadius: "10px"
      hoverBackground: "#FF9933"
      hoverColor: "#0D0D12"
    type: composition
  ghost_button:
    value:
      background: "transparent"
      color: "#86868D"
      minHeight: "36px"
      paddingInline: "12px"
      borderRadius: "10px"
      hoverBackground: "#FF9933"
      hoverColor: "#0D0D12"
    type: composition
  glass_game_card:
    value:
      background: "rgba(22, 22, 29, 0.60)"
      border: "1px solid rgba(41, 41, 50, 0.50)"
      backdropFilter: "blur(12px)"
      borderRadius: "24px"
      padding: "24px"
      hoverScale: "1.02"
      hoverBorderColor: "rgba(0, 255, 170, 0.50)"
    type: composition
  brand_title:
    value:
      fontFamily: "Space Grotesk, sans-serif"
      fontWeight: 700
      color: "#F2F2F2"
      accentColor: "#995CD6"
      textShadow: "0 0 10px rgba(0, 255, 170, 0.60), 0 0 30px rgba(0, 255, 170, 0.30), 0 0 60px rgba(0, 255, 170, 0.10)"
    type: composition
  commentary_ticker:
    value:
      position: "fixed bottom center"
      maxWidth: "768px"
      background: "rgba(22, 22, 29, 0.60)"
      border: "1px solid rgba(0, 255, 170, 0.50)"
      borderRadius: "24px"
      padding: "12px 20px"
      iconColor: "#00FFAA"
      shadow: "0 24px 48px rgba(0, 0, 0, 0.45)"
    type: composition
  ai_status_chip:
    value:
      borderRadius: "9999px"
      padding: "4px 10px"
      fontFamily: "Space Grotesk, sans-serif"
      fontSize: "0.75rem"
      textTransform: uppercase
      activeBackground: "rgba(0, 255, 170, 0.12)"
      activeColor: "#00FFAA"
      fallbackBackground: "rgba(255, 209, 26, 0.12)"
      fallbackColor: "#FFD11A"
      degradedBackground: "rgba(255, 153, 51, 0.12)"
      degradedColor: "#FF9933"
      offlineBackground: "rgba(134, 134, 141, 0.12)"
      offlineColor: "#86868D"
    type: composition
  ludo_board:
    value:
      background: "#16161D"
      border: "1px solid #292932"
      borderRadius: "16px"
      playerColors:
        red: "#E63D3D"
        green: "#22C761"
        yellow: "#FFD11A"
        blue: "#338CE0"
    type: composition
  ludo_token:
    value:
      borderRadius: "9999px"
      border: "2px solid rgba(242, 242, 242, 0.70)"
      shadow: "0 8px 24px rgba(0, 0, 0, 0.35)"
      selectedShadow: "0 0 10px rgba(0, 255, 170, 0.30), 0 0 30px rgba(0, 255, 170, 0.10)"
    type: composition
  whot_card:
    value:
      background: "#16161D"
      color: "#F2F2F2"
      border: "1px solid #292932"
      borderRadius: "8px"
      fontFamily: "Space Grotesk, sans-serif"
      fontWeight: 700
      smallSize: "44px 64px"
      mediumSize: "64px 92px"
      largeSize: "96px 136px"
    type: composition
  whot_card_back:
    value:
      background: "repeating-linear-gradient(45deg, #25252D 0px, #25252D 6px, #16161D 6px, #16161D 12px)"
      border: "1px solid #292932"
      borderRadius: "8px"
    type: composition
  whot_legal_state:
    value:
      border: "2px solid #00FFAA"
      shadow: "0 0 0 1px rgba(0, 255, 170, 0.25), 0 8px 20px rgba(0, 255, 170, 0.20)"
    type: composition
  whot_blocked_state:
    value:
      border: "2px solid rgba(230, 61, 61, 0.50)"
      opacity: 0.8
    type: composition
  player_status_row:
    value:
      background: "rgba(22, 22, 29, 0.60)"
      border: "1px solid rgba(41, 41, 50, 0.50)"
      borderRadius: "16px"
      padding: "12px 16px"
      gap: "12px"
    type: composition
  room_code_panel:
    value:
      background: "rgba(22, 22, 29, 0.60)"
      border: "1px solid rgba(0, 255, 170, 0.50)"
      borderRadius: "24px"
      codeFontFamily: "Space Grotesk, sans-serif"
      codeFontWeight: 700
      codeColor: "#00FFAA"
      codeTextShadow: "0 0 10px rgba(0, 255, 170, 0.60), 0 0 30px rgba(0, 255, 170, 0.30)"
    type: composition
  qr_panel:
    value:
      background: "#F2F2F2"
      foreground: "#0D0D12"
      borderRadius: "16px"
      padding: "16px"
    type: composition
  mobile_controller_action_bar:
    value:
      position: "fixed bottom"
      background: "rgba(22, 22, 29, 0.88)"
      borderTop: "1px solid rgba(41, 41, 50, 0.70)"
      backdropFilter: "blur(16px)"
      padding: "16px"
      minButtonHeight: "60px"
    type: composition
---

# BoredRoom Design System

## Overview

BoredRoom is a dark neon social party-game interface built for people playing together in the same physical room. The visual identity should feel like a compact arcade table brought into a browser: high contrast, energetic, readable from across a room, and fast enough for thumb-driven mobile play.

The interface is not a corporate dashboard and not a generic game skin. It should feel atmospheric without becoming noisy: deep black-blue surfaces, restrained glass panels, sharp neon teal energy, purple brand accents, orange action highlights, and bright player colors that remain instantly distinguishable during play.

The product has two complementary modes:

- **Shared display mode:** optimized for spectators and players looking at a TV, projector, laptop, or shared monitor. Information must be large, centered, glanceable, and theatrical.
- **Mobile controller mode:** optimized for speed, touch comfort, private information, and clear turn actions. Controls should be thumb-friendly and never require careful aiming during live play.

## Colors

The color system is anchored by a near-black background and luminous accents. Dark surfaces should dominate the experience, while neon color should be used to communicate state, player identity, and action priority.

### Brand colors

- **Neon teal** is the primary energy color. Use it for primary actions, live status, legal moves, active indicators, and the glow around the BoredRoom identity.
- **Purple** is the secondary brand color. Use it for the “Room” emphasis, secondary actions, beta indicators, and cross-suit Whot identity.
- **Orange** is the attention color. Use it for special game events, highlighted Whot states, warnings that are not destructive, and moments that need warmth or urgency.
- **Red** is destructive and also a player color. When used for gameplay identity, keep context clear so it does not read as an error.

### Surface colors

Surfaces should remain very dark. Cards, panels, menus, and overlays should be only slightly lighter than the page background. Borders should be visible but restrained, usually appearing as low-contrast outlines rather than bright frames.

Glass panels should use translucent dark surfaces with blur. They should feel like game HUD panels floating over an atmospheric background, not like heavy modal containers.

### Player and suit colors

Player colors must be bright and immediately distinguishable: red, green, yellow, and blue. These colors carry gameplay meaning and should not be diluted into muted variants when used for tokens, board zones, or player status.

Whot suits should use consistent symbolic color:

- Circle: neon teal
- Triangle: red
- Cross: purple
- Square: blue
- Star: yellow
- Whot special cards: orange or orange-tinted dark gradient

## Typography

The typography pairing is bold and direct:

- **Space Grotesk** carries the brand, room codes, game names, headings, labels, and major controls.
- **Inter** carries body copy, metadata, descriptions, and longer supporting text.

Headings should feel geometric and game-like without becoming novelty typography. Body text should be calm and readable so the neon palette remains the expressive layer.

Use uppercase labels sparingly for chips, badges, room metadata, and compact status indicators. Uppercase labels should have positive letter spacing and never use negative tracking.

Hero and display text should be large, centered, and confident. On shared screens, important game state should be readable at a distance. On mobile controllers, labels should be short and paired with strong layout hierarchy rather than long explanatory copy.

## Layout

BoredRoom layouts should be centered, purposeful, and focused on the active game moment.

Entry screens use a centered vertical composition: brand mark, glowing title, concise description, game choices, then small status claims. The background may contain large, soft ambient radial glows, but these should stay subtle and never compete with text.

Game screens should prioritize the current turn, playable state, room code, player list, and action controls. Avoid decorative layout complexity during live play. The interface should always answer:

1. Whose turn is it?
2. What just happened?
3. What can I do now?
4. What state is private versus public?

Mobile controller screens should reserve the bottom area for primary actions. Action controls should be large, stable, and reachable. Avoid controls shifting during state updates.

Shared display screens should use larger type, stronger spacing, and visual grouping suitable for spectators. Private player information must not appear on the shared display.

## Elevation & Depth

Depth comes from three layers:

1. **Atmosphere:** dark background with subtle teal and purple radial light.
2. **Glass HUD surfaces:** translucent panels with blur and restrained borders.
3. **Neon emphasis:** glows used only for brand identity, active status, legal moves, and special moments.

Do not overuse glow. Neon effects should make important moments feel alive, not turn every element into a light source. Most UI should remain flat, dark, and legible, with glow reserved for hierarchy.

Cards and overlays should have soft dark shadows. Avoid bright white shadows or glossy highlights. BoredRoom should feel like a night-mode arcade HUD, not a skeuomorphic object interface.

## Shapes

The shape language is rounded but not overly soft.

- Standard controls use medium radii around 8–12px.
- Game cards and panels may use larger radii around 16–24px.
- Chips, status dots, tokens, and avatars use full pill or circular radii.
- Whot cards use tighter radii so they still feel like physical cards.

Touch targets should be generous. Mobile game controls should feel sturdy and easy to hit quickly.

## Motion

Motion should feel playful, quick, and readable. Use it to show state changes, not to decorate every interaction.

Recommended motion behaviors:

- Entry content fades and rises into place.
- Game cards lift slightly on hover.
- Playable cards press down on tap.
- Controller buttons scale down briefly when activated.
- Neon status indicators pulse slowly.
- Dice rolls use a short, energetic rotation.
- Commentary appears from below and exits quickly without blocking play.

Respect reduced-motion preferences by removing nonessential looping or decorative motion while preserving state changes.

## Components

### Brand title

The BoredRoom wordmark should be large, centered, and glowing. The core brand text uses foreground white with teal glow, while “Room” receives purple emphasis. The title is a first-viewport identity signal and should never be reduced to only a small nav label on entry screens.

### Game selection cards

Game selection cards are dark glass panels with large emoji or icon identity, bold game names, short taglines, and subtle hover lift. They should feel like choosing a game mode from an arcade menu.

### Buttons

Primary buttons are neon teal with dark text. They should be reserved for the main action. Secondary buttons are purple. Ghost buttons should remain quiet until hover or focus. Destructive actions use red only when the action is truly dangerous or irreversible.

Buttons should include icons when they represent familiar actions. Text should remain short and should not wrap awkwardly.

### Commentary ticker

The commentary ticker is a bottom-centered glass HUD element with a neon border and sparkle icon. It should feel like a live announcer overlay. It must not permanently block core gameplay controls, especially on mobile.

### AI status chip

The AI status chip is compact and operational. It should communicate whether commentary is live, degraded, in fallback, or offline without drawing more attention than the game state itself.

### Ludo board and tokens

The Ludo board should use strong player colors and clear positional contrast. Tokens should be circular, tactile, and easy to distinguish. Selected or movable tokens can receive neon emphasis, but the board should remain readable without relying only on glow.

### Whot cards

Whot cards are compact dark cards with bold geometric symbols and suit colors. Values appear in opposing corners. Legal cards receive teal emphasis; blocked cards receive red restraint and reduced opacity; selected cards receive a clear active ring.

Whot special cards should feel distinct through orange accenting or a warm tinted gradient, but they should still belong to the same dark card family.

### Room code and QR panels

Room codes should be large, high-contrast, and glow with primary teal. QR panels may invert to a light surface for scan reliability, but they should remain visually contained with rounded corners and sufficient padding.

### Mobile controller action bar

The mobile controller action bar is fixed near the bottom, dark, blurred, and stable. Primary actions should be large enough for thumbs and should not jump position when state changes. Private hand information and pending action state should be clear without being exposed on shared displays.

## Do’s and Don’ts

### Do

- Use near-black backgrounds as the default canvas.
- Use neon teal for primary action, live state, and playable state.
- Keep player colors bright and consistent.
- Use glass panels for HUD-like grouping.
- Keep shared-screen UI readable from a distance.
- Keep mobile controls stable, large, and thumb-friendly.
- Use motion to clarify turn changes, actions, and feedback.
- Reserve glow for hierarchy and moments of importance.

### Don’t

- Do not make the interface bright or white-dominant.
- Do not replace the neon arcade identity with a generic SaaS dashboard look.
- Do not overuse purple gradients or make the palette one-note.
- Do not use tiny controls for live gameplay actions.
- Do not expose private card hands on shared display surfaces.
- Do not let decorative glow reduce text contrast.
- Do not use long instructional copy in active gameplay areas.
- Do not allow cards, buttons, or status text to resize the layout during play.
