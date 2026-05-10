

const GAME_PHASE = Object.freeze({
  FADE_IN: 'FADE_IN',
  TUTORIAL_MOVE: 'TUTORIAL_MOVE',
  TUTORIAL_WEEDS: 'TUTORIAL_WEEDS',
  TUTORIAL_SOIL_PICKUP: 'TUTORIAL_SOIL_PICKUP',
  TUTORIAL_SOIL_PLACE: 'TUTORIAL_SOIL_PLACE',
  TUTORIAL_WATER_PICKUP: 'TUTORIAL_WATER_PICKUP',
  TUTORIAL_WATER_PLACE: 'TUTORIAL_WATER_PLACE',
  TUTORIAL_RETURN_CAN: 'TUTORIAL_RETURN_CAN',
  TUTORIAL_GRASS_ROW: 'TUTORIAL_GRASS_ROW',
  WALK_TO_HOUSE: 'WALK_TO_HOUSE',
  FALLING: 'FALLING',
  BACKROOMS_TRAPPED: 'BACKROOMS_TRAPPED',
  BACKROOMS_SIGN_OPEN: 'BACKROOMS_SIGN_OPEN',
  BACKROOMS_CHASE: 'BACKROOMS_CHASE',
});

const ITEM_NONE = null;
const ITEM_SOIL = 'soil_bag';
const ITEM_CAN = 'watering_can';
const ITEM_CAN_EMPTY = 'watering_can_empty';
const ITEM_HEDGE = 'hedge_blocks';

var g_entityActive = false;

var g_gs = {
  phase: GAME_PHASE.FADE_IN,
  stateTime: 0,
  weedsLeft: 6,
  soilUses: 0,
  waterUses: 0,
  inventoryItem: ITEM_NONE,
  soilPlaced: new Set(),
  waterPlaced: new Set(),
  grassRowFixed: false,
  hedgeBlocks: 0,
  hasMoved: false,
  controlsDismissTimer: -1,
  vnOpen: false,
  signOpen: false,
  vnJustDismissed: false,
  introDialogStep: 0,
  backroomsDialogStep: 0,
  porchWarningShown: false,
  returnWarningShown: false,
  trapCenterX: 6,
  trapCenterZ: 6,
  fallStarted: false,
};

function _el(id) { return document.getElementById(id); }

function setupGameStateUI() {
  const vn = _el('vnBox');
  if (vn) vn.addEventListener('click', hideVN);

  const closeBtn = _el('signCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeBackroomsSign();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'e' && e.key !== 'E' && e.key !== 'Enter') return;
    if (g_gs.vnOpen) {
      e.preventDefault();
      hideVN();
    } else if (g_gs.signOpen) {
      e.preventDefault();
      closeBackroomsSign();
    }
  });

  setInventory(ITEM_NONE, 0);
  setObjective('Tend to your garden');
  hideControlsToast();
}

function resetGameStateForNewGame() {
  g_gs.phase = GAME_PHASE.FADE_IN;
  g_gs.stateTime = 0;
  g_gs.weedsLeft = 6;
  g_gs.soilUses = 0;
  g_gs.waterUses = 0;
  g_gs.inventoryItem = ITEM_NONE;
  g_gs.soilPlaced = new Set();
  g_gs.waterPlaced = new Set();
  g_gs.grassRowFixed = false;
  g_gs.hedgeBlocks = 0;
  g_gs.hasMoved = false;
  g_gs.controlsDismissTimer = -1;
  g_gs.vnOpen = false;
  g_gs.signOpen = false;
  g_gs.vnJustDismissed = false;
  g_gs.introDialogStep = 0;
  g_gs.backroomsDialogStep = 0;
  g_gs.porchWarningShown = false;
  g_gs.returnWarningShown = false;
  g_gs.fallStarted = false;
  g_entityActive = false;
  setInventory(ITEM_NONE, 0);
  hideVN();
  g_gs.vnJustDismissed = false;
  setObjective('Tend to your garden');
  hideControlsToast();
  hideSignPopup();
  document.body.classList.remove('level-backrooms', 'level-backrooms-trapped');
  document.body.classList.add('level-suburbs');
}

function startNarrativeSequence() {
  resetGameStateForNewGame();
  setPhase(GAME_PHASE.FADE_IN);
  showFade('after a long day of work...', true);
}

function setPhase(phase) {
  if (g_gs.phase === phase) return;
  g_gs.phase = phase;
  g_gs.stateTime = 0;

  if (phase === GAME_PHASE.TUTORIAL_MOVE) {
    setObjective('Tend to your garden');
    showControlsToast('CONTROLS', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp;|&nbsp; <kbd>SHIFT</kbd> sprint &nbsp;|&nbsp; mouse look &nbsp;|&nbsp; <kbd>LMB</kbd> interact');
    g_gs.controlsDismissTimer = 6.0;
  } else if (phase === GAME_PHASE.TUTORIAL_WEEDS) {
    setObjective('Tend to your garden');
    showControlsToast('GARDEN', '<kbd>LMB</kbd> pull the weeds from each highlighted garden patch');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_SOIL_PICKUP) {
    setObjective('Plant soil and water');
    showControlsToast('SOIL', '<kbd>LMB</kbd> pick up the soil bag');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_SOIL_PLACE) {
    setObjective('Plant soil and water');
    showControlsToast('SOIL', '<kbd>LMB</kbd> place soil on every garden patch');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_WATER_PICKUP) {
    setObjective('Plant soil and water');
    showControlsToast('WATER', '<kbd>LMB</kbd> pick up the watering can');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_WATER_PLACE) {
    setObjective('Plant soil and water');
    showControlsToast('WATER', '<kbd>LMB</kbd> water every planted patch');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_RETURN_CAN) {
    setObjective('Return the watering can');
    showControlsToast('WATER', '<kbd>LMB</kbd> put the watering can back where you found it');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.TUTORIAL_GRASS_ROW) {
    setObjective('Reorganize the hedge');
    showControlsToast('HEDGE', '<kbd>RMB</kbd> break the top blocks &nbsp;|&nbsp; <kbd>LMB</kbd> place them on the sides');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.WALK_TO_HOUSE) {
    setObjective('Head home');
    showControlsToast('HOME', 'Go through the front door');
    g_gs.controlsDismissTimer = -1;
  } else if (phase === GAME_PHASE.BACKROOMS_TRAPPED) {
    document.body.classList.remove('level-suburbs');
    document.body.classList.add('level-backrooms', 'level-backrooms-trapped');
    setInventory(ITEM_NONE, 0);
    setObjective('Check the sign');
    g_gs.vnJustDismissed = false;
    g_gs.backroomsDialogStep = 0;
  } else if (phase === GAME_PHASE.BACKROOMS_CHASE) {
    document.body.classList.remove('level-backrooms-trapped');
    document.body.classList.add('level-backrooms');
    setObjective('RUN.');
    hideVN();
    hideControlsToast();
  }
}

function setObjective(text) {
  const obj = _el('objectiveHUD');
  if (obj) obj.textContent = text ? 'Objective: ' + text : '';
}

function showFade(text, textVisible) {
  const overlay = _el('fadeOverlay');
  const fadeText = _el('fadeText');
  if (!overlay || !fadeText) return;
  fadeText.textContent = text || '';
  fadeText.classList.toggle('show', !!textVisible);
  overlay.classList.add('active');
}

function hideFade() {
  const overlay = _el('fadeOverlay');
  const fadeText = _el('fadeText');
  if (fadeText) fadeText.classList.remove('show');
  if (overlay) overlay.classList.remove('active');
}

function showControlsToast(title, html) {
  const toast = _el('controlsToast');
  if (!toast) return;
  const titleEl = toast.querySelector('.toastTitle');
  const bodyEl = toast.querySelector('.toastBody');
  if (titleEl) titleEl.textContent = title || 'CONTROLS';
  if (bodyEl) bodyEl.innerHTML = html || '';
  toast.classList.add('show');
}

function hideControlsToast() {
  const toast = _el('controlsToast');
  if (toast) toast.classList.remove('show');
}

function showVN(text) {
  const box = _el('vnBox');
  const txt = _el('vnText');
  if (!box || !txt) return;
  g_gs.vnJustDismissed = false;
  txt.textContent = text;
  box.classList.add('show');
  g_gs.vnOpen = true;
}

function hideVN() {
  const box = _el('vnBox');
  if (box) box.classList.remove('show');
  const wasOpen = g_gs.vnOpen;
  if (wasOpen) g_gs.vnJustDismissed = true;
  g_gs.vnOpen = false;
  if (wasOpen && g_gs.phase === GAME_PHASE.BACKROOMS_TRAPPED && g_gs.backroomsDialogStep >= 4) {
    advancePostSignDialog();
  }
}

function beginPostSignDialog() {
  g_gs.phase = GAME_PHASE.BACKROOMS_TRAPPED;
  g_gs.stateTime = 0;
  g_gs.vnJustDismissed = false;
  g_gs.backroomsDialogStep = 4;
  document.body.classList.remove('level-suburbs');
  document.body.classList.add('level-backrooms', 'level-backrooms-trapped');
  setInventory(ITEM_NONE, 0);
  setObjective('Listen.');
  showVN('WHAT IS THAT?!?!?!');
}

function advancePostSignDialog() {
  if (g_gs.phase !== GAME_PHASE.BACKROOMS_TRAPPED || !g_gs.vnJustDismissed) return false;
  if (g_gs.backroomsDialogStep === 4) {
    g_gs.vnJustDismissed = false;
    g_gs.backroomsDialogStep = 5;
    showVN('I need to get out of here. now.');
    return true;
  }
  if (g_gs.backroomsDialogStep === 5) {
    g_gs.vnJustDismissed = false;
    g_gs.backroomsDialogStep = 6;
    activateBackroomsEntity();
    setPhase(GAME_PHASE.BACKROOMS_CHASE);
    if (typeof requestGamePointerLock === 'function' && typeof canvas !== 'undefined' && document.pointerLockElement !== canvas) {
      requestGamePointerLock();
    }
    return true;
  }
  return false;
}

function setInventory(item, usesRemaining) {
  g_gs.inventoryItem = item;
  const slot = _el('inventorySlot');
  const name = _el('invItemName');
  const count = _el('invUseCount');
  if (!slot || !name || !count) return;
  slot.classList.remove('show', 'soil', 'can', 'hedge');
  if (!item) {
    name.textContent = '';
    count.textContent = '';
    return;
  }
  slot.classList.add('show');
  if (item === ITEM_SOIL) {
    slot.classList.add('soil');
    name.textContent = 'SOIL BAG';
    count.textContent = String(usesRemaining);
  } else if (item === ITEM_CAN || item === ITEM_CAN_EMPTY) {
    slot.classList.add('can');
    name.textContent = item === ITEM_CAN_EMPTY ? 'WATERING CAN (EMPTY)' : 'WATERING CAN';
    count.textContent = String(usesRemaining);
  } else if (item === ITEM_HEDGE) {
    slot.classList.add('hedge');
    name.textContent = 'HEDGE BLOCKS';
    count.textContent = String(usesRemaining);
  }
}

function hideSignPopup() {
  const popup = _el('signPopup');
  if (popup) {
    popup.classList.remove('show');
    popup.style.display = 'none';
  }
  g_gs.signOpen = false;
}

function openBackroomsSign() {
  const popup = _el('signPopup');
  if (!popup) return;
  g_gs.signOpen = true;
  setPhase(GAME_PHASE.BACKROOMS_SIGN_OPEN);
  popup.classList.add('show');
  popup.style.display = 'flex';
  if (document.pointerLockElement) {
    if (typeof g_suppressPointerPause !== 'undefined') g_suppressPointerPause = true;
    document.exitPointerLock();
  }
}

function closeBackroomsSign() {
  if (g_gs.phase !== GAME_PHASE.BACKROOMS_SIGN_OPEN) return;
  hideSignPopup();
  if (typeof playBuf === 'function' && g_wailBuf) {
    playBuf(g_wailBuf, VOL_WAIL * 0.65 * g_masterVolume);
  } else if (typeof g_audioCtx !== 'undefined' && g_audioCtx) {
    const osc = g_audioCtx.createOscillator();
    const gain = g_audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(720, g_audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, g_audioCtx.currentTime + 0.7);
    gain.gain.setValueAtTime(0.16 * g_masterVolume, g_audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, g_audioCtx.currentTime + 0.75);
    osc.connect(gain); gain.connect(g_audioCtx.destination);
    osc.start(); osc.stop(g_audioCtx.currentTime + 0.75);
  }
  beginPostSignDialog();
  if (typeof requestGamePointerLock === 'function' && typeof canvas !== 'undefined' && document.pointerLockElement !== canvas) {
    requestGamePointerLock();
  }
}

function isBackroomsChaseActive() {
  return g_gs.phase === GAME_PHASE.BACKROOMS_CHASE && g_entityActive;
}

function isNarrativeMovementLocked() {
  return g_gs.phase === GAME_PHASE.FADE_IN ||
         g_gs.phase === GAME_PHASE.FALLING ||
         g_gs.phase === GAME_PHASE.BACKROOMS_SIGN_OPEN ||
         g_gs.vnOpen || g_gs.signOpen;
}

function narrativeRecordMovement() {
  if (g_gs.phase === GAME_PHASE.TUTORIAL_MOVE && !g_gs.hasMoved) {
    g_gs.hasMoved = true;
    g_gs.controlsDismissTimer = 3.0;
  }
}

function canMoveToNarrative(nx, nz) {
  if (isNarrativeMovementLocked()) return false;

  if (g_currentLevel === 1) {

    if (nz >= 14.15 && nx >= 12.0 && nx <= 19.0 && g_gs.phase !== GAME_PHASE.WALK_TO_HOUSE) {
      if (g_gs.phase === GAME_PHASE.TUTORIAL_RETURN_CAN) {
        setObjective('Return the watering can');
        g_gs.returnWarningShown = true;
      } else {
        setObjective('Tend to your garden');
        if (!g_gs.porchWarningShown && !g_gs.vnOpen) {
          g_gs.porchWarningShown = true;
          showVN('I should tend to the garden first.');
        }
        if (g_gs.phase === GAME_PHASE.TUTORIAL_MOVE) setPhase(GAME_PHASE.TUTORIAL_WEEDS);
      }
      return false;
    }
  }

  if (g_gs.phase === GAME_PHASE.BACKROOMS_TRAPPED) {
    const cx = Math.floor(nx);
    const cz = Math.floor(nz);
    if (Math.abs(cx - g_gs.trapCenterX) > 1 || Math.abs(cz - g_gs.trapCenterZ) > 1) {
      setObjective('Read the sign');
      return false;
    }
  }
  return true;
}

function handleNarrativeInteract(tx, tz, button) {
  if (g_currentLevel === 1) return handleSuburbInteract(tx, tz, button || 0);
  if ((button || 0) !== 0) return false;
  if (g_gs.phase === GAME_PHASE.BACKROOMS_TRAPPED) {
    const code = (typeof getInteractiveAt === 'function') ? getInteractiveAt(tx, tz) : 0;
    if (code === INTERACT_SIGN) {
      openBackroomsSign();
      return true;
    }
  }
  return false;
}

function handleSuburbInteract(tx, tz, button) {
  button = button || 0;
  const code = (typeof getInteractiveAt === 'function') ? getInteractiveAt(tx, tz) : 0;
  const key = tx + ',' + tz;

  if (g_gs.phase === GAME_PHASE.TUTORIAL_GRASS_ROW && code === INTERACT_GRASS_ROW) {
    if (button === 2 && typeof breakHedgeBlock === 'function' && breakHedgeBlock(tx, tz)) {
      g_gs.hedgeBlocks++;
      setInventory(ITEM_HEDGE, g_gs.hedgeBlocks);
      return true;
    }
    if (button === 0 && g_gs.hedgeBlocks > 0 && typeof placeHedgeBlock === 'function' && placeHedgeBlock(tx, tz)) {
      g_gs.hedgeBlocks = Math.max(0, g_gs.hedgeBlocks - 1);
      if (g_gs.hedgeBlocks > 0) setInventory(ITEM_HEDGE, g_gs.hedgeBlocks);
      else setInventory(ITEM_NONE, 0);
      if (typeof isHedgeRowComplete === 'function' && isHedgeRowComplete() && g_gs.hedgeBlocks === 0) {
        g_gs.grassRowFixed = true;
        setPhase(GAME_PHASE.WALK_TO_HOUSE);
      }
      return true;
    }
    return true;
  }

  if (button !== 0) return false;

  if (g_gs.phase === GAME_PHASE.TUTORIAL_WEEDS && code === INTERACT_WEED) {
    if (destroyGardenWeed(tx, tz)) {
      g_gs.weedsLeft = Math.max(0, g_gs.weedsLeft - 1);
      if (g_gs.weedsLeft === 0) setPhase(GAME_PHASE.TUTORIAL_SOIL_PICKUP);
    }
    return true;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_SOIL_PICKUP && code === INTERACT_SOIL_BAG) {
    removeInteractiveItem(tx, tz);
    setInventory(ITEM_SOIL, 6);
    setPhase(GAME_PHASE.TUTORIAL_SOIL_PLACE);
    return true;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_SOIL_PLACE && code === INTERACT_GARDEN_PLOT && !g_gs.soilPlaced.has(key)) {
    if (placeGardenSoil(tx, tz)) {
      g_gs.soilPlaced.add(key);
      g_gs.soilUses++;
      const left = Math.max(0, 6 - g_gs.soilUses);
      setInventory(ITEM_SOIL, left);
      if (g_gs.soilUses >= 6) {
        setInventory(ITEM_NONE, 0);
        setPhase(GAME_PHASE.TUTORIAL_WATER_PICKUP);
      }
    }
    return true;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_WATER_PICKUP && code === INTERACT_WATER_CAN) {
    removeInteractiveItem(tx, tz);
    setInventory(ITEM_CAN, 6);
    setPhase(GAME_PHASE.TUTORIAL_WATER_PLACE);
    return true;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_WATER_PLACE && code === INTERACT_GARDEN_PLOT && g_gs.soilPlaced.has(key) && !g_gs.waterPlaced.has(key)) {
    if (waterGardenPlot(tx, tz)) {
      g_gs.waterPlaced.add(key);
      g_gs.waterUses++;
      const left = Math.max(0, 6 - g_gs.waterUses);
      setInventory(left === 0 ? ITEM_CAN_EMPTY : ITEM_CAN, left);
      if (g_gs.waterUses >= 6) {
        setInventory(ITEM_CAN_EMPTY, 0);
        setPhase(GAME_PHASE.TUTORIAL_RETURN_CAN);
      }
    }
    return true;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_RETURN_CAN && code === INTERACT_CAN_RETURN && g_gs.inventoryItem === ITEM_CAN_EMPTY) {
    returnWateringCan(tx, tz);
    setInventory(ITEM_NONE, 0);
    showVN("Ok, now that I've done the garden, let me take care of the hedge.");
    setPhase(GAME_PHASE.TUTORIAL_GRASS_ROW);
    return true;
  }

  if (code === INTERACT_WEED && g_gs.phase !== GAME_PHASE.TUTORIAL_WEEDS) {
    setPhase(GAME_PHASE.TUTORIAL_WEEDS);
    return true;
  }
  return false;
}

function activateBackroomsEntity() {
  g_entityActive = true;
  if (typeof g_entity !== 'undefined') {
    g_entity.x = ENTITY_SPAWN_X;
    g_entity.z = ENTITY_SPAWN_Z;
    g_entity.vx = 0;
    g_entity.vz = 0;
    g_entity.hasLOS = false;
    g_entity.inChase = false;
    g_entity.pathRecalcTimer = 0;
    g_entity.pathDir = null;
  }
}

function scrubLevel1UIForBackrooms() {
  setInventory(ITEM_NONE, 0);
  hideControlsToast();
  hideVN();
  hideSignPopup();
  const slot = _el('inventorySlot');
  if (slot) slot.classList.remove('show');
}

function updateGameState(dt) {
  if (!g_started) return;
  g_gs.stateTime += dt;

  if (g_gs.controlsDismissTimer >= 0) {
    g_gs.controlsDismissTimer -= dt;
    if (g_gs.controlsDismissTimer <= 0) {
      hideControlsToast();
      g_gs.controlsDismissTimer = -1;
    }
  }

  if (g_gs.phase === GAME_PHASE.FADE_IN) {
    if (g_gs.stateTime > 1.0) {
      const txt = _el('fadeText');
      if (txt) txt.classList.add('show');
    }
    if (g_gs.stateTime > 3.2) hideFade();
    if (g_gs.stateTime > 4.2 && g_gs.introDialogStep === 0 && !g_gs.vnOpen) {
      g_gs.introDialogStep = 1;
      showVN('What a long day....');
    }
    if (g_gs.introDialogStep === 1 && g_gs.vnJustDismissed) {
      g_gs.vnJustDismissed = false;
      g_gs.introDialogStep = 2;
      showVN("Let's take care of my garden before I go inside.");
    }
    if (g_gs.introDialogStep === 2 && g_gs.vnJustDismissed) {
      g_gs.vnJustDismissed = false;
      g_gs.introDialogStep = 3;
      setPhase(GAME_PHASE.TUTORIAL_MOVE);
    }
    return;
  }

  if (g_gs.phase === GAME_PHASE.TUTORIAL_MOVE && g_gs.hasMoved && g_gs.stateTime > 3.0) {

    if (g_gs.stateTime > 8.0) setPhase(GAME_PHASE.TUTORIAL_WEEDS);
  }

  if (g_gs.phase === GAME_PHASE.WALK_TO_HOUSE) {
    const e = camera.eye.elements;
    if (e[2] >= 16.65 && e[0] >= 13.0 && e[0] <= 18.5) {
      setPhase(GAME_PHASE.FALLING);
      showFade('', false);
      g_gs.fallStarted = true;
      g_gs.stateTime = 0;
    }
  }

  if (g_gs.phase === GAME_PHASE.FALLING) {
    const e = camera.eye.elements;
    e[1] = Math.max(-9.0, e[1] - 8.5 * dt);
    camera.pitch = Math.max(-65, camera.pitch - 25 * dt);
    camera.updateViewMatrix();
    if (g_gs.stateTime > 0.25) {
      const overlay = _el('fadeOverlay');
      if (overlay) overlay.classList.add('active');
    }
    if (g_gs.stateTime > 1.65) {
      scrubLevel1UIForBackrooms();
      try {
        if (typeof loadLevel === 'function') loadLevel(2);
      } catch (err) {
        console.error('[transition] Level 2 load failed:', err);
      } finally {
        const eye = camera.eye.elements;
        g_gs.trapCenterX = Math.floor(eye[0]);
        g_gs.trapCenterZ = Math.floor(eye[2]);
        hideFade();
        setPhase(GAME_PHASE.BACKROOMS_TRAPPED);
      }
    }
  }

  if (g_gs.phase === GAME_PHASE.BACKROOMS_TRAPPED) {
    if (g_gs.backroomsDialogStep === 0 && g_gs.stateTime > 1.8 && !g_gs.vnOpen) {
      g_gs.backroomsDialogStep = 1;
      showVN('What just happened?');
    }
    if (g_gs.backroomsDialogStep === 1 && g_gs.vnJustDismissed) {
      g_gs.vnJustDismissed = false;
      g_gs.backroomsDialogStep = 2;
      showVN('I should read the sign.');
    }
    if (g_gs.backroomsDialogStep === 2 && g_gs.vnJustDismissed) {
      g_gs.vnJustDismissed = false;
      g_gs.backroomsDialogStep = 3;
    }
    advancePostSignDialog();
  }
}
