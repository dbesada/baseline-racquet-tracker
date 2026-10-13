// Finds racquets by name as the visitor types. Every word typed has to match
// the start of a word in the racquet's name or brand ("pure aero 98",
// "blade v9", "ezone"), and digits may run into letters ("98l" ≈ "98 l").

function words(value = "") {
  return String(value).toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// models: [{ key, name, brand, price }]. Returns the best matches first:
// names that start with the search, then the rest, in stock before out of
// stock, then by name.
export function searchRacquets(query, models, limit = 8) {
  const terms = words(query);
  if (!terms.length) return [];
  const scored = [];
  for (const model of models) {
    const nameWords = words(model.name);
    const allWords = [...nameWords, ...words(model.brand)];
    if (!terms.every((term) => allWords.some((word) => word.startsWith(term)))) continue;
    const startsName = terms.every((term, index) => nameWords[index]?.startsWith(term))
      || terms.every((term, index) => nameWords[index + 1]?.startsWith(term));
    scored.push({ model, rank: startsName ? 0 : 1 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank
      || Number(b.model.price != null) - Number(a.model.price != null)
      || a.model.name.localeCompare(b.model.name, "en-CA"))
    .slice(0, limit)
    .map(({ model }) => model);
}
