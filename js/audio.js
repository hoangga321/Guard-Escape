// Audio manager cho Guard Escape
// Dùng HTMLAudioElement đơn giản, preload trước vài BGM + SFX cơ bản.

var AudioManager = (function () {
  var bgmEnabled = true;
  var sfxEnabled = true;

  var bgmVolume = 0.6;
  var sfxVolume = 0.9;

  function setBgmVolume(value) {
    bgmVolume = Math.max(0, Math.min(1, value || 0));
    Object.keys(bgmMap).forEach(function (key) {
      var a = bgmMap[key];
      if (a) a.volume = bgmVolume;
    });
  }

  function setSfxVolume(value) {
    sfxVolume = Math.max(0, Math.min(1, value || 0));
    Object.keys(sfxMap).forEach(function (key) {
      var a = sfxMap[key];
      if (a) a.volume = sfxVolume;
    });
  }

  function getBgmVolume() {
    return bgmVolume;
  }

  function getSfxVolume() {
    return sfxVolume;
  }

  var bgmMap = {};
  var sfxMap = {};
  var currentBgmName = null;
  // Chase loop state: use the existing "detected" SFX as a looping chase sound
  var chaseSfxName = "detected";
  var isChaseLoopActive = false;

  // Những SFX nên dùng một audio duy nhất (không clone) để có thể tắt ngay
  var NON_CLONE_SFX = {
    player_step: true,
    guard_step: true
  };

  function createAudio(src, loop, volume) {
    var a = new Audio();
    a.src = src;
    a.loop = !!loop;
    a.preload = "auto";
    a.volume = volume;
    return a;
  }

  function init() {
    // === ĐỔI PATH / TÊN FILE NẾU CẦN ===
    // BGM
    bgmMap["bgm_stage1"] = createAudio(
      "./assets/audio/bgm_stage1.mp3",
      true,
      bgmVolume
    );
    // Stage 2 BGM
    bgmMap["bgm_stage2"] = createAudio(
      "./assets/audio/bgm_stage2.mp3",
      true,
      bgmVolume
    );
    // Nếu có nhạc intro riêng thì bật thêm dòng này:
    // bgmMap["bgm_intro"] = createAudio("./assets/audio/bgm_intro.mp3", true, bgmVolume);

    // SFX
    sfxMap["hack_start"] = createAudio(
      "./assets/audio/sfx_hack_start.mp3",
      false,
      sfxVolume
    );
    sfxMap["player_step"] = createAudio(
      "./assets/audio/sfx_player_step.mp3",
      false,
      sfxVolume
    );
    sfxMap["guard_step"] = createAudio(
      "./assets/audio/sfx_guard_step.mp3",
      false,
      sfxVolume
    );
    if (sfxMap["guard_step"]) {
      sfxMap["guard_step"].volume = Math.min(1.0, sfxVolume * 1.1);
    }
    sfxMap["hack_complete"] = createAudio(
      "./assets/audio/sfx_hack_complete.mp3",
      false,
      sfxVolume
    );
    sfxMap["laser_off"] = createAudio(
      "./assets/audio/sfx_laser_off.mp3",
      false,
      sfxVolume
    );
    sfxMap["detected"] = createAudio(
      "./assets/audio/sfx_detected.mp3",
      false,
      sfxVolume
    );
    sfxMap["mission_clear"] = createAudio(
      "./assets/audio/sfx_mission_clear.mp3",
      false,
      sfxVolume
    );
    sfxMap["mission_fail"] = createAudio(
      "./assets/audio/sfx_mission_fail.mp3",
      false,
      sfxVolume
    );

    // === Mutant roar (thức dậy / phát hiện player) ===
    // Đảm bảo bạn có file: ./assets/audio/sfx_mutant_roar.mp3
    sfxMap["mutant_roar"] = createAudio(
      "./assets/audio/sfx_mutant_roar.mp3",
      false,
      sfxVolume
    );
  }

  function playBgm(name) {
    if (!bgmEnabled) return;

    if (currentBgmName === name) {
      var cur = bgmMap[name];
      if (cur && cur.paused) {
        var p0 = cur.play();
        if (p0 && p0.catch) p0.catch(function () {});
      }
      return;
    }

    // tắt BGM cũ
    if (currentBgmName) {
      var old = bgmMap[currentBgmName];
      if (old) {
        old.pause();
        old.currentTime = 0;
      }
    }

    var audio = bgmMap[name];
    if (!audio) {
      console.warn("[Audio] missing bgm:", name);
      currentBgmName = null;
      return;
    }

    currentBgmName = name;
    var p = audio.play();
    if (p && p.catch) {
      // tránh lỗi autoplay bị chặn
      p.catch(function () {
        console.warn("[Audio] BGM play blocked (autoplay policy)");
      });
    }
  }

  function stopBgm() {
    if (!currentBgmName) return;
    var audio = bgmMap[currentBgmName];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    currentBgmName = null;
  }

  function playSfx(name) {
    if (!sfxEnabled) return;

    var audio = sfxMap[name];
    if (!audio) {
      console.warn("[Audio] missing sfx:", name);
      return;
    }

    // Với SFX bước chân → không clone, để có thể stop ngay lập tức
    if (NON_CLONE_SFX[name]) {
      try {
        audio.pause();
        audio.currentTime = 0;
        var p0 = audio.play();
        if (p0 && p0.catch) p0.catch(function () {});
      } catch (e0) {
        // ignore
      }
      return;
    }

    // clone để có thể phát chồng nhiều lần (cho các SFX khác)
    try {
      var clone = audio.cloneNode();
      clone.volume = audio.volume;
      var p = clone.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {
      // fallback: dùng lại audio gốc
      try {
        audio.currentTime = 0;
        var p2 = audio.play();
        if (p2 && p2.catch) p2.catch(function () {});
      } catch (e2) {
        // ignore
      }
    }
  }

  function setBgmEnabled(flag) {
    bgmEnabled = !!flag;
    if (!bgmEnabled) {
      stopBgm();
    } else if (bgmEnabled && currentBgmName) {
      playBgm(currentBgmName);
    }
  }

  function setSfxEnabled(flag) {
    sfxEnabled = !!flag;
    if (!sfxEnabled) {
      // Ensure any chase loop stops when SFX are disabled
      try {
        stopChaseLoop();
      } catch (e) {}
    }
  }

  function stopSfx(name) {
    var audio = sfxMap[name];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      // ignore
    }
  }

  // Play the chase loop (uses the existing 'detected' SFX)
  function playChaseLoop() {
    if (!sfxEnabled) return;
    var audio = sfxMap[chaseSfxName];
    if (!audio) return;

    // If already active and still playing, do nothing
    if (isChaseLoopActive && !audio.paused) return;

    isChaseLoopActive = true;
    audio.loop = true;
    try {
      audio.currentTime = 0;
    } catch (e) {}
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function stopChaseLoop() {
    var audio = sfxMap[chaseSfxName];
    if (!audio) return;
    isChaseLoopActive = false;
    audio.loop = false;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  }

  return {
    init: init,
    playBgm: playBgm,
    stopBgm: stopBgm,
    playSfx: playSfx,
    stopSfx: stopSfx,
    setBgmEnabled: setBgmEnabled,
    setSfxEnabled: setSfxEnabled,
    setBgmVolume: setBgmVolume,
    setSfxVolume: setSfxVolume,
    getBgmVolume: getBgmVolume,
    getSfxVolume: getSfxVolume,
    playChaseLoop: playChaseLoop,
    stopChaseLoop: stopChaseLoop
  };
})();
