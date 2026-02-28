# Changelog

## [1.1.0] - Initial Release

### Character Sheet
- 4-tab layout: Main, Equipment, Sorcery, Bio
- 6 Skills with unique icons: Combat (fist), Craft (hammer), Lore (book), Physical (running), Social (comments), Stealth (eye-slash)
- 5 Ranks: Experienced, Expert, Master, Grandmaster, Legend
- XP tracking (5 XP to advance)
- Stamina, Defense, Armor, Hero Points
- Wounds and Fatigue tracking
- Triage roll button with injury results
- Archetype as a draggable item
- Coin tracking: Gold, Silver, Copper
- Combat Moves organized by level (2-5)
- Equipment management with equip/unequip toggle (shield icon)
- Equipped items displayed on Main tab
- Spells with range field
- Bio fields: Appearance, Personality, Motivation, Notes (all resizable)

### NPC Sheet
- Compact single-page layout
- Description text field
- Stamina, Defense, Movement, Armor stats
- All 6 skills with roll buttons
- Weapon and armor item lists
- NPC Ability items for special powers
- Scroll position preserved when adding items

### Weapons
- Damage formula field
- Attack Bonus field (adds to attack rolls)
- Type dropdown: Crushing, Piercing, Slashing
- Hands dropdown: 1H, 2H
- Range field (effective/maximum)
- Cost field
- All properties visible on item row

### Dice System
- Skill rolls: 2d6 + Skill + Modifier - Fatigue
- Advantage option: 3d6 drop lowest (checkbox in dialog)
- Critical Success: Double 6s (ignores modifiers)
- Critical Failure: Double 1s (ignores modifiers)
- Attack rolls: 2d6 + Combat + Attack Bonus + Modifier - Fatigue
- Combined weapon roll (click weapon icon):
  - Rolls attack and damage together
  - Single chat card for both
  - Critical hit = maximum damage
  - Critical miss = no damage
- Triage roll: 2d6 - Wounds + Modifier
  - Results: Death (≤3), Critical Injury (4-5), Severe Injury (6-7), Moderate Injury (8-10), Flesh Wound (11+)
- Initiative: 2d6 + Combat skill

### Macro Support
- Skill rolls draggable to macro bar
- Weapon icons draggable for attack+damage macros
- Macros work with selected token or assigned character
- Skill icons displayed on macro buttons

### Dice So Nice Integration
- Full support for Dice So Nice module
- Attack and damage dice roll simultaneously
- Uses player's default dice configuration

### Visual Theme
- Dark sword and sorcery color scheme
- Background: Dark browns (#1a1410, #2a2018)
- Accents: Gold (#c9a227), Bronze (#b87333), Blood red (#8b1a1a)
- Text: Parchment (#e8dcc4)
- Themed chat messages
- Color-coded critical success/failure
- Color-coded triage results
- Styled dice roll results in chat

### Technical
- Foundry VTT v13 compatible
- V1 Application framework
- GitHub-compatible system.json
- English localization included
