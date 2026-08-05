const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const projectRoot = path.resolve(__dirname, "..");
const fontPath = path.join(
  projectRoot,
  "src/assets/fonts/MagicSymbols2021.otf",
);
const outputDirectory = path.join(
  projectRoot,
  "src/assets/mana-symbols",
);
const glyphs = {
  W: 200,
  U: 201,
  B: 202,
  R: 203,
  G: 204,
  C: 207,
  WL: 210,
  UL: 211,
  BL: 212,
  RL: 213,
  GL: 214,
  CL: 215,
};

const font = fs.readFileSync(fontPath);
const tableCount = font.readUInt16BE(4);
let svgTableOffset = null;
for (let index = 0; index < tableCount; index += 1) {
  const recordOffset = 12 + index * 16;
  if (font.toString("ascii", recordOffset, recordOffset + 4) === "SVG ") {
    svgTableOffset = font.readUInt32BE(recordOffset + 8);
    break;
  }
}
if (svgTableOffset === null) {
  throw new Error("MagicSymbols2021.otf 不包含 SVG 字形表");
}

const indexStart =
  svgTableOffset + font.readUInt32BE(svgTableOffset + 2);
const entryCount = font.readUInt16BE(indexStart);
const entries = [];
for (let index = 0; index < entryCount; index += 1) {
  const entryOffset = indexStart + 2 + index * 12;
  entries.push({
    startGlyph: font.readUInt16BE(entryOffset),
    endGlyph: font.readUInt16BE(entryOffset + 2),
    documentOffset: font.readUInt32BE(entryOffset + 4),
    documentLength: font.readUInt32BE(entryOffset + 8),
  });
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [color, glyphId] of Object.entries(glyphs)) {
  const entry = entries.find(
    (candidate) =>
      glyphId >= candidate.startGlyph && glyphId <= candidate.endGlyph,
  );
  if (!entry) throw new Error(`找不到 ${color} 对应的字体字形`);

  let document = font.subarray(
    indexStart + entry.documentOffset,
    indexStart + entry.documentOffset + entry.documentLength,
  );
  if (document[0] === 0x1f && document[1] === 0x8b) {
    document = zlib.gunzipSync(document);
  }
  const svg = document
    .toString("utf8")
    .replace(
      "<svg ",
      '<svg viewBox="0 -800 875 1000" width="875" height="1000" ',
    );
  fs.writeFileSync(path.join(outputDirectory, `${color}.svg`), svg);
}
