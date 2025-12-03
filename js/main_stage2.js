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
      // Stage 1 clear flag (kept for backward compatibility)
      localStorage.setItem("stage1_cleared", "true");
      // NEW: Stage 2 clear flag, used to unlock Stage 3 in the hub
      localStorage.setItem("stage2_cleared", "true");
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
      // After Stage 2 is cleared, go to Stage 3
      window.location.href = "stage3.html";
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

  currentLevel = createStage2Level();
  if (currentLevel) {
    currentLevel.stageId = 2;
    currentLevel.useFog = false;
  }

  // Override player spawn to a safe spot in Zone A (away from cameras/guards)
  currentLevel.playerSpawn = {
    x: TILE_SIZE * 3 + TILE_SIZE / 2,   // around tile x=3
    y: TILE_SIZE * 17 + TILE_SIZE / 2   // around tile y=17, clear of pillars
  };

  player = new Player(
    currentLevel.playerSpawn.x,
    currentLevel.playerSpawn.y
  );

  // ===== Stage 2 meta flags =====
  // Mark this as Stage 2 and use circular guard vision instead of cone.
  currentLevel.stageId = 2;
  currentLevel.visionMode = "circle";
  currentLevel.securityMode = 0; // 0 = default, 1 = alternate

  // ===== Stage 2 security consoles + clues =====
  currentLevel.securityConsoles = [
    {
      id: "main",
      spriteKey: "s2_console_main",
      clueKey: "stage1_clue_fake_console",
      // Left control station – against the upper-left wall
      x: TILE_SIZE * 1,
      y: TILE_SIZE * 1,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      id: "corridor",
      spriteKey: "s2_console_corridor",
      clueKey: "stage1_clue_lore_logs",
      // Center routing console – near the central divider, lower down
      x: TILE_SIZE * 13,
      y: TILE_SIZE * 11,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      id: "exit",
      spriteKey: "s2_console_exit",
      clueKey: "stage1_clue_mutant_tank",
      // Exit-side console – against the right inner wall, away from the door
      x: TILE_SIZE * 28,
      y: TILE_SIZE * 14,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    }
  ];

  // ===== Stage 2 EXIT rect =====
  // Move EXIT closer to the right wall so the door appears to be mounted on the wall
  // but still visible inside the playable area.
  currentLevel.exit = {
    // EXIT slightly inset from the outer right wall, around mid–lower height
    x: TILE_SIZE * 39 - TILE_SIZE * 0.5,
    y: TILE_SIZE * 10,
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

  // Sync visible props to consoles
  currentLevel.securityProps = currentLevel.securityConsoles.map(function (c) {
    return {
      spriteKey: c.spriteKey,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height
    };
  });

  // ===== Stage 2 wall cameras =====
  // These are used both for rendering and for stealth detection.
  // They are mounted near the top walls and look downwards into the map.
  currentLevel.cameras = [
    {
      // Camera A – top wall, above center of Zone B, below HUD
      x: TILE_SIZE * 12,
      y: TILE_SIZE * 6,
      radius: TILE_SIZE * 5,
      dirX: 0,
      dirY: 1,
      fovAngle: Math.PI / 3
    },
    {
      // Camera B – central divider (looking left into corridor)
      x: TILE_SIZE * 24,
      y: TILE_SIZE * 7,
      radius: TILE_SIZE * 5,
      dirX: -1,
      dirY: 0,
      fovAngle: Math.PI / 3
    },
    {
      // Camera C – right-side wall watching the exit corridor
      x: TILE_SIZE * 39,
      y: TILE_SIZE * 10,
      radius: TILE_SIZE * 5,
      dirX: -1,
      dirY: 0,
      fovAngle: Math.PI / 3
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

  // ===== Stage 2 guards – Security floor =====
  //
  // Coordinate system:
  //   width  = 40 tiles, height = 22 tiles
  //   TILE_SIZE pixels per tile.
  //
  // Zones (roughly):
  //   Zone A: x ~ 1..11
  //   Zone B: x ~ 13..23
  //   Zone C: x ~ 25..38

  // Guard A – Zone A (left): horizontal patrol in front of the control area
  var gARoute = [
    { x: TILE_SIZE * 2,  y: TILE_SIZE * 8 },
    { x: TILE_SIZE * 2,  y: TILE_SIZE * 13 },
    { x: TILE_SIZE * 10, y: TILE_SIZE * 8 }
  ];
  guards.push(new Guard(gARoute[0].x, gARoute[0].y, gARoute));

  // Guard B – Zone B (center): vertical patrol in the main surveillance corridor
  var gBRoute = [
    { x: TILE_SIZE * 20, y: TILE_SIZE * 4 },
    { x: TILE_SIZE * 20, y: TILE_SIZE * 18 }
  ];
  guards.push(new Guard(gBRoute[0].x, gBRoute[0].y, gBRoute));

  // Guard C – Zone C (right): vertical patrol near the exit area
  var gCRoute = [
    { x: TILE_SIZE * 32, y: TILE_SIZE * 4 },
    { x: TILE_SIZE * 32, y: TILE_SIZE * 12 },
    { x: TILE_SIZE * 28, y: TILE_SIZE * 12 }
  ];
  guards.push(new Guard(gCRoute[0].x, gCRoute[0].y, gCRoute));
  // Guard D – Zone C (right): horizontal patrol near the exit door
  var gDRoute = [
    { x: TILE_SIZE * 14, y: TILE_SIZE *  16 },
    { x: TILE_SIZE *  24, y: TILE_SIZE *  16 },
    { x: TILE_SIZE *  14, y: TILE_SIZE *  16 }
  ];
  guards.push(new Guard(gDRoute[0].x, gDRoute[0].y, gDRoute));


  // No mutant guard in Stage 2

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
      // Player can disable the laser by pressing E near the side-room switch
      updateLaserSwitch(dt, justPressedE);
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
      if (typeof Renderer.setCameraTarget === "function") {
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
        Stealth.drawDebug(gameContext);
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

function startStage2Intro() {
  if (typeof StateManager !== "undefined" && StateManager && typeof StateManager.setState === "function") {
    StateManager.setState("intro");
  } else {
    StateManager.current = "intro";
  }

  var step = 0;

  function advanceIntro() {
    if (step === 0) {
      step = 1;
      if (typeof UI !== "undefined" && UI && typeof UI.showDialog === "function") {
        UI.showDialog("stage2_goal", "tutorial_hint");
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
    UI.showDialog("stage2_story", "tutorial_hint");
  }
}

window.addEventListener("load", function () {
  // Simple progression gate: Stage 2 requires Stage 1 cleared
  var stage1Cleared = false;
  try {
    stage1Cleared = localStorage.getItem("stage1_cleared") === "true";
  } catch (e) {}
  if (!stage1Cleared) {
    try {
      alert("Clear Stage 1 to unlock Stage 2.");
    } catch (e) {}
    window.location.href = "index.html";
    return;
  }

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
    { key: "lab_tank",   src: "./assets/img/lab_tank.png" }
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
        if (typeof startStage2Intro === "function") {
          startStage2Intro();
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
