import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/core/game-engine.js";

class MemoryStorage {
  constructor() {
    this.state = null;
    this.settings = {};
  }

  load() {
    return this.state;
  }

  save(state) {
    this.state = structuredClone(state);
  }

  loadSettings() {
    return structuredClone(this.settings);
  }

  saveSettings(settings) {
    this.settings = structuredClone(settings);
  }
}

test("法术力显示默认使用正常符号并可切换为字母", () => {
  const storage = new MemoryStorage();
  const engine = new GameEngine(storage, () => 1000);
  engine.startNewGame("ORIGIN_W", "LAND_PLAINS");

  assert.equal(engine.state.settings.manaDisplayMode, "SYMBOL");
  engine.setManaDisplayMode("LETTER");
  assert.equal(engine.state.settings.manaDisplayMode, "LETTER");
  assert.equal(storage.settings.manaDisplayMode, "LETTER");
  assert.equal(storage.state.settings.manaDisplayMode, "LETTER");

  engine.setManaDisplayMode("SYMBOL");
  assert.equal(engine.state.settings.manaDisplayMode, "SYMBOL");
  assert.throws(
    () => engine.setManaDisplayMode("LIGHT"),
    /法术力显示模式无效/,
  );
});

test("界面配色默认使用封印终端并独立持久化", () => {
  const storage = new MemoryStorage();
  const engine = new GameEngine(storage, () => 1000);
  engine.startNewGame("ORIGIN_W", "LAND_PLAINS");

  assert.equal(engine.state.settings.themeId, "SEAL_TERMINAL");
  engine.setThemeId("VOID_OBSERVATORY");
  assert.equal(engine.state.settings.themeId, "VOID_OBSERVATORY");
  assert.equal(storage.settings.themeId, "VOID_OBSERVATORY");
  assert.equal(storage.state.settings.themeId, "VOID_OBSERVATORY");
  assert.throws(() => engine.setThemeId("NEON_DAYLIGHT"), /界面配色无效/);
});

test("锁屏恢复与重新打开页面都会按离线时长推进渗透", () => {
  let now = 1000;
  const storage = new MemoryStorage();
  const engine = new GameEngine(storage, () => now);
  engine.startNewGame("ORIGIN_U", "LAND_ISLAND");
  engine.state.activeExpedition = {
    phase: "INFILTRATING",
    infiltration: { cycleRemainingMs: 10000 },
  };

  now = 5000;
  engine.settleAfterPause();
  assert.equal(
    engine.state.activeExpedition.infiltration.cycleRemainingMs,
    6000,
  );

  engine.persist(now);
  now = 9000;
  const reloaded = new GameEngine(storage, () => now);
  reloaded.load();
  assert.equal(
    reloaded.state.activeExpedition.infiltration.cycleRemainingMs,
    2000,
  );
});
