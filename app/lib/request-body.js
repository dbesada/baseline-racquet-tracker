// Request body helpers for the tracker API.

// Reads a JSON request body that must be a plain object.
//
// `request.json()` throws on an empty or malformed body, and a well-formed body
// can still be `null`, an array or a number. All of those return null so the
// handler can answer 400 instead of failing with a 500.
export async function readJsonObject(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  return body !== null && typeof body === "object" && !Array.isArray(body) ? body : null;
}

// True when `key` is one of the object's own keys.
//
// The `in` operator also accepts inherited names such as "toString" or
// "constructor", which would let those through as model keys.
export function isOwnKey(object, key) {
  return typeof key === "string" && Object.hasOwn(object, key);
}
