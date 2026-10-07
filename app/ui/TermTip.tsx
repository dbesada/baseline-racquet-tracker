"use client";

import { useId } from "react";
import { glossary } from "./glossary";

export type GlossaryTerm = keyof typeof glossary;

// Wraps a term (a spec, a badge, a label) so a tap explains it in plain
// English. Uses the browser's popover, so the tip sits above everything and
// closes on Escape or a tap elsewhere.
export function TermTip({ term, children, className = "" }: { term: GlossaryTerm; children: React.ReactNode; className?: string }) {
  const id = `tip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const entry: { title: string; text: string; more?: string } = glossary[term];
  return <>
    <button type="button" className={`term-tip ${className}`} popoverTarget={id} data-analytics="term_tip" data-analytics-detail={term}>
      {children}<span className="visually-hidden"> — what does this mean?</span>
    </button>
    <span id={id} popover="auto" className="term-tip-card" role="note">
      <strong>{entry.title}</strong>
      <span>{entry.text}</span>
      {entry.more && <span>{entry.more}</span>}
      <button type="button" popoverTarget={id} popoverTargetAction="hide">Got it</button>
    </span>
  </>;
}

// A small "?" button that explains a term sitting next to it.
export function TermHelp({ term, label }: { term: GlossaryTerm; label: string }) {
  return <TermTip term={term} className="term-help"><span aria-hidden="true">?</span><span className="visually-hidden">{label}</span></TermTip>;
}
