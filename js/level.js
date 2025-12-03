// Level management

function Level(tiles, width, height, playerSpawn, exitRect) {
  this.tiles = tiles;
  this.width = width;
  this.height = height;
  this.playerSpawn = playerSpawn || { x: TILE_SIZE * 2, y: TILE_SIZE * 2 };
  this.exit = exitRect || null; // vùng EXIT
  this.guards = [];

  // vùng nhiệm vụ chính (máy console) - optional, có thể null
  // dạng: { x, y, width, height } (tính theo pixel)
  this.objective = null;

  // Các vùng phòng đặc biệt trong Stage 1 (phòng A/B/C/D + Lab)
  // Mỗi phòng là rect theo pixel: { x, y, width, height }
  this.rooms = null;          // { A, B, C, D, lab }
  this.loreRoom = null;       // phòng dùng để đặt monitor/log gợi ý
  this.mutantRoom = null;     // phòng chứa "mutant"
  this.fakeConsoleRoom = null;// phòng có thể đặt máy đánh lừa người chơi
  this.mutantSpawn = null;    // toạ độ spawn cho mutant (pixel)

  // Tiles đã được khám phá (dùng cho minimap / fog-of-war)
  // explored[y][x] = true nếu người chơi đã từng đi ngang vùng đó
  this.explored = [];
  for (var y = 0; y < height; y++) {
    var row = [];
    for (var x = 0; x < width; x++) {
      row.push(false);
    }
    this.explored.push(row);
  }
}

Level.prototype.isBlocked = function (x, y) {
  // x, y in pixels. Check if inside a wall tile.
  var tx = Math.floor(x / TILE_SIZE);
  var ty = Math.floor(y / TILE_SIZE);

  if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) {
    return true;
  }

  // Security doors (Stage 2): treat as blocking when active
  if (Array.isArray(this.securityDoors)) {
    for (var i = 0; i < this.securityDoors.length; i++) {
      var door = this.securityDoors[i];
      if (!door || door.active === false) continue;

      var dx = x;
      var dy = y;
      if (
        dx >= door.x &&
        dx <= door.x + door.width &&
        dy >= door.y &&
        dy <= door.y + door.height
      ) {
        return true;
      }
    }
  }

  return this.tiles[ty][tx] === 1;
};

// Player có đang đứng trong vùng EXIT không?
Level.prototype.isPlayerAtExit = function (player) {
  if (!this.exit || !player) return false;

  var ex = this.exit;

  var px1 = player.x - player.width / 2;
  var py1 = player.y - player.height / 2;
  var px2 = player.x + player.width / 2;
  var py2 = player.y + player.height / 2;

  var ex2 = ex.x + ex.width;
  var ey2 = ex.y + ex.height;

  var overlap =
    px2 > ex.x && px1 < ex2 &&
    py2 > ex.y && py1 < ey2;

  return overlap;
};

// Player đứng trong vùng nhiệm vụ (máy console) không?
Level.prototype.isPlayerAtObjective = function (player) {
  if (!this.objective || !player) return false;

  var oz = this.objective;

  var px1 = player.x - player.width / 2;
  var py1 = player.y - player.height / 2;
  var px2 = player.x + player.width / 2;
  var py2 = player.y + player.height / 2;

  var ox2 = oz.x + oz.width;
  var oy2 = oz.y + oz.height;

  var overlap =
    px2 > oz.x && px1 < ox2 &&
    py2 > oz.y && py1 < oy2;

  return overlap;
};

// Helper generic: kiểm tra player trong 1 rect bất kỳ
Level.prototype.isPlayerInRect = function (rect, player) {
  if (!rect || !player) return false;

  var px1 = player.x - player.width / 2;
  var py1 = player.y - player.height / 2;
  var px2 = player.x + player.width / 2;
  var py2 = player.y + player.height / 2;

  var rx2 = rect.x + rect.width;
  var ry2 = rect.y + rect.height;

  var overlap =
    px2 > rect.x && px1 < rx2 &&
    py2 > rect.y && py1 < ry2;

  return overlap;
};

function createTestLevel() {
  var width = 40;  // 40 * 32 = 1280
  var height = 22; // 22 * 32 = 704

  var tiles = [];
  for (var y = 0; y < height; y++) {
    var row = [];
    for (var x = 0; x < width; x++) {
      // border walls
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    tiles.push(row);
  }

  // ===== Helper: vẽ khung tường cho 1 phòng (rectangle) =====
  function addRoomRect(x1, y1, x2, y2) {
    var i;
    for (i = x1; i <= x2; i++) {
      tiles[y1][i] = 1;
      tiles[y2][i] = 1;
    }
    for (i = y1; i <= y2; i++) {
      tiles[i][x1] = 1;
      tiles[i][x2] = 1;
    }
  }

  // Helper: lấy rect "bên trong" phòng (bỏ viền tường)
  function roomInteriorRect(tileX1, tileY1, tileX2, tileY2) {
    var ix1 = tileX1 + 1;
    var iy1 = tileY1 + 1;
    var ix2 = tileX2 - 1;
    var iy2 = tileY2 - 1;

    return {
      x: ix1 * TILE_SIZE,
      y: iy1 * TILE_SIZE,
      width: (ix2 - ix1 + 1) * TILE_SIZE,
      height: (iy2 - iy1 + 1) * TILE_SIZE
    };
  }

  // ----- Phòng & lab -----
  // Room A (trên-trái)
  addRoomRect(2, 2, 10, 8);

  // Room B (dưới-trái)
  addRoomRect(2, 11, 10, 19);

  // Room C (trên-giữa)
  addRoomRect(14, 2, 22, 8);

  // Room D (dưới-giữa)
  addRoomRect(14, 11, 22, 19);

  // Lab (phòng bên phải, nơi đặt console chính)
  addRoomRect(26, 4, 37, 17);

  // ----- Cửa (door) nối phòng với hành lang -----
  // Room A cửa sang hành lang
  tiles[5][10] = 0;
  tiles[6][10] = 0; // widen to 2 tiles
  // Room B
  tiles[15][10] = 0;
  tiles[16][10] = 0;
  // Room C
  tiles[5][14] = 0;
  tiles[6][14] = 0;
  // Room D
  tiles[15][14] = 0;
  tiles[16][14] = 0;
  // Lab: cửa bên trái
  tiles[10][26] = 0;
  tiles[11][26] = 0;

  // ----- Vị trí spawn của player (phòng A) -----
  var playerSpawn = {
    x: TILE_SIZE * 5,
    y: TILE_SIZE * 5
  };

  // EXIT: vùng va chạm cho cửa thoát hiểm.
  // Cửa được gắn trên tường ngoài cùng bên phải,
  // nhưng vùng va chạm sẽ "nhô" vào hành lang 1 chút để player có thể chạm được.
  var exitTileX = width - 2; // tile hành lang sát tường phải

  var exitRect = {
    // đặt phần lớn hitbox trong hành lang, một phần lấn vào tường
    x: TILE_SIZE * exitTileX + TILE_SIZE * 0.25,
    y: TILE_SIZE * 9,
    width: TILE_SIZE * 1.4, // rộng hơn 1 tile một chút để nhô ra
    height: TILE_SIZE * 4
  };

  var level = new Level(tiles, width, height, playerSpawn, exitRect);

  // Vùng nhiệm vụ (console chính) đặt trong Lab (phòng bên phải)
  level.objective = {
    x: TILE_SIZE * 30,  // bên trong lab
    y: TILE_SIZE * 8,
    width: TILE_SIZE * 4,
    height: TILE_SIZE * 4
  };

  // ===== Định nghĩa rect cho các phòng (bên trong tường) =====
  var roomA = roomInteriorRect(2, 2, 10, 8);
  var roomB = roomInteriorRect(2, 11, 10, 19);
  var roomC = roomInteriorRect(14, 2, 22, 8);
  var roomD = roomInteriorRect(14, 11, 22, 19);
  var labRoom = roomInteriorRect(26, 4, 37, 17);

  level.rooms = {
    A: roomA,
    B: roomB,
    C: roomC,
    D: roomD,
    lab: labRoom
  };

  // Gán vai trò cho từng phòng:
  // - fakeConsoleRoom: phòng có thể đặt máy "giả"
  // - loreRoom: phòng gợi ý / log / camera
  // - mutantRoom: phòng có thí nghiệm thất bại (mutant)
  level.fakeConsoleRoom = roomA; // trên-trái
  level.loreRoom        = roomC; // trên-giữa
  level.mutantRoom      = labRoom; // mutant now lives in the console lab

  // Toạ độ spawn cho mutant trong mutantRoom (giữa phòng)
  level.mutantSpawn = {
    x: level.objective.x + level.objective.width / 2,
    y: level.objective.y + level.objective.height + TILE_SIZE
  };

  return level;
}

function createStage2Level() {
  var width = 40;   // 40 * 32 = 1280
  var height = 22;  // 22 * 32 = 704

  var tiles = [];
  for (var y = 0; y < height; y++) {
    var row = [];
    for (var x = 0; x < width; x++) {
      var value = 0;

      // ---- Outer border walls ----
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        value = 1;
      }

      // ---- Vertical divider walls between zones ----
      // Divider 1: between Zone A and Zone B at x = 12
      // Divider 2: between Zone B and Zone C at x = 24
      // We keep openings (doors) at specific y ranges.
      if (x === 12 || x === 24) {
        // Only place divider walls inside the outer border
        if (y > 0 && y < height - 1) {
          var isDoor = false;

          if (x === 12) {
            // Two doors between Zone A and Zone B
            // Door 1 around y = 6..8, Door 2 around y = 14..16
            if ((y >= 6 && y <= 8) || (y >= 14 && y <= 16)) {
              isDoor = true;
            }
          } else if (x === 24) {
            // One main corridor door between Zone B and Zone C
            // Door around y = 9..12
            if (y >= 9 && y <= 12) {
              isDoor = true;
            }
          }

          if (!isDoor) {
            value = 1;
          }
        }
      }

      // ---- Simple cover pillars / obstacles inside zones ----
      // Zone A small pillars
      if (x >= 4 && x <= 5 && y >= 5 && y <= 6) value = 1;
      if (x >= 4 && x <= 5 && y >= 15 && y <= 16) value = 1;

      // Zone B small cover columns
      if (x >= 16 && x <= 17 && y >= 4 && y <= 5) value = 1;
      if (x >= 18 && x <= 19 && y >= 12 && y <= 13) value = 1;

      // Zone C small cover blocks
      if (x >= 28 && x <= 29 && y >= 6 && y <= 7) value = 1;
      if (x >= 30 && x <= 31 && y >= 14 && y <= 15) value = 1;

      row.push(value);
    }
    tiles.push(row);
  }

  // Player spawn in Zone A (left side)
  var playerSpawn = {
    x: TILE_SIZE * 3 + TILE_SIZE / 2,
    y: TILE_SIZE * 11 + TILE_SIZE / 2
  };

  // Exit in Zone C (right side, middle)
  var exitRect = {
    x: TILE_SIZE * (width - 4),
    y: TILE_SIZE * (Math.floor(height / 2) - 2),
    width: TILE_SIZE * 2,
    height: TILE_SIZE * 4
  };

  var level = new Level(tiles, width, height, playerSpawn, exitRect);

  // Stage 2 visual theme and fog settings
  level.theme = "security";
  level.useFog = false;

  // No special console objective yet in Stage 2
  level.objective = null;

  // No guards or cameras are added here; they will be spawned in main_stage2.js
  level.guards = [];

  // Mark the whole map as explored so the minimap is fully visible
  level.explored = [];
  for (var yy = 0; yy < height; yy++) {
    var rowExplored = [];
    for (var xx = 0; xx < width; xx++) {
      rowExplored.push(true);
    }
    level.explored.push(rowExplored);
  }

  // Optional: rough zone rectangles for future logic (SRC, cameras, etc.)
  level.zoneA = {
    x: TILE_SIZE * 1,
    y: TILE_SIZE * 1,
    width: TILE_SIZE * (12 - 2),
    height: TILE_SIZE * (height - 2)
  };
  level.zoneB = {
    x: TILE_SIZE * 13,
    y: TILE_SIZE * 1,
    width: TILE_SIZE * (24 - 14),
    height: TILE_SIZE * (height - 2)
  };
  level.zoneC = {
    x: TILE_SIZE * 25,
    y: TILE_SIZE * 1,
    width: TILE_SIZE * (width - 26),
    height: TILE_SIZE * (height - 2)
  };

  // Door A: horizontal laser barrier in Zone B (security corridor).
  var doorA = {
    id: "doorA",
    x: 13 * TILE_SIZE,
    y: 13 * TILE_SIZE + TILE_SIZE * 0.2,
    width: (23 - 13 + 1) * TILE_SIZE,
    height: TILE_SIZE * 0.4,
    active: true
  };

  level.securityDoors = [doorA];

  // ===== Stage 2 machines (securityProps) =====
  // Each entry: { spriteKey, x, y, width, height } in pixels.
  // These positions should roughly match the consoles drawn on the Stage 2 map.
  level.securityProps = [
    {
      spriteKey: "s2_console_main",   // main routing console in Zone A
      x: TILE_SIZE * 3.5,
      y: TILE_SIZE * 5.5,
      width: TILE_SIZE * 3,
      height: TILE_SIZE * 3
    },
    {
      spriteKey: "s2_console_corridor", // hint console in the central corridor (Zone B)
      x: TILE_SIZE * 16,
      y: TILE_SIZE * 6,
      width: TILE_SIZE * 3,
      height: TILE_SIZE * 3
    },
    {
      spriteKey: "s2_console_exit",   // console near the EXIT in Zone C
      x: TILE_SIZE * 32,
      y: TILE_SIZE * 8,
      width: TILE_SIZE * 3,
      height: TILE_SIZE * 3
    }
  ];

  // ===== Stage 2 wall cameras =====
  // Each entry: { x, y, width, height } in pixels.
  // For now we only use them for drawing; detection logic will be added later.
  level.securityCameras = [
    {
      x: TILE_SIZE * 14,
      y: TILE_SIZE * 3,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      x: TILE_SIZE * 22,
      y: TILE_SIZE * 3,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    },
    {
      x: TILE_SIZE * 34,
      y: TILE_SIZE * 5,
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2
    }
  ];

  return level;
}

function createStage3Level() {
  // Bigger map for Stage 3: core facility
  var width = 64;   // 64 * 32 = 2048 px wide
  var height = 40;  // 40 * 32 = 1280 px high

  // ---- Initialize all tiles as floor (0) ----
  var tiles = [];
  for (var y = 0; y < height; y++) {
    var row = [];
    for (var x = 0; x < width; x++) {
      row.push(0); // floor
    }
    tiles.push(row);
  }

  // Helper: add a rectangle border of walls (tile = 1)
  function addWallRect(x1, y1, x2, y2) {
    var i;
    for (i = x1; i <= x2; i++) {
      tiles[y1][i] = 1;
      tiles[y2][i] = 1;
    }
    for (i = y1; i <= y2; i++) {
      tiles[i][x1] = 1;
      tiles[i][x2] = 1;
    }
  }

  // Helper: add a horizontal belt of walls with door gaps
  function addHorizontalBelt(y, x1, x2, doorRanges) {
    for (var x = x1; x <= x2; x++) {
      var isDoor = false;
      if (Array.isArray(doorRanges)) {
        for (var i = 0; i < doorRanges.length; i++) {
          var d = doorRanges[i]; // { from, to }
          if (x >= d.from && x <= d.to) {
            isDoor = true;
            break;
          }
        }
      }
      if (!isDoor) {
        tiles[y][x] = 1;
      }
    }
  }

  // ---- Outer border walls ----
  addWallRect(0, 0, width - 1, height - 1);

  // ---- Horizontal belts (maze layers) ----
  // Slightly inset from top/bottom to leave room for corridors.
  // y coordinates chosen so that spawn (x≈3,y≈17) always has a path.

  // Belt 1 (upper layer)
  addHorizontalBelt(
    7,         // y
    3, 60,     // x1, x2
    [
      { from: 6, to: 9 },   // left door
      { from: 26, to: 29 }, // mid door near future core entrance
      { from: 52, to: 55 }  // right door
    ]
  );

  // Belt 2 (mid-upper)
  addHorizontalBelt(
    13,
    3, 60,
    [
      { from: 6, to: 9 },
      { from: 20, to: 23 },
      { from: 40, to: 43 }
    ]
  );

  // Belt 3 (mid-lower)
  addHorizontalBelt(
    21,
    3, 60,
    [
      { from: 10, to: 13 },
      { from: 28, to: 31 }, // door into core ring
      { from: 48, to: 51 }
    ]
  );

  // Belt 4 (lower layer)
  addHorizontalBelt(
    29,
    3, 60,
    [
      { from: 6, to: 9 },
      { from: 34, to: 37 },
      { from: 52, to: 55 }
    ]
  );

  // ---- Central core room (rectangular) ----
  // This is the main objective area in the middle-right of the map.
  var coreX1 = 26;
  var coreY1 = 14;
  var coreX2 = 37;
  var coreY2 = 25;
  addWallRect(coreX1, coreY1, coreX2, coreY2);

  // Carve an entrance on the left side of the core room (door in the ring).
  // Keep a 1-tile gap at (coreX1, entranceY).
  var entranceY = 19;
  tiles[entranceY][coreX1] = 0;
  tiles[entranceY - 1][coreX1] = 0; // make the entrance 2 tiles high

  // Make sure there is a corridor leading to this door from the left:
  // clear a vertical line of floor tiles through the belts at x = coreX1 - 2.
  var corridorX = coreX1 - 2; // e.g. x=24
  for (var cy = 8; cy <= 28; cy++) {
    tiles[cy][corridorX] = 0;
  }

  // ---- EXIT placement (right side of map) ----
  // EXIT door is mounted near the right wall, roughly mid–height.
  var exitTileX = width - 3; // a bit inset from the border
  var exitTileY = 20;

  var playerSpawn = {
    // Initial spawn can be overridden by main_stage3.js,
    // but we still provide a reasonable default.
    x: TILE_SIZE * 3 + TILE_SIZE / 2,
    y: TILE_SIZE * 17 + TILE_SIZE / 2
  };

  var exitRect = {
    x: exitTileX * TILE_SIZE - TILE_SIZE * 0.4,
    y: (exitTileY - 2) * TILE_SIZE,
    width: TILE_SIZE * 1.4,
    height: TILE_SIZE * 4
  };

  var level = new Level(tiles, width, height, playerSpawn, exitRect);

  // Mark this as a core-type stage; main_stage3.js will set theme = "core".
  level.stageId = 3;

  // Define the core objective region as the interior of the core room.
  level.objective = {
    x: (coreX1 + 1) * TILE_SIZE,
    y: (coreY1 + 1) * TILE_SIZE,
    width: (coreX2 - coreX1 - 2) * TILE_SIZE,
    height: (coreY2 - coreY1 - 2) * TILE_SIZE
  };

  // By default, all tiles start unexplored (minimap/fog can handle this).
  // No guards are added here; they are spawned in main_stage3.js.

  return level;
}

Level.createStage3Level = createStage3Level;
