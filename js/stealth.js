// Stealth system: vision cone, line-of-sight, alert + detection + decoy noise

var Stealth = {
  alertLevel: 0,

  // cấu hình tầm nhìn
  FOV_ANGLE: (70 * Math.PI) / 180, // 70 độ
  VIEW_DISTANCE: TILE_SIZE * 8,    // tầm nhìn ~ 8 ô
  CAMERA_FOV_ANGLE: Math.PI / 3,    // 60 độ mặc định cho camera

  // thanh "bị phát hiện" (0..1)
  detection: 0,
  isDetected: false,

  // Decoy / noise
  decoys: [],
  // Decoy charges (limit number of decoys per run)
  maxDecoyCharges: 5,
  decoyCharges: 5,
  // whether any guard is actively chasing (has line of sight)
  isChasing: false,

  // Debug
  debug: false,     // bật = true để vẽ debug line guard -> player
  debugRays: []     // lưu dữ liệu debug cho mỗi guard
};

Stealth.reset = function () {
  this.alertLevel = 0;
  this.detection = 0;
  this.isDetected = false;
  this.decoys = [];
  this.debugRays = [];
  // reset decoy charges on level restart
  this.decoyCharges = this.maxDecoyCharges;
  // reset chasing flag
  this.isChasing = false;
};

// ===== Alert level helpers =====

Stealth.raiseAlert = function (amount) {
  this.alertLevel += amount;
  if (this.alertLevel > 1) this.alertLevel = 1;
};

Stealth.decayAlert = function (dt) {
  this.alertLevel -= ALERT_LEVEL_DECAY * dt;
  if (this.alertLevel < 0) this.alertLevel = 0;
};

// ===== Decoy / Noise =====

// tạo 1 decoy tại x,y
Stealth.spawnDecoy = function (x, y) {
  if (typeof this.decoyCharges === 'number' && this.decoyCharges <= 0) {
    console.log("[Stealth] no decoy charges left");
    return;
  }

  var decoy = {
    x: x,
    y: y,
    radius: TILE_SIZE * 6, // tầm tiếng động
    life: 3                // tồn tại 3 giây
  };
  this.decoys.push(decoy);
  // consume a charge if available
  if (typeof this.decoyCharges === 'number') this.decoyCharges -= 1;
  console.log("[Stealth] spawn decoy at", x, y);
};

Stealth.updateDecoys = function (guards, dt) {
  if (!this.decoys.length || !guards || !guards.length) return;

  for (var i = this.decoys.length - 1; i >= 0; i--) {
    var d = this.decoys[i];
    d.life -= dt;

    if (d.life <= 0) {
      this.decoys.splice(i, 1);
      continue;
    }

    // mọi guard trong bán kính decoy → INVESTIGATE
    for (var g = 0; g < guards.length; g++) {
      var guard = guards[g];
      var dx = guard.x - d.x;
      var dy = guard.y - d.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= d.radius) {
        guard.hearNoise(d.x, d.y);
      }
    }
  }
};

// ===== Vision / LOS / Detection =====

Stealth.isInVisionCone = function (guard, player) {
  var dx = player.x - guard.x;
  var dy = player.y - guard.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > this.VIEW_DISTANCE) return false;

  // guard.dirX, dirY đã là vector đơn vị (set trong guard.update)
  var dot = dx * guard.dirX + dy * guard.dirY;
  if (dot <= 0) return false; // player ở phía sau guard

  var cosAngle = dot / dist;  // vì |dir| ~ 1
  var halfFov = this.FOV_ANGLE / 2;
  var cosHalfFov = Math.cos(halfFov);

  return cosAngle >= cosHalfFov;
};

Stealth.hasLineOfSight = function (guard, player, level) {
  var steps = 20;
  var sx = guard.x;
  var sy = guard.y;
  var ex = player.x;
  var ey = player.y;

  var dx = (ex - sx) / steps;
  var dy = (ey - sy) / steps;

  for (var i = 1; i <= steps; i++) {
    var cx = sx + dx * i;
    var cy = sy + dy * i;
    if (level.isBlocked(cx, cy)) {
      return false;
    }
  }
  return true;
};

Stealth.cameraCanSeePlayer = function (cam, player, level) {
  if (!cam || !player) return false;

  var radius = cam.radius || this.VIEW_DISTANCE;
  var dx = player.x - cam.x;
  var dy = player.y - cam.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > radius) return false;

  var dirX = cam.dirX || 0;
  var dirY = cam.dirY || 1; // mặc định nhìn xuống

  // player ở phía sau camera
  var dot = dx * dirX + dy * dirY;
  if (dot <= 0) return false;

  var cosAngle = dot / dist;
  var desiredFov = (cam.fovAngle || this.CAMERA_FOV_ANGLE || (Math.PI / 3));
  if (level && level.stageId === 2 && desiredFov < Math.PI) {
    desiredFov = Math.PI; // Stage 2: rộng ~ nửa vòng tròn
  }
  var halfFov = desiredFov / 2;
  var cosHalfFov = Math.cos(halfFov);
  if (cosAngle < cosHalfFov) return false;

  // Reuse the LOS routine with a fake "guard" object that just has x,y.
  if (!this.hasLineOfSight({ x: cam.x, y: cam.y }, player, level)) {
    return false;
  }

  return true;
};

Stealth.guardCanSeePlayer = function (guard, player, level) {
  if (!guard || !player) return false;

  // Stage 2: optional circular FOV instead of a cone.
  if (level && level.visionMode === "circle") {
    var dx = player.x - guard.x;
    var dy = player.y - guard.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    var baseRadius = this.VIEW_DISTANCE;
    // Stage 2: use a smaller circular FOV (~60% of the normal cone distance)
    var radius = baseRadius * 0.6;

    if (dist > radius) return false;
    if (!this.hasLineOfSight(guard, player, level)) return false;

    return true;
  }

  // Default: cone-based vision (Stage 1)
  if (!this.isInVisionCone(guard, player)) return false;
  if (!this.hasLineOfSight(guard, player, level)) return false;
  return true;
};

// guards: mảng guard
// player: player object
// level : currentLevel
// dt    : delta time (seconds)
Stealth.update = function (guards, player, level, dt) {
  // cập nhật decoy + cho guard nghe tiếng
  this.updateDecoys(guards, dt);

  var visible = false;
  this.debugRays = [];

  if (guards && player && level) {
    var chasing = false;
    for (var i = 0; i < guards.length; i++) {
      var g = guards[i];
      var canSee = this.guardCanSeePlayer(g, player, level);

      // debug line guard -> player
      if (this.debug) {
        this.debugRays.push({
          gx: g.x,
          gy: g.y,
          px: player.x,
          py: player.y,
          canSee: canSee
        });
      }

      if (canSee) {
        chasing = true;
        visible = true;

        // Gọi onSpotPlayer để guard chuyển sang CHASE
        if (typeof g.onSpotPlayer === "function") {
          g.onSpotPlayer();
        }
      }
    }
    // Security cameras (Stage 2): they can also see the player.
    if (level.cameras && level.cameras.length) {
      for (var c = 0; c < level.cameras.length; c++) {
        var cam = level.cameras[c];
        if (!cam) continue;
        if (cam.active === false) continue;
        var camSee = this.cameraCanSeePlayer(cam, player, level);

        if (typeof cam.playerWasInVision !== "boolean") {
          cam.playerWasInVision = false;
        }

        if (this.debug) {
          this.debugRays.push({
            gx: cam.x,
            gy: cam.y,
            px: player.x,
            py: player.y,
            canSee: camSee
          });
        }

        if (camSee) {
          if (!cam.playerWasInVision) {
            if (
              typeof AudioManager !== "undefined" &&
              AudioManager &&
              typeof AudioManager.playSfx === "function"
            ) {
              AudioManager.playSfx("detected");
            }
          }
          cam.playerWasInVision = true;
          visible = true;
        } else {
          cam.playerWasInVision = false;
        }
      }
    }

    // Stage 3 turrets also contribute to visibility / alert.
    if (level.securityProps && level.securityProps.length) {
      for (var t = 0; t < level.securityProps.length; t++) {
        var tp = level.securityProps[t];
        if (!tp || tp.trapType !== "turret") continue;
        if (tp.active === false) continue;

        var tx = tp.x + tp.width * 0.5;
        var ty = tp.y + tp.height * 0.5;
        var radius =
          (typeof tp.visionRadius === "number" && tp.visionRadius > 0)
            ? tp.visionRadius
            : (typeof tp.detectionRadius === "number" && tp.detectionRadius > 0)
              ? tp.detectionRadius
              : (TILE_SIZE * 6);
        var dxTurret = player.x - tx;
        var dyTurret = player.y - ty;
        var distSqTurret = dxTurret * dxTurret + dyTurret * dyTurret;
        if (distSqTurret > radius * radius) continue;

        var hasLos = true;
        if (typeof this.hasLineOfSight === "function") {
          hasLos = this.hasLineOfSight({ x: tx, y: ty }, player, level);
        }
        if (hasLos) {
          visible = true;
        }
      }
    }

    // Update public chasing flag so other systems can observe chase state
    this.isChasing = chasing;
  }

  if (visible) {
    // tăng alert + detection nhanh hơn khi bị nhìn thấy
    this.raiseAlert(ALERT_LEVEL_INCREASE * dt * 2);

    this.detection += 0.7 * dt;
    if (this.detection >= 1) {
      this.detection = 1;
      this.isDetected = true;
    }
  } else {
    // không guard nào thấy player → alert giảm dần
    this.decayAlert(dt);

    this.detection -= 0.3 * dt;
    if (this.detection < 0) this.detection = 0;
  }
};

// Vẽ debug line guard -> player (gọi sau khi vẽ scene)
Stealth.drawDebug = function (ctx, level) {
  if (!this.debug || !ctx) return;
  var cam = (typeof Renderer !== "undefined" && Renderer.camera) ? Renderer.camera : { x: 0, y: 0 };

  ctx.save();
  ctx.lineWidth = 1;

  for (var i = 0; i < this.debugRays.length; i++) {
    var r = this.debugRays[i];
    var gx = r.gx;
    var gy = r.gy;
    var px = r.px;
    var py = r.py;

    if (
      level &&
      level.theme === "core" &&
      typeof Renderer !== "undefined" &&
      Renderer.canvas
    ) {
      var tileSize = (typeof level.tileSize === "number") ? level.tileSize : TILE_SIZE;
      var worldWidth = level.width * tileSize;
      var worldHeight = level.height * tileSize;
      var cameraX = cam.x - Renderer.canvas.width / 2;
      var cameraY = cam.y - Renderer.canvas.height / 2;
      cameraX = Math.max(0, Math.min(cameraX, worldWidth - Renderer.canvas.width));
      cameraY = Math.max(0, Math.min(cameraY, worldHeight - Renderer.canvas.height));

      gx = r.gx - cameraX;
      gy = r.gy - cameraY;
      px = r.px - cameraX;
      py = r.py - cameraY;
    } else if (
      typeof GAME_WIDTH !== "undefined" &&
      typeof GAME_HEIGHT !== "undefined"
    ) {
      gx = r.gx - cam.x + GAME_WIDTH / 2;
      gy = r.gy - cam.y + GAME_HEIGHT / 2;
      px = r.px - cam.x + GAME_WIDTH / 2;
      py = r.py - cam.y + GAME_HEIGHT / 2;
    }

    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = r.canSee
      ? "rgba(34,197,94,0.9)"   // xanh: thật sự thấy player
      : "rgba(239,68,68,0.9)"; // đỏ: không thấy
    ctx.stroke();
  }

  ctx.restore();
};
