// Global configuration for "Neon Heist: Guard Escape"

var GAME_WIDTH = 1280;
var GAME_HEIGHT = 720;

var TILE_SIZE = 32;

// Player movement
var PLAYER_SPEED_WALK = 140; // pixels per second
var PLAYER_SPEED_RUN = 220;

// Guard movement
var GUARD_SPEED = 110;

// Stealth / alert
var ALERT_LEVEL_DECAY = 0.2; // per second
var ALERT_LEVEL_INCREASE = 0.5;

// Level listings (placeholder; will match /levels JSON later)
var LEVELS = [
  { id: 1, name: "Lobby Infiltration", file: "./levels/level1.json" },
  { id: 2, name: "Security Office", file: "./levels/level2.json" },
  { id: 3, name: "Server Room", file: "./levels/level3.json" },
  { id: 4, name: "Research Lab", file: "./levels/level4.json" },
  { id: 5, name: "Vault Heist", file: "./levels/level5.json" },
  { id: 6, name: "Escape Route", file: "./levels/level6.json" }
];
