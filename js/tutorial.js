// Tutorial / Intro manager
// Flow intro Stage 1 (cutscene):
// Act 0: Fade from black + story (spotlight player, radius tăng dần)
// Act 1: Hướng dẫn move/run/hide (vòng sáng quanh player)
// Act 1b: Hướng dẫn dùng phím E để kiểm tra thiết bị
// Act 2: Giới thiệu phòng fake console
// Act 3: Giới thiệu phòng có log / camera (lore)
// Act 4: Giới thiệu phòng mutant (bẫy)
// Act 5: Giới thiệu console thật (objective)
// Act 6: Giới thiệu cửa exit
// Act 7: Giới thiệu guard
// Sau đó camera quay về player, fog gameplay, bật điều khiển

var Tutorial = (function () {
  var INTRO_FADE_DURATION = 2.0; // giây

  // Mỗi bước gồm: id, key (text), fogMode, focus()
  var introSteps = [
    {
      id: "fade_story",
      key: "stage1_story",
      fogMode: "playerFade",
      focus: function () {
        if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("playerFade");
          Renderer.setIntroFogProgress(0);
        }
      }
    },
    {
      id: "controls",
      key: "tutorial_move",
      fogMode: "player",
      focus: function () {
        if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("player");
          Renderer.setIntroFogProgress(1);
        }
      }
    },
    {
      // Bước mới: hướng dẫn phím E để kiểm tra máy móc / console
      id: "inspect",
      key: "tutorial_inspect",
      fogMode: "player",
      focus: function () {
        if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("player");
          Renderer.setIntroFogProgress(1);
        }
      }
    },
    {
      // Phòng có console giả / máy trạm phụ (lab_server - phòng trên bên trái)
      id: "room_fake",
      key: "stage1_room_fake",
      fogMode: "spotlight",
      focus: function () {
        // Tâm phòng: (4,4) kích thước 2x2 tile → (5,5)
        var cx = TILE_SIZE * 5;
        var cy = TILE_SIZE * 5;

        Renderer.setCameraMode("intro");
        Renderer.setCameraTarget(cx, cy);

        var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
        Renderer.setIntroSpotlight(cx, cy, spotRadius);
      }
    },
    {
      // Phòng chứa log / camera / lore (lab_table - phòng dưới bên trái)
      id: "room_lore",
      key: "stage1_room_lore",
      fogMode: "spotlight",
      focus: function () {
        // Tâm phòng: (4,14) kích thước 2x2 tile → (5,15)
        var cx = TILE_SIZE * 5;
        var cy = TILE_SIZE * 15;

        Renderer.setCameraMode("intro");
        Renderer.setCameraTarget(cx, cy);

        var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
        Renderer.setIntroSpotlight(cx, cy, spotRadius);
      }
    },
    {
      // Phòng mutant / thí nghiệm lỗi (lab_tank - phòng dưới bên phải)
      id: "room_mutant",
      key: "stage1_room_mutant",
      fogMode: "spotlight",
      focus: function () {
        // Tâm phòng: (18,14) kích thước 2x2 tile → (19,15)
        var cx = TILE_SIZE * 19;
        var cy = TILE_SIZE * 15;

        Renderer.setCameraMode("intro");
        Renderer.setCameraTarget(cx, cy);

        var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
        Renderer.setIntroSpotlight(cx, cy, spotRadius);
      }
    },
    {
      // Console thật (objective hack)
      id: "console",
      key: "tutorial_goal",
      fogMode: "spotlight",
      focus: function () {
        if (typeof currentLevel !== "undefined" && currentLevel && currentLevel.objective) {
          var oz = currentLevel.objective;
          var cx = oz.x + oz.width / 2;
          var cy = oz.y + oz.height / 2;

          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(cx, cy);

          var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
          Renderer.setIntroSpotlight(cx, cy, spotRadius);
        } else if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("player");
        }
      }
    },
    {
      // Cửa EXIT
      id: "exit",
      key: "tutorial_goal", // reuse text "hack & escape"
      fogMode: "spotlight",
      focus: function () {
        if (typeof currentLevel !== "undefined" && currentLevel && currentLevel.exit) {
          var ex = currentLevel.exit;
          var cx = ex.x + ex.width / 2;
          var cy = ex.y + ex.height / 2;

          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(cx, cy);

          var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
          Renderer.setIntroSpotlight(cx, cy, spotRadius);
        } else if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("player");
        }
      }
    },
    {
      // Guard đầu tiên
      id: "guard",
      key: "tutorial_actions",
      fogMode: "spotlight",
      focus: function () {
        if (typeof guards !== "undefined" && guards && guards.length > 0) {
          var g = guards[0];
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(g.x, g.y);

          var spotRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25;
          Renderer.setIntroSpotlight(g.x, g.y, spotRadius);
        } else if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode("player");
        }
      }
    }
  ];

  // Intro riêng cho Stage 2 (security floor)
  var introStepsStage2 = [
    {
      id: "s2_story",
      key: "stage2_story",
      fogMode: null,
      focus: function () {
        if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
          Renderer.setIntroFogMode(null);
          Renderer.setIntroFogProgress(1);
        }
      }
    },
    {
      id: "s2_corridor",
      key: "stage2_corridor_hint",
      fogMode: null,
      focus: function () {
        if (typeof currentLevel !== "undefined" && currentLevel) {
          var cx = (currentLevel.width * TILE_SIZE) * 0.5;
          var cy = (currentLevel.height * TILE_SIZE) * 0.5;
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(cx, cy);
          Renderer.setIntroFogMode(null);
          Renderer.setIntroFogProgress(1);
        } else if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
        }
      }
    },
    {
      id: "s2_goal",
      key: "stage2_goal",
      fogMode: null,
      focus: function () {
        if (typeof currentLevel !== "undefined" && currentLevel && currentLevel.exit) {
          var ex = currentLevel.exit;
          var cx = ex.x + ex.width / 2;
          var cy = ex.y + ex.height / 2;
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(cx, cy);
          Renderer.setIntroFogMode(null);
          Renderer.setIntroFogProgress(1);
        } else if (typeof player !== "undefined" && player) {
          Renderer.setCameraMode("intro");
          Renderer.setCameraTarget(player.x, player.y);
        }
      }
    }
  ];

  var introIndex = -1;
  var introActive = false;
  var fadeTimer = 0;
  var activeIntroSteps = introSteps;

  function getCurrentStep() {
    if (!introActive) return null;
    if (!activeIntroSteps || activeIntroSteps.length === 0) return null;
    if (introIndex < 0 || introIndex >= activeIntroSteps.length) return null;
    return activeIntroSteps[introIndex];
  }

  function showDialogForCurrentStep() {
    var step = getCurrentStep();
    if (!step) return;

    var bodyKey = step.key;
    var hintKey = "tutorial_hint";

    if (window.UI && typeof UI.showDialog === "function") {
      UI.showDialog(bodyKey, hintKey);
    }
  }

  function applyCameraForCurrentStep() {
    var step = getCurrentStep();
    if (!step) return;
    if (step.focus) step.focus();
  }

  function goToNextStep() {
    if (!introActive) return;

    introIndex++;
    fadeTimer = 0;

    if (!activeIntroSteps || introIndex >= activeIntroSteps.length) {
      endIntro();
      return;
    }

    applyCameraForCurrentStep();
    showDialogForCurrentStep();
  }

  function endIntro() {
    introActive = false;
    introIndex = -1;
    fadeTimer = 0;

    if (window.UI && typeof UI.hideDialog === "function") {
      UI.hideDialog();
    }

    if (typeof setInputEnabled === "function") {
      setInputEnabled(true);
    }

    if (typeof Renderer !== "undefined" && Renderer) {
      Renderer.setCameraMode("follow");
      Renderer.setIntroFogMode(null);
      Renderer.setIntroFogProgress(1);
    }

    if (typeof StateManager !== "undefined" && StateManager) {
      StateManager.setState("game");
    }
  }

  function startIntro() {
    if (introActive) return;

    activeIntroSteps = introSteps;
    introActive = true;
    introIndex = 0;
    fadeTimer = 0;

    if (typeof setInputEnabled === "function") {
      setInputEnabled(false);
    }

    if (typeof StateManager !== "undefined" && StateManager) {
      StateManager.setState("intro");
    }

    if (typeof Renderer !== "undefined" && Renderer) {
      Renderer.setCameraMode("intro");
      Renderer.setIntroFogMode("playerFade");
      Renderer.setIntroFogProgress(0);
    }

    applyCameraForCurrentStep();
    showDialogForCurrentStep();
  }

  function startStage2Intro() {
    if (introActive) return;

    activeIntroSteps = introStepsStage2;
    introActive = true;
    introIndex = 0;
    fadeTimer = 0;

    if (typeof setInputEnabled === "function") {
      setInputEnabled(false);
    }

    if (typeof StateManager !== "undefined" && StateManager) {
      StateManager.setState("intro");
    } else {
      StateManager.current = "intro";
    }

    if (typeof Renderer !== "undefined" && Renderer) {
      Renderer.setCameraMode("intro");
      Renderer.setIntroFogMode(null);
      Renderer.setIntroFogProgress(1);
    }

    applyCameraForCurrentStep();
    showDialogForCurrentStep();
  }

  function updateIntro(dt, context) {
    if (!introActive) return;

    var step = getCurrentStep();
    if (!step) return;

    if (step.id === "fade_story") {
      fadeTimer += dt;
      var p = fadeTimer / INTRO_FADE_DURATION;
      if (p > 1) p = 1;

      if (typeof Renderer !== "undefined" && Renderer) {
        Renderer.setIntroFogMode("playerFade");
        Renderer.setIntroFogProgress(p);
      }
    }
  }

  function onKeyDown(e) {
    if (!introActive) return;
    if (e.code === "Space" || e.key === " " || e.code === "Enter") {
      e.preventDefault();
      goToNextStep();
    }
  }

  function init() {
    window.addEventListener("keydown", onKeyDown);
  }

  function isActive() {
    return introActive;
  }

  return {
    init: init,
    startIntro: startIntro,
    startStage2Intro: startStage2Intro,
    isActive: isActive,
    updateIntro: updateIntro
  };
})();
