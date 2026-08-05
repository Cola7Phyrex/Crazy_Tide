import test from "node:test";
import assert from "node:assert/strict";
import {
  findTerritoryByName,
  parseTerminalInput,
} from "../src/systems/terminal.js";
import { TERRITORIES } from "../src/data/territory-data.js";

test("终端解析中文、英文和全角斜杠指令", () => {
  assert.deepEqual(parseTerminalInput("/建造"), {
    kind: "COMMAND",
    command: "BUILD",
    argument: "",
  });
  assert.deepEqual(parseTerminalInput("/recon 白色村庄"), {
    kind: "COMMAND",
    command: "RECON",
    argument: "白色村庄",
  });
  assert.deepEqual(parseTerminalInput("／帮助"), {
    kind: "COMMAND",
    command: "HELP",
    argument: "",
  });
  assert.deepEqual(parseTerminalInput("/交谈 Lilith 你是谁"), {
    kind: "COMMAND",
    command: "TALK",
    argument: "Lilith 你是谁",
  });
});

test("普通文本进入亚空间大喊，未知斜杠内容保持可辨识", () => {
  assert.deepEqual(parseTerminalInput("你们听得见吗"), {
    kind: "SHOUT",
    text: "你们听得见吗",
  });
  assert.deepEqual(parseTerminalInput("/毁灭宇宙"), {
    kind: "UNKNOWN_COMMAND",
    rawCommand: "毁灭宇宙",
  });
  assert.deepEqual(parseTerminalInput("   "), { kind: "EMPTY" });
});

test("终端可以用正式名和简称定位领土", () => {
  assert.equal(
    findTerritoryByName(TERRITORIES, "平原上的村庄")?.id,
    "TERRITORY_TUTORIAL_W",
  );
  assert.equal(
    findTerritoryByName(TERRITORIES, "白色教学村庄")?.id,
    "TERRITORY_TUTORIAL_W",
  );
  assert.equal(
    findTerritoryByName(TERRITORIES, "森林中的村庄")?.id,
    "TERRITORY_TUTORIAL_G",
  );
  assert.equal(
    findTerritoryByName(TERRITORIES, "绿色村庄")?.id,
    "TERRITORY_TUTORIAL_G",
  );
  assert.equal(
    findTerritoryByName(TERRITORIES, "加渥尼镇区")?.id,
    "TERRITORY_TOWN_WG",
  );
  assert.equal(findTerritoryByName(TERRITORIES, "不存在"), null);
});
