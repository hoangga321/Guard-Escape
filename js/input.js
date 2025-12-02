// Keyboard input handling

var keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  shift: false,
  space: false,
  f: false,
  e: false,     // 🔹 phím E để hack
  num1: false,
  num2: false,
  num3: false,
  num4: false,
  esc: false
};

var _inputEnabled = true;

function clearKeys() {
  for (var k in keys) {
    if (Object.prototype.hasOwnProperty.call(keys, k)) {
      keys[k] = false;
    }
  }
}

function setInputEnabled(enabled) {
  _inputEnabled = !!enabled;
  if (!_inputEnabled) {
    clearKeys();
  }
}

function isInputEnabled() {
  return _inputEnabled;
}

(function setupKeyboard() {
  window.addEventListener("keydown", function (e) {
    if (!_inputEnabled) return;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        keys.up = true;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        keys.down = true;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        keys.left = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        keys.right = true;
        break;
      case "Shift":
        keys.shift = true;
        break;
      case " ":
        keys.space = true;
        break;
      case "f":
      case "F":
        keys.f = true;
        break;
      case "e":
      case "E":
        keys.e = true;
        break;
      case "1":
        keys.num1 = true;
        break;
      case "2":
        keys.num2 = true;
        break;
      case "3":
        keys.num3 = true;
        break;
      case "4":
        keys.num4 = true;
        break;
      case "Escape":
        keys.esc = true;
        break;
      default:
        break;
    }
  });

  window.addEventListener("keyup", function (e) {
    if (!_inputEnabled) return;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        keys.up = false;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        keys.down = false;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        keys.left = false;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        keys.right = false;
        break;
      case "Shift":
        keys.shift = false;
        break;
      case " ":
        keys.space = false;
        break;
      case "f":
      case "F":
        keys.f = false;
        break;
      case "e":
      case "E":
        keys.e = false;
        break;
      case "1":
        keys.num1 = false;
        break;
      case "2":
        keys.num2 = false;
        break;
      case "3":
        keys.num3 = false;
        break;
      case "4":
        keys.num4 = false;
        break;
      case "Escape":
        keys.esc = false;
        break;
      default:
        break;
    }
  });
})();
