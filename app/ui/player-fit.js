// A rough "who does this racquet suit" line, worked out from published head
// size and unstrung weight only. Returns null when either value is unknown,
// so nothing is guessed.
export function playerFit(spec) {
  const head = Number.parseFloat(spec?.head ?? "");
  const weight = Number.parseFloat(spec?.weight ?? "");
  if (!Number.isFinite(head) || !Number.isFinite(weight) || head < 80 || head > 140 || weight < 200 || weight > 380) return null;

  const level = (head >= 102 && weight <= 300) || (head >= 100 && weight <= 285) ? "beginner"
    : (head <= 98 && weight >= 305) || weight >= 315 ? "advanced"
    : "intermediate";

  const reasons = [
    head >= 102 ? "big sweet spot" : head <= 98 ? "smaller, precise head" : "mid-size head",
    weight <= 285 ? "light to swing" : weight >= 310 ? "heavy and stable" : "medium weight",
  ];

  const label = level === "beginner" ? "Good for beginners"
    : level === "advanced" ? "Good for experienced players"
    : "Good for improving players";

  return { level, label, reasons };
}
