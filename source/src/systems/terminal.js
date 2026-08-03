const COMMAND_ALIASES = new Map([
  ["帮助", "HELP"],
  ["help", "HELP"],
  ["?", "HELP"],
  ["基地", "BASE"],
  ["base", "BASE"],
  ["记录", "LOGS"],
  ["日志", "LOGS"],
  ["logs", "LOGS"],
  ["建造", "BUILD"],
  ["build", "BUILD"],
  ["远征", "EXPEDITION"],
  ["expedition", "EXPEDITION"],
  ["侦查", "RECON"],
  ["recon", "RECON"],
  ["征服", "CONQUEST"],
  ["conquest", "CONQUEST"],
  ["渗透", "INFILTRATION"],
  ["infiltration", "INFILTRATION"],
  ["交谈", "TALK"],
  ["talk", "TALK"],
]);

export function parseTerminalInput(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (!input) return { kind: "EMPTY" };

  const normalized = input.startsWith("／")
    ? `/${input.slice(1)}`
    : input;
  if (!normalized.startsWith("/")) {
    return { kind: "SHOUT", text: input };
  }

  const commandText = normalized.slice(1).trim();
  if (!commandText) {
    return { kind: "UNKNOWN_COMMAND", rawCommand: "" };
  }
  const [rawCommand, ...argumentParts] = commandText.split(/\s+/);
  const command = COMMAND_ALIASES.get(rawCommand.toLowerCase());
  if (!command) {
    return {
      kind: "UNKNOWN_COMMAND",
      rawCommand,
    };
  }

  return {
    kind: "COMMAND",
    command,
    argument: argumentParts.join(" ").trim(),
  };
}

export function findTerritoryByName(territories, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const namesFor = (territory) => [
    territory.name,
    territory.shortName,
    ...(territory.aliases ?? []),
  ]
    .filter(Boolean)
    .map((name) => name.toLowerCase());
  return (
    territories.find(
      (territory) =>
        territory.id.toLowerCase() === normalized ||
        namesFor(territory).includes(normalized),
    ) ??
    territories.find(
      (territory) => namesFor(territory).some((name) => name.includes(normalized)),
    ) ??
    null
  );
}
