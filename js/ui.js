// UI & HUD for Guard Escape
// - HUD trên: title, alert bar, status, timer, nút chọn ngôn ngữ
// - Hộp thoại tutorial ở dưới màn hình
// - Popup Mission Clear / Failed

var UI = (function () {
  var hudRoot = null;

  // Top HUD
  var titleEl = null;
  var alertLabelEl = null;
  var alertBarFillEl = null;
  var statusEl = null;
  var timeEl = null;
  var decoyEl = null;
  var langLabelEl = null; // label "Ngôn ngữ" / "언어" / "Language"
  var langButtons = {};
  var lastHudModel = {
    alertLevel: 0,
    status: "playing",
    time: 0,
    decoyCurrent: null,
    decoyMax: null
  };

  // Hack progress bar
  var hackBarRoot = null;
  var hackBarFillEl = null;
  var hackBarLabelEl = null;

  // Bottom dialog
  var dialogRoot = null;
  var dialogBox = null;
  var dialogBodyEl = null;
  var dialogHintEl = null;
  var currentDialogBodyKey = null;
  var currentDialogHintKey = null;

  // Result overlay
  var resultOverlay = null;
  var resultTitleEl = null;
  var resultTimeEl = null;
  var resultRankEl = null;
  var resultDetailEl = null;
  var resultButtons = {
    retry: null,
    next: null,
    menu: null
  };
  var resultCallbacks = {
    onRetry: null,
    onNext: null,
    onMenu: null
  };

  // Pause overlay
  var pauseOverlay = null;
  var pauseTitleEl = null;
  var pauseButtons = {
    resume: null,
    retry: null,
    menu: null
  };
  var pauseCallbacks = {
    onResume: null,
    onRetry: null,
    onMenu: null
  };

  // ===== Helpers =====

  function getText(key, fallback) {
    if (window.I18N && typeof I18N.get === "function") {
      var v = I18N.get(key);
      if (v) return v;
    }
    return fallback || key;
  }

  function formatTime(seconds) {
    if (!seconds || seconds < 0) seconds = 0;
    // hiển thị với 1 chữ số thập phân
    return seconds.toFixed(1) + "s";
  }

  // ===== HUD =====

  function createHud() {
    var root = document.getElementById("game-root") || document.body;

    hudRoot = document.createElement("div");
    hudRoot.id = "hud-root";
    Object.assign(hudRoot.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#e5e7eb",
      fontSize: "14px"
    });

    // ===== Top bar =====
    var topBar = document.createElement("div");
    Object.assign(topBar.style, {
      position: "absolute",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "6px 12px",
      borderRadius: "999px",
      background: "rgba(15, 23, 42, 0.92)",
      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.85)",
      pointerEvents: "auto",
      border: "1px solid rgba(148, 163, 184, 0.6)"
    });

    // Title
    titleEl = document.createElement("span");
    Object.assign(titleEl.style, {
      fontWeight: "600",
      letterSpacing: "0.04em",
      fontSize: "14px",
      textTransform: "uppercase",
      color: "#e5e7eb"
    });
    topBar.appendChild(titleEl);

    // Alert block
    var alertBlock = document.createElement("div");
    Object.assign(alertBlock.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      minWidth: "160px"
    });

    alertLabelEl = document.createElement("span");
    Object.assign(alertLabelEl.style, {
      fontSize: "12px",
      opacity: 0.9
    });
    alertBlock.appendChild(alertLabelEl);

    var alertBar = document.createElement("div");
    alertBar.id = "alert-bar";
    Object.assign(alertBar.style, {
      flexGrow: 1,
      height: "12px",
      borderRadius: "999px",
      overflow: "hidden",
      border: "1px solid rgba(148, 163, 184, 0.7)",
      background: "#020617"
    });

    alertBarFillEl = document.createElement("div");
    alertBarFillEl.id = "alert-bar-fill";
    Object.assign(alertBarFillEl.style, {
      width: "0%",
      height: "100%",
      borderRadius: "999px",
      background:
        "linear-gradient(to right, #22c55e, #eab308, #ef4444)",
      transition: "width 0.1s linear"
    });

    alertBar.appendChild(alertBarFillEl);
    alertBlock.appendChild(alertBar);
    topBar.appendChild(alertBlock);

    // Status
    statusEl = document.createElement("span");
    Object.assign(statusEl.style, {
      fontSize: "12px",
      minWidth: "120px",
      textAlign: "center",
      padding: "2px 8px",
      borderRadius: "999px",
      border: "1px solid rgba(148, 163, 184, 0.6)",
      background: "rgba(15,23,42,0.9)"
    });
    topBar.appendChild(statusEl);

    // Timer
    timeEl = document.createElement("span");
    Object.assign(timeEl.style, {
      fontSize: "12px",
      minWidth: "80px",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums"
    });
    topBar.appendChild(timeEl);

    // Decoy counter
    decoyEl = document.createElement("span");
    Object.assign(decoyEl.style, {
      fontSize: "12px",
      minWidth: "90px",
      textAlign: "left",
      opacity: 0.9
    });
    decoyEl.textContent = "";
    topBar.appendChild(decoyEl);

    // Language chooser
    var langBlock = document.createElement("div");
    Object.assign(langBlock.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      marginLeft: "8px"
    });

    langLabelEl = document.createElement("span");
    Object.assign(langLabelEl.style, {
      fontSize: "11px",
      opacity: 0.85
    });
    langLabelEl.textContent = getText("hud_lang_label", "Lang");
    langBlock.appendChild(langLabelEl);

    ["vi", "ko", "en"].forEach(function (code) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = code.toUpperCase();
      Object.assign(btn.style, {
        border: "none",
        padding: "2px 6px",
        borderRadius: "999px",
        fontSize: "11px",
        cursor: "pointer",
        background: "rgba(30,64,175,0.6)",
        color: "#e5e7eb",
        border: "1px solid rgba(129,140,248,0.7)"
      });
      btn.addEventListener("click", function () {
        if (window.I18N && typeof I18N.setLanguage === "function") {
          I18N.setLanguage(code);
        }
      });
      langButtons[code] = btn;
      langBlock.appendChild(btn);
    });

    topBar.appendChild(langBlock);
    hudRoot.appendChild(topBar);

    // ===== Hack progress bar (dưới top bar) =====
    hackBarRoot = document.createElement("div");
    Object.assign(hackBarRoot.style, {
      position: "absolute",
      top: "56px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "none",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "999px",
      background: "rgba(15,23,42,0.9)",
      border: "1px solid rgba(56,189,248,0.7)",
      boxShadow: "0 10px 25px rgba(15,23,42,0.7)",
      pointerEvents: "none"
    });

    // Small icon on the hack bar
    var hackIcon = document.createElement("div");
    Object.assign(hackIcon.style, {
      width: "16px",
      height: "16px",
      borderRadius: "6px",
      border: "1px solid rgba(56,189,248,0.9)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      color: "#e5f8ff",
      background: "rgba(15,23,42,0.9)"
    });
    // Simple symbol that does not depend on language
    hackIcon.textContent = "◆";
    hackBarRoot.appendChild(hackIcon);
    hackBarLabelEl = document.createElement("span");
    Object.assign(hackBarLabelEl.style, {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      opacity: 0.95
    });
    hackBarLabelEl.textContent = getText("hud_hacking", "HACKING");
    hackBarRoot.appendChild(hackBarLabelEl);

    var hackBar = document.createElement("div");
    Object.assign(hackBar.style, {
      width: "140px",
      height: "10px",
      borderRadius: "999px",
      overflow: "hidden",
      border: "1px solid rgba(56,189,248,0.9)",
      background: "#020617"
    });

    hackBarFillEl = document.createElement("div");
    Object.assign(hackBarFillEl.style, {
      width: "0%",
      height: "100%",
      borderRadius: "999px",
      background: "linear-gradient(to right,#22c55e,#eab308,#ef4444)",
      transition: "width 0.1s linear"
    });

    hackBar.appendChild(hackBarFillEl);
    hackBarRoot.appendChild(hackBar);
    hudRoot.appendChild(hackBarRoot);

    // ===== Dialog root (tutorial) =====
    dialogRoot = document.createElement("div");
    Object.assign(dialogRoot.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      pointerEvents: "none"
    });

    dialogBox = document.createElement("div");
    Object.assign(dialogBox.style, {
      maxWidth: "960px",
      width: "80%",
      marginBottom: "28px",
      padding: "12px 16px",
      borderRadius: "16px",
      background:
        "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92))",
      boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
      border: "1px solid rgba(148,163,184,0.9)",
      display: "none",
      flexDirection: "column",
      gap: "6px",
      pointerEvents: "auto"
    });

    dialogBodyEl = document.createElement("div");
    Object.assign(dialogBodyEl.style, {
      fontSize: "14px",
      lineHeight: 1.5
    });
    dialogBox.appendChild(dialogBodyEl);

    dialogHintEl = document.createElement("div");
    Object.assign(dialogHintEl.style, {
      fontSize: "12px",
      opacity: 0.85
    });
    dialogBox.appendChild(dialogHintEl);

    dialogRoot.appendChild(dialogBox);
    hudRoot.appendChild(dialogRoot);

    // ===== Result overlay (ẩn mặc định) =====
    createResultOverlay();
    createPauseOverlay();

    root.appendChild(hudRoot);
  }

  function createResultOverlay() {
    resultOverlay = document.createElement("div");
    Object.assign(resultOverlay.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(15,23,42,0.85)",
      backdropFilter: "blur(6px)",
      pointerEvents: "auto",
      zIndex: 50
    });

    var panel = document.createElement("div");
    Object.assign(panel.style, {
      minWidth: "320px",
      maxWidth: "420px",
      padding: "18px 20px",
      borderRadius: "18px",
      background:
        "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(17,24,39,0.98))",
      border: "1px solid rgba(148,163,184,0.9)",
      boxShadow: "0 24px 70px rgba(15,23,42,0.95)",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    });

    resultTitleEl = document.createElement("div");
    Object.assign(resultTitleEl.style, {
      fontSize: "18px",
      fontWeight: "600",
      letterSpacing: "0.04em",
      textTransform: "uppercase"
    });
    panel.appendChild(resultTitleEl);

    resultDetailEl = document.createElement("div");
    Object.assign(resultDetailEl.style, {
      fontSize: "13px",
      opacity: 0.9
    });
    panel.appendChild(resultDetailEl);

    var row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "13px",
      marginTop: "6px"
    });

    resultTimeEl = document.createElement("span");
    resultRankEl = document.createElement("span");
    row.appendChild(resultTimeEl);
    row.appendChild(resultRankEl);
    panel.appendChild(row);

    var btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "12px"
    });

    function makeButton(label, callbackKey, bg) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      Object.assign(btn.style, {
        padding: "6px 12px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        fontSize: "13px",
        background: bg,
        color: "#e5e7eb"
      });
      btn.addEventListener("click", function () {
        if (resultCallbacks[callbackKey]) {
          resultCallbacks[callbackKey]();
        }
      });

      if (callbackKey === "onRetry") {
        resultButtons.retry = btn;
      } else if (callbackKey === "onNext") {
        resultButtons.next = btn;
      } else if (callbackKey === "onMenu") {
        resultButtons.menu = btn;
      }

      btnRow.appendChild(btn);
    }

    makeButton("Menu", "onMenu", "rgba(30,64,175,0.8)");
    makeButton("Retry", "onRetry", "rgba(220,38,38,0.9)");
    makeButton("Next", "onNext", "rgba(22,163,74,0.95)");

    panel.appendChild(btnRow);
    resultOverlay.appendChild(panel);
    hudRoot && hudRoot.appendChild(resultOverlay);
  }

  function createPauseOverlay() {
    pauseOverlay = document.createElement("div");
    Object.assign(pauseOverlay.style, {
      position: "absolute",
      left: "0",
      top: "0",
      right: "0",
      bottom: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(4px)",
      zIndex: "20"
    });

    var panel = document.createElement("div");
    Object.assign(panel.style, {
      minWidth: "260px",
      padding: "16px",
      borderRadius: "12px",
      background: "rgba(15, 23, 42, 0.95)",
      boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
      border: "1px solid rgba(148,163,184,0.4)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      color: "#e5e7eb",
      fontSize: "14px"
    });

    pauseTitleEl = document.createElement("div");
    pauseTitleEl.style.fontSize = "18px";
    pauseTitleEl.style.fontWeight = "600";
    pauseTitleEl.style.marginBottom = "4px";
    pauseTitleEl.textContent = getText("pause_title", "Paused");
    panel.appendChild(pauseTitleEl);

    var btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      gap: "8px",
      marginTop: "8px",
      justifyContent: "flex-end"
    });

    function makePauseButton(key, fallback) {
      var btn = document.createElement("button");
      btn.textContent = getText(key, fallback);
      Object.assign(btn.style, {
        padding: "6px 10px",
        borderRadius: "999px",
        border: "1px solid rgba(148,163,184,0.5)",
        background: "rgba(15,23,42,0.9)",
        color: "#e5e7eb",
        fontSize: "12px",
        cursor: "pointer"
      });
      btn.onmouseenter = function () {
        btn.style.background = "rgba(30,64,175,0.9)";
      };
      btn.onmouseleave = function () {
        btn.style.background = "rgba(15,23,42,0.9)";
      };
      return btn;
    }

    pauseButtons.resume = makePauseButton("pause_resume", "Resume");
    pauseButtons.retry = makePauseButton("pause_retry", "Retry");
    pauseButtons.menu = makePauseButton("pause_menu", "Menu");

    pauseButtons.resume.onclick = function () {
      if (pauseCallbacks.onResume) pauseCallbacks.onResume();
    };
    pauseButtons.retry.onclick = function () {
      if (pauseCallbacks.onRetry) pauseCallbacks.onRetry();
    };
    pauseButtons.menu.onclick = function () {
      if (pauseCallbacks.onMenu) pauseCallbacks.onMenu();
    };

    btnRow.appendChild(pauseButtons.menu);
    btnRow.appendChild(pauseButtons.retry);
    btnRow.appendChild(pauseButtons.resume);

    panel.appendChild(btnRow);
    pauseOverlay.appendChild(panel);
    hudRoot.appendChild(pauseOverlay);
  }

  // ===== Public functions =====

  function init() {
    createHud();
    refresh();
  }

  function updateHud(model) {
    if (!model) model = {};
    lastHudModel = {
      alertLevel:
        typeof model.alertLevel === "number"
          ? model.alertLevel
          : lastHudModel.alertLevel,
      status: model.status || lastHudModel.status,
      time:
        typeof model.time === "number" ? model.time : lastHudModel.time,
      decoyCurrent:
        typeof model.decoyCurrent === "number"
          ? model.decoyCurrent
          : lastHudModel.decoyCurrent,
      decoyMax:
        typeof model.decoyMax === "number"
          ? model.decoyMax
          : lastHudModel.decoyMax
    };

    var alertLevel = lastHudModel.alertLevel;
    if (alertLevel < 0) alertLevel = 0;
    if (alertLevel > 1) alertLevel = 1;
    if (alertBarFillEl) {
      alertBarFillEl.style.width = (alertLevel * 100).toFixed(0) + "%";
    }

    var statusKey = "hud_status_playing";
    if (lastHudModel.status === "fail") {
      statusKey = "hud_status_fail";
    } else if (lastHudModel.status === "clear") {
      statusKey = "hud_status_clear";
    }
    if (statusEl) {
      statusEl.textContent = getText(statusKey, lastHudModel.status || "");
    }

    if (timeEl) {
      timeEl.textContent = "Time: " + formatTime(lastHudModel.time);
    }

    if (decoyEl) {
      if (
        typeof lastHudModel.decoyCurrent === "number" &&
        typeof lastHudModel.decoyMax === "number"
      ) {
        decoyEl.textContent =
          getText("hud_decoy", "Decoy") +
          ": " +
          lastHudModel.decoyCurrent +
          "/" +
          lastHudModel.decoyMax;
      } else {
        decoyEl.textContent = "";
      }
    }
  }

  function refresh() {
    if (!hudRoot) return;
    if (titleEl) {
      titleEl.textContent = getText("title", "Guard Escape");
    }
    if (alertLabelEl) {
      alertLabelEl.textContent = getText("hud_alert", "Alert");
    }
    if (hackBarLabelEl) {
      hackBarLabelEl.textContent = getText("hud_hacking", "HACKING");
    }
    if (langLabelEl) {
      langLabelEl.textContent = getText("hud_lang_label", "Lang");
    }

    // cập nhật HUD (alert bar, status, time)
    updateHud(lastHudModel);

    // 🔄 Nếu đang hiển thị hộp thoại (intro / tutorial) thì cập nhật lại text
    if (
      dialogBox &&
      dialogBox.style.display !== "none" &&
      currentDialogBodyKey
    ) {
      dialogBodyEl.textContent = getText(
        currentDialogBodyKey,
        currentDialogBodyKey
      );

      if (currentDialogHintKey) {
        dialogHintEl.textContent = getText(currentDialogHintKey, "");
        dialogHintEl.style.display = "";
      } else {
        dialogHintEl.style.display = "none";
      }
    }
  }

  function showDialog(bodyKey, hintKey) {
    currentDialogBodyKey = bodyKey;
    currentDialogHintKey = hintKey || null;
    if (!dialogBox) return;

    dialogBox.style.display = "flex";
    dialogBodyEl.textContent = getText(bodyKey, bodyKey);
    if (hintKey) {
      dialogHintEl.textContent = getText(hintKey, "");
      dialogHintEl.style.display = "";
    } else {
      dialogHintEl.style.display = "none";
    }
  }

  function hideDialog() {
    currentDialogBodyKey = null;
    currentDialogHintKey = null;
    if (dialogBox) {
      dialogBox.style.display = "none";
    }
  }

  function showResult(resultModel) {
    if (!resultOverlay) return;
    resultModel = resultModel || {};

    var isClear = resultModel.status === "clear";
    var failReason = resultModel.failReason || "guard";

    resultTitleEl.textContent = isClear
      ? getText("hud_status_clear", "MISSION CLEAR")
      : getText("hud_status_fail", "MISSION FAILED");

    if (isClear) {
      resultDetailEl.textContent = getText(
        "stage1_clear_guard_escape",
        "You escaped the facility without being captured."
      );
    } else {
      // Phân biệt guard vs laser
      if (failReason === "laser") {
        // Dùng text đa ngôn ngữ stage1_laser_dead cho trường hợp laser
        resultDetailEl.textContent = getText(
          "stage1_laser_dead",
          "You triggered the laser barrier at the EXIT. Find the auxiliary console and disable it first."
        );
      } else {
        // Mặc định: bị guard phát hiện
        resultDetailEl.textContent = getText(
          "stage1_fail_guard",
          "You were spotted by the guards."
        );
      }
    }

    resultTimeEl.textContent = "Time: " + formatTime(resultModel.time || 0);
    resultRankEl.textContent = "Rank: " + (resultModel.rank || "C");

    resultCallbacks.onRetry = resultModel.onRetry || null;
    resultCallbacks.onNext  = resultModel.onNext  || null;
    resultCallbacks.onMenu  = resultModel.onMenu  || null;

    if (resultButtons.next) {
      resultButtons.next.style.display =
        resultModel.status === "clear" ? "" : "none";
    }

    resultOverlay.style.display = "flex";
  }

  function hideResult() {
    if (resultOverlay) {
      resultOverlay.style.display = "none";
    }
  }

  function showPause(model) {
    if (!pauseOverlay) return;
    model = model || {};
    pauseCallbacks.onResume = model.onResume || null;
    pauseCallbacks.onRetry = model.onRetry || null;
    pauseCallbacks.onMenu = model.onMenu || null;
    pauseTitleEl.textContent = getText("pause_title", "Paused");
    pauseOverlay.style.display = "flex";
  }

  function hidePause() {
    if (!pauseOverlay) return;
    pauseOverlay.style.display = "none";
    pauseCallbacks.onResume = null;
    pauseCallbacks.onRetry = null;
    pauseCallbacks.onMenu = null;
  }

  // 🔹 Thanh tiến độ hack
  function updateHackProgress(progress, visible) {
    if (!hackBarRoot || !hackBarFillEl) return;

    if (!visible) {
      hackBarRoot.style.display = "none";
      hackBarFillEl.style.width = "0%";
      return;
    }

    var p = progress;
    if (p < 0) p = 0;
    if (p > 1) p = 1;

    hackBarRoot.style.display = "flex";
    hackBarFillEl.style.width = (p * 100).toFixed(0) + "%";
  }

  return {
    init: init,
    updateHud: updateHud,
    refresh: refresh,
    showDialog: showDialog,
    hideDialog: hideDialog,
    showResult: showResult,
    hideResult: hideResult,
    updateHackProgress: updateHackProgress,
    showPause: showPause,
    hidePause: hidePause
  };
})();
