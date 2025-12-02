// guard.js
// Guard entity (patrol + investigate + chase + animated sprite from guard_sprite.png)
//
//
// guard_sprite.png: 1326x304, 1 row, 7 frames horizontally.
// We treat:
//   frame 0 : IDLE pose
//   frame 0..5 : WALK cycle
//   frame 6 (with muzzle flash) is ignored for now.

var DEBUG_GUARD = true; // bật debug overlay cho guard

// ===== Sprite constants =====
var GUARD_SPRITE_FRAME_W = 189;
var GUARD_SPRITE_FRAME_H = 304;

// ===== Speed & behavior tuning =====
var GUARD_PATROL_SPEED = 55;   // đi tuần
var GUARD_CHASE_SPEED  = 90;   // đuổi bắt (vẫn chậm hơn player chạy)

// --- Tham số riêng cho "mutant guard" (thí nghiệm thất bại) ---
var MUTANT_PATROL_SPEED = 0;    // mặc định không tuần tra
var MUTANT_CHASE_SPEED  = 110;  // đuổi nhanh hơn guard thường một chút

// guard sẽ tiếp tục chase thêm chừng này giây
// sau khi vừa nhìn thấy player (dù mất sight tạm thời)
var GUARD_CHASE_MEMORY = 1.0; // giây

// ===== Animation constants =====
var GUARD_IDLE_FRAMES = 1;
var GUARD_WALK_FRAMES = 6;

var GUARD_IDLE_FRAME_TIME = 0.4;
var GUARD_WALK_FRAME_TIME = 0.14;

function Guard(x, y, waypoints) {
  this.x = x || 0;
  this.y = y || 0;

  this.width  = 24;
  this.height = 24;

  // PATROL | INVESTIGATE | CHASE | SLEEP (mutant only)
  this.state = "PATROL";
  this.waypoints = waypoints || [];
  this.currentWaypointIndex = 0;

  // hướng nhìn (unit vector), sprite gốc nhìn lên
  this.dirX = 0;
  this.dirY = -1;

  this.speed = GUARD_PATROL_SPEED;

  // noise investigate
  this.noiseTarget = null;
  this.noiseTimer = 0;
  this.maxNoiseTime = 3;

  // nhớ vị trí player (trong CHASE)
  this.chaseMemory = 0;

  // animation
  this.animState = "idle";
  this.animTime = 0;

  // lưu vị trí frame trước (dùng cho anim)
  this.lastX = this.x;
  this.lastY = this.y;

  // footstep SFX timer
  this.stepTimer = 0;

  // ---- Flag cho "mutant" (thí nghiệm thất bại) ----
  // Mặc định là guard thường. Khi cần spawn mutant, chỉ cần:
  //   var g = new Guard(...); g.isMutant = true;
  this.isMutant = false;

  // Biến riêng cho mutant
  this.sleepTimer = 0;            // dùng để animate z/zz/zzz
  this.mutantInitialized = false; // để set state SLEEP đúng 1 lần
}

// được gọi từ Stealth khi guard nhìn thấy player
Guard.prototype.onSpotPlayer = function () {
  var wasChasing = (this.state === "CHASE");

  this.state = "CHASE";
  this.chaseMemory = GUARD_CHASE_MEMORY;

  // Mutant: khi lần đầu chuyển sang CHASE → gầm 1 lần
  if (this.isMutant && !wasChasing) {
    if (
      typeof AudioManager !== "undefined" &&
      AudioManager &&
      typeof AudioManager.playSfx === "function"
    ) {
      AudioManager.playSfx("mutant_roar");
    }
  }
};

Guard.prototype._setAnimState = function (state, dt) {
  if (state !== this.animState) {
    this.animState = state;
    this.animTime = 0;
  } else {
    this.animTime += dt;
  }
};

Guard.prototype.hearNoise = function (x, y) {
  if (this.state === "CHASE") return;
  this.state = "INVESTIGATE";
  this.noiseTarget = { x: x, y: y };
  this.noiseTimer = 0;
};

// (hiện tại không dùng trong update nhưng để sẵn cho sau này)
Guard.prototype._isFrontBlocked = function (level) {
  if (!level || typeof level.isBlocked !== "function") return false;

  var step = (typeof TILE_SIZE === "number" && TILE_SIZE > 0)
    ? TILE_SIZE * 0.7
    : this.width * 1.4;

  var perpX = -this.dirY;
  var perpY =  this.dirX;

  var offsets = [-this.width / 3, 0, this.width / 3];

  for (var i = 0; i < offsets.length; i++) {
    var o = offsets[i];
    var fx = this.x + this.dirX * step + perpX * o;
    var fy = this.y + this.dirY * step + perpY * o;

    if (level.isBlocked(fx, fy)) {
      return true;
    }
  }
  return false;
};

// snap guard về tâm ô gần nhất
Guard.prototype._snapToGrid = function () {
  if (typeof TILE_SIZE !== "number" || TILE_SIZE <= 0) return;
  var cx = Math.round(this.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
  var cy = Math.round(this.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
  this.x = cx;
  this.y = cy;
};

Guard.prototype.update = function (dt, level) {
  var target = null;

  // ===== Mutant: SLEEP -> CHASE khi player lại gần =====
  if (this.isMutant) {
    if (!this.mutantInitialized) {
      this.mutantInitialized = true;
      this.state = "SLEEP";                 // mutant bắt đầu trong trạng thái ngủ
      this.chaseMemory = GUARD_CHASE_MEMORY;
      this.sleepTimer = 0;
    }

    // tăng timer để animate z/zz/zzz
    this.sleepTimer += dt;

    if (this.state === "SLEEP") {
      if (typeof player !== "undefined" && player) {
        var dxm = player.x - this.x;
        var dym = player.y - this.y;
        var distm = Math.sqrt(dxm * dxm + dym * dym);

        // bán kính ~1 ô quanh mutant
        var wakeRadius =
          (typeof TILE_SIZE === "number" && TILE_SIZE > 0)
            ? TILE_SIZE * 1.1
            : this.width * 1.5;

        if (distm <= wakeRadius) {
          // Player lại gần → mutant tỉnh dậy và bắt đầu CHASE
          this.state = "CHASE";
          this.chaseMemory = GUARD_CHASE_MEMORY;

          if (
            typeof AudioManager !== "undefined" &&
            AudioManager &&
            typeof AudioManager.playSfx === "function"
          ) {
            // có thể dùng sfx riêng, nếu không có cũng không lỗi
            AudioManager.playSfx("mutant_awake");
          }
        }
      }

      // Đang ngủ thì không patrol / investigate, chỉ idle
      this._setAnimState("idle", dt);
      return;
    }
  }

  // ===== 1. cập nhật chase memory =====
  if (this.state === "CHASE") {
    this.chaseMemory -= dt;
    if (this.chaseMemory <= 0) {
      this.state = "PATROL";
      this.chaseMemory = 0;
    }
  }

  // ===== 2. chọn mục tiêu theo state =====
  if (this.state === "CHASE" && typeof player !== "undefined" && player) {
    target = { x: player.x, y: player.y };
  } else if (this.state === "INVESTIGATE" && this.noiseTarget) {
    target = this.noiseTarget;
    this.noiseTimer += dt;
  } else if (this.waypoints.length) {
    target = this.waypoints[this.currentWaypointIndex];
  }

  if (!target) {
    this._setAnimState("idle", dt);
    return;
  }

  var dx = target.x - this.x;
  var dy = target.y - this.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  // ===== 3. logic INVESTIGATE / PATROL =====
  if (this.state === "INVESTIGATE") {
    if (dist < 6 || this.noiseTimer >= this.maxNoiseTime) {
      this.state = "PATROL";
      this.noiseTarget = null;
      this.noiseTimer = 0;
      this._setAnimState("idle", dt);
      return;
    }
  } else if (this.state === "PATROL") {
    // đến gần waypoint thì chuyển waypoint
    if (dist < 4 && this.waypoints.length > 0) {
      this.currentWaypointIndex =
        (this.currentWaypointIndex + 1) % this.waypoints.length;
      this._setAnimState("idle", dt);
      return;
    }
  }

  if (dist > 0) {
    var nx = dx / dist;
    var ny = dy / dist;
    this.dirX = nx;
    this.dirY = ny;
  }

  // ===== 4. chọn speed (guard thường vs mutant) =====
  var patrolSpeed = GUARD_PATROL_SPEED;
  var chaseSpeed  = GUARD_CHASE_SPEED;

  if (this.isMutant) {
    patrolSpeed = MUTANT_PATROL_SPEED;
    chaseSpeed  = MUTANT_CHASE_SPEED;
  }

  this.speed = (this.state === "CHASE")
    ? chaseSpeed
    : patrolSpeed;

  var vx = this.dirX * this.speed;
  var vy = this.dirY * this.speed;

  var oldX = this.x;
  var oldY = this.y;

  var newX = this.x + vx * dt;
  var newY = this.y + vy * dt;

  var movedX = false;
  var movedY = false;

  // ===== 5. di chuyển + collision =====
  // Horizontal
  if (
    !level.isBlocked(newX - this.width / 2, this.y - this.height / 2) &&
    !level.isBlocked(newX + this.width / 2, this.y - this.height / 2) &&
    !level.isBlocked(newX - this.width / 2, this.y + this.height / 2) &&
    !level.isBlocked(newX + this.width / 2, this.y + this.height / 2)
  ) {
    this.x = newX;
    movedX = true;
  }

  // Vertical
  if (
    !level.isBlocked(this.x - this.width / 2, newY - this.height / 2) &&
    !level.isBlocked(this.x + this.width / 2, newY - this.height / 2) &&
    !level.isBlocked(this.x - this.width / 2, newY + this.height / 2) &&
    !level.isBlocked(this.x + this.width / 2, newY + this.height / 2)
  ) {
    this.y = newY;
    movedY = true;
  }

  // ===== 6. Nếu đang PATROL và hướng CHÍNH bị chặn → quay đầu (đổi waypoint) =====
  if (this.state === "PATROL" && this.waypoints.length > 1) {
    var horizontalMain = Math.abs(this.dirX) >= Math.abs(this.dirY);
    var forwardBlocked = false;

    if (horizontalMain) {
      if (!movedX) forwardBlocked = true; // muốn đi ngang mà không đi được
    } else {
      if (!movedY) forwardBlocked = true; // muốn đi dọc mà không đi được
    }

    if (forwardBlocked && dist > 6) {
      var oldIdx = this.currentWaypointIndex;
      this.currentWaypointIndex =
        (this.currentWaypointIndex + 1) % this.waypoints.length;

      if (DEBUG_GUARD) {
        console.log(
          "[GUARD PATROL TURN] hit wall, change wp",
          "from", oldIdx, "to", this.currentWaypointIndex,
          "x=", this.x.toFixed(1), "y=", this.y.toFixed(1)
        );
      }

      // cập nhật lại hướng nhìn về waypoint mới
      var newTarget = this.waypoints[this.currentWaypointIndex];
      var ddx = newTarget.x - this.x;
      var ddy = newTarget.y - this.y;
      var dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      this.dirX = ddx / dlen;
      this.dirY = ddy / dlen;
    }
  }

  // ===== 7. animation + footstep =====
  var moveDx = this.x - oldX;
  var moveDy = this.y - oldY;
  var moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

  this._setAnimState(moveDist > 0.01 ? "walk" : "idle", dt);

  // === Footstep SFX ===
  if (this.stepInterval == null) {
    this.stepInterval = 0.40;
  }

  var guardMoving = (moveDist > 0.1);
  var isChasingOrKnocked = (
    this.state === "CHASE" ||
    this.state === "chasing" ||
    this.state === "knocked"
  );

  if (guardMoving && !isChasingOrKnocked) {
    this.stepTimer += dt;
    if (this.stepTimer >= this.stepInterval) {
      this.stepTimer = 0;
      // Always play guard step when guard is walking (any stage)
      if (
        typeof AudioManager !== "undefined" &&
        AudioManager &&
        typeof AudioManager.playSfx === "function"
      ) {
        AudioManager.playSfx("guard_step");
      }
    }
  } else {
    this.stepTimer = 0;
  }

  this.lastX = this.x;
  this.lastY = this.y;
};

// ===== Cone vẽ chính xác theo từng tia =====
Guard.prototype.drawVisionCone = function (ctx) {
  if (!Stealth || !ctx) return;

  // Mutant: không vẽ cone tầm nhìn, cho cảm giác khác guard thường
  if (this.isMutant) {
    return;
  }

  var fov = Stealth.FOV_ANGLE;
  var baseViewDist = Stealth.VIEW_DISTANCE;

  // Default: Stage 1 và các mode khác dùng full distance.
  // Stage 2 (visionMode === "circle") dùng bán kính nhỏ hơn để khớp logic Stealth.
  var viewDist = baseViewDist;
  if (
    typeof currentLevel !== "undefined" &&
    currentLevel &&
    currentLevel.visionMode === "circle"
  ) {
    viewDist = baseViewDist * 0.6;
  }

  // Stage 2: use a circular vision radius instead of a cone.
  if (typeof currentLevel !== "undefined" &&
      currentLevel &&
      currentLevel.visionMode === "circle") {

    var radius = viewDist;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(148,163,184,0.10)";
    ctx.fill();
    ctx.restore();

    // Do not draw the cone in this mode.
    return;
  }

  var baseAngle = Math.atan2(this.dirY, this.dirX);
  var half = fov / 2;

  var samples = 21;
  var stepSize = 12;

  var points = [];

  if (
    typeof currentLevel !== "undefined" &&
    currentLevel &&
    typeof currentLevel.isBlocked === "function"
  ) {
    for (var i = 0; i < samples; i++) {
      var t = samples === 1 ? 0.5 : i / (samples - 1);
      var a = baseAngle - half + t * fov;

      var rayDist = viewDist;
      for (var d = stepSize; d <= viewDist; d += stepSize) {
        var rx = this.x + Math.cos(a) * d;
        var ry = this.y + Math.sin(a) * d;

        if (currentLevel.isBlocked(rx, ry)) {
          rayDist = d - stepSize * 0.5;
          break;
        }
      }

      if (rayDist < 0) rayDist = 0;

      var px = this.x + Math.cos(a) * rayDist;
      var py = this.y + Math.sin(a) * rayDist;
      points.push({ x: px, y: py });
    }
  } else {
    for (var i = 0; i < samples; i++) {
      var t = samples === 1 ? 0.5 : i / (samples - 1);
      var a = baseAngle - half + t * fov;
      var px = this.x + Math.cos(a) * viewDist;
      var py = this.y + Math.sin(a) * viewDist;
      points.push({ x: px, py: py });
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(this.x, this.y);
  for (var j = 0; j < points.length; j++) {
    ctx.lineTo(points[j].x, points[j].y);
  }
  ctx.closePath();

  ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
  ctx.fill();
  ctx.restore();
};

Guard.prototype.draw = function (ctx) {
  if (!ctx) return;

  // Shadow
  ctx.save();
  ctx.fillStyle = this.isMutant
    ? "rgba(148, 27, 81, 0.55)"
    : "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.ellipse(
    this.x,
    this.y + this.height / 2,
    this.width / 2,
    6,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  var img = AssetImages && AssetImages.guard;
  if (!img) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle =
      this.state === "CHASE"
        ? (this.isMutant ? "#ec4899" : "#ef4444")
        : (this.state === "INVESTIGATE"
            ? "#fb923c"
            : (this.isMutant ? "#a855f7" : "#f97316"));
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6
    );
    ctx.fill();
    ctx.restore();
    return;
  }

  var frames, fTime;
  if (this.animState === "walk") {
    frames = GUARD_WALK_FRAMES;
    fTime  = GUARD_WALK_FRAME_TIME;
  } else {
    frames = GUARD_IDLE_FRAMES;
    fTime  = GUARD_IDLE_FRAME_TIME;
  }

  var frameIndex;
  if (this.animState === "idle") {
    frameIndex = 0;
  } else {
    frameIndex = Math.floor(this.animTime / fTime) % frames;
  }

  var sx = frameIndex * GUARD_SPRITE_FRAME_W;
  var sy = 0;

  var dx = this.dirX;
  var dy = this.dirY;
  if (dx === 0 && dy === 0) dy = -1;

  var angle = Math.atan2(dy, dx) + Math.PI / 2;

  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(angle);

  ctx.drawImage(
    img,
    sx, sy,
    GUARD_SPRITE_FRAME_W, GUARD_SPRITE_FRAME_H,
    -this.width / 2,
    -this.height / 2,
    this.width,
    this.height
  );

  ctx.restore();

  // Mutant đang ngủ: hiển thị z/zz/zzz trên đầu
  if (this.isMutant && this.state === "SLEEP") {
    var t = this.sleepTimer || 0;
    var phase = Math.floor((t * 1.5) % 3); // 0,1,2
    var zText = phase === 0 ? "z" : (phase === 1 ? "zz" : "zzz");

    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(244, 114, 182, 0.95)"; // hồng tím nhẹ
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(zText, this.x, this.y - this.height / 2 - 4);
    ctx.restore();
  }

  if (DEBUG_GUARD) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(this.x - 34, this.y - 42, 68, 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";

    var label = this.state;
    if (this.isMutant) {
      label = "MUTANT-" + this.state;
    }

    ctx.fillText(label, this.x, this.y - 28);
    ctx.restore();
  }
};
