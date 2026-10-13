"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { glossary } from "./glossary";

export type GlossaryTerm = keyof typeof glossary;

// Wraps a term (a spec, a badge, a label) so a tap explains it in plain
// English. The explanation opens over the page only after a tap, and closes
// with "Got it", Escape or a tap outside it. It does not rely on the
// browser's popover feature, which some browsers lack (they showed every
// explanation all the time).
export function TermTip({ term, children, className = "" }: { term: GlossaryTerm; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const entry: { title: string; text: string; more?: string } = glossary[term];

  useEffect(() => {
    if (!open) return;
    // Capture on the document so Escape closes only this explanation, not a
    // racquet pop-up that listens on the window underneath it.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [open]);

  return <>
    <button type="button" className={`term-tip ${className}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-analytics="term_tip" data-analytics-detail={term}>
      {children}<span className="visually-hidden"> — what does this mean?</span>
    </button>
    {open && createPortal(
      <div className="term-tip-layer" role="presentation" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="term-tip-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <strong id={titleId}>{entry.title}</strong>
          <span>{entry.text}</span>
          {entry.more && <span>{entry.more}</span>}
          <button type="button" autoFocus onClick={() => setOpen(false)}>Got it</button>
        </div>
      </div>,
      document.body,
    )}
  </>;
}

// A small "?" button that explains a term sitting next to it.
export function TermHelp({ term, label }: { term: GlossaryTerm; label: string }) {
  return <TermTip term={term} className="term-help"><span aria-hidden="true">?</span><span className="visually-hidden">{label}</span></TermTip>;
}
