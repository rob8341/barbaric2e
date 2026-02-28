# Barbaric! 2e - Foundry VTT System

A sword and sorcery 2d6-based tabletop RPG system for Foundry VTT v13.

## Features

### Characters
- **6 Skills**: Combat, Craft, Lore, Physical, Social, Stealth (with unique icons)
- **5 Ranks**: Experienced, Expert, Master, Grandmaster, Legend (5 XP to advance)
- **Stats**: Stamina, Defense, Armor, Hero Points, Wounds, Fatigue
- **Archetype**: Character concept as an item with icon and description
- **Combat Moves**: Organized by levels 2-5
- **Equipment**: Weapons, Armor, General Equipment with equip/unequip toggle
- **Sorcery**: Spell tracking with range and description
- **Bio**: Appearance, Personality, Motivation, Notes (resizable text fields)
- **Coins**: Gold, Silver, Copper tracking

### Weapons
- **Damage formula**: Custom damage dice
- **Attack Bonus**: Added to attack rolls
- **Type**: Crushing, Piercing, or Slashing
- **Hands**: 1H or 2H
- **Range**: Effective/Maximum (e.g., 5/10)
- **Cost**: Item value

### NPCs
- Short description (large text field)
- Stamina, Defense, Movement, Armor
- All 6 skills with roll buttons
- Weapons with attack and damage rolls
- Armor items with protection value
- Special NPC Abilities (name and description)

### Dice Rolling
- **Skill Rolls**: 2d6 + Skill + Modifier - Fatigue
- **Advantage**: Optional 3d6 drop lowest (checkbox in roll dialog)
- **Critical Success**: Double 6s (regardless of modifiers)
- **Critical Failure**: Double 1s (regardless of modifiers)
- **Attack Rolls**: 2d6 + Combat + Weapon Attack Bonus + Modifier - Fatigue
- **Damage Rolls**: Roll weapon damage formula
- **Combined Attack + Damage**: Click weapon icon to roll both together
  - Critical Hit: Deals maximum damage
  - Critical Miss: No damage rolled
- **Triage Rolls**: 2d6 - Wounds + Modifier
  - 3 or lower: 💀 Death
  - 4-5: 🩸 Critical Injury
  - 6-7: ⚠️ Severe Injury
  - 8-10: 🩹 Moderate Injury
  - 11+: ✓ Flesh Wound
- **Initiative**: 2d6 + Combat skill

### Macro Bar Support
- **Drag skill rolls** to the macro bar for quick access
- **Drag weapon icons** to create attack + damage macros
- Macros work with selected tokens or assigned characters

### Dice So Nice Integration
- Full Dice So Nice support
- Attack and damage dice roll simultaneously when using combined weapon roll
- Uses player's default dice configuration

### Visual Theme
- Dark sword and sorcery aesthetic
- Gold, bronze, and blood red accents
- Themed chat messages with matching colors
- Critical success/failure styled messages
- Triage results color-coded by severity

## Installation

### Manual Installation
1. Download the latest release zip file
2. Extract to your Foundry VTT `Data/systems/` directory
3. Restart Foundry VTT

### Manifest URL
```
https://raw.githubusercontent.com/rob8341/barbaric2e/refs/heads/main/system.json
```

## Item Types

| Item Type | Description |
|-----------|-------------|
| Weapon | Damage, attack bonus, type, hands, range, cost |
| Armor | Protection value, cost |
| Equipment | General gear with cost |
| Combat Move | Special moves with level (2-5) |
| Spell | Magical abilities with range |
| Archetype | Character concept/description |
| NPC Ability | Special monster/NPC powers |

## License

MIT License

## Credits

**Barbaric! 2e** is a tabletop RPG by **Omer Golan-Joel** from **[Stellagama Publishing](https://www.stellagama.com/)**.

This Foundry VTT system implementation is unofficial and created for personal use with the game.
