// Main entry

var gameCanvas = null;
var gameContext = null;

var currentLevel = null;
var player = null;
var guards = [];

var lastTimestamp = 0;

// playing | fail | clear
var gameStatus = "playing";
var gameStatusTimer = 0;

// Thời gian chơi
var elapsedTime = 0;

// Lý do thất bại gần nhất: "guard" | "laser"
var lastFailReason = "guard";
var isPaused = false;
var lastEscDown = false;

var stage2ReconfigHintShown = false;

// Laser gate cinematic state
var laserCinematic = {
  active: false,
  timer: 0,
  duration: 1.4 // seconds for camera pan + fade
};

// Cinematic for briefly focusing on recently disabled trap groups
var trapFocusCinematic = {
  active: false,
  timer: 0,
  duration: 1.0, // seconds for camera pan
  targetX: 0,
  targetY: 0
};

// Hint state for the laser switch
var laserHintShown = false;

// Trạng thái nhiệm vụ hack
var mission = {
  hacked: false,
  hacking: false,
  hackProgress: 0,
  hackDuration: 3.0, // giây giữ E để hack xong

  // flags to only show dialogs once
  notifiedAfterHack: false,
  notifiedNeedData: false,

  // flags cho SFX
  hackStartSfxPlayed: false,
  hackCompleteSfxPlayed: false,

  // Stage 2 hack flag
  stage2HackCompleted: false,
  stage2AfterHackHintShown: false
};

function applySecurityModeForStage2() {
  if (!currentLevel || currentLevel.stageId !== 2) return;

  var mode = (typeof currentLevel.securityMode === "number")
    ? currentLevel.securityMode
    : 0;

  // Camera index meanings:
  // 0: top corridor camera
  // 1: central divider camera
  // 2: exit-side camera
  if (Array.isArray(currentLevel.cameras)) {
    currentLevel.cameras.forEach(function (cam, index) {
      if (!cam) return;
      cam.active = true; // default

      if (mode === 0) {
        // Mode 0: exit stays guarded
        if (index === 2) {
          cam.active = true;
        }
      } else if (mode === 1) {
        // Mode 1: relax exit approach
        if (index === 2) {
          cam.active = false;
        }
      }
    });
  }

  // Security doors (Door A): toggle based on mode
  if (Array.isArray(currentLevel.securityDoors)) {
    currentLevel.securityDoors.forEach(function (door) {
      if (!door) return;
      if (door.id === "doorA") {
        if (mode === 0) {
          door.active = true; // barrier ON
        } else if (mode === 1) {
          door.active = false; // barrier OFF
        }
      }
    });
  }
}

// Đã bị phát hiện chưa (để play SFX detected 1 lần)
var wasDetected = false;

// Đã từng bị truy đuổi hay chưa (để quản lý chase loop)
var wasChasing = false;

// Was E pressed in the previous frame? (for just-pressed detection)
var lastEPressed = false;

// assets (được load ở cuối)
var AssetImages = {};

// Chỉ hiện intro 1 lần
var hasShownIntro = false;

// Stealth debug disabled in release build
var DEBUG_STEALTH = false;

// ===== Key state riêng cho main (dùng cho phím E) =====
var keyState = {};
window.addEventListener("keydown", function (e) {
  keyState[e.code] = true;
});
window.addEventListener("keyup", function (e) {
  keyState[e.code] = false;
});

function setupAudioSliders() {
  if (typeof AudioManager === "undefined" || !AudioManager) return;

  var bgmSlider = document.getElementById("bgm-volume");
  var sfxSlider = document.getElementById("sfx-volume");

  // Initialize slider values from AudioManager if getters exist
  if (bgmSlider && typeof AudioManager.getBgmVolume === "function") {
    bgmSlider.value = Math.round(AudioManager.getBgmVolume() * 100);
  }
  if (sfxSlider && typeof AudioManager.getSfxVolume === "function") {
    sfxSlider.value = Math.round(AudioManager.getSfxVolume() * 100);
  }

  if (bgmSlider && typeof AudioManager.setBgmVolume === "function") {
    bgmSlider.addEventListener("input", function (e) {
      var v = parseInt(e.target.value, 10);
      if (isNaN(v)) return;
      AudioManager.setBgmVolume(v / 100);
    });
  }

  if (sfxSlider && typeof AudioManager.setSfxVolume === "function") {
    sfxSlider.addEventListener("input", function (e) {
      var v = parseInt(e.target.value, 10);
      if (isNaN(v)) return;
      AudioManager.setSfxVolume(v / 100);
    });
  }

  function attachBlurOnKey(slider) {
    if (!slider) return;
    slider.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        return;
      }
      e.preventDefault();
      slider.blur();
    });
  }

  attachBlurOnKey(bgmSlider);
  attachBlurOnKey(sfxSlider);
}

// ===== Video helpers (opening / ending) =====

function playOpeningVideo(onDone) {
  var overlay = document.getElementById("video-overlay");
  var openVideo = document.getElementById("video-open2");
  var endVideo = document.getElementById("video-end1");
  var skipBtn = document.getElementById("video-skip");

  // Nếu không có video → bỏ qua
  if (!overlay || !openVideo) {
    if (typeof onDone === "function") onDone();
    return;
  }

  // Reset trạng thái video khác
  if (endVideo) {
    endVideo.pause();
    endVideo.currentTime = 0;
    endVideo.style.display = "none";
  }

  overlay.style.display = "flex";
  openVideo.style.display = "block";
  openVideo.currentTime = 0;

  if (skipBtn) {
    skipBtn.style.display = "block";
  }

  var finished = false;

  function cleanup() {
    if (finished) return;
    finished = true;

    openVideo.pause();
    openVideo.removeEventListener("ended", handleEnd);

    if (skipBtn) {
      skipBtn.removeEventListener("click", handleSkip);
      skipBtn.style.display = "none";
    }

    openVideo.style.display = "none";
    overlay.style.display = "none";

    if (typeof onDone === "function") {
      onDone();
    }
  }

  function handleEnd() {
    cleanup();
  }

  function handleSkip() {
    cleanup();
  }

  openVideo.addEventListener("ended", handleEnd);

  if (skipBtn) {
    skipBtn.addEventListener("click", handleSkip);
  }

  // Autoplay có thể bị chặn → nếu lỗi thì skip luôn
  var playPromise = openVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function () {
      cleanup();
    });
  }
}

function playEndingVideo(onDone) {
  var overlay = document.getElementById("video-overlay");
  var openVideo = document.getElementById("video-open1");
  var endVideo = document.getElementById("video-end1");

  if (!overlay || !endVideo) {
    if (typeof onDone === "function") onDone();
    return;
  }

  if (openVideo) {
    openVideo.pause();
    openVideo.currentTime = 0;
    openVideo.style.display = "none";
  }

  overlay.style.display = "flex";
  endVideo.style.display = "block";
  endVideo.currentTime = 0;

  var finished = false;

  function cleanup() {
    if (finished) return;
    finished = true;

    endVideo.pause();
    endVideo.removeEventListener("ended", handleEnd);
    endVideo.style.display = "none";
    overlay.style.display = "none";

    if (typeof onDone === "function") {
      onDone();
    }
  }

  function handleEnd() {
    cleanup();
  }

  endVideo.addEventListener("ended", handleEnd);

  var playPromise = endVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function () {
      cleanup();
    });
  }
}

function loadImages(manifest, callback) {
  if (!manifest || manifest.length === 0) {
    callback();
    return;
  }

  var loaded = 0;
  var total = manifest.length;

  manifest.forEach(function (item) {
    var img = new Image();
    img.onload = function () {
      AssetImages[item.key] = img;
      loaded++;
      if (loaded === total) {
        callback();
      }
    };
    img.onerror = function () {
      loaded++;
      if (loaded === total) {
        callback();
      }
    };
    img.src = item.src;
  });
}

function resizeGame() {
  var root = document.getElementById("game-root");
  var wrapper = document.getElementById("game-wrapper");

  if (!root || !wrapper) return;

  var availableWidth = root.clientWidth;
  var availableHeight = root.clientHeight;

  var scale = Math.min(
    availableWidth / GAME_WIDTH,
    availableHeight / GAME_HEIGHT
  );

  wrapper.style.transform = "scale(" + scale + ")";
}

// ===== Kết thúc màn (thắng/thua) + popup rank =====
function endMission(isClear) {
  if (gameStatus !== "playing") return;

  gameStatus = isClear ? "clear" : "fail";

  // SFX kết thúc
  if (isClear) {
    AudioManager.playSfx("mission_clear");
  } else {
    AudioManager.playSfx("mission_fail");
  }
  if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.stopChaseLoop === "function") {
    AudioManager.stopChaseLoop();
  }
  if (isClear) {
    try {
      // Ensure earlier flags are also set
      localStorage.setItem("stage1_cleared", "true");
      localStorage.setItem("stage2_cleared", "true");
      // NEW: Stage 3 clear flag
      localStorage.setItem("stage3_cleared", "true");
    } catch (e) {
      // ignore storage errors
    }
  }

  if (typeof setInputEnabled === "function") {
    setInputEnabled(false);
  }

  // tắt thanh hack
  UI.updateHackProgress(0, false);

  // Rank based on time (relaxed thresholds).
  // Any failure (being detected) gives rank F.
  var rank = "C";
  if (isClear) {
    if (elapsedTime <= 45) {
      rank = "S";
    } else if (elapsedTime <= 75) {
      rank = "A";
    } else if (elapsedTime <= 110) {
      rank = "B";
    } else {
      rank = "C";
    }
  } else {
    // Caught or killed by laser
    rank = "F";
  }

  var resultModel = {
    status: isClear ? "clear" : "fail",
    time: elapsedTime,
    rank: rank,
    // Lý do thất bại: "guard" | "laser"
    failReason: isClear ? null : (lastFailReason || "guard"),
    onRetry: function () {
      UI.hideResult();
      restartLevel();
    },
    onNext: function () {
      // After Stage 3 is cleared, go back to the hub
      window.location.href = "index.html";
    },
    onMenu: function () {
      // Go back to Hub
      window.location.href = "index.html";
    }
  };

  // Clear stage → play ending video, xong mới show popup
  if (isClear) {
    playEndingVideo(function () {
      UI.showResult(resultModel);
    });
  } else {
    UI.showResult(resultModel);
  }
}

function restartLevel() {
  // reset stealth + input
  if (typeof Stealth !== "undefined" && typeof Stealth.reset === "function") {
    Stealth.reset();
  }
  if (typeof setInputEnabled === "function") {
    setInputEnabled(true);
  }
  isPaused = false;
  if (typeof UI !== "undefined" && UI && typeof UI.hidePause === "function") {
    UI.hidePause();
  }
  wasChasing = false;
  if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.stopChaseLoop === "function") {
    AudioManager.stopChaseLoop();
  }

  // Mặc định coi như fail vì guard nếu chưa thiết lập khác
  lastFailReason = "guard";

  currentLevel = createStage3Level();
  if (currentLevel) {
    currentLevel.stageId = 3;
    currentLevel.theme = "core";
    currentLevel.useFog = false;
  }

  // Override player spawn to a safe spot in Zone A (away from cameras/guards)
  currentLevel.playerSpawn = {
    x: TILE_SIZE * 3 + TILE_SIZE / 2,   // around tile x=3
    y: TILE_SIZE * 33 + TILE_SIZE / 2   // around tile y=17, clear of pillars
  };

  player = new Player(
    currentLevel.playerSpawn.x,
    currentLevel.playerSpawn.y
  );

  // ===== Stage 2 meta flags =====
  // Mark this as Stage 3 and use circular guard vision instead of cone.
  currentLevel.stageId = 3;
  currentLevel.visionMode = "circle";
  currentLevel.securityMode = 0; // 0 = default, 1 = alternate

  // ===== Stage 3 security consoles + clues =====
  currentLevel.securityConsoles = [
    {
      id: "main",
      spriteKey: "s3_console_main",
      clueKey: "stage1_clue_fake_console",
      x: TILE_SIZE * 30,
      y: TILE_SIZE * 18,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      id: "corridor",
      spriteKey: "s3_console_clue",
      clueKey: "stage1_clue_lore_logs",
      x: TILE_SIZE * 32,
      y: TILE_SIZE * 18,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      id: "exit",
      spriteKey: "s3_console_main",
      clueKey: "stage1_clue_mutant_tank",
      x: TILE_SIZE * 34,
      y: TILE_SIZE * 21,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    }
  ];

  currentLevel.trapSwitches = [
    { consoleId: "corridor", groupIds: ["A"] },
    { consoleId: "main",     groupIds: ["B"] },
    { consoleId: "exit",     groupIds: ["C"] }
  ];

  // ===== Stage 3 EXIT rect =====
  currentLevel.exit = {
    x: TILE_SIZE * 63 - TILE_SIZE * 0.4,
    y: TILE_SIZE * 1,
    width: TILE_SIZE * 1.4,
    height: TILE_SIZE * 4
  };

  // EXIT laser must be active at the start of Stage 2
  currentLevel.laserEnabled = true;
  currentLevel.laserAlpha = 1;

  // Clue trigger rects follow the console positions.
  currentLevel.clues = currentLevel.securityConsoles.map(function (c) {
    return {
      key: c.clueKey,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height
    };
  });

  // Objective region = main console (hack target)
  var mainConsole = currentLevel.securityConsoles.find(function (c) {
    return c.id === "main";
  });
  if (mainConsole) {
    currentLevel.objective = {
      x: mainConsole.x,
      y: mainConsole.y,
      width: mainConsole.width,
      height: mainConsole.height
    };
  }

  // Laser switch uses the exit console region
  var exitConsole = currentLevel.securityConsoles.find(function (c) {
    return c.id === "exit";
  });
  if (exitConsole) {
    currentLevel.laserSwitch = {
      x: exitConsole.x,
      y: exitConsole.y,
      width: exitConsole.width,
      height: exitConsole.height
    };
  }

  // ===== Stage 3 decor: machines & traps across the map =====
  var props = [];

  function addProp(spriteKey, tileX, tileY, tileW, tileH, options) {
    var prop = {
      spriteKey: spriteKey,
      x: TILE_SIZE * tileX,
      y: TILE_SIZE * tileY,
      width: TILE_SIZE * tileW,
      height: TILE_SIZE * tileH
    };
    if (options && typeof options === "object") {
      for (var k in options) {
        if (Object.prototype.hasOwnProperty.call(options, k)) {
          prop[k] = options[k];
        }
      }
    }
    props.push(prop);
  }

  // 1) All interactive consoles also appear as props (so they render)
  currentLevel.securityConsoles.forEach(function (c) {
    addProp(c.spriteKey,
      c.x / TILE_SIZE,
      c.y / TILE_SIZE,
      c.width / TILE_SIZE,
      c.height / TILE_SIZE
    );
  });

  // ========== ZONE 1: spawn-side corridor (left) ==========
  // One turret watching the corridor, plus a line of floor spikes.
  addProp("s3_turret",       16, 25, 2, 2, {
    trapType: "turret",
    groupId: "A",
    active: true
  });  // near spawn corridor
  addProp("s3_laser_spikes", 10, 21, 4, 1, {
    trapType: "spikes",
    groupId: "A",
    onSpriteKey: "s3_laser_spikes",
    offSpriteKey: "s3_laser_spikes_off",
    active: true
  });  // small spike strip further down

  // ========== ZONE 2: approach corridor to core ==========
  // Two laser gates forming a choke point, and one spike strip.
  addProp("s3_laser_gate",   26, 26, 2, 3, {
    trapType: "gate",
    groupId: "A",
    onSpriteKey: "s3_laser_gate",
    offSpriteKey: "s3_laser_gate_off",
    active: true
  });  // first gate in main corridor
  // addProp("s3_laser_gate",   22, 19, 2, 3, {
  //   trapType: "gate",
  //   groupId: "A",
  //   onSpriteKey: "s3_laser_gate",
  //   offSpriteKey: "s3_laser_gate_off",
  //   active: true
  // });  // second gate slightly lower/right
  addProp("s3_laser_spikes", 6, 29, 4, 1, {
    trapType: "spikes",
    groupId: "A",
    onSpriteKey: "s3_laser_spikes",
    offSpriteKey: "s3_laser_spikes_off",
    active: true
  });  // spikes on an alternate path

  // ========== ZONE 3: central core room ==========
  // Four turrets around the core, two gates at entrances,
  // and two spike strips inside the room.
  addProp("s3_turret",       24, 15, 2, 2, {
    trapType: "turret",
    groupId: "B",
    active: true
  });  // upper-left of core  
  addProp("s3_turret",       46, 16, 2, 2, {
    trapType: "turret",
    groupId: "B",
    active: true
  });  // upper-right of core
  addProp("s3_turret",       24, 22, 2, 2, {
    trapType: "turret",
    groupId: "B",
    active: true
  });  // lower-left of core, sẽ bị vô hiệu hóa khi mở công tắc tắt laser
  addProp("s3_turret",       42, 25, 2, 2, {
    trapType: "turret",
    groupId: "B",
    active: true
  });  // lower-right of core

  addProp("s3_laser_gate",   15, 8, 2, 5, {
    trapType: "gate",
    groupId: "B",
    onSpriteKey: "s3_laser_gate",
    offSpriteKey: "s3_laser_gate_off",
    active: true
  });  // gate at top entrance to core
  addProp("s3_laser_gate",   27, 15, 2, 6, {
    trapType: "gate",
    groupId: "B",
    onSpriteKey: "s3_laser_gate",
    offSpriteKey: "s3_laser_gate_off",
    active: true
  });  // gate at bottom entrance to core

  addProp("s3_laser_spikes", 52, 7, 4, 1, {
    trapType: "spikes",
    groupId: "B",
    onSpriteKey: "s3_laser_spikes",
    offSpriteKey: "s3_laser_spikes_off",
    active: true
  });  // spikes near lower center
  addProp("s3_laser_spikes", 52, 29, 4, 1, {
    trapType: "spikes",
    groupId: "B",
    onSpriteKey: "s3_laser_spikes",
    offSpriteKey: "s3_laser_spikes_off",
    active: true
  });  // spikes slightly to the right

  // ========== ZONE 4: exit-side area (right) ==========
  // Final turret, gate near exit, and last spike strip.
  addProp("s3_turret",       10, 3, 2, 2, {
    trapType: "turret",
    groupId: "C",
    active: true
  });  // turret guarding the exit corridor
  addProp("s3_laser_gate",   57, 14, 3, 7, {
    trapType: "gate",
    groupId: "C",
    onSpriteKey: "s3_laser_gate",
    offSpriteKey: "s3_laser_gate_off",
    active: true
  });  // gate just before exit
  addProp("s3_laser_spikes", 61, 21, 2, 1, {
    trapType: "spikes",
    groupId: "C",
    onSpriteKey: "s3_laser_spikes",
    offSpriteKey: "s3_laser_spikes_off",
    active: true
  });  // spikes under the gate

  currentLevel.securityProps = props;

  if (currentLevel.stageId === 3) {
    currentLevel.turretBullets = [];
    if (currentLevel.securityProps && currentLevel.securityProps.length) {
      for (var i = 0; i < currentLevel.securityProps.length; i++) {
        var tp = currentLevel.securityProps[i];
        if (!tp || tp.trapType !== "turret") continue;
        if (typeof tp.fireCooldown !== "number") tp.fireCooldown = 0;
        if (typeof tp.fireInterval !== "number") tp.fireInterval = 0.8;
        if (typeof tp.detectionRadius !== "number") tp.detectionRadius = TILE_SIZE * 6;
        if (typeof tp.bulletSpeed !== "number") tp.bulletSpeed = 400;
        if (typeof tp.bulletRadius !== "number") tp.bulletRadius = 6;
        tp.detectionRadius = tp.detectionRadius - TILE_SIZE;
        if (tp.detectionRadius < TILE_SIZE * 2) {
          tp.detectionRadius = TILE_SIZE * 2;
        }
        var vr = tp.detectionRadius - TILE_SIZE;
        if (vr < TILE_SIZE) {
          vr = TILE_SIZE;
        }
        tp.visionRadius = vr;
      }
    }

    currentLevel.laserGroups = {
      A: { id: "A", name: "Spawn/approach traps", active: true },
      B: { id: "B", name: "Core traps",           active: true },
      C: { id: "C", name: "Exit traps",           active: true }
    };

    function worldFromTile(tx, ty) {
      return {
        x: TILE_SIZE * tx,
        y: TILE_SIZE * ty
      };
    }

    var switches = [];

    (function createSwitchA() {
      var pos = worldFromTile(12, 27);
      switches.push({
        id: "switchA",
        consoleId: "corridor",
        groupIds: ["A"],
        x: pos.x,
        y: pos.y,
        width: TILE_SIZE * 2,
        height: TILE_SIZE * 2,
        spriteKey: "s3_laser_switch",
        active: true,
        pressed: false,
        animTime: 0,
        used: false,
        justToggled: false
      });
      addProp("s3_laser_switch", 12, 27, 2, 2);
    })();

    (function createSwitchB() {
      var pos = worldFromTile(38, 19);
      switches.push({
        id: "switchB",
        consoleId: "main",
        groupIds: ["B"],
        x: pos.x,
        y: pos.y,
        width: TILE_SIZE * 2,
        height: TILE_SIZE * 2,
        spriteKey: "s3_laser_switch",
        active: true,
        pressed: false,
        animTime: 0,
        used: false,
        justToggled: false
      });
      addProp("s3_laser_switch", 38, 19, 2, 2);
    })();

    (function createSwitchC() {
      var pos = worldFromTile(51, 19);
      switches.push({
        id: "switchC",
        consoleId: "exit",
        groupIds: ["C"],
        x: pos.x,
        y: pos.y,
        width: TILE_SIZE * 2,
        height: TILE_SIZE * 2,
        spriteKey: "s3_laser_switch",
        active: true,
        pressed: false,
        animTime: 0,
        used: false,
        justToggled: false
      });
      addProp("s3_laser_switch", 51, 19, 2, 2);
    })();

    currentLevel.laserSwitches = switches;

    currentLevel.laserEnabled = true;
    currentLevel.laserAlpha = 1;
  }

  // ===== Stage 2 wall cameras =====
  // These are used both for rendering and for stealth detection.
  // They are mounted near the top walls and look downwards into the map.
  currentLevel.cameras = [
    {
      // Camera A – top wall, above center of Zone B, below HUD
      x: TILE_SIZE * 4,
      y: TILE_SIZE * 8,
      radius: TILE_SIZE * 5,
      dirX: 0,
      dirY: 1,
      fovAngle: Math.PI
    },
    {
      // Camera B – central divider (looking left into corridor)
      x: TILE_SIZE * 30,
      y: TILE_SIZE * 8,
      radius: TILE_SIZE * 5,
      dirX: -1,
      dirY: 0,
      fovAngle: Math.PI
    },
    {
      // Camera C – right-side wall watching the exit corridor
      x: TILE_SIZE * 63,
      y: TILE_SIZE * 11,
      radius: TILE_SIZE * 5,
      dirX: -1,
      dirY: 0,
      fovAngle: Math.PI
    }
  ];
  if (Array.isArray(currentLevel.cameras)) {
    currentLevel.cameras.forEach(function (cam) {
      if (typeof cam.active === "undefined") {
        cam.active = true;
      }
    });
  }
  if (Array.isArray(currentLevel.securityDoors)) {
    currentLevel.securityDoors.forEach(function (door) {
      if (typeof door.active === "undefined") {
        door.active = true;
      }
    });
  }
  applySecurityModeForStage2();

  guards = [];

  // ===== Stage 3 guards – Core facility =====
  //
  // Coordinate system:
  //   width  = 64 tiles, height = 40 tiles
  //   TILE_SIZE pixels per tile.
  //
  // Layout overview (from level.js):
  //   - Player spawn: around tile x=3, y=17 (left).
  //   - Horizontal wall belts: y = 7, 13, 21, 29.
  //   - Central core room: x = 26..37, y = 14..25.
  //   - EXIT region: near tile x=61, y=20.

  // Guard A1 – Spawn corridor (left): patrol horizontally near the player's area
  var gA1Route = [
    { x: TILE_SIZE * 6,  y: TILE_SIZE * 17 },
    { x: TILE_SIZE * 18, y: TILE_SIZE * 17 },
    { x: TILE_SIZE * 10, y: TILE_SIZE * 17 }
  ];
  guards.push(new Guard(gA1Route[0].x, gA1Route[0].y, gA1Route));

  // // Guard A2 – Upper left corridor: patrol above the spawn zone
  var gA2Route = [
    { x: TILE_SIZE * 4,  y: TILE_SIZE * 11 },
    { x: TILE_SIZE * 14, y: TILE_SIZE * 11 },
    { x: TILE_SIZE * 8,  y: TILE_SIZE * 11 }
  ];
  guards.push(new Guard(gA2Route[0].x, gA2Route[0].y, gA2Route));

  // // Guard B1 – Core ring (center): rectangle patrol around the core room interior
  var gB1Route = [
    { x: TILE_SIZE * 55, y: TILE_SIZE * 25 },
    { x: TILE_SIZE * 45, y: TILE_SIZE * 25 },
    { x: TILE_SIZE * 55, y: TILE_SIZE * 25 }
  ];
  guards.push(new Guard(gB1Route[0].x, gB1Route[0].y, gB1Route));

  // // Guard B2 – Core entrance corridor: short patrol in front of the core door
  // Core door is roughly at x = 26, y = 19; we patrol slightly left of it.
  var gB2Route = [
    { x: TILE_SIZE * 37, y: TILE_SIZE * 35 },
    { x: TILE_SIZE * 37, y: TILE_SIZE * 19 },
    { x: TILE_SIZE * 37, y: TILE_SIZE * 35 }
  ];
  guards.push(new Guard(gB2Route[0].x, gB2Route[0].y, gB2Route));

  // // Guard C1 – Exit zone (right): patrol around the exit corridor
  var gC1Route = [
    { x: TILE_SIZE * 50, y: TILE_SIZE * 3 },
    { x: TILE_SIZE * 10, y: TILE_SIZE * 3 },
    { x: TILE_SIZE * 50, y: TILE_SIZE * 3 }
  ];
  guards.push(new Guard(gC1Route[0].x, gC1Route[0].y, gC1Route));
  // // Guard C2 – Lower right corridor: patrol below the exit corridor
  var gC2Route = [
    { x: TILE_SIZE * 6, y: TILE_SIZE * 25 },
    { x: TILE_SIZE * 17, y: TILE_SIZE * 25 },
    { x: TILE_SIZE * 6, y: TILE_SIZE * 25 }
  ];
  guards.push(new Guard(gC2Route[0].x, gC2Route[0].y, gC2Route));
  // Guard 
  var gC3Route = [
      { x: TILE_SIZE * 60, y: TILE_SIZE * 31 },
    { x: TILE_SIZE * 40, y: TILE_SIZE * 31 },
    { x: TILE_SIZE * 40, y: TILE_SIZE * 38 },
    { x: TILE_SIZE * 60, y: TILE_SIZE * 38 }
  ];
  guards.push(new Guard(gC3Route[0].x, gC3Route[0].y, gC3Route));

  // === Mutant guard in console room (Stage 3) ===
  // NOTE: keep this inside the Stage 3 setup function, after other guards are created.
  var mutantConsoleGuard = new Guard(TILE_SIZE * 35, TILE_SIZE * 20, []);
  mutantConsoleGuard.isMutant = true;  // important: enables mutant sleep/zzz behavior
  guards.push(mutantConsoleGuard);

  // Reset timer & mission
  elapsedTime = 0;
  mission.hacked = false;
  mission.hacking = false;
  mission.hackProgress = 0;
  mission.notifiedAfterHack = false;
  mission.notifiedNeedData = false;
  mission.hackStartSfxPlayed = false;
  mission.hackCompleteSfxPlayed = false;
  mission.stage2HackCompleted = false;
  mission.stage2AfterHackHintShown = false;
  stage2ReconfigHintShown = false;
  UI.updateHackProgress(0, false);

  wasDetected = false;

  gameStatus = "playing";
  gameStatusTimer = 0;
}

function setLaserGroupActive(level, groupId, active) {
  if (!level) return;

  if (!level.laserGroups) {
    level.laserGroups = {};
  }

  if (!level.laserGroups[groupId]) {
    level.laserGroups[groupId] = { id: groupId, active: !!active };
  } else {
    level.laserGroups[groupId].active = active;
  }

  if (level.securityProps && level.securityProps.length) {
    for (var i = 0; i < level.securityProps.length; i++) {
      var p = level.securityProps[i];
      if (!p || !p.groupId) continue;
      if (p.groupId === groupId) {
        p.active = active;

        // For Stage 3 traps with separate ON/OFF frames, swap the sprite to match active state
        if (p.trapType === "gate" || p.trapType === "spikes") {
          if (active === false && p.offSpriteKey) {
            p.spriteKey = p.offSpriteKey;
          } else if (active === true && p.onSpriteKey) {
            p.spriteKey = p.onSpriteKey;
          }
        }
      }
    }
  }
}

function disableTrapGroup(level, groupId) {
  if (!level || !Array.isArray(level.securityProps)) return;

  for (var i = 0; i < level.securityProps.length; i++) {
    var p = level.securityProps[i];
    if (!p || p.groupId !== groupId) continue;

    if (p.trapType === "gate" || p.trapType === "spikes") {
      p.active = false;
      if (p.offSpriteKey) {
        p.spriteKey = p.offSpriteKey;
      }
    }

    if (p.trapType === "turret" || p.trapType === "camera") {
      p.active = false;
      if (typeof p.visionRadius === "number") {
        p.visionRadius = 0;
      }
    }
  }
}

function computeTrapGroupCenter(level, groupIds) {
  if (!level || !Array.isArray(level.securityProps) || !groupIds || !groupIds.length) {
    return null;
  }

  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  var found = false;

  for (var i = 0; i < level.securityProps.length; i++) {
    var p = level.securityProps[i];
    if (!p || !p.groupId) continue;

    var inGroup = false;
    for (var g = 0; g < groupIds.length; g++) {
      if (p.groupId === groupIds[g]) {
        inGroup = true;
        break;
      }
    }
    if (!inGroup) continue;

    var x1 = p.x;
    var y1 = p.y;
    var x2 = p.x + p.width;
    var y2 = p.y + p.height;

    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
    found = true;
  }

  if (!found) {
    return null;
  }

  return {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5
  };
}

function updateStage3LaserSwitches(dt, justPressedE) {
  if (!currentLevel || currentLevel.stageId !== 3) return;
  if (!player) return;
  if (!currentLevel.laserSwitches || !currentLevel.laserSwitches.length) return;

  var hoveredSwitch = null;
  var px = player.x;
  var py = player.y;
  var radius = TILE_SIZE * 1.5;
  var radiusSq = radius * radius;

  for (var i = 0; i < currentLevel.laserSwitches.length; i++) {
    var s = currentLevel.laserSwitches[i];
    if (!s) continue;
    var cx = s.x + s.width * 0.5;
    var cy = s.y + s.height * 0.5;
    var dx = px - cx;
    var dy = py - cy;
    var distSq = dx * dx + dy * dy;
    if (distSq <= radiusSq) {
      hoveredSwitch = s;
      break;
    }
  }

  if (hoveredSwitch) {
    if (typeof UI !== "undefined" && UI && typeof UI.showInteractionHint === "function") {
      UI.showInteractionHint("stage3_laser_hint");
    }
  } else {
    if (typeof UI !== "undefined" && UI && typeof UI.clearInteractionHint === "function") {
      UI.clearInteractionHint();
    }
  }

  if (!justPressedE) return;
  if (!hoveredSwitch) return;
  if (hoveredSwitch.used) return;

  var anyActive = false;
  if (hoveredSwitch.groupIds && hoveredSwitch.groupIds.length) {
    for (var j = 0; j < hoveredSwitch.groupIds.length; j++) {
      var gid = hoveredSwitch.groupIds[j];
      if (!currentLevel.laserGroups || !currentLevel.laserGroups[gid] || currentLevel.laserGroups[gid].active) {
        anyActive = true;
        break;
      }
    }
  }

  if (!anyActive) return;

  if (hoveredSwitch.groupIds && hoveredSwitch.groupIds.length) {
    for (var k = 0; k < hoveredSwitch.groupIds.length; k++) {
      setLaserGroupActive(currentLevel, hoveredSwitch.groupIds[k], false);
    }
  }

  hoveredSwitch.used = true;

  // Start a short camera pan towards the disabled trap group(s), except for switchC which uses the exit cinematic
  if (hoveredSwitch.id !== "switchC") {
    var focusPoint = computeTrapGroupCenter(currentLevel, hoveredSwitch.groupIds || []);
    if (focusPoint) {
      trapFocusCinematic.active = true;
      trapFocusCinematic.timer = 0;
      trapFocusCinematic.duration = 1.0;
      trapFocusCinematic.targetX = focusPoint.x;
      trapFocusCinematic.targetY = focusPoint.y;
    }
  }

  if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.playSfx === "function") {
    AudioManager.playSfx("laser_off");
  }

  if (hoveredSwitch.id === "switchC") {
    if (!laserCinematic.active) {
      laserCinematic.active = true;
      laserCinematic.timer = 0;
      currentLevel.laserEnabled = true;
      currentLevel.laserAlpha = 1;

      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        UI.showDialog("stage3_laser_off", "tutorial_hint");
        setTimeout(function () {
          if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
            UI.hideDialog();
          }
        }, 2000);
      }
    }
  }
}

function updateStage3TrapSwitches(dt, justPressedE) {
  if (!currentLevel || currentLevel.stageId !== 3) return;
  if (!justPressedE) return;
  if (!player) return;
  if (!Array.isArray(currentLevel.securityConsoles)) return;
  if (!Array.isArray(currentLevel.trapSwitches)) return;

  var px = player.x;
  var py = player.y;
  var margin = TILE_SIZE * 0.5;

  for (var i = 0; i < currentLevel.securityConsoles.length; i++) {
    var c = currentLevel.securityConsoles[i];
    if (!c) continue;

    var cx = c.x;
    var cy = c.y;
    var cw = c.width;
    var ch = c.height;

    var inside =
      px >= cx - margin && px <= cx + cw + margin &&
      py >= cy - margin && py <= cy + ch + margin;

    if (!inside) continue;

    var groups = [];
    for (var j = 0; j < currentLevel.trapSwitches.length; j++) {
      var sw = currentLevel.trapSwitches[j];
      if (sw && sw.consoleId === c.id && Array.isArray(sw.groupIds)) {
        groups = sw.groupIds;
        break;
      }
    }

    if (!groups.length) continue;

    if (c.used) {
      continue;
    }
    c.used = true;

    for (var g = 0; g < groups.length; g++) {
      disableTrapGroup(currentLevel, groups[g]);
    }

    if (c.id === "exit") {
      currentLevel.laserEnabled = false;
      currentLevel.laserAlpha = 0;
      laserCinematic.active = false;
      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        UI.showDialog("stage3_laser_off", "tutorial_hint");
        setTimeout(function () {
          if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
            UI.hideDialog();
          }
        }, 2000);
      }
    }

    if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.playSfx === "function") {
      AudioManager.playSfx("laser_off");
    }

    break;
  }
}

function updateStage3Traps(dt) {
  if (!currentLevel || currentLevel.stageId !== 3) return;
  if (!player) return;
  if (!currentLevel.securityProps || !currentLevel.securityProps.length) return;

  function turretHasLineOfSight(level, tx, ty, px, py) {
    if (!level || typeof level.isBlocked !== "function") return true;
    var steps = 20;
    var dx = px - tx;
    var dy = py - ty;
    for (var s = 1; s <= steps; s++) {
      var t = s / steps;
      var cx = tx + dx * t;
      var cy = ty + dy * t;
      if (level.isBlocked(cx, cy)) {
        return false;
      }
    }
    return true;
  }

  function killPlayerWithKey(dialogKey) {
    if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
      UI.showDialog(dialogKey || "stage1_laser_dead", "tutorial_hint");
      setTimeout(function () {
        if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
          UI.hideDialog();
        }
      }, 2000);
    }
    lastFailReason = "laser";
    endMission(false);
  }

  for (var i = 0; i < currentLevel.securityProps.length; i++) {
    var p = currentLevel.securityProps[i];
    if (!p) continue;
    if (!p.trapType) continue;
    if (p.active === false) continue;

    var px = player.x;
    var py = player.y;

    if (p.trapType === "spikes" || p.trapType === "gate") {
      var inside =
        px >= p.x && px <= p.x + p.width &&
        py >= p.y && py <= p.y + p.height;

      if (!inside) continue;

      killPlayerWithKey("stage1_laser_dead");
      return;
    }

    if (p.trapType === "turret") {
      if (p.active === false) continue;
      var tx = p.x + p.width * 0.5;
      var ty = p.y + p.height * 0.5;
      var dx = px - tx;
      var dy = py - ty;
      var distSq = dx * dx + dy * dy;
      var detectRadius = (typeof p.detectionRadius === "number") ? p.detectionRadius : TILE_SIZE * 6;
      var detectSq = detectRadius * detectRadius;
      var len = Math.sqrt(distSq);
      var nx = len > 0 ? dx / len : 0;
      var ny = len > 0 ? dy / len : 0;

      p.aimDirX = nx;
      p.aimDirY = ny;

      if (distSq <= detectSq) {
        var hasLosTurret = turretHasLineOfSight(currentLevel, tx, ty, px, py);
        if (!hasLosTurret) continue;
        if (typeof p.fireCooldown !== "number") {
          p.fireCooldown = 0;
        }
        p.fireCooldown -= dt;
        if (p.fireCooldown <= 0) {
          var speed = (typeof p.bulletSpeed === "number") ? p.bulletSpeed : 400;
          var interval = (typeof p.fireInterval === "number") ? p.fireInterval : 0.8;
          var radius = (typeof p.bulletRadius === "number") ? p.bulletRadius : 6;

          currentLevel.turretBullets.push({
            x: tx,
            y: ty,
            vx: nx * speed,
            vy: ny * speed,
            speed: speed,
            radius: radius,
            alive: true
          });

          p.fireCooldown = interval;
        }
      }
    }
  }

  if (!currentLevel.turretBullets || !currentLevel.turretBullets.length) return;

  var worldW = currentLevel.width * TILE_SIZE;
  var worldH = currentLevel.height * TILE_SIZE;

  for (var b = 0; b < currentLevel.turretBullets.length; b++) {
    var bullet = currentLevel.turretBullets[b];
    if (!bullet || bullet.alive === false) continue;

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    if (
      bullet.x < 0 || bullet.y < 0 ||
      bullet.x > worldW || bullet.y > worldH
    ) {
      bullet.alive = false;
      continue;
    }

    if (typeof currentLevel.isBlocked === "function" && currentLevel.isBlocked(bullet.x, bullet.y)) {
      bullet.alive = false;
      continue;
    }

    var dxp = bullet.x - player.x;
    var dyp = bullet.y - player.y;
    var br = (typeof bullet.radius === "number") ? bullet.radius : 6;
    if (dxp * dxp + dyp * dyp <= br * br) {
      bullet.alive = false;
      killPlayerWithKey("stage3_turret_dead");
      return;
    }
  }

  currentLevel.turretBullets = currentLevel.turretBullets.filter(function (bItem) {
    return bItem && bItem.alive !== false;
  });
}

function isPlayerNearStage2MainConsole() {
  if (!currentLevel || currentLevel.stageId !== 2) return false;
  if (!player) return false;
  var obj = currentLevel.objective;
  if (!obj) return false;

  var px = player.x;
  var py = player.y;
  var inRange =
    px >= obj.x - TILE_SIZE * 0.5 &&
    px <= obj.x + obj.width + TILE_SIZE * 0.5 &&
    py >= obj.y - TILE_SIZE * 0.5 &&
    py <= obj.y + obj.height + TILE_SIZE * 0.5;

  return inRange;
}

function handleStage2SecurityModeToggle(justPressedE) {
  if (!currentLevel || currentLevel.stageId !== 2) return;
  if (!mission || !mission.stage2HackCompleted) return;
  if (!player) return;

  var inRange = isPlayerNearStage2MainConsole();
  if (!inRange) return;
  if (!justPressedE) return;

  if (typeof currentLevel.securityMode !== "number") {
    currentLevel.securityMode = 0;
  } else {
    currentLevel.securityMode = (currentLevel.securityMode + 1) % 2;
  }

  applySecurityModeForStage2();

  var msgKey =
    currentLevel.securityMode === 0
      ? "stage2_mode_exit_guarded"
      : "stage2_mode_exit_relaxed";

  if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
    UI.showDialog(msgKey, "tutorial_hint");
  }
}

function updateHacking(dt) {
  if (!currentLevel || !player) return;

  var inZone = currentLevel.isPlayerAtObjective(player);
  var eDown = !!keyState["KeyE"];
  var wasHacking = mission.hacking; // trạng thái frame trước

  if (inZone && eDown && !mission.hacked) {
    // mới bắt đầu giữ E → play SFX hack_start 1 lần
    if (!wasHacking && !mission.hackStartSfxPlayed) {
      AudioManager.playSfx("hack_start");
      mission.hackStartSfxPlayed = true;
    }

    mission.hacking = true;
    mission.hackProgress += dt;

    if (mission.hackProgress >= mission.hackDuration) {
      mission.hackProgress = mission.hackDuration;
      mission.hacked = true;
      mission.hacking = false;

      // SFX hack complete (chỉ 1 lần)
      if (!mission.hackCompleteSfxPlayed) {
        AudioManager.playSfx("hack_complete");
        mission.hackCompleteSfxPlayed = true;
      }
      mission.stage2HackCompleted = true;

      // Thông báo hoàn thành hack (chỉ 1 lần)
      if (
        !mission.notifiedAfterHack &&
        typeof UI !== "undefined" &&
        UI &&
        typeof UI.showDialog === "function"
      ) {
        mission.notifiedAfterHack = true;

        // dùng key text đã có trong lang.js
        UI.showDialog("stage2_after_hack_hint", "tutorial_hint");

        // tự ẩn sau 3s để không che màn hình
        setTimeout(function () {
          if (
            typeof UI !== "undefined" &&
            UI &&
            typeof UI.hideDialog === "function"
          ) {
            UI.hideDialog();
          }
        }, 3000);
      }
    }

  } else {
    if (!mission.hacked) {
      // phải giữ liên tục, buông ra là reset
      mission.hacking = false;
      mission.hackProgress = 0;
      mission.hackStartSfxPlayed = false; // để lần sau giữ E lại có âm
    }
  }

  var progress = mission.hacked
    ? 1
    : mission.hackProgress / mission.hackDuration;

  // Hiện thanh tiến độ khi đang hack hoặc đang đứng trong vùng mục tiêu
  UI.updateHackProgress(
    progress,
    mission.hacking || (inZone && !mission.hacked)
  );
}

// Player walks near lab devices and just pressed E -> show clue dialog
function updateClues(dt, justPressedE) {
  if (!currentLevel || !player) return;
  if (!justPressedE) return;

  // If we are currently hacking (or about to hack) at the objective,
  // prioritize the hacking interaction over clues.
  var inObjective =
    currentLevel.isPlayerAtObjective &&
    currentLevel.isPlayerAtObjective(player);

  if ((mission.hacking && !mission.hacked) || (!mission.hacked && inObjective)) {
    return;
  }

  var clues = currentLevel.clues;
  if (!clues || !clues.length) return;

  var px = player.x;
  var py = player.y;
  var margin = TILE_SIZE * 0.5; // allow some distance around the device

  for (var i = 0; i < clues.length; i++) {
    var c = clues[i];

    // Expand the region a bit to make it easier to interact
    var rx = c.x - margin;
    var ry = c.y - margin;
    var rw = c.width + margin * 2;
    var rh = c.height + margin * 2;

    var inside =
      px >= rx && px <= rx + rw &&
      py >= ry && py <= ry + rh;

    if (inside) {
      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        // Ẩn dialog cũ nếu có
        if (typeof UI.hideDialog === "function") {
          UI.hideDialog();
        }

        // Hiện manh mối mới
        UI.showDialog(c.key, "tutorial_hint");

        // Tự tắt sau 2.5s (trừ khi đang ở intro)
        setTimeout(function () {
          if (
            typeof Tutorial !== "undefined" &&
            Tutorial &&
            typeof Tutorial.isActive === "function" &&
            Tutorial.isActive()
          ) {
            return;
          }
          if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
            UI.hideDialog();
          }
        }, 2500);
      }
      break;
    }
  }
}

// Show a hint when the player is near the side-room console that disables the laser.
function updateLaserSwitchHint(dt) {
  if (!currentLevel || !player) return;

  // Stage 3 uses multi-switch logic; the hint is handled in updateStage3LaserSwitches.
  if (currentLevel.stageId === 3 && currentLevel.laserSwitches && currentLevel.laserSwitches.length > 0) {
    return;
  }

  if (!currentLevel.laserSwitch) return;

  // If the laser is already disabled, hide the hint (if any) and stop.
  if (!currentLevel.laserEnabled) {
    if (laserHintShown && typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
      UI.hideDialog();
    }
    laserHintShown = false;
    return;
  }

  var s = currentLevel.laserSwitch;
  var px = player.x;
  var py = player.y;
  var margin = TILE_SIZE * 0.5;

  var rx = s.x - margin;
  var ry = s.y - margin;
  var rw = s.width + margin * 2;
  var rh = s.height + margin * 2;

  var inside =
    px >= rx && px <= rx + rw &&
    py >= ry && py <= ry + rh;

  // Player near the switch: show hint dialog once
  if (inside) {
    if (!laserHintShown) {
      laserHintShown = true;
        if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
          UI.showDialog("stage2_laser_hint", "tutorial_hint");
        }
    }
  } else {
    // Player left the area: hide hint if it was visible
    if (laserHintShown) {
      laserHintShown = false;
      if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
        UI.hideDialog();
      }
    }
  }
}

// Player can disable the laser by pressing E near the side-room switch.
function updateLaserSwitch(dt, justPressedE) {
  if (!currentLevel || !player) return;
  if (currentLevel.stageId === 3 && currentLevel.laserSwitches && currentLevel.laserSwitches.length > 0) {
    updateStage3LaserSwitches(dt, justPressedE);
    return;
  }
  if (!justPressedE) return;
  if (!currentLevel.laserSwitch) return;
  if (!currentLevel.laserEnabled) return;

  var s = currentLevel.laserSwitch;
  var px = player.x;
  var py = player.y;
  var margin = TILE_SIZE * 0.5;

  var rx = s.x - margin;
  var ry = s.y - margin;
  var rw = s.width + margin * 2;
  var rh = s.height + margin * 2;

  var inside =
    px >= rx && px <= rx + rw &&
    py >= ry && py <= ry + rh;

  if (!inside) return;

  // Start the laser disable cinematic only once
  if (!laserCinematic.active) {
    laserCinematic.active = true;
    laserCinematic.timer = 0;

    // Laser still visible at start; will fade out over time.
    currentLevel.laserEnabled = true;
    currentLevel.laserAlpha = 1;

    // Optional SFX
    if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.playSfx === "function") {
      AudioManager.playSfx("laser_off");
    }

    // Show a short hint dialog (new key must exist in lang.js)
    if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
      UI.showDialog("stage2_laser_off", "tutorial_hint");
      setTimeout(function () {
        if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
          UI.hideDialog();
        }
      }, 2500);
    }

    // Focus the camera on the exit while fading the laser
    if (currentLevel.exit && typeof Renderer !== "undefined" && Renderer) {
      var ex = currentLevel.exit;
      var cx = ex.x + ex.width / 2;
      var cy = ex.y + ex.height / 2;
      if (typeof Renderer.setCameraMode === "function") {
        Renderer.setCameraMode("intro");
      }
      if (typeof Renderer.setCameraTarget === "function") {
        Renderer.setCameraTarget(cx, cy);
      }
    }
  }
}

// ===== Cập nhật vùng explored xung quanh player (cho minimap) =====
function updateExploredArea() {
  if (!currentLevel || !player || !currentLevel.explored) return;

  var cx = Math.floor(player.x / TILE_SIZE);
  var cy = Math.floor(player.y / TILE_SIZE);

  var radius = 4; // bán kính tile "mở sáng" trên minimap
  var w = currentLevel.width;
  var h = currentLevel.height;

  for (var y = cy - radius; y <= cy + radius; y++) {
    if (y < 0 || y >= h) continue;
    var row = currentLevel.explored[y];
    for (var x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= w) continue;
      row[x] = true;
    }
  }
}

function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  var dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  if (dt > 0.05) dt = 0.05;

  var escDown = !!keyState["Escape"];
  var justEscPressed = escDown && !lastEscDown;
  lastEscDown = escDown;

  if (
    justEscPressed &&
    gameStatus === "playing" &&
    typeof StateManager !== "undefined" &&
    StateManager.current === "game"
  ) {
    if (!isPaused) {
      // Enter pause
      isPaused = true;
      if (typeof UI !== "undefined" && UI && typeof UI.showPause === "function") {
        UI.showPause({
          onResume: function () {
            isPaused = false;
            if (UI && UI.hidePause) UI.hidePause();
          },
          onRetry: function () {
            if (UI && UI.hidePause) UI.hidePause();
            isPaused = false;
            restartLevel();
          },
          onMenu: function () {
            if (UI && UI.hidePause) UI.hidePause();
            isPaused = false;
            restartLevel();
          }
        });
      }
    } else {
      // Already paused: ESC again to resume quickly
      isPaused = false;
      if (typeof UI !== "undefined" && UI && typeof UI.hidePause === "function") {
        UI.hidePause();
      }
    }
  }

  if (gameStatus === "playing") {
    var state = StateManager.current || "game";

    // Detect just-pressed E
      var eDown = !!keyState["KeyE"];
      var justPressedE = eDown && !lastEPressed;

    if (isPaused) {
      // Do not update gameplay while paused
    } else if (state === "intro") {
      // Intro: không đếm thời gian, không update gameplay/hack/detection
      if (window.Tutorial && typeof Tutorial.updateIntro === "function") {
        Tutorial.updateIntro(dt, {
          level: currentLevel,
          player: player,
          guards: guards
        });
      }
    } else {
      // ===== GAMEPLAY chính =====

      // tăng thời gian
      elapsedTime += dt;

      StateManager.update(dt, {
        level: currentLevel,
        player: player,
        guards: guards
      });

      // (Giữ nguyên double Stealth.update như logic cũ)
      if (typeof Stealth !== "undefined" && typeof Stealth.update === "function") {
        Stealth.update(guards, player, currentLevel, dt);
      }

      var isChasingNow = !!Stealth.isChasing;

      if (isChasingNow && !wasChasing) {
        // just entered chase
        if (typeof AudioManager !== "undefined" &&
            AudioManager && typeof AudioManager.playChaseLoop === "function") {
          AudioManager.playChaseLoop();
        }
      } else if (!isChasingNow && wasChasing) {
        // just left chase
        if (typeof AudioManager !== "undefined" &&
            AudioManager && typeof AudioManager.stopChaseLoop === "function") {
          AudioManager.stopChaseLoop();
        }
      }

      wasChasing = isChasingNow;

      // cập nhật hack nhiệm vụ
      updateHacking(dt);

      // cập nhật vùng explored cho minimap
      updateExploredArea();

      // Check for clues near lab devices when player presses E
      updateClues(dt, justPressedE);
      // Player can disable traps / laser by pressing E near switches
      updateLaserSwitch(dt, justPressedE);
      updateStage3TrapSwitches(dt, justPressedE);
      updateStage3Traps(dt);
      updateLaserSwitchHint(dt);
      handleStage2SecurityModeToggle(justPressedE);

      // Show contextual hint to reconfigure security after hack
      if (
        currentLevel &&
        currentLevel.stageId === 2 &&
        mission &&
        mission.stage2HackCompleted &&
        isPlayerNearStage2MainConsole()
      ) {
        if (
          typeof UI !== "undefined" &&
          UI &&
          typeof UI.showInteractionHint === "function"
        ) {
          UI.showInteractionHint("stage2_hint_reconfigure_action");
        } else if (!stage2ReconfigHintShown && typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
          UI.showDialog("stage2_hint_reconfigure_action", "tutorial_hint");
          stage2ReconfigHintShown = true;
        }
      } else {
        if (
          typeof UI !== "undefined" &&
          UI &&
          typeof UI.clearInteractionHint === "function"
        ) {
          UI.clearInteractionHint();
        } else if (stage2ReconfigHintShown && typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
          UI.hideDialog();
          stage2ReconfigHintShown = false;
        }
      }

      // Bị guard phát hiện → thua
      if (Stealth.isDetected) {
        if (!wasDetected) {
          wasDetected = true;
        }
        // stop chase loop when fully detected and about to fail
        if (typeof AudioManager !== "undefined" &&
            AudioManager && typeof AudioManager.stopChaseLoop === "function") {
          AudioManager.stopChaseLoop();
        }
        lastFailReason = "guard";
        endMission(false);
      }
      // Player đến cửa EXIT
      else if (currentLevel && currentLevel.isPlayerAtExit(player)) {
        // If the laser gate is still enabled: instant death by laser
        if (currentLevel.laserEnabled) {
          if (
            typeof UI !== "undefined" &&
            UI &&
            typeof UI.showDialog === "function"
          ) {
            UI.showDialog("stage1_laser_dead", "tutorial_hint");
            setTimeout(function () {
              if (
                typeof UI !== "undefined" &&
                UI &&
                typeof UI.hideDialog === "function"
              ) {
                UI.hideDialog();
              }
            }, 2000);
          }

          lastFailReason = "laser";
          endMission(false);
        }
        // No laser, but mission hacked -> normal clear
        else if (mission.hacked) {
          endMission(true);
        }
        // No laser, but data not hacked yet -> warn the player
        else {
          if (
            !mission.notifiedNeedData &&
            typeof UI !== "undefined" &&
            UI &&
            typeof UI.showDialog === "function"
          ) {
            mission.notifiedNeedData = true;

            UI.showDialog("stage2_objective_need_data", "tutorial_hint");

            setTimeout(function () {
              if (
                typeof UI !== "undefined" &&
                UI &&
                typeof UI.hideDialog === "function"
              ) {
                UI.hideDialog();
              }
            }, 2500);
          }
        }
      }
    }
  }

  // Camera shake based on alert level / detection
  if (typeof Renderer !== "undefined" && typeof Stealth !== "undefined" && Renderer && Stealth) {
    var shakeStrength = 0;

    if (Stealth.isDetected) {
      shakeStrength = 6; // strong shake when fully detected
    } else if (Stealth.alertLevel >= 0.7) {
      shakeStrength = 3.5; // medium shake
    } else if (Stealth.alertLevel >= 0.4) {
      shakeStrength = 2; // light shake
    }

    if (shakeStrength > 0 && gameStatus === "playing") {
      Renderer.cameraShakeX = (Math.random() * 2 - 1) * shakeStrength;
      Renderer.cameraShakeY = (Math.random() * 2 - 1) * shakeStrength;
    } else {
      Renderer.cameraShakeX = 0;
      Renderer.cameraShakeY = 0;
    }
  }

  // Laser fade + camera pan towards exit while the cinematic is active
  if (laserCinematic.active && currentLevel && currentLevel.exit) {
    laserCinematic.timer += dt;
    var t = laserCinematic.timer / laserCinematic.duration;
    if (t > 1) t = 1;

    // Fade laser alpha from 1 -> 0
    currentLevel.laserAlpha = 1 - t;

    // Keep camera mode on intro and target at the exit during the fade
    if (typeof Renderer !== "undefined" && Renderer) {
      if (typeof Renderer.setCameraMode === "function") {
        Renderer.setCameraMode("intro");
      }
      if (typeof Renderer.setCameraTarget === "function" && currentLevel.exit) {
        var ex = currentLevel.exit;
        var cx = ex.x + ex.width / 2;
        var cy = ex.y + ex.height / 2;
        Renderer.setCameraTarget(cx, cy);
      }
    }

    if (t >= 1) {
      // End of cinematic: laser fully disabled, return camera to follow mode
      laserCinematic.active = false;
      currentLevel.laserEnabled = false;
      currentLevel.laserAlpha = 0;

      if (typeof Renderer !== "undefined" && Renderer && typeof Renderer.setCameraMode === "function") {
        Renderer.setCameraMode("follow");
      }
    }
  } else if (trapFocusCinematic.active) {
    // Generic trap-focus cinematic: pan to the last disabled trap group
    trapFocusCinematic.timer += dt;
    var tf = trapFocusCinematic.timer / trapFocusCinematic.duration;
    if (tf > 1) tf = 1;

    if (typeof Renderer !== "undefined" && Renderer) {
      if (typeof Renderer.setCameraMode === "function") {
        Renderer.setCameraMode("intro");
      }
      if (typeof Renderer.setCameraTarget === "function") {
        Renderer.setCameraTarget(trapFocusCinematic.targetX, trapFocusCinematic.targetY);
      }
    }

    if (tf >= 1) {
      trapFocusCinematic.active = false;

      // Return camera to follow mode only if no other cinematic is active
      if (!laserCinematic.active && typeof Renderer !== "undefined" && Renderer && typeof Renderer.setCameraMode === "function") {
        Renderer.setCameraMode("follow");
      }
    }
  }

  Renderer.clear();
  StateManager.render(gameContext, {
    level: currentLevel,
    player: player,
    guards: guards
  });

  // vẽ minimap vào canvas ở sidebar (nếu có)
  Renderer.renderMinimap(currentLevel, player, guards);

  UI.updateHud({
    alertLevel: Stealth.alertLevel,
    status: gameStatus,
    time: elapsedTime,
    decoyCurrent: Stealth.decoyCharges,
    decoyMax: Stealth.maxDecoyCharges
  });

  // Vẽ debug stealth (tia nhìn guard, panel nhỏ)
  if (typeof Stealth !== "undefined") {
    try {
      if (typeof Stealth.drawDebug === "function") {
        Stealth.drawDebug(gameContext, currentLevel);
      }
    } catch (e) {
    }
  }

  if (DEBUG_STEALTH && typeof Stealth !== "undefined") {
    var ctx = gameContext;
    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(8, 8, 170, 46);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    var alertVal = (typeof Stealth.alertLevel === "number")
      ? Stealth.alertLevel : 0;
    var detectVal = (typeof Stealth.detection === "number")
      ? Stealth.detection : 0;
    var detected = !!Stealth.isDetected;

    ctx.fillText("Alert: " + alertVal.toFixed(2), 12, 12);
    ctx.fillText("Detect: " + detectVal.toFixed(2), 12, 24);
    ctx.fillText("Detected: " + (detected ? "YES" : "no"), 12, 36);

    ctx.restore();
  }

  // Remember E key state for the next frame
  lastEPressed = !!keyState["KeyE"];

  window.requestAnimationFrame(gameLoop);
}

function startStage3Intro() {
  if (typeof StateManager !== "undefined" && StateManager && typeof StateManager.setState === "function") {
    StateManager.setState("intro");
  } else {
    StateManager.current = "intro";
  }

  var step = 0;

  function advanceIntro() {
    step++;

    if (step === 1) {
      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        UI.showDialog("stage3_goal", "tutorial_hint");
      }
    } else if (step === 2) {
      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        UI.showDialog("stage3_traps", "tutorial_hint");
      }
    } else {
      if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
        UI.hideDialog();
      }
      if (typeof StateManager !== "undefined" && StateManager && typeof StateManager.setState === "function") {
        StateManager.setState("game");
      } else {
        StateManager.current = "game";
      }
      window.removeEventListener("keydown", introKeyHandler);
    }
  }

  function introKeyHandler(e) {
    if (e.code !== "Space" && e.code !== "Enter") return;
    advanceIntro();
  }

  window.addEventListener("keydown", introKeyHandler);

  if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
    UI.showDialog("stage3_story", "tutorial_hint");
  }
}

window.addEventListener("load", function () {
  gameCanvas = document.getElementById("game-canvas");
  if (!gameCanvas) {
    console.error("game-canvas not found");
    return;
  }

  gameContext = gameCanvas.getContext("2d");

  Renderer.init(gameCanvas);

  // Tạo canvas minimap trong sidebar nếu có placeholder
  (function setupMinimapCanvas() {
    var holder = document.getElementById("minimap-placeholder");
    var miniCanvas = null;
    if (holder) {
      miniCanvas = document.createElement("canvas");
      miniCanvas.id = "minimap-canvas";
      miniCanvas.width = 200;
      miniCanvas.height = 200;
      holder.innerHTML = "";
      holder.appendChild(miniCanvas);
    }
    Renderer.setMinimapCanvas(miniCanvas);
  })();

  UI.init();
  AudioManager.init();
  setupAudioSliders();
  StateManager.init();
  if (window.Tutorial && typeof Tutorial.init === "function") {
    Tutorial.init();
  }

  resizeGame();

  var manifest = [
    { key: "floor",          src: "./assets/img/tile_floor.png" },
    { key: "floor_security", src: "./assets/img/tile_floor_security.png" },

    { key: "wall",           src: "./assets/img/tile_wall.png" },
    { key: "wall_security",  src: "./assets/img/tile_wall_security.png" },
    { key: "exit",       src: "./assets/img/exit_door.png" },
    { key: "player",     src: "./assets/img/player_sprite.png" },
    { key: "guard",      src: "./assets/img/guard_sprite.png" },

    { key: "console",    src: "./assets/img/console_terminal.png" },
    { key: "s2_console_main",     src: "./assets/img/s2_console_main.png" },
    { key: "s2_console_corridor", src: "./assets/img/s2_console_corridor.png" },
    { key: "s2_console_exit",     src: "./assets/img/s2_console_exit.png" },
    { key: "s2_camera_wall",      src: "./assets/img/s2_camera_wall.png" },
    { key: "lab_server", src: "./assets/img/lab_server.png" },
    { key: "lab_table",  src: "./assets/img/lab_table.png" },
    { key: "lab_tank",   src: "./assets/img/lab_tank.png" },

    // NEW: Stage 3 core tileset (48x48 sci-fi floors/walls)
    { key: "core_tileset", src: "./assets/img/tileset_core_48.png" },

    // NEW: Stage 3 atlas for machines / traps
    { key: "s3_tileset", src: "./assets/img/stage3_tileset.png" },
    { key: "s3_console_main",  src: "./assets/img/s3_console_main.png" },
    { key: "s3_console_clue",  src: "./assets/img/s3_console_clue.png" },
    { key: "s3_laser_switch",  src: "./assets/img/s3_laser_switch.png" }
  ];

  loadImages(manifest, function () {
    function startGame(showIntro) {
      showIntro = !!showIntro;
      restartLevel();

      if (typeof Renderer !== "undefined" && Renderer) {
        if (showIntro) {
          Renderer.setCameraMode("intro");
        } else {
          Renderer.setCameraMode("follow");
        }
      }

      function ensureStage2Bgm() {
        if (typeof AudioManager !== "undefined" && AudioManager && typeof AudioManager.playBgm === "function") {
          AudioManager.playBgm("bgm_stage2");
        }
      }
      // First attempt: right after level is ready
      ensureStage2Bgm();

      // Fallback: retry once on first user input (in case autoplay blocks)
      function onFirstUserInput() {
        ensureStage2Bgm();
        window.removeEventListener("keydown", onFirstUserInput);
        window.removeEventListener("mousedown", onFirstUserInput);
      }

      window.addEventListener("keydown", onFirstUserInput);
      window.addEventListener("mousedown", onFirstUserInput);

      if (showIntro) {
        if (typeof startStage3Intro === "function") {
          startStage3Intro();
        }
      } else {
        if (
          typeof StateManager !== "undefined" &&
          StateManager &&
          typeof StateManager.setState === "function"
        ) {
          StateManager.setState("game");
        } else {
          StateManager.current = "game";
        }
      }

      window.requestAnimationFrame(gameLoop);
    }

    // First time: play opening video, then restart level + intro
    if (!hasShownIntro) {
      hasShownIntro = true;
      playOpeningVideo(function () {
        startGame(true);
      });
    } else {
      // Later visits / retries: no opening and no intro, go straight to gameplay
      startGame(false);
    }
  });
});

window.addEventListener("resize", resizeGame);

// Trong gameplay, cho phép Space / Enter đóng dialog manh mối / cảnh báo
window.addEventListener("keydown", function (e) {
  if (e.code !== "Space" && e.code !== "Enter") return;

  // Nếu đang ở intro, để Tutorial xử lý Space/Enter (next step)
  if (
    typeof Tutorial !== "undefined" &&
    Tutorial &&
    typeof Tutorial.isActive === "function" &&
    Tutorial.isActive()
  ) {
    return;
  }

  if (gameStatus === "playing") {
    if (typeof UI !== "undefined" && UI && typeof UI.hideDialog === "function") {
      UI.hideDialog();
    }
  }
});
