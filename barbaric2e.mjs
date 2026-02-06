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
    
    // Roll damage
    html.find(".roll-damage").click(this._onRollDamage.bind(this));
    
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
    
    const flavorContent = `
      <div class="barbaric2e-roll">
        <div class="roll-header">${item.name} Damage</div>
      </div>
    `;
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorContent
    });
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
            
            const flavorContent = `
              <div class="barbaric2e-roll">
                <div class="roll-header">Triage Roll</div>
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
    
    // Roll damage
    html.find(".roll-damage").click(this._onRollDamage.bind(this));
    
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
    
    const flavorContent = `
      <div class="barbaric2e-roll">
        <div class="roll-header">${item.name} Damage</div>
      </div>
    `;
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorContent
    });
  }

  async _onItemCreate(event) {
    event.preventDefault();
    event.stopPropagation();
    const type = event.currentTarget.dataset.type;
    
    const itemData = {
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type,
      system: {}
    };
    
    await Item.create(itemData, { parent: this.actor, render: false });
    this.render(false);
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
