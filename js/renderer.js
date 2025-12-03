// Renderer for canvas

var Renderer = {
  canvas: null,
  ctx: null,

  // camera world-space center
  camera: { x: 0, y: 0 },

  // mode: "follow" (bám player) | "intro" (camera script)
  cameraMode: "follow",
  cameraTarget: null,

  // Optional camera shake offsets (set from main.js)
  cameraShakeX: 0,
  cameraShakeY: 0,

  // Intro fog control
  // introFogMode:
  //   null        -> không override (mặc định, nhưng trong intro ta thường set rõ)
  //   "playerFade"-> fade từ màn đen thành vòng sáng quanh player
  //   "player"    -> vòng sáng quanh player như gameplay
  //   "spotlight" -> spotlight tại 1 điểm (console/exit/guard/phòng)
  introFogMode: null,
  introFogProgress: 0, // 0..1, dùng cho "playerFade"
  introSpot: null,     // { x: worldX, y: worldY, radius: number }

  // minimap
  minimapCanvas: null,
  minimapCtx: null
};

// Core tileset image for Stage 3 (48x48 sci-fi tiles)
var coreTileset = new Image();
// ĐÚNG TÊN FILE: assets/img/tileset_core_48.png
coreTileset.src = "assets/img/tileset_core_48.png";

function getTileSpriteRect(tileIndex) {
  var SRC = 48;
  var tilesPerRow = (coreTileset && coreTileset.width)
    ? Math.max(1, Math.floor(coreTileset.width / SRC))
    : 1;
  var idx = Math.max(0, (typeof tileIndex === "number" ? tileIndex : 0));
  var col = idx % tilesPerRow;
  var row = Math.floor(idx / tilesPerRow);

  return {
    sx: col * SRC,
    sy: row * SRC,
    sw: SRC,
    sh: SRC
  };
}

// Map logical core tile codes (0 = floor, 1 = wall, etc.)
// to actual sprite indices inside the 48x48 core tileset.
// This keeps Level.tiles as simple 0/1 codes but lets us pick
// good-looking tiles from the sheet.
function resolveCoreSpriteIndex(logicalTile, tileX, tileY) {
  // Fallback if something weird is passed in
  if (typeof logicalTile !== "number") {
    logicalTile = 0;
  }

  // Two dark floor tiles at the bottom-left of the sheet:
  // indices 112 and 113 (row 14, col 0–1).
  var floorChoices = [112, 113];

  // A small set of sci-fi wall segments (row 10, indices 80–83).
  // They all look like nice wall blocks.
  var wallChoices = [80, 81, 82, 83];

  switch (logicalTile) {
    case 1:
      // Solid wall: pick one of the wall tiles, alternating by (x + y)
      return wallChoices[(tileX + tileY) % wallChoices.length];

    case 2:
      // Reserved for future: special wall / junction.
      // For now just pick a cross / intersection style tile.
      return 32; // you can tweak this later if needed

    case 3:
      // Reserved for future: another variant (e.g. corner).
      return 40; // tweak later if you design special shapes

    default:
      // Everything else (0 or unknown) is walkable floor.
      // Slight variation between 112 and 113 so the floor
      // doesn't look too repetitive.
      return floorChoices[(tileX + tileY) % floorChoices.length];
  }
}

function drawOccludedCameraCone(ctx, level, cam) {
  if (!cam) return;
  if (cam.active === false) return;

  var cx = cam.x;
  var cy = cam.y;

  // Base forward angle from dirX/dirY
  var dxForward = (typeof cam.dirX === "number") ? cam.dirX : 0;
  var dyForward = (typeof cam.dirY === "number") ? cam.dirY : 1;
  if (dxForward === 0 && dyForward === 0) {
    dyForward = 1;
  }
  var baseAngle = Math.atan2(dyForward, dxForward);

  // Wide half-circle FOV for cameras
  var fov = (typeof cam.fovAngle === "number") ? cam.fovAngle : Math.PI;
  if (level && level.stageId === 2 && fov < Math.PI) {
    fov = Math.PI;
  }

  var radius = cam.radius || TILE_SIZE * 6;

  var startAngle = baseAngle - fov * 0.5;
  var endAngle = baseAngle + fov * 0.5;

  var RAY_COUNT = 48;
  var rayStep = fov / (RAY_COUNT - 1);
  var STEP_DIST = 8;

  var points = [];

  for (var i = 0; i < RAY_COUNT; i++) {
    var angle = startAngle + rayStep * i;
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);

    var hitX = cx;
    var hitY = cy;
    var hitAny = false;

    for (var d = STEP_DIST; d <= radius; d += STEP_DIST) {
      var sx = cx + dx * d;
      var sy = cy + dy * d;

      var blocked = false;
      if (level && typeof level.isBlocked === "function") {
        if (level.isBlocked(sx, sy)) {
          blocked = true;
        }
      }

      hitX = sx;
      hitY = sy;
      hitAny = true;

      if (blocked) {
        break;
      }
    }

    // ensure minimal extent so cone isn't collapsed under sprite
    if (!hitAny) {
      hitX = cx + dx * TILE_SIZE * 1.5;
      hitY = cy + dy * TILE_SIZE * 1.5;
    }

    points.push({ x: hitX, y: hitY });
  }

  ctx.save();
  // Softer, more transparent cone
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (var j = 0; j < points.length; j++) {
    ctx.lineTo(points[j].x, points[j].y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
  ctx.fill();
  ctx.restore();
}

// Draw floor tile for Stage 3 "core" theme using 48x48 tileset
Renderer.drawCoreFloorTile = function (ctx, tilesetImg, tileX, tileY, destX, destY) {
  if (!ctx || !tilesetImg) return;

  // Source tile size in the tileset PNG
  var SRC_SIZE = 48;
  // Destination tile size in the game world
  var DST_SIZE = (typeof TILE_SIZE === "number") ? TILE_SIZE : 32;

  // Tileset layout: 8 columns x 15 rows (384x720)
  var tilesPerRow = Math.floor(tilesetImg.width / SRC_SIZE);

  // We will use the two dark floor tiles at the bottom-left of the sheet:
  // - tile index 112 (row 14, col 0)
  // - tile index 113 (row 14, col 1)
  // To avoid extra randomness, alternate them by (tileX + tileY).
  var floorIndices = [112, 113];
  var idx = floorIndices[(tileX + tileY) % floorIndices.length];

  var sx = (idx % tilesPerRow) * SRC_SIZE;
  var sy = Math.floor(idx / tilesPerRow) * SRC_SIZE;

  ctx.drawImage(
    tilesetImg,
    sx, sy, SRC_SIZE, SRC_SIZE,   // source rect in the PNG
    destX, destY, DST_SIZE, DST_SIZE // destination rect in the world
  );
};

Renderer.init = function (canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext("2d");
};

// cho main.js / tutorial.js gắn canvas minimap (ở sidebar)
Renderer.setMinimapCanvas = function (canvas) {
  this.minimapCanvas = canvas || null;
  this.minimapCtx = canvas ? canvas.getContext("2d") : null;
};

// Đổi mode camera
Renderer.setCameraMode = function (mode) {
  if (mode === "intro") {
    this.cameraMode = "intro";
  } else {
    this.cameraMode = "follow";
  }
};

// Đặt target cho camera intro (world-space)
Renderer.setCameraTarget = function (x, y) {
  this.cameraTarget = { x: x, y: y };
};

// ---- API cho intro fog ----
Renderer.setIntroFogMode = function (mode) {
  this.introFogMode = mode || null;
};

Renderer.setIntroFogProgress = function (p) {
  if (typeof p !== "number") p = 0;
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  this.introFogProgress = p;
};

Renderer.setIntroSpotlight = function (x, y, radius) {
  this.introFogMode = "spotlight";
  this.introSpot = {
    x: x,
    y: y,
    radius: radius
  };
};

Renderer.clear = function () {
  if (!this.ctx) return;
  this.ctx.fillStyle = "#020617";
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
};

Renderer.renderGame = function (level, player, guards) {
  if (!this.ctx || !level) return;

  var ctx = this.ctx;
  var isCoreTheme = level && level.theme === "core";
  const TILE = isCoreTheme && typeof level.tileSize === "number" ? level.tileSize : TILE_SIZE;
  const worldWidth = level ? level.width * TILE : 0;
  const worldHeight = level ? level.height * TILE : 0;

  var floorImg = null;
  var wallImg  = null;
  var coreTilesetImg = null;

  if (AssetImages) {
    if (level && level.theme === "security") {
      // Stage 2: prefer security tiles, fallback to default lab tiles
      floorImg = AssetImages.floor_security || AssetImages.floor || null;
      wallImg  = AssetImages.wall_security  || AssetImages.wall  || null;
    } else if (level && level.theme === "core") {
      // Stage 3: "core" theme uses dedicated tileset for floor,
      // but can reuse the existing security wall tiles.
      coreTilesetImg = coreTileset; // dùng global image vừa load ở trên
      floorImg = null;
      wallImg  = AssetImages.wall_security || AssetImages.wall || null;
    } else {
      // Stage 1 and other themes: use default lab tiles
      floorImg = AssetImages.floor || null;
      wallImg  = AssetImages.wall  || null;
    }
  }

  var exitImg      = AssetImages && AssetImages.exit;
  var consoleImg   = AssetImages && AssetImages.console;
  var labServerImg = AssetImages && AssetImages.lab_server;
  var labTableImg  = AssetImages && AssetImages.lab_table;
  var labTankImg   = AssetImages && AssetImages.lab_tank;
  // Stage 2 security props
  var s2ConsoleMainImg     = AssetImages && AssetImages.s2_console_main;
  var s2ConsoleCorridorImg = AssetImages && AssetImages.s2_console_corridor;
  var s2ConsoleExitImg     = AssetImages && AssetImages.s2_console_exit;
  var s2CameraImg          = AssetImages && AssetImages.s2_camera_wall;
  // Stage 3: machine / trap tileset atlas
  var s3TilesetImg = AssetImages && AssetImages.s3_tileset;
  var s3ConsoleMainImg = AssetImages && AssetImages.s3_console_main;
  var s3ConsoleClueImg = AssetImages && AssetImages.s3_console_clue;
  var s3LaserSwitchImg = AssetImages && AssetImages.s3_laser_switch;

  // NOTE: coordinates are estimated from the 300x300 tileset and may be tweaked later.
  // sx, sy, sw, sh are source rects in the tileset image.
  var STAGE3_ATLAS = {
    // Turret / cannon near the lower-middle of the tileset
    s3_turret: {
      sx: 154, // expanded around the red-lit turret
      sy: 228,
      sw: 48,
      sh: 32
    },
    // Vertical laser gate (tall red stripes, detected region 165..186 x 175..215)
    s3_laser_gate: {
      sx: 162,
      sy: 162,
      sw: 27,
      sh: 65
    },
    // Floor laser spikes (red spikes near bottom, detected 195..220 x 273..280)
    s3_laser_spikes: {
      sx: 195,
      sy: 270,
      sw: 25,
      sh: 17
    }
  };
  // Derive OFF frames (to the left of ON frames) for gates/spikes
  (function deriveStage3OffFrames() {
    var gateOn = STAGE3_ATLAS.s3_laser_gate;
    var spikesOn = STAGE3_ATLAS.s3_laser_spikes;
    if (gateOn) {
      STAGE3_ATLAS.s3_laser_gate_off = {
        sx: gateOn.sx - gateOn.sw,
        sy: gateOn.sy,
        sw: gateOn.sw,
        sh: gateOn.sh
      };
    }
    if (spikesOn) {
      STAGE3_ATLAS.s3_laser_spikes_off = {
        sx: spikesOn.sx - spikesOn.sw,
        sy: spikesOn.sy,
        sw: spikesOn.sw,
        sh: spikesOn.sh
      };
    }
  })();

  // ===== Cập nhật camera =====
  var cam = this.camera;

  if (this.cameraMode === "intro" && this.cameraTarget) {
    // Camera intro: lerp nhẹ tới target
    var lerp = 0.08; // mượt hơn thì tăng, nhanh hơn thì giảm
    cam.x += (this.cameraTarget.x - cam.x) * lerp;
    cam.y += (this.cameraTarget.y - cam.y) * lerp;
  } else {
    // Camera gameplay: bám theo player như cũ
    if (player) {
      cam.x = player.x;
      cam.y = player.y;
    }
  }

  if (
    typeof GAME_WIDTH === "number" &&
    typeof GAME_HEIGHT === "number" &&
    typeof TILE_SIZE === "number"
  ) {
    var worldW = level.width * TILE_SIZE;
    var worldH = level.height * TILE_SIZE;
    var halfW = GAME_WIDTH / 2;
    var halfH = GAME_HEIGHT / 2;

    // Nếu map nhỏ hơn viewport → giữ camera ở giữa map
    if (worldW <= GAME_WIDTH) {
      cam.x = worldW / 2;
    } else {
      cam.x = Math.max(halfW, Math.min(cam.x, worldW - halfW));
    }

    if (worldH <= GAME_HEIGHT) {
      cam.y = worldH / 2;
    } else {
      cam.y = Math.max(halfH, Math.min(cam.y, worldH - halfH));
    }
  }

  // dịch toàn bộ thế giới theo camera (hỗ trợ camera shake)
  ctx.save();
  if (isCoreTheme && player && this.canvas) {
    var cameraX = player.x - this.canvas.width / 2;
    var cameraY = player.y - this.canvas.height / 2;
    cameraX = Math.max(0, Math.min(cameraX, worldWidth - this.canvas.width));
    cameraY = Math.max(0, Math.min(cameraY, worldHeight - this.canvas.height));
    var shakeXCore = this.cameraShakeX || 0;
    var shakeYCore = this.cameraShakeY || 0;
    ctx.translate(
      -cameraX + Math.floor(shakeXCore),
      -cameraY + Math.floor(shakeYCore)
    );
  } else if (typeof GAME_WIDTH === "number" && typeof GAME_HEIGHT === "number") {
    var shakeX = this.cameraShakeX || 0;
    var shakeY = this.cameraShakeY || 0;
    var offsetX = Math.round(GAME_WIDTH / 2 - cam.x + shakeX);
    var offsetY = Math.round(GAME_HEIGHT / 2 - cam.y + shakeY);
    ctx.translate(offsetX, offsetY);
  }

  // ===== Draw tiles (floor + wall) =====
  if (level.theme === "core") {
    renderCoreTileset(ctx, level);
    renderCoreDecor(ctx, level);
  } else {
    for (var y = 0; y < level.height; y++) {
      for (var x = 0; x < level.width; x++) {
        var tile = level.tiles[y][x];
        var px = x * TILE_SIZE;
        var py = y * TILE_SIZE;

        if (tile === 1) {
          // WALL tile
          if (wallImg) {
            ctx.drawImage(wallImg, px, py, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#111827";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#1f2937";
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            ctx.strokeStyle = "#020617";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          }
        } else {
          // FLOOR tile
          if (isCoreTheme && coreTilesetImg && typeof Renderer.drawCoreFloorTile === "function") {
            // Stage 3 "core" floor using tileset cropping
            Renderer.drawCoreFloorTile(ctx, coreTilesetImg, x, y, px, py);
          } else if (floorImg) {
            ctx.drawImage(floorImg, px, py, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#020617";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#0b1120";
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
        }
      }
    }
  }

  // ===== Security doors / laser barriers (Stage 2) =====
  if (level.securityDoors && level.securityDoors.length) {
    for (var sd = 0; sd < level.securityDoors.length; sd++) {
      var door = level.securityDoors[sd];
      if (!door || door.active === false) continue;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#4ffcff";
      ctx.fillRect(door.x, door.y, door.width, door.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#a9ffff";
      ctx.strokeRect(door.x, door.y, door.width, door.height);
      ctx.restore();
    }
  }

  // ===== Draw EXIT door (world-space, theo rect từ level.exit) =====
  if (level.exit) {
    var ex = level.exit;
    if (exitImg) {
      ctx.drawImage(exitImg, ex.x, ex.y, ex.width, ex.height);
    } else {
      // fallback (giữ nguyên hitbox để debug)
      ctx.save();
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(ex.x, ex.y, ex.width, ex.height);
      ctx.fillStyle = "#15803d";
      ctx.fillRect(ex.x + 4, ex.y + 4, ex.width - 8, ex.height - 8);
      ctx.restore();
    }
  }

  // Laser gate overlay on the exit (if enabled or fading out)
  if (level.exit && (level.laserEnabled || (typeof level.laserAlpha === "number" && level.laserAlpha > 0))) {
    var ex2 = level.exit;
    var alpha = (typeof level.laserAlpha === "number") ? level.laserAlpha : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Draw a soft red glow over the exit
    ctx.fillStyle = "rgba(248,113,113,0.22)";
    ctx.fillRect(ex2.x, ex2.y, ex2.width, ex2.height);

    // Draw several horizontal laser lines
    var lineCount = 4;
    ctx.strokeStyle = "rgba(248,113,113,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    for (var li = 0; li < lineCount; li++) {
      var t = (li + 1) / (lineCount + 1);
      var ly = ex2.y + ex2.height * t;
      ctx.beginPath();
      ctx.moveTo(ex2.x + 2, ly);
      ctx.lineTo(ex2.x + ex2.width - 2, ly);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ===== OBJECTIVE CONSOLE (trong Lab) =====
  if (level.objective) {
    var oz = level.objective;

    // highlight vùng nhiệm vụ cho rõ
    ctx.save();
    ctx.fillStyle = "rgba(56,189,248,0.10)";
    ctx.fillRect(oz.x, oz.y, oz.width, oz.height);
    ctx.strokeStyle = "rgba(56,189,248,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(oz.x + 0.5, oz.y + 0.5, oz.width - 1, oz.height - 1);
    ctx.restore();

    // Tính tâm vùng objective (để đặt console)
    var centerX = oz.x + oz.width / 2;
    var centerY = oz.y + oz.height / 2;

    // Console ~3x3 tile (Stage 1 only)
    if (consoleImg && level.stageId !== 2) {
      var consoleW = TILE_SIZE * 3;
      var consoleH = TILE_SIZE * 3;
      var cx = centerX - consoleW / 2;
      var cy = centerY - consoleH / 2;
      ctx.drawImage(consoleImg, cx, cy, consoleW, consoleH);
    } else if (!consoleImg) {
      // fallback nếu thiếu ảnh
      ctx.save();
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(
        centerX - TILE_SIZE * 1.5,
        centerY - TILE_SIZE * 1.5,
        TILE_SIZE * 3,
        TILE_SIZE * 3
      );
      ctx.restore();
    }
  }

  // ===== Stage 1 lab props (only when stageId is 1) =====
  if (!level.stageId || level.stageId === 1) {
    var propW = TILE_SIZE * 2;
    var propH = TILE_SIZE * 2;

    // Room A (trên-trái)
    if (labServerImg) {
      ctx.drawImage(labServerImg, TILE_SIZE * 4, TILE_SIZE * 4, propW, propH);
    }

    // Room B (dưới-trái)
    if (labTableImg) {
      ctx.drawImage(labTableImg, TILE_SIZE * 4, TILE_SIZE * 14, propW, propH);
    }

    // Room D (dưới-giữa)
    if (labTankImg) {
      ctx.drawImage(labTankImg, TILE_SIZE * 18, TILE_SIZE * 14, propW, propH);
    }

    // Laser switch machine – follow the logical laserSwitch rectangle from the level
    if (labServerImg && level.laserSwitch) {
      var s = level.laserSwitch;
      var sx = s.x;
      var sy = s.y;
      var sw = s.width || propW;
      var sh = s.height || propH;

      // Draw the auxiliary console at the laser switch position
      ctx.drawImage(labServerImg, sx, sy, sw, sh);

      // Subtle highlight to show it's an interactive device
      ctx.save();
      ctx.strokeStyle = "rgba(56,189,248,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);
      ctx.restore();
    }
  }

  // ===== STAGE 2 + 3 SECURITY PROPS (consoles + machines + wall cameras) =====
  if (level && (level.stageId === 2 || level.stageId === 3)) {
    // Machines / consoles (Stage 2 + Stage 3)
    var props =
      (level.securityProps && level.securityProps.length)
        ? level.securityProps
        : level.securityConsoles;

    if (props && props.length) {
      for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        if (!prop) continue;

        var img = null;
        var atlas = null;

          // Stage 2 consoles (separate images)
          if (prop.spriteKey === "s2_console_main") {
            img = s2ConsoleMainImg;
          } else if (prop.spriteKey === "s2_console_corridor") {
            img = s2ConsoleCorridorImg;
          } else if (prop.spriteKey === "s2_console_exit") {
            img = s2ConsoleExitImg;
          }
          // Stage 3 standalone consoles / switches
          else if (prop.spriteKey === "s3_console_main") {
            img = s3ConsoleMainImg;
          } else if (prop.spriteKey === "s3_console_clue") {
            img = s3ConsoleClueImg;
          } else if (prop.spriteKey === "s3_laser_switch") {
            img = s3LaserSwitchImg;
          }
          // Stage 3 machines / traps from tileset atlas
          else if (prop.spriteKey === "s3_turret" ||
                   prop.spriteKey === "s3_laser_gate" ||
                   prop.spriteKey === "s3_laser_spikes" ||
                   prop.spriteKey === "s3_laser_gate_off" ||
                   prop.spriteKey === "s3_laser_spikes_off") {
            img = s3TilesetImg;
            atlas = STAGE3_ATLAS[prop.spriteKey];
          }

        var centerX = prop.x + prop.width / 2;
        var centerY = prop.y + prop.height / 2;

          if (img) {
            // Desired on-screen size (can be tuned per prop if needed)
            var drawW = prop.width  || TILE_SIZE * 2;
            var drawH = prop.height || TILE_SIZE * 2;
            if (prop.spriteKey === "s3_console_main" ||
                prop.spriteKey === "s3_console_clue") {
              if (img && img.width) {
                drawW = img.width;
              }
              if (img && img.height) {
                drawH = img.height;
              }
            }
            var dstX  = centerX - drawW / 2;
            var dstY  = centerY - drawH / 2;

          if (atlas && img === s3TilesetImg) {
            // Draw from tileset sub-rect
            ctx.drawImage(
              img,
              atlas.sx, atlas.sy, atlas.sw, atlas.sh,
              dstX, dstY, drawW, drawH
            );
          } else {
            // Normal full-image draw for Stage 2 consoles
            ctx.drawImage(img, dstX, dstY, drawW, drawH);
          }
        } else {
          // Fallback rectangle if images are missing
          ctx.save();
          ctx.fillStyle = "#0ea5e9";
          ctx.fillRect(
            centerX - TILE_SIZE,
            centerY - TILE_SIZE,
            TILE_SIZE * 2,
            TILE_SIZE * 2
          );
          ctx.restore();
        }
      }
    }

    // Stage 3: turret vision areas (circle)
    if (level.stageId === 3 && level.securityProps && level.securityProps.length) {
      for (var t = 0; t < level.securityProps.length; t++) {
        var tprop = level.securityProps[t];
        if (!tprop || tprop.trapType !== "turret") continue;
        if (tprop.active === false) continue;

        var tx = tprop.x + tprop.width * 0.5;
        var ty = tprop.y + tprop.height * 0.5;
        var trad =
          (typeof tprop.visionRadius === "number" && tprop.visionRadius > 0)
            ? tprop.visionRadius
            : (typeof tprop.detectionRadius === "number" && tprop.detectionRadius > 0)
              ? tprop.detectionRadius
              : (TILE_SIZE * 6);

        ctx.save();
        ctx.beginPath();
        ctx.arc(tx, ty, trad, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 80, 80, 0.15)";
        ctx.fill();
        ctx.restore();
      }
    }

    // Stage 3: turret bullets
    if (level.stageId === 3 && level.turretBullets && level.turretBullets.length) {
      ctx.save();
      ctx.fillStyle = "rgba(255,80,80,0.9)";
      for (var bi = 0; bi < level.turretBullets.length; bi++) {
        var bullet = level.turretBullets[bi];
        if (!bullet || bullet.alive === false) continue;
        var brad = (typeof bullet.radius === "number") ? bullet.radius : 6;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, brad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Wall-mounted cameras + vision area
    if (level.cameras && level.cameras.length) {
      ctx.save();

      for (var j = 0; j < level.cameras.length; j++) {
        var cam2 = level.cameras[j];
        if (!cam2) continue;
        if (cam2.active === false) continue;

        // Camera sprite
        if (s2CameraImg) {
          var camW = TILE_SIZE * 1.6;
          var camH = TILE_SIZE * 1.6;
          var camX = cam2.x - camW / 2;
          var camY = cam2.y - camH * 0.8; // hug the top wall
          ctx.drawImage(s2CameraImg, camX, camY, camW, camH);
        }

        // Vision cone / sector with occlusion
        drawOccludedCameraCone(ctx, level, cam2);
      }

      ctx.restore();
    }
  }

  // ===== Decoys từ hệ thống Stealth (nếu có) =====
  if (typeof Stealth !== "undefined" && Stealth.decoys && Stealth.decoys.length) {
    for (var d = 0; d < Stealth.decoys.length; d++) {
      var decoy = Stealth.decoys[d];
      var alpha = Math.max(0.2, decoy.life / 3);

      ctx.save();
      ctx.beginPath();
      ctx.arc(decoy.x, decoy.y, decoy.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(96,165,250," + (0.08 * alpha) + ")";
      ctx.fill();

      ctx.fillStyle = "rgba(59,130,246," + (0.8 * alpha) + ")";
      ctx.beginPath();
      ctx.arc(decoy.x, decoy.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ===== Vision cone của guard =====
  if (guards && guards.length) {
    for (var i2 = 0; i2 < guards.length; i2++) {
      if (typeof guards[i2].drawVisionCone === "function") {
        guards[i2].drawVisionCone(ctx);
      }
    }
  }

  // ===== Player =====
  if (player && typeof player.draw === "function") {
    player.draw(ctx);
  }

  // ===== Guards =====
  if (guards && guards.length) {
    for (var j2 = 0; j2 < guards.length; j2++) {
      if (typeof guards[j2].draw === "function") {
        guards[j2].draw(ctx);
      }
    }
  }

  // Kết thúc world-space
  ctx.restore();

  // ===== Fog-of-war / Intro lighting =====
  // Stage 2 is a bright security floor -> skip gameplay fog
  if (
    level &&
    level.stageId === 2
  ) {
    return;
  }
  if (
    level &&
    level.useFog !== false &&
    player &&
    typeof GAME_WIDTH === "number" &&
    typeof GAME_HEIGHT === "number"
  ) {
    var sxFog, syFog, radiusFog;
    var baseRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.4;

    if (this.cameraMode === "intro") {
      // ---- Intro: dùng fog cinematic ----
      if (!this.introFogMode) {
        // nếu chưa set mode, cho tối đen toàn màn
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        return;
      }

      if (this.introFogMode === "playerFade" || this.introFogMode === "player") {
        // spotlight quanh player
        sxFog = player.x - cam.x + GAME_WIDTH / 2;
        syFog = player.y - cam.y + GAME_HEIGHT / 2;

        var p =
          this.introFogMode === "playerFade"
            ? (this.introFogProgress || 0)
            : 1;

        // tránh radius = 0, nhưng vẫn rất nhỏ lúc mới fade
        var k = Math.max(0.05, Math.min(1, p));
        radiusFog = baseRadius * k;

      } else if (this.introFogMode === "spotlight" && this.introSpot) {
        // spotlight quanh 1 điểm (console / exit / guard / phòng)
        sxFog = this.introSpot.x - cam.x + GAME_WIDTH / 2;
        syFog = this.introSpot.y - cam.y + GAME_HEIGHT / 2;
        radiusFog =
          this.introSpot.radius ||
          (Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.25);
      } else {
        return;
      }

      ctx.save();
      var gIntro = ctx.createRadialGradient(sxFog, syFog, 0, sxFog, syFog, radiusFog);
      gIntro.addColorStop(0, "rgba(0,0,0,0)");
      gIntro.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = gIntro;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();

      return;
    }

    // ---- Gameplay: fog bình thường quanh player ----
    sxFog = player.x - cam.x + GAME_WIDTH / 2;
    syFog = player.y - cam.y + GAME_HEIGHT / 2;
    radiusFog = baseRadius;

    ctx.save();

    // Gradient tối từ ngoài vào trong:
    // - ở tâm: alpha = 0 → thấy map rõ
    // - ở ngoài: alpha ~0.88 → rất tối
    var g = ctx.createRadialGradient(sxFog, syFog, 0, sxFog, syFog, radiusFog);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.88)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.restore();
  }
};

// ===== Minimap (vẽ vào canvas riêng bên sidebar) =====
Renderer.renderMinimap = function (level, player, guards) {
  var ctx = this.minimapCtx;
  if (!ctx || !level) return;

  var w = ctx.canvas.width;
  var h = ctx.canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  var tileW = w / level.width;
  var tileH = h / level.height;

  for (var y = 0; y < level.height; y++) {
    for (var x = 0; x < level.width; x++) {
      var explored =
        level.explored &&
        level.explored[y] &&
        level.explored[y][x];

      if (!explored) {
        ctx.fillStyle = "#020617"; // chưa khám phá: tối
      } else {
        var t = level.tiles[y][x];
        if (t === 1) ctx.fillStyle = "#1f2937"; // tường
        else         ctx.fillStyle = "#4b5563"; // floor
      }
      ctx.fillRect(x * tileW, y * tileH, tileW + 1, tileH + 1);
    }
  }

  // vẽ player
  if (player) {
    var px = (player.x / TILE_SIZE) * tileW;
    var py = (player.y / TILE_SIZE) * tileH;
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  // vẽ guards
  if (guards && guards.length) {
    ctx.fillStyle = "#ef4444";
    for (var i = 0; i < guards.length; i++) {
      var g2 = guards[i];
      var gx = (g2.x / TILE_SIZE) * tileW;
      var gy = (g2.y / TILE_SIZE) * tileH;
      ctx.fillRect(gx - 2, gy - 2, 4, 4);
    }
  }
};

function renderCoreTileset(ctx, level) {
  if (!ctx || !level || !level.tiles) return;
  var tileSize = (typeof level.tileSize === "number") ? level.tileSize : TILE_SIZE;
  var tileset = coreTileset;
  var hasTileset = tileset && tileset.complete && tileset.width > 0;

  for (var y = 0; y < level.height; y++) {
    for (var x = 0; x < level.width; x++) {
      var logical = level.tiles[y][x];
      var px = x * tileSize;
      var py = y * tileSize;

      if (hasTileset) {
        // Map logical tile code (0=floor, 1=wall, ...) → sprite index.
        var spriteIndex = resolveCoreSpriteIndex(logical, x, y);
        // If you ever want "empty" tiles, you can return -1 and skip draw.
        if (spriteIndex < 0) {
          continue;
        }

        var rect = getTileSpriteRect(spriteIndex);
        ctx.drawImage(
          tileset,
          rect.sx, rect.sy, rect.sw, rect.sh,
          px, py, tileSize, tileSize
        );
      } else {
        // fallback fill if tileset not loaded yet
        var isWall = (logical === 1);
        if (isWall) {
          ctx.fillStyle = "#1f2937";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = "#111827";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = "#020617";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        }
      }
    }
  }
}

function renderCoreDecor(ctx, level) {
  if (!ctx || !level || !level.decorTiles) return;
  var tileSize = (typeof level.tileSize === "number") ? level.tileSize : TILE_SIZE;
  var tileset = coreTileset;
  if (!(tileset && tileset.complete && tileset.width > 0)) return;

  for (var y = 0; y < level.decorTiles.length; y++) {
    var row = level.decorTiles[y];
    if (!row) continue;
    for (var x = 0; x < row.length; x++) {
      var tileIndex = row[x];
      if (typeof tileIndex !== "number") continue;
      var px = x * tileSize;
      var py = y * tileSize;
      var rect = getTileSpriteRect(tileIndex);
      ctx.drawImage(
        tileset,
        rect.sx, rect.sy, rect.sw, rect.sh,
        px, py, tileSize, tileSize
      );
    }
  }
}
