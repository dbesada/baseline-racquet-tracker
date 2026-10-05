import type { StringGroup } from "./baseline-types";
import { money } from "./baseline-catalogue";

const racquetGuideEntries = [
  ["Head size", "The size of the hitting area.", "97–98 in² rewards clean contact and precision; 100 in² is the versatile middle; 102+ in² gives a larger margin for error and easier depth."],
  ["Unstrung weight", "How heavy the frame is before strings and an overgrip.", "Lighter frames are easier to accelerate; 300–305 g suits many intermediate players; 310 g+ adds stability but asks more of your timing and strength."],
  ["Balance", "Where the mass sits along the frame.", "Head-light feels faster at net and on quick changes; head-heavy can add plow-through and easy depth. Compare it with weight, not alone."],
  ["Swingweight", "How heavy the racquet feels while swinging.", "A higher swingweight is steadier against pace and can add ball weight; a lower number is easier to whip and recover. This often matters more than static weight."],
  ["Stiffness / RA", "How much the frame resists bending on impact.", "Lower RA generally feels softer with more flex; higher RA tends to feel crisper and more direct. String choice, tension and sample variation also change comfort."],
  ["String pattern", "The number of main and cross strings.", "16 × 19 is a familiar open, all-court pattern; 16 × 20 is slightly tighter; 18 × 20 is denser for a more controlled, connected response."],
  ["Beam width", "The thickness of the frame.", "A thinner beam often emphasizes feel and control; a wider beam usually brings more inherent power. The layup and stiffness still matter."],
  ["Length", "Most adult racquets are 27 in.", "Extended lengths can offer reach and leverage, but may feel less maneuverable. Standard length is the easiest baseline for comparison."],
  ["Grip size", "The circumference of the handle.", "Choose the grip you can hold relaxed without the handle shifting. Baseline filters each listing by the grip size shown by the retailer—availability is separate from frame fit."],
  ["Colour & style", "An honest part of choosing a racquet.", "Use the bold, understated and iconic style cues to narrow a big catalogue. They use verified colours, model names and editions where available; they never override a safety or fit concern."],
];

const stringGuideEntries = [
  ["Polyester / monofilament", "Durable, controlled and spin-friendly.", "Usually best for players who swing fast and break strings. It can feel firmer, so it is rarely the first choice for a tender arm or a newer player."],
  ["Multifilament", "Soft, elastic and power-friendly.", "A strong default for comfort and easy depth. It loses durability sooner than polyester but is often kinder to the arm."],
  ["Natural gut", "Premium comfort, feel and tension stability.", "Exceptionally elastic and lively, but expensive and more sensitive to moisture. Often used alone or in a hybrid."],
  ["Synthetic gut", "Simple, balanced and usually affordable.", "A practical starting point when you want a neutral response without committing to a very soft multi or firm poly."],
  ["Hybrid", "Two strings working together.", "Commonly polyester in the mains for control and a softer string in the crosses for feel. The mains influence the overall feel the most."],
  ["Gauge", "The thickness of the string.", "A lower gauge number is thicker: generally more durable and firmer. A higher number is thinner: generally more feel, bite and comfort, with less durability."],
  ["Tension", "How tightly the string is installed.", "Lower tension generally adds pocketing, comfort and easy depth; higher tension generally feels firmer and more controlled. Stay within the racquet’s printed range."],
  ["When to restring", "Broken strings are not the only signal.", "Strings lose resilience before they break. Regular players often restring about as many times per year as they play per week; treat that as a starting point, not a rule."],
];

export function RacquetGuide() {
  return (
    <section className="racquet-guide" aria-label="Racquet specification guide">
      <p className="guide-intro">Use this as a translation layer for the comparison tool. Specifications describe tendencies—not guarantees—and the right combination matters more than any one number.</p>
      <div className="guide-grid">
        {racquetGuideEntries.map(([title, definition, translation]) => <article className="guide-card" key={title}><span>SPEC</span><h3>{title}</h3><strong>{definition}</strong><p>{translation}</p></article>)}
      </div>
      <p className="guide-note">Manufacturer specifications are Baseline’s primary record and matching Canadian retailer listings provide a secondary check. Strung weight, balance, swingweight and RA can vary by setup, sample and generation.</p>
    </section>
  );
}

export function StringGuide({ examples }: { examples: StringGroup[] }) {
  return (
    <section className="racquet-guide string-guide" aria-label="Tennis string selection guide">
      <div className="guide-section-heading"><span>STRING TRANSLATOR</span><h3>What to put in the frame.</h3><p>Start with comfort and playing frequency, then refine feel, durability and spin. The same string can play very differently at another tension or in another racquet.</p></div>
      <div className="guide-grid">
        {stringGuideEntries.map(([title, definition, translation]) => <article className="guide-card string-guide-card" key={title}><span>STRING</span><h3>{title}</h3><strong>{definition}</strong><p>{translation}</p></article>)}
      </div>
      <section className="string-guide-examples" aria-labelledby="string-guide-examples-title"><div className="guide-section-heading"><span>LIVE CANADIAN EXAMPLES</span><h3 id="string-guide-examples-title">Examples from the current market.</h3><p>These examples refresh with the catalogue. Package format matters: a set, half set and reel are not interchangeable prices.</p></div><div className="string-guide-example-grid">{examples.map((group) => <a href={group.bestOffer.url} target="_blank" rel="noreferrer" key={group.key}><span>{group.type} · {group.format}</span><strong>{group.title}</strong><small>{group.gauges.join(", ") || "Gauge not listed"} · {group.bestOffer.store}</small><b>{money.format(group.bestOffer.currentPrice ?? 0)} ↗</b></a>)}</div></section>
      <details className="string-guide-advanced"><summary><span><b>Advanced string lab</b><small>Construction, gauge, tension, hybrids and maintenance</small></span><i aria-hidden="true">+</i></summary><div className="string-guide-advanced-body"><section><h3>Construction & shape</h3><p>Round polyester tends to slide and snap back consistently; shaped or textured polyester can increase friction on the ball, but it may also notch sooner. Multis and gut use many filaments for elasticity; their comfort comes with less resistance to frequent string breakers.</p></section><section><h3>Gauge & durability</h3><p>Lower gauge numbers are thicker. For example, 16 gauge generally lasts longer than 17 gauge, while 17 gauge can offer more bite and feel. A thicker string is not automatically better if it makes the response too firm for your arm.</p></section><section><h3>Tension & response</h3><p>Lower tension usually increases pocketing, launch and comfort; higher tension usually tightens the response and reduces launch. Change only a small amount at once—about 1–2 lb—so you can feel the difference. Always stay within the racquet&apos;s recommended range.</p></section><section><h3>Hybrid logic</h3><p>Mains usually dominate the feel because they move most. Poly mains plus multi or gut crosses is a common control/comfort hybrid. Softer mains with poly crosses can preserve more feel while adding directional control.</p></section><section><h3>Weather & maintenance</h3><p>Heat, cold and long periods in a car can accelerate tension loss. Cut a broken string bed out promptly to reduce uneven stress on the frame. If strings feel dead or harsh before breaking, it is reasonable to restring rather than wait for failure.</p></section></div></details>
      <p className="guide-note">For a sore arm, avoid escalating to a full polyester setup simply for durability. If pain persists, stop playing and speak with a qualified professional.</p>
      <aside className="stringer-recommendation"><span>LOCAL STRINGER RECOMMENDATION</span><h3>Your Local ATP/WTA Tour Stringer</h3><p>Get your racquets strung by an ATP/WTA Tour Stringer who just strung at this year&apos;s National Bank Open, right here in Mississauga/Oakville.</p><p>Plus, an unbeatable 30-minute turnaround. Located at Erin Mills and Dundas.</p><a href="https://www.gaostringinglab.com/" target="_blank" rel="noreferrer">Learn about Richard Gao&apos;s stringing services ↗</a></aside>
    </section>
  );
}
