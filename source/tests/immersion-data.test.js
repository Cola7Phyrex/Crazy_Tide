import test from "node:test";
import assert from "node:assert/strict";
import {
  ELF_QUEEN_DECLARATION,
  ELF_QUEEN_DECLARATION_TITLE,
  INNISTRAD_REVELATION_NODES,
  OPENING_NARRATIVE,
  resolveNarrativeEntry,
} from "../src/data/immersion-data.js";

test("对外测试版开局提供六段无剧透系统指引", () => {
  assert.equal(OPENING_NARRATIVE.length, 6);
  const prototypeGuide = resolveNarrativeEntry(OPENING_NARRATIVE[1], {
    landName: "海岛",
  });
  assert.match(prototypeGuide.body, /原体/);
  assert.match(OPENING_NARRATIVE[2].body, /征服或渗透/);
  assert.match(OPENING_NARRATIVE[3].body, /生物因子/);
  assert.match(OPENING_NARRATIVE[4].body, /神器、法术和结界/);
  assert.match(OPENING_NARRATIVE[5].body, /离线期间/);
  assert.doesNotMatch(
    OPENING_NARRATIVE.map((entry) => `${entry.title}${entry.body}`).join(""),
    /\{\{LAND_NAME\}\}/,
  );
});

test("妖精女皇宣战与依尼翠五段真相线保持完整", () => {
  assert.equal(ELF_QUEEN_DECLARATION.length, 4);
  assert.equal(
    ELF_QUEEN_DECLARATION_TITLE,
    "王冠向无名僭越者宣战",
  );
  assert.ok(
    ELF_QUEEN_DECLARATION.some((paragraph) => paragraph.includes("蚊蚋")),
  );
  assert.match(ELF_QUEEN_DECLARATION[0], /无名的僭越者/);
  assert.doesNotMatch(
    ELF_QUEEN_DECLARATION.join(""),
    /亚空间|高维|封印|裂隙|投影|本体|囚徒|牢笼/,
  );
  assert.equal(INNISTRAD_REVELATION_NODES.length, 5);
  assert.equal(
    new Set(INNISTRAD_REVELATION_NODES.map((node) => node.id)).size,
    5,
  );
  assert.match(
    INNISTRAD_REVELATION_NODES.at(-1).body,
    /狱窖/,
  );
});
