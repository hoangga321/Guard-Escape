// Simple state manager for Guard Escape

var StateManager = {
  current: "game", // "intro" | "game"
  params: {}
};

StateManager.init = function () {
  this.current = "game";
  this.params = {};
};

StateManager.setState = function (name, params) {
  this.current = name;
  this.params = params || {};
};

// Cập nhật logic game (player + guards + stealth)
StateManager.update = function (dt, context) {
  // Chỉ update gameplay khi đang ở state "game"
  if (this.current !== "game") return;
  if (!context) return;

  var level = context.level;
  var player = context.player;
  var guards = context.guards || [];

  if (player && level) {
    player.update(dt, level);
  }

  for (var i = 0; i < guards.length; i++) {
    if (guards[i] && guards[i].update) {
      guards[i].update(dt, level);
    }
  }

  if (typeof Stealth !== "undefined" && typeof Stealth.update === "function") {
    Stealth.update(guards, player, level, dt);
  }
};

// Vẽ game (dùng chung cho cả intro & game)
// Camera sẽ do Renderer xử lý theo mode
StateManager.render = function (ctx, context) {
  if (!context) return;
  Renderer.renderGame(context.level, context.player, context.guards);
};
