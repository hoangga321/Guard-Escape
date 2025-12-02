// Player entity using player_sprite.png (640x640, 10x10 tiles of 64x64)
//
//
// Top-left 4x4 block (0..255 x 0..255) is animation:
//  - Columns = directions
//      col 1: UP   (back)
//      col 2: DOWN (front)
//      col 3: RIGHT
//  - Column 0 trong sheet gốc không dùng vì không đúng "nhìn trái"
//  - Rows    = animation frames (0..3)
//      row 0: idle pose
//      row 1..3: walking poses
//
// Ta sẽ:
//  - Dùng 4 frame cho mỗi hướng để WALK
//  - Dùng frame 0 làm IDLE
//  - Hướng LEFT = dùng cột RIGHT + lật gương (scale(-1,1))

var PLAYER_FRAME_W = 64;
var PLAYER_FRAME_H = 64;

var PLAYER_FRAMES_PER_DIR = 4;
var PLAYER_IDLE_FRAME_TIME = 0.4;
var PLAYER_WALK_FRAME_TIME = 0.12;

// Mapping cột cho 3 hướng có sprite riêng
var PLAYER_DIR_COL = {
  up:    1,
  down:  2,
  right: 3
};

function Player(spawnX, spawnY) {
  this.x = spawnX || 0;
  this.y = spawnY || 0;

  // in-game size (scale từ 64x64)
  this.width  = 28;
  this.height = 28;

  // hướng nhìn hiện tại
  this.facing = "down";  // "up" | "down" | "left" | "right"

  this.state = "idle";   // "idle" | "walk"
  this._prevF = false;

  // animation
  this.animState = "idle";
  this.animTime  = 0;

  // footstep SFX timer
  this.stepTimer = 0;
}

Player.prototype._setAnimState = function (state, dt) {
  if (state !== this.animState) {
    this.animState = state;
    this.animTime = 0;
  } else {
    this.animTime += dt;
  }
};

Player.prototype.update = function (dt, level) {
  if (!isInputEnabled()) return;

  // lưu vị trí cũ để biết có di chuyển thật hay không
  var oldX = this.x;
  var oldY = this.y;

  var moveX = 0;
  var moveY = 0;

  if (keys.up)    moveY -= 1;
  if (keys.down)  moveY += 1;
  if (keys.left)  moveX -= 1;
  if (keys.right) moveX += 1;

  var length = Math.sqrt(moveX * moveX + moveY * moveY);

  // ---- xác định hướng nhìn (facing) từ phím cuối ----
  if (length > 0) {
    moveX /= length;
    moveY /= length;

    if (Math.abs(moveX) >= Math.abs(moveY)) {
      // ưu tiên trái/phải
      this.facing = (moveX > 0) ? "right" : "left";
    } else {
      // ưu tiên lên/xuống
      this.facing = (moveY > 0) ? "down" : "up";
    }
  }

  var speed = keys.shift ? PLAYER_SPEED_RUN : PLAYER_SPEED_WALK;
  var vx = (length > 0 ? moveX : 0) * speed;
  var vy = (length > 0 ? moveY : 0) * speed;

  this.state = (length === 0) ? "idle" : "walk";

  // ---- movement + collision ----
  var newX = this.x + vx * dt;
  var newY = this.y + vy * dt;

  // Horizontal
  if (
    !level.isBlocked(newX - this.width / 2, this.y - this.height / 2) &&
    !level.isBlocked(newX + this.width / 2, this.y - this.height / 2) &&
    !level.isBlocked(newX - this.width / 2, this.y + this.height / 2) &&
    !level.isBlocked(newX + this.width / 2, this.y + this.height / 2)
  ) {
    this.x = newX;
  }

  // Vertical
  if (
    !level.isBlocked(this.x - this.width / 2, newY - this.height / 2) &&
    !level.isBlocked(this.x + this.width / 2, newY - this.height / 2) &&
    !level.isBlocked(this.x - this.width / 2, newY + this.height / 2) &&
    !level.isBlocked(this.x + this.width / 2, newY + this.height / 2)
  ) {
    this.y = newY;
  }

  // ---- footstep SFX: chỉ phát khi thực sự di chuyển ----
  var dx = this.x - oldX;
  var dy = this.y - oldY;
  var moveDist = Math.sqrt(dx * dx + dy * dy);

  if (moveDist > 0.1) {
    this.stepTimer += dt;
    var STEP_INTERVAL = 0.35; // mỗi ~0.35s một tiếng bước chân
    if (this.stepTimer >= STEP_INTERVAL) {
      if (
        typeof AudioManager !== "undefined" &&
        AudioManager &&
        typeof AudioManager.playSfx === "function"
      ) {
        AudioManager.playSfx("player_step");
      }
      this.stepTimer -= STEP_INTERVAL;
    }
  } else {
    // dừng di chuyển → reset timer và tắt luôn SFX bước chân
    this.stepTimer = 0;
    if (
      typeof AudioManager !== "undefined" &&
      AudioManager &&
      typeof AudioManager.stopSfx === "function"
    ) {
      AudioManager.stopSfx("player_step");
    }
  }

  // ---- Gadget: Decoy (F) ----
  var justPressedF = keys.f && !this._prevF;
  if (justPressedF && typeof Stealth !== "undefined") {
    var throwDist = TILE_SIZE * 2;
    var dxDecoy = 0, dyDecoy = 0;

    if (this.facing === "right") { dxDecoy = 1;  dyDecoy = 0; }
    if (this.facing === "left")  { dxDecoy = -1; dyDecoy = 0; }
    if (this.facing === "up")    { dxDecoy = 0;  dyDecoy = -1; }
    if (this.facing === "down")  { dxDecoy = 0;  dyDecoy = 1;  }

    var decoyX = this.x + dxDecoy * throwDist;
    var decoyY = this.y + dyDecoy * throwDist;
    Stealth.spawnDecoy(decoyX, decoyY);
  }
  this._prevF = keys.f;

  // ---- animation state ----
  var animState = (this.state === "walk") ? "walk" : "idle";
  this._setAnimState(animState, dt);
};

Player.prototype.draw = function (ctx) {
  if (!ctx) return;

  // Shadow
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
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

  var img = AssetImages && AssetImages.player;
  if (!img) {
    // fallback rectangle
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 6);
    ctx.fill();
    ctx.restore();
    return;
  }

  // ----- chọn cột + flip theo hướng -----
  var flipX = false;
  var col;

  if (this.facing === "left") {
    // dùng cột "right" nhưng lật gương
    col = PLAYER_DIR_COL.right;
    flipX = true;
  } else {
    col = PLAYER_DIR_COL[this.facing] || PLAYER_DIR_COL.down;
  }

  var sxBase = col * PLAYER_FRAME_W;

  // ----- chọn frame idle / walk -----
  var frameIndex;
  if (this.animState === "idle") {
    frameIndex = 0; // frame đứng
  } else {
    var frameTime = PLAYER_WALK_FRAME_TIME;
    frameIndex = Math.floor(this.animTime / frameTime) % PLAYER_FRAMES_PER_DIR;
  }

  var sy = frameIndex * PLAYER_FRAME_H;

  // vẽ
  ctx.save();
  ctx.translate(this.x, this.y);
  if (flipX) {
    ctx.scale(-1, 1);
  }

  ctx.drawImage(
    img,
    sxBase, sy,
    PLAYER_FRAME_W, PLAYER_FRAME_H,
    -this.width / 2,
    -this.height / 2,
    this.width,
    this.height
  );
  ctx.restore();
};
