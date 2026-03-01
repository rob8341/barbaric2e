// Barbaric! 2e System for Foundry VTT v13

// Register Handlebars helpers
Hooks.once("init", async function() {
  console.log("Barbaric! 2e | Initializing system");

  // Configure combat initiative - 2d6 + Combat skill
  CONFIG.Combat.initiative = {
    formula: "2d6 + @skills.combat",
    decimals: 2
  };

  // Handlebars helpers
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("lookup", (obj, key) => obj?.[key]);
  Handlebars.registerHelper("capitalize", (str) => str?.charAt(0).toUpperCase() + str?.slice(1));

  // Register sheets
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("barbaric2e", Barbaric2eActorSheet, { 
    types: ["character"],
    makeDefault: true 
  });
  Actors.registerSheet("barbaric2e", Barbaric2eNPCSheet, { 
    types: ["npc"],
    makeDefault: true 
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("barbaric2e", Barbaric2eItemSheet, { makeDefault: true });
});

// Handle macro bar drops and set up API
Hooks.once("ready", async function() {
  // Set up API for macros
  game.barbaric2e = {
    rollSkill: rollSkillMacro,
    rollWeapon: rollWeaponMacro
  };
  
  // Handle hotbar drop
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type === "barbaric2e-skill" || data.type === "barbaric2e-weapon") {
      createBarbaric2eMacro(data, slot);
      return false;
    }
  });
});

// Skill roll macro function
async function rollSkillMacro(actor, skill) {
  const skillValue = actor.system.skills[skill] || 0;
  const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
  const fatigue = parseInt(actor.system.fatigue) || 0;
  
  const fatigueNote = fatigue > 0 ? `<br><small style="color: #dd4444;">Fatigue: -${fatigue}</small>` : "";
  const content = `
    <form>
      <div style="margin-bottom: 10px;">
        <strong>Rolling ${skillName}</strong><br>
        <small>Base: 2d6 + ${skillValue}</small>${fatigueNote}
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <label style="margin: 0;">Modifier:</label>
        <input type="number" name="modifier" value="0" style="width: 60px;"/>
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" name="advantage" id="macro-advantage-check" style="width: 16px; height: 16px;"/>
        <label for="macro-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
      </div>
    </form>
  `;
  
  new Dialog({
    title: `Roll ${skillName}`,
    content: content,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice"></i>',
        label: "Roll",
        callback: async (html) => {
          const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
          const advantage = html.find('[name="advantage"]').is(':checked');
          const totalMod = modifier - fatigue;
          
          let formula;
          if (advantage) {
            formula = totalMod !== 0 ? `3d6kh2 + ${skillValue} + ${totalMod}` : `3d6kh2 + ${skillValue}`;
          } else {
            formula = totalMod !== 0 ? `2d6 + ${skillValue} + ${totalMod}` : `2d6 + ${skillValue}`;
          }
          
          const roll = new Roll(formula);
          await roll.evaluate();
          
          let critMessage = "";
          if (roll.dice[0]) {
            const keptDice = roll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
            if (keptDice[0] === 6 && keptDice[1] === 6) {
              critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL SUCCESS! ⚔️</strong></div>`;
            } else if (keptDice[0] === 1 && keptDice[1] === 1) {
              critMessage = `<div class="critical-failure"><strong>💀 CRITICAL FAILURE! 💀</strong></div>`;
            }
          }
          
          const advantageText = advantage ? " (Advantage)" : "";
          const flavorContent = `
            <div class="barbaric2e-roll">
              <div class="roll-header">${skillName} Check${advantageText}</div>
              ${critMessage}
            </div>
          `;
          roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorContent
          });
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "roll"
  }).render(true);
}

// Weapon roll macro function
async function rollWeaponMacro(actor, item) {
  const combatSkill = actor.system.skills.combat || 0;
  const attackBonus = parseInt(item.system.attackBonus) || 0;
  const fatigue = parseInt(actor.system.fatigue) || 0;
  
  const fatigueNote = fatigue > 0 ? `<br><small style="color: #dd4444;">Fatigue: -${fatigue}</small>` : "";
  const attackBonusNote = attackBonus !== 0 ? `<br><small style="color: #44dd44;">Weapon Bonus: +${attackBonus}</small>` : "";
  const damageNote = item.system.damage ? `<br><small>Damage: ${item.system.damage}</small>` : "";
  const content = `
    <form>
      <div style="margin-bottom: 10px;">
        <strong>Attack with ${item.name}</strong><br>
        <small>Base: 2d6 + ${combatSkill} (Combat)</small>${attackBonusNote}${fatigueNote}${damageNote}
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <label style="margin: 0;">Modifier:</label>
        <input type="number" name="modifier" value="0" style="width: 60px;"/>
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" name="advantage" id="macro-weapon-advantage-check" style="width: 16px; height: 16px;"/>
        <label for="macro-weapon-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
      </div>
    </form>
  `;
  
  new Dialog({
    title: `Attack with ${item.name}`,
    content: content,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice"></i>',
        label: "Roll",
        callback: async (html) => {
          const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
          const advantage = html.find('[name="advantage"]').is(':checked');
          const totalMod = modifier + attackBonus - fatigue;
          
          let formula;
          if (advantage) {
            formula = totalMod !== 0 ? `3d6kh2 + ${combatSkill} + ${totalMod}` : `3d6kh2 + ${combatSkill}`;
          } else {
            formula = totalMod !== 0 ? `2d6 + ${combatSkill} + ${totalMod}` : `2d6 + ${combatSkill}`;
          }
          
          const attackRoll = new Roll(formula);
          await attackRoll.evaluate();
          
          let isCriticalHit = false;
          let isCriticalFail = false;
          let critMessage = "";
          if (attackRoll.dice[0]) {
            const keptDice = attackRoll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
            if (keptDice[0] === 6 && keptDice[1] === 6) {
              isCriticalHit = true;
              critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL HIT! ⚔️</strong></div>`;
            } else if (keptDice[0] === 1 && keptDice[1] === 1) {
              isCriticalFail = true;
              critMessage = `<div class="critical-failure"><strong>💀 CRITICAL MISS! 💀</strong></div>`;
            }
          }
          
          const advantageText = advantage ? " (Advantage)" : "";
          
          let damageSection = "";
          let damageRoll = null;
          let maxDamage = 0;
          
          if (item.system.damage && !isCriticalFail) {
            damageRoll = new Roll(item.system.damage);
            await damageRoll.evaluate();
            
            if (isCriticalHit) {
              for (const term of damageRoll.terms) {
                if (term.faces) {
                  maxDamage += (term.number || 1) * term.faces;
                } else if (term.number !== undefined) {
                  maxDamage += term.number;
                }
              }
              
              damageSection = `
                <div class="damage-section">
                  <div class="roll-header" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage</div>
                  <div class="critical-success"><strong>MAXIMUM DAMAGE: ${maxDamage}</strong></div>
                </div>
              `;
            } else {
              const damageRollHtml = await damageRoll.render();
              damageSection = `
                <div class="damage-section">
                  <div class="roll-header" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage</div>
                  ${damageRollHtml}
                </div>
              `;
            }
          }
          
          if (game.dice3d) {
            const dicePromises = [game.dice3d.showForRoll(attackRoll, game.user, true)];
            if (damageRoll && !isCriticalHit) {
              dicePromises.push(game.dice3d.showForRoll(damageRoll, game.user, true));
            }
            await Promise.all(dicePromises);
          }
          
          const attackRollHtml = await attackRoll.render();
          
          const messageContent = `
            <div class="barbaric2e-roll">
              <div class="roll-header">${item.name} Attack${advantageText}</div>
              ${critMessage}
              ${attackRollHtml}
              ${damageSection}
            </div>
          `;
          
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: messageContent
          });
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "roll"
  }).render(true);
}

// Create a macro from dropped data
async function createBarbaric2eMacro(data, slot) {
  let command = "";
  let name = "";
  let img = "icons/svg/dice-target.svg";
  
  if (data.type === "barbaric2e-skill") {
    name = `Roll ${data.skillName}`;
    img = getSkillIcon(data.skill);
    // Store actorId in the macro for fallback
    command = `// Roll ${data.skillName}
let actor = game.actors.get("${data.actorId}");
if (!actor) {
  const token = canvas.tokens.controlled[0];
  actor = token?.actor ?? game.user.character;
}
if (!actor) {
  return ui.notifications.warn("Please select a token or assign a character.");
}
game.barbaric2e.rollSkill(actor, "${data.skill}");`;
  } else if (data.type === "barbaric2e-weapon") {
    name = `Attack: ${data.weaponName}`;
    img = data.img || "icons/svg/sword.svg";
    // Store actorId in the macro for fallback
    command = `// Attack with ${data.weaponName}
let actor = game.actors.get("${data.actorId}");
if (!actor) {
  const token = canvas.tokens.controlled[0];
  actor = token?.actor ?? game.user.character;
}
if (!actor) {
  return ui.notifications.warn("Please select a token or assign a character.");
}
const item = actor.items.get("${data.itemId}");
if (!item) {
  return ui.notifications.warn("Weapon not found on this actor.");
}
game.barbaric2e.rollWeapon(actor, item);`;
  }
  
  // Check if a macro with this name already exists
  let macro = game.macros.find(m => m.name === name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: name,
      type: "script",
      img: img,
      command: command,
      flags: { "barbaric2e.skillMacro": true }
    });
  }
  
  game.user.assignHotbarMacro(macro, slot);
}

// Get Foundry core icon path for skills
function getSkillIcon(skill) {
  const icons = {
    combat: "icons/skills/melee/hand-grip-sword-red.webp",
    craft: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    lore: "icons/sundries/books/book-worn-brown.webp",
    physical: "icons/skills/movement/figure-running-gray.webp",
    social: "icons/skills/social/diplomacy-handshake.webp",
    stealth: "icons/magic/perception/eye-ringed-glow-angry-small-red.webp"
  };
  return icons[skill] || "icons/svg/dice-target.svg";
}

// Actor Sheet
class Barbaric2eActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["barbaric2e", "sheet", "actor"],
      template: "systems/barbaric2e/actor-sheet.hbs",
      width: 650,
      height: 750,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);
    
    context.system = actorData.system;
    context.flags = actorData.flags;
    
    // Organize items
    context.archetype = this.actor.items.find(i => i.type === "archetype");
    context.weapons = this.actor.items.filter(i => i.type === "weapon");
    context.armors = this.actor.items.filter(i => i.type === "armor");
    context.equipment = this.actor.items.filter(i => i.type === "equipment");
    context.spells = this.actor.items.filter(i => i.type === "spell");
    context.equippedItems = this.actor.items.filter(i => 
      (i.type === "weapon" || i.type === "armor" || i.type === "equipment") && i.system.equipped
    );
    
    // Combat moves by level
    context.combatMoves = { 2: [], 3: [], 4: [], 5: [] };
    this.actor.items.filter(i => i.type === "combatMove").forEach(m => {
      const lvl = parseInt(m.system.level) || 2;
      if (context.combatMoves[lvl]) context.combatMoves[lvl].push(m);
    });
    
    // Skill icons
    context.skillIcons = {
      combat: "fa-fist-raised",
      craft: "fa-hammer",
      lore: "fa-book",
      physical: "fa-running",
      social: "fa-comments",
      stealth: "fa-eye-slash"
    };
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    if (!this.isEditable) return;
    
    // Roll skills
    html.find(".roll-skill").click(this._onRollSkill.bind(this));
    
    // Roll attack
    html.find(".roll-attack").click(this._onRollAttack.bind(this));
    
    // Roll damage
    html.find(".roll-damage").click(this._onRollDamage.bind(this));
    
    // Roll weapon (combined attack + damage)
    html.find(".roll-weapon").click(this._onRollWeapon.bind(this));
    
    // Roll triage
    html.find(".roll-triage").click(this._onRollTriage.bind(this));
    
    // Item controls
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-chat").click(this._onItemChat.bind(this));
    html.find(".item-equip").click(this._onItemEquip.bind(this));
    
    // Open item sheets on name click
    html.find(".item-name").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const item = this.actor.items.get(itemId);
      item?.sheet.render(true);
    });
    
    // Open archetype sheet on archetype item click
    html.find(".archetype-item").click(ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      item?.sheet.render(true);
    });
    
    // Drag handlers for macro bar
    html.find(".roll-skill").each((i, el) => {
      el.setAttribute("draggable", true);
      el.addEventListener("dragstart", ev => this._onDragSkillStart(ev));
    });
    
    html.find(".weapon-icon.roll-weapon").each((i, el) => {
      el.setAttribute("draggable", true);
      el.addEventListener("dragstart", ev => this._onDragWeaponStart(ev));
    });
  }
  
  _onDragSkillStart(event) {
    const skill = event.currentTarget.dataset.skill;
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "barbaric2e-skill",
      skill: skill,
      skillName: skillName,
      actorId: this.actor.id
    }));
  }
  
  _onDragWeaponStart(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "barbaric2e-weapon",
      itemId: item.id,
      weaponName: item.name,
      img: item.img,
      actorId: this.actor.id
    }));
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const skill = event.currentTarget.dataset.skill;
    const skillValue = this.actor.system.skills[skill] || 0;
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
    const fatigue = parseInt(this.actor.system.fatigue) || 0;
    
    // Ask for modifier and advantage
    const fatigueNote = fatigue > 0 ? `<br><small style="color: #dd4444;">Fatigue: -${fatigue}</small>` : "";
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Rolling ${skillName}</strong><br>
          <small>Base: 2d6 + ${skillValue}</small>${fatigueNote}
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="advantage-check" style="width: 16px; height: 16px;"/>
          <label for="advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Roll ${skillName}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            const totalMod = modifier - fatigue;
            
            let formula;
            if (advantage) {
              formula = totalMod !== 0 
                ? `3d6kh2 + ${skillValue} + ${totalMod}` 
                : `3d6kh2 + ${skillValue}`;
            } else {
              formula = totalMod !== 0 
                ? `2d6 + ${skillValue} + ${totalMod}` 
                : `2d6 + ${skillValue}`;
            }
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            // Check for critical success/failure (based on kept dice only)
            let critMessage = "";
            if (roll.dice[0]) {
              const keptDice = roll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL SUCCESS! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL FAILURE! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">${skillName} Check${advantageText}</div>
                ${critMessage}
              </div>
            `;
            roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavorContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollAttack(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    const combatSkill = this.actor.system.skills.combat || 0;
    const attackBonus = parseInt(item.system.attackBonus) || 0;
    const fatigue = parseInt(this.actor.system.fatigue) || 0;
    
    // Ask for modifier and advantage
    const fatigueNote = fatigue > 0 ? `<br><small style="color: #dd4444;">Fatigue: -${fatigue}</small>` : "";
    const attackBonusNote = attackBonus !== 0 ? `<br><small style="color: #44dd44;">Weapon Bonus: +${attackBonus}</small>` : "";
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Attack with ${item.name}</strong><br>
          <small>Base: 2d6 + ${combatSkill} (Combat)</small>${attackBonusNote}${fatigueNote}
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="attack-advantage-check" style="width: 16px; height: 16px;"/>
          <label for="attack-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Attack with ${item.name}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            const totalMod = modifier + attackBonus - fatigue;
            
            let formula;
            if (advantage) {
              formula = totalMod !== 0 
                ? `3d6kh2 + ${combatSkill} + ${totalMod}` 
                : `3d6kh2 + ${combatSkill}`;
            } else {
              formula = totalMod !== 0 
                ? `2d6 + ${combatSkill} + ${totalMod}` 
                : `2d6 + ${combatSkill}`;
            }
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            // Check for critical success/failure (based on kept dice only)
            let critMessage = "";
            if (roll.dice[0]) {
              const keptDice = roll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL SUCCESS! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL FAILURE! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">
                  <img src="${item.img}" class="chat-item-icon" />
                  <span>${item.name} Attack${advantageText}</span>
                </div>
                ${critMessage}
              </div>
            `;
            roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavorContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollDamage(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item || !item.system.damage) {
      ui.notifications.warn("This weapon has no damage formula.");
      return;
    }
    
    const roll = new Roll(item.system.damage);
    await roll.evaluate();
    
    const damageType = item.system.type ? ` (${item.system.type})` : "";
    const flavorContent = `
      <div class="barbaric2e-roll">
        <div class="roll-header">
          <img src="${item.img}" class="chat-item-icon" />
          <span>${item.name} Damage${damageType}</span>
        </div>
      </div>
    `;
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorContent
    });
  }

  async _onRollWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    const combatSkill = this.actor.system.skills.combat || 0;
    const attackBonus = parseInt(item.system.attackBonus) || 0;
    const fatigue = parseInt(this.actor.system.fatigue) || 0;
    
    // Ask for modifier and advantage
    const fatigueNote = fatigue > 0 ? `<br><small style="color: #dd4444;">Fatigue: -${fatigue}</small>` : "";
    const attackBonusNote = attackBonus !== 0 ? `<br><small style="color: #44dd44;">Weapon Bonus: +${attackBonus}</small>` : "";
    const damageNote = item.system.damage ? `<br><small>Damage: ${item.system.damage}</small>` : "";
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Attack with ${item.name}</strong><br>
          <small>Base: 2d6 + ${combatSkill} (Combat)</small>${attackBonusNote}${fatigueNote}${damageNote}
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="weapon-advantage-check" style="width: 16px; height: 16px;"/>
          <label for="weapon-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Attack with ${item.name}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            const totalMod = modifier + attackBonus - fatigue;
            
            let formula;
            if (advantage) {
              formula = totalMod !== 0 
                ? `3d6kh2 + ${combatSkill} + ${totalMod}` 
                : `3d6kh2 + ${combatSkill}`;
            } else {
              formula = totalMod !== 0 
                ? `2d6 + ${combatSkill} + ${totalMod}` 
                : `2d6 + ${combatSkill}`;
            }
            
            const attackRoll = new Roll(formula);
            await attackRoll.evaluate();
            
            // Check for critical success/failure (based on kept dice only)
            let isCriticalHit = false;
            let isCriticalFail = false;
            let critMessage = "";
            if (attackRoll.dice[0]) {
              const keptDice = attackRoll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                isCriticalHit = true;
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL HIT! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                isCriticalFail = true;
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL MISS! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            
            // Build combined chat card content
            let damageSection = "";
            let damageRoll = null;
            let maxDamage = 0;
            
            if (item.system.damage && !isCriticalFail) {
              damageRoll = new Roll(item.system.damage);
              await damageRoll.evaluate();
              
              if (isCriticalHit) {
                // Calculate max damage from formula
                for (const term of damageRoll.terms) {
                  if (term.faces) {
                    maxDamage += (term.number || 1) * term.faces;
                  } else if (term.number !== undefined) {
                    maxDamage += term.number;
                  }
                }
                
                const damageType = item.system.type ? ` (${item.system.type})` : "";
                damageSection = `
                  <div class="damage-section">
                    <div class="roll-label" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage${damageType}</div>
                    <div class="critical-success"><strong>MAXIMUM DAMAGE: ${maxDamage}</strong></div>
                  </div>
                `;
              } else {
                const damageRollHtml = await damageRoll.render();
                const damageType = item.system.type ? ` (${item.system.type})` : "";
                damageSection = `
                  <div class="damage-section">
                    <div class="roll-label" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage${damageType}</div>
                    ${damageRollHtml}
                  </div>
                `;
              }
            }
            
            // Show Dice So Nice for both rolls together
            if (game.dice3d) {
              const dicePromises = [
                game.dice3d.showForRoll(attackRoll, game.user, true)
              ];
              
              if (damageRoll && !isCriticalHit) {
                dicePromises.push(
                  game.dice3d.showForRoll(damageRoll, game.user, true)
                );
              }
              
              await Promise.all(dicePromises);
            }
            
            // Get attack roll HTML
            const attackRollHtml = await attackRoll.render();
            
            // Create combined message content
            const messageContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">
                  <img src="${item.img}" class="chat-item-icon" />
                  <span>${item.name} Attack${advantageText}</span>
                </div>
                ${critMessage}
                ${attackRollHtml}
                ${damageSection}
              </div>
            `;
            
            // Create message WITHOUT rolls array to prevent double dice animation
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: messageContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollTriage(event) {
    event.preventDefault();
    const wounds = parseInt(this.actor.system.wounds) || 0;
    
    // Ask for modifier
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Triage Roll</strong><br>
          <small>Formula: 2d6 - ${wounds} wounds</small>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
      </form>
    `;
    
    new Dialog({
      title: "Triage Roll",
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const totalMod = modifier - wounds;
            
            const formula = totalMod !== 0 
              ? `2d6 + ${totalMod}` 
              : `2d6`;
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            // Determine injury result based on total
            const total = roll.total;
            let injuryResult = "";
            let injuryClass = "";
            
            if (total <= 3) {
              injuryResult = "💀 DEATH";
              injuryClass = "critical-failure";
            } else if (total <= 5) {
              injuryResult = "🩸 Critical Injury";
              injuryClass = "triage-critical";
            } else if (total <= 7) {
              injuryResult = "⚠️ Severe Injury";
              injuryClass = "triage-severe";
            } else if (total <= 10) {
              injuryResult = "🩹 Moderate Injury";
              injuryClass = "triage-moderate";
            } else {
              injuryResult = "✓ Flesh Wound";
              injuryClass = "triage-flesh";
            }
            
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">Triage Roll</div>
                <div class="${injuryClass}"><strong>${injuryResult}</strong></div>
              </div>
            `;
            roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavorContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    event.stopPropagation();
    const type = event.currentTarget.dataset.type;
    const level = event.currentTarget.dataset.level;
    
    // Save scroll position
    const scrollContainer = this.element.find(".sheet-body")[0];
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    const itemData = {
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type,
      system: {}
    };
    
    if (type === "combatMove" && level) {
      itemData.system.level = level;
    }
    
    // Create item without opening the sheet, with render: false to prevent immediate re-render
    await Item.create(itemData, { parent: this.actor, render: false });
    
    // Manually re-render and restore scroll position
    this.render(false);
    
    // Restore scroll position after render completes
    Hooks.once("renderBarbaric2eActorSheet", () => {
      const container = this.element.find(".sheet-body")[0];
      if (container) container.scrollTop = scrollTop;
    });
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    new Dialog({
      title: "Delete Item",
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Delete",
          callback: () => item.delete()
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "no"
    }).render(true);
  }

  async _onItemChat(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    // Build details based on item type
    let details = "";
    
    if (item.type === "weapon") {
      details = `
        <div class="chat-details">
          ${item.system.damage ? `<div class="chat-detail"><span class="chat-detail-label">Damage:</span><span class="chat-detail-value">${item.system.damage}</span></div>` : ""}
          ${item.system.type ? `<div class="chat-detail"><span class="chat-detail-label">Type:</span><span class="chat-detail-value">${item.system.type}</span></div>` : ""}
          ${item.system.hands ? `<div class="chat-detail"><span class="chat-detail-label">Hands:</span><span class="chat-detail-value">${item.system.hands}</span></div>` : ""}
          ${item.system.range ? `<div class="chat-detail"><span class="chat-detail-label">Range:</span><span class="chat-detail-value">${item.system.range}</span></div>` : ""}
          ${item.system.cost ? `<div class="chat-detail"><span class="chat-detail-label">Cost:</span><span class="chat-detail-value">${item.system.cost}</span></div>` : ""}
        </div>
      `;
    } else if (item.type === "armor") {
      details = `
        <div class="chat-details">
          ${item.system.protection ? `<div class="chat-detail"><span class="chat-detail-label">Protection:</span><span class="chat-detail-value">${item.system.protection}</span></div>` : ""}
          ${item.system.cost ? `<div class="chat-detail"><span class="chat-detail-label">Cost:</span><span class="chat-detail-value">${item.system.cost}</span></div>` : ""}
        </div>
      `;
    } else if (item.type === "spell") {
      details = `
        <div class="chat-details">
          ${item.system.range ? `<div class="chat-detail"><span class="chat-detail-label">Range:</span><span class="chat-detail-value">${item.system.range}</span></div>` : ""}
        </div>
      `;
    } else if (item.type === "combatMove") {
      details = `
        <div class="chat-details">
          <div class="chat-detail"><span class="chat-detail-label">Level:</span><span class="chat-detail-value">${item.system.level || "2"}</span></div>
        </div>
      `;
    } else if (item.type === "equipment") {
      details = `
        <div class="chat-details">
          ${item.system.cost ? `<div class="chat-detail"><span class="chat-detail-label">Cost:</span><span class="chat-detail-value">${item.system.cost}</span></div>` : ""}
        </div>
      `;
    }
    
    const description = item.system.description ? `<div class="chat-description">${item.system.description}</div>` : "";
    
    const content = `
      <div class="barbaric2e-chat">
        <div class="chat-header">
          <img src="${item.img}" class="chat-icon"/>
          <div>
            <div class="chat-title">${item.name}</div>
            <div class="chat-subtitle">${item.type}</div>
          </div>
        </div>
        ${details}
        ${description}
      </div>
    `;
    
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }

  async _onItemEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    await item.update({ "system.equipped": !item.system.equipped });
  }
}

// NPC Sheet
class Barbaric2eNPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["barbaric2e", "sheet", "actor", "npc"],
      template: "systems/barbaric2e/npc-sheet.hbs",
      width: 550,
      height: 600
    });
  }

  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);
    
    context.system = actorData.system;
    context.flags = actorData.flags;
    
    // Organize items
    context.weapons = this.actor.items.filter(i => i.type === "weapon");
    context.armors = this.actor.items.filter(i => i.type === "armor");
    context.npcAbilities = this.actor.items.filter(i => i.type === "npcAbility");
    
    // Skill icons
    context.skillIcons = {
      combat: "fa-fist-raised",
      craft: "fa-hammer",
      lore: "fa-book",
      physical: "fa-running",
      social: "fa-comments",
      stealth: "fa-eye-slash"
    };
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    if (!this.isEditable) return;
    
    // Roll skills
    html.find(".roll-skill").click(this._onRollSkill.bind(this));
    
    // Roll attack
    html.find(".roll-attack").click(this._onRollAttack.bind(this));
    
    // Roll damage
    html.find(".roll-damage").click(this._onRollDamage.bind(this));
    
    // Roll weapon (combined attack + damage)
    html.find(".roll-weapon").click(this._onRollWeapon.bind(this));
    
    // Item controls
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-chat").click(this._onItemChat.bind(this));
    
    // Open item sheets on name click
    html.find(".item-name").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const item = this.actor.items.get(itemId);
      item?.sheet.render(true);
    });
    
    // Drag handlers for macro bar
    html.find(".roll-skill").each((i, el) => {
      el.setAttribute("draggable", true);
      el.addEventListener("dragstart", ev => this._onDragSkillStart(ev));
    });
    
    html.find(".weapon-icon.roll-weapon").each((i, el) => {
      el.setAttribute("draggable", true);
      el.addEventListener("dragstart", ev => this._onDragWeaponStart(ev));
    });
  }
  
  _onDragSkillStart(event) {
    const skill = event.currentTarget.dataset.skill;
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "barbaric2e-skill",
      skill: skill,
      skillName: skillName,
      actorId: this.actor.id
    }));
  }
  
  _onDragWeaponStart(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "barbaric2e-weapon",
      itemId: item.id,
      weaponName: item.name,
      img: item.img,
      actorId: this.actor.id
    }));
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const skill = event.currentTarget.dataset.skill;
    const skillValue = this.actor.system.skills[skill] || 0;
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
    
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Rolling ${skillName}</strong><br>
          <small>Base: 2d6 + ${skillValue}</small>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="npc-advantage-check" style="width: 16px; height: 16px;"/>
          <label for="npc-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Roll ${skillName}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            
            let formula;
            if (advantage) {
              formula = modifier !== 0 
                ? `3d6kh2 + ${skillValue} + ${modifier}` 
                : `3d6kh2 + ${skillValue}`;
            } else {
              formula = modifier !== 0 
                ? `2d6 + ${skillValue} + ${modifier}` 
                : `2d6 + ${skillValue}`;
            }
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            // Check for critical success/failure
            let critMessage = "";
            if (roll.dice[0]) {
              const keptDice = roll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL SUCCESS! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL FAILURE! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">${skillName} Check${advantageText}</div>
                ${critMessage}
              </div>
            `;
            roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavorContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollAttack(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    const combatSkill = this.actor.system.skills.combat || 0;
    const attackBonus = parseInt(item.system.attackBonus) || 0;
    
    // Ask for modifier and advantage
    const attackBonusNote = attackBonus !== 0 ? `<br><small style="color: #44dd44;">Weapon Bonus: +${attackBonus}</small>` : "";
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Attack with ${item.name}</strong><br>
          <small>Base: 2d6 + ${combatSkill} (Combat)</small>${attackBonusNote}
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="npc-attack-advantage-check" style="width: 16px; height: 16px;"/>
          <label for="npc-attack-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Attack with ${item.name}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            const totalMod = modifier + attackBonus;
            
            let formula;
            if (advantage) {
              formula = totalMod !== 0 
                ? `3d6kh2 + ${combatSkill} + ${totalMod}` 
                : `3d6kh2 + ${combatSkill}`;
            } else {
              formula = totalMod !== 0 
                ? `2d6 + ${combatSkill} + ${totalMod}` 
                : `2d6 + ${combatSkill}`;
            }
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            // Check for critical success/failure
            let critMessage = "";
            if (roll.dice[0]) {
              const keptDice = roll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL SUCCESS! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL FAILURE! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">
                  <img src="${item.img}" class="chat-item-icon" />
                  <span>${item.name} Attack${advantageText}</span>
                </div>
                ${critMessage}
              </div>
            `;
            roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavorContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollDamage(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item || !item.system.damage) {
      ui.notifications.warn("This weapon has no damage formula.");
      return;
    }
    
    const roll = new Roll(item.system.damage);
    await roll.evaluate();
    
    const damageType = item.system.type ? ` (${item.system.type})` : "";
    const flavorContent = `
      <div class="barbaric2e-roll">
        <div class="roll-header">
          <img src="${item.img}" class="chat-item-icon" />
          <span>${item.name} Damage${damageType}</span>
        </div>
      </div>
    `;
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorContent
    });
  }

  async _onRollWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    const combatSkill = this.actor.system.skills.combat || 0;
    const attackBonus = parseInt(item.system.attackBonus) || 0;
    
    // Ask for modifier and advantage
    const attackBonusNote = attackBonus !== 0 ? `<br><small style="color: #44dd44;">Weapon Bonus: +${attackBonus}</small>` : "";
    const damageNote = item.system.damage ? `<br><small>Damage: ${item.system.damage}</small>` : "";
    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <strong>Attack with ${item.name}</strong><br>
          <small>Base: 2d6 + ${combatSkill} (Combat)</small>${attackBonusNote}${damageNote}
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <label style="margin: 0;">Modifier:</label>
          <input type="number" name="modifier" value="0" style="width: 60px;"/>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" name="advantage" id="npc-weapon-advantage-check" style="width: 16px; height: 16px;"/>
          <label for="npc-weapon-advantage-check" style="margin: 0;">Advantage (3d6, drop lowest)</label>
        </div>
      </form>
    `;
    
    new Dialog({
      title: `Attack with ${item.name}`,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
            const advantage = html.find('[name="advantage"]').is(':checked');
            const totalMod = modifier + attackBonus;
            
            let formula;
            if (advantage) {
              formula = totalMod !== 0 
                ? `3d6kh2 + ${combatSkill} + ${totalMod}` 
                : `3d6kh2 + ${combatSkill}`;
            } else {
              formula = totalMod !== 0 
                ? `2d6 + ${combatSkill} + ${totalMod}` 
                : `2d6 + ${combatSkill}`;
            }
            
            const attackRoll = new Roll(formula);
            await attackRoll.evaluate();
            
            // Check for critical success/failure
            let isCriticalHit = false;
            let isCriticalFail = false;
            let critMessage = "";
            if (attackRoll.dice[0]) {
              const keptDice = attackRoll.dice[0].results.filter(r => !r.discarded).map(r => r.result);
              if (keptDice[0] === 6 && keptDice[1] === 6) {
                isCriticalHit = true;
                critMessage = `<div class="critical-success"><strong>⚔️ CRITICAL HIT! ⚔️</strong></div>`;
              } else if (keptDice[0] === 1 && keptDice[1] === 1) {
                isCriticalFail = true;
                critMessage = `<div class="critical-failure"><strong>💀 CRITICAL MISS! 💀</strong></div>`;
              }
            }
            
            const advantageText = advantage ? " (Advantage)" : "";
            
            // Build combined chat card content
            let damageSection = "";
            let damageRoll = null;
            let maxDamage = 0;
            
            if (item.system.damage && !isCriticalFail) {
              damageRoll = new Roll(item.system.damage);
              await damageRoll.evaluate();
              
              if (isCriticalHit) {
                // Calculate max damage from formula
                for (const term of damageRoll.terms) {
                  if (term.faces) {
                    maxDamage += (term.number || 1) * term.faces;
                  } else if (term.number !== undefined) {
                    maxDamage += term.number;
                  }
                }
                
                const damageType = item.system.type ? ` (${item.system.type})` : "";
                damageSection = `
                  <div class="damage-section">
                    <div class="roll-label" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage${damageType}</div>
                    <div class="critical-success"><strong>MAXIMUM DAMAGE: ${maxDamage}</strong></div>
                  </div>
                `;
              } else {
                const damageRollHtml = await damageRoll.render();
                const damageType = item.system.type ? ` (${item.system.type})` : "";
                damageSection = `
                  <div class="damage-section">
                    <div class="roll-label" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #5a4a3a;">Damage${damageType}</div>
                    ${damageRollHtml}
                  </div>
                `;
              }
            }
            
            // Show Dice So Nice for both rolls together
            if (game.dice3d) {
              const dicePromises = [
                game.dice3d.showForRoll(attackRoll, game.user, true)
              ];
              
              if (damageRoll && !isCriticalHit) {
                dicePromises.push(
                  game.dice3d.showForRoll(damageRoll, game.user, true)
                );
              }
              
              await Promise.all(dicePromises);
            }
            
            // Get attack roll HTML
            const attackRollHtml = await attackRoll.render();
            
            // Create combined message content
            const messageContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">
                  <img src="${item.img}" class="chat-item-icon" />
                  <span>${item.name} Attack${advantageText}</span>
                </div>
                ${critMessage}
                ${attackRollHtml}
                ${damageSection}
              </div>
            `;
            
            // Create message WITHOUT rolls array to prevent double dice animation
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: messageContent
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    event.stopPropagation();
    const type = event.currentTarget.dataset.type;
    
    // Save scroll position
    const scrollContainer = this.element.find(".sheet-body")[0];
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    const itemData = {
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type,
      system: {}
    };
    
    await Item.create(itemData, { parent: this.actor, render: false });
    this.render(false);
    
    // Restore scroll position after render completes
    Hooks.once("renderBarbaric2eNPCSheet", () => {
      const container = this.element.find(".sheet-body")[0];
      if (container) container.scrollTop = scrollTop;
    });
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    new Dialog({
      title: "Delete Item",
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Delete",
          callback: () => item.delete()
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "no"
    }).render(true);
  }

  async _onItemChat(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    let details = "";
    
    if (item.type === "weapon") {
      details = `
        <div class="chat-details">
          ${item.system.damage ? `<div class="chat-detail"><span class="chat-detail-label">Damage:</span><span class="chat-detail-value">${item.system.damage}</span></div>` : ""}
        </div>
      `;
    } else if (item.type === "armor") {
      details = `
        <div class="chat-details">
          ${item.system.protection ? `<div class="chat-detail"><span class="chat-detail-label">Protection:</span><span class="chat-detail-value">${item.system.protection}</span></div>` : ""}
        </div>
      `;
    }
    
    const description = item.system.description ? `<div class="chat-description">${item.system.description}</div>` : "";
    
    const content = `
      <div class="barbaric2e-chat">
        <div class="chat-header">
          <img src="${item.img}" class="chat-icon"/>
          <div>
            <div class="chat-title">${item.name}</div>
            <div class="chat-subtitle">${item.type}</div>
          </div>
        </div>
        ${details}
        ${description}
      </div>
    `;
    
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }
}

// Item Sheet
class Barbaric2eItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["barbaric2e", "sheet", "item"],
      template: "systems/barbaric2e/item-sheet.hbs",
      width: 450,
      height: 400
    });
  }

  getData() {
    const context = super.getData();
    const itemData = this.item.toObject(false);
    
    context.system = itemData.system;
    context.flags = itemData.flags;
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
