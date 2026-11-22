// Two plain ratings worked out from published specs: how high the ball leaves
// the strings ("launch") and how forgiving the racquet is ("ease of use").
// Each is null when a value it needs is unknown, so nothing is guessed. The
// same launch model draws the ball's flight in the launch simulator.

const number = (value) => Number.parseFloat(value ?? "");

// "16 × 19" -> { mains: 16, crosses: 19 }, or null.
export function stringPattern(value) {
  const match = /^\s*(\d{2})\s*[x×/]\s*(\d{2})\s*$/i.exec(value ?? "");
  if (!match) return null;
  const mains = Number(match[1]);
  const crosses = Number(match[2]);
  return mains >= 12 && mains <= 20 && crosses >= 14 && crosses <= 22 ? { mains, crosses } : null;
}

// Fewer strings move more and send the ball out higher. Degrees relative to
// a 16 × 19.5 string bed.
function patternLift(pattern) {
  return (16 - pattern.mains) * 0.9 + (19.5 - pattern.crosses) * 0.8;
}

export const referenceTension = 54;

// The angle (degrees) the ball leaves the strings on a level, medium-paced
// swing. A teaching model, not a measurement: an open pattern, a bigger head
// and lower tension each raise it.
export function launchAngle({ pattern, head, tension = referenceTension }) {
  return 8.8 + patternLift(pattern) + (head - 100) * 0.14 + (referenceTension - tension) * 0.09;
}

function launchRating(spec) {
  const head = number(spec?.head);
  const pattern = stringPattern(spec?.pattern);
  if (!pattern || !Number.isFinite(head) || head < 80 || head > 140) return null;
  const angle = launchAngle({ pattern, head });
  const level = angle >= 9.15 ? "high" : angle >= 8 ? "medium" : "low";
  const label = level === "high" ? "High launch" : level === "medium" ? "Medium launch" : "Low launch";
  const detail = level === "high" ? "the ball clears the net easily, even on a short swing"
    : level === "medium" ? "a balance of net clearance and control"
    : "flatter and more precise, but you lift the ball yourself";
  return { level, label, detail };
}

function easeRating(spec) {
  const head = number(spec?.head);
  const weight = number(spec?.weight);
  if (!Number.isFinite(head) || !Number.isFinite(weight) || head < 80 || head > 140 || weight < 200 || weight > 380) return null;
  const pattern = stringPattern(spec?.pattern);
  const score = (head >= 102 ? 2 : head >= 100 ? 1 : head >= 99 ? 0 : head > 95 ? -1 : -2)
    + (weight <= 285 ? 2 : weight <= 300 ? 1 : weight < 305 ? 0 : weight < 315 ? -1 : -2)
    + (pattern && pattern.mains >= 18 ? -1 : 0);
  const level = score >= 3 ? "easy" : score <= -1 ? "demanding" : "moderate";
  const label = level === "easy" ? "Easy to use" : level === "moderate" ? "Moderate to use" : "Demanding to use";
  const detail = level === "easy" ? "forgives off-centre hits and late swings"
    : level === "moderate" ? "rewards a steady, repeatable swing"
    : "needs clean contact and a full, fast swing";
  return { level, label, detail };
}

export function playRatings(spec) {
  return { launch: launchRating(spec), ease: easeRating(spec) };
}

// Court and ball, in metres.
export const court = { length: 23.77, net: 11.885, netHeight: 0.914, contactHeight: 1 };

// Flies one ball from the baseline with air drag and a typical amount of
// topspin. Returns the path and where it ends up.
export function simulateShot({ pattern, head, tension = referenceTension, speedKmh }) {
  const angle = launchAngle({ pattern, head, tension });
  const speed = (speedKmh / 3.6) * (1 + (head - 100) * 0.004 + (referenceTension - tension) * 0.003);
  const radians = (angle * Math.PI) / 180;
  const step = 0.004;
  let x = 0;
  let y = court.contactHeight;
  let vx = speed * Math.cos(radians);
  let vy = speed * Math.sin(radians);
  let heightAtNet = null;
  const path = [[x, y]];
  for (let tick = 0; tick < 5000; tick += 1) {
    const pace = Math.hypot(vx, vy);
    const ax = -0.02 * pace * vx + 0.006 * pace * vy;
    const ay = -9.81 - 0.02 * pace * vy - 0.006 * pace * vx;
    const before = x;
    vx += ax * step;
    vy += ay * step;
    x += vx * step;
    y += vy * step;
    if (before < court.net && x >= court.net) {
      heightAtNet = y;
      if (y < court.netHeight) {
        path.push([court.net, Math.max(y, 0)]);
        return { angle, path, heightAtNet, outcome: "net", landing: court.net };
      }
    }
    if (y <= 0) {
      path.push([x, 0]);
      const outcome = heightAtNet === null ? "net" : x > court.length ? "long" : "in";
      return { angle, path, heightAtNet, outcome, landing: x };
    }
    if (tick % 4 === 0) path.push([x, y]);
  }
  return { angle, path, heightAtNet, outcome: "long", landing: x };
}
