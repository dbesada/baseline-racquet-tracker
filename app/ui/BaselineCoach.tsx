"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { modelFitTags, modelReason, recommendModels, recommendStrings, stringFitTags, stringReason } from "./coach-recommender";
import { AffiliateNote } from "./AffiliateNote";
import { outboundRel } from "./baseline-catalogue";

export type CoachModel = {
  key: string;
  name: string;
  brand: string;
  head?: string;
  weight?: string;
  pattern?: string;
  profile?: string;
  color?: string;
  price: number;
  store: string;
  url: string;
};

export type CoachString = {
  key: string;
  title: string;
  brand: string;
  type: string;
  gauges: string[];
  format: string;
  price: number;
  store: string;
  url: string;
};

type Focus = "racquets" | "strings" | "complete";
type Level = "new" | "intermediate" | "advanced";
type Priority = "comfort" | "power" | "spin" | "control" | "balanced";
type ArmComfort = "tender" | "fine";
type StringFormatPreference = "set" | "half-set" | "reel" | "any";
type AestheticPreference = "bold" | "understated" | "iconic" | "any";
type CoachAnswers = {
  focus?: Focus;
  level?: Level;
  priority?: Priority;
  arm?: ArmComfort;
  stringFormat?: StringFormatPreference;
  budget?: string;
  brand?: string;
  aesthetic?: AestheticPreference;
};

type Question = {
  key: keyof CoachAnswers;
  prompt: string;
  note: string;
  options: Array<{ value: string; label: string; detail: string }>;
};

type BaselineCoachProps = {
  models: CoachModel[];
  strings: CoachString[];
  gripLabel: string;
  raised?: boolean;
  onCompare: (modelKeys: string[]) => void;
  /** The parent owns whether the coach is open, so other buttons can open it too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when someone answers the last question (for aggregate analytics). */
  onComplete?: (focus: string) => void;
  affiliateLinksOn?: boolean;
};

const profileKey = "baseline-coach-profile-v2";
const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });

function answerLabel(question: Question, value?: string) {
  return question.options.find((option) => option.value === value)?.label ?? value ?? "";
}

function questionsFor(answers: CoachAnswers): Question[] {
  const common: Question[] = [
    {
      key: "focus", prompt: "What are we choosing today?", note: "I’ll use the current Canadian catalogue.",
      options: [
        { value: "racquets", label: "A racquet", detail: "Find three frames that fit" },
        { value: "strings", label: "Strings", detail: "Choose type, gauge and package" },
        { value: "complete", label: "A complete setup", detail: "Match a frame and strings" },
      ],
    },
    {
      key: "level", prompt: "How would you describe your game?", note: "No ranking required—just the closest fit.",
      options: [
        { value: "new", label: "New or recreational", detail: "Easy depth and forgiveness" },
        { value: "intermediate", label: "Intermediate", detail: "A blend of help and control" },
        { value: "advanced", label: "Advanced", detail: "Precision, stability and feedback" },
      ],
    },
    {
      key: "priority", prompt: "What do you want more of?", note: "Pick the quality you notice most on court.",
      options: [
        { value: "comfort", label: "Comfort", detail: "Softer and easier on the arm" },
        { value: "power", label: "Power", detail: "More depth with less effort" },
        { value: "spin", label: "Spin", detail: "Shape and net clearance" },
        { value: "control", label: "Control", detail: "Placement and predictability" },
        { value: "balanced", label: "A balanced setup", detail: "A bit of everything" },
      ],
    },
    {
      key: "arm", prompt: "How is your arm feeling?", note: "This changes the string recommendation quite a bit.",
      options: [
        { value: "tender", label: "Sensitive or tender", detail: "Prioritize softer materials" },
        { value: "fine", label: "No arm concerns", detail: "Keep the full range open" },
      ],
    },
  ];

  const formatQuestion: Question = {
    key: "stringFormat", prompt: "How much string do you need?", note: "Sets suit one restring; half sets are for hybrids; reels suit frequent stringing.",
    options: [
      { value: "set", label: "Full set", detail: "Enough for one complete string job" },
      { value: "half-set", label: "Half set", detail: "One side of a hybrid setup" },
      { value: "reel", label: "Reel", detail: "Best for frequent restringing" },
      { value: "any", label: "No preference", detail: "Choose by feel and value" },
    ],
  };

  if (answers.focus === "strings") {
    return [...common, formatQuestion, {
      key: "budget", prompt: "What should the selected string format cost?", note: "The budget applies to the full set, half set, reel, or package you selected.",
      options: [
        { value: "20", label: "Under $20", detail: "Value-first options" },
        { value: "35", label: "Under $35", detail: "The widest practical range" },
        { value: "any", label: "Best match", detail: "Fit matters more than price" },
      ],
    }];
  }

  const racquetQuestions: Question[] = [
    {
      key: "budget", prompt: "What is your racquet budget?", note: "Prices are current Canadian in-stock prices.",
      options: [
        { value: "200", label: "Under $200", detail: "Prioritize sale and value frames" },
        { value: "300", label: "Under $300", detail: "Include most performance frames" },
        { value: "any", label: "Best match", detail: "Fit matters more than price" },
      ],
    },
    {
      key: "brand", prompt: "Any brand preference?", note: "I’ll prioritize that brand, then rank its different racquet families by fit.",
      options: [
        { value: "any", label: "No preference", detail: "Show the strongest matches" },
        { value: "Wilson", label: "Wilson", detail: "Blade, Clash, Defyer and more" },
        { value: "Yonex", label: "Yonex", detail: "EZONE, VCORE and Percept" },
        { value: "Babolat", label: "Babolat", detail: "Pure Aero, Drive and Strike" },
        { value: "Head", label: "Head", detail: "Speed, Gravity, Radical and more" },
        { value: "Tecnifibre", label: "Tecnifibre", detail: "TF40, T-Fight and TFX1" },
      ],
    },
    {
      key: "aesthetic", prompt: "How should it feel off-court?", note: "Style is personal, so this only changes the ranking when you want it to.",
      options: [
        { value: "any", label: "Performance first", detail: "Keep the look neutral in the ranking" },
        { value: "bold", label: "Bold and expressive", detail: "Prioritize vivid, energetic and distinctive frames" },
        { value: "understated", label: "Clean and understated", detail: "Prioritize quieter, timeless-looking frames" },
        { value: "iconic", label: "Classic and iconic", detail: "Prioritize heritage, tour-inspired and signature lines" },
      ],
    },
  ];
  return answers.focus === "complete" ? [...common, formatQuestion, ...racquetQuestions] : [...common, ...racquetQuestions];
}

export function BaselineCoach({ models, strings, gripLabel, raised = false, onCompare, open, onOpenChange, onComplete, affiliateLinksOn = false }: BaselineCoachProps) {
  const setOpen = onOpenChange;
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<CoachAnswers>({});
  const [savedProfile, setSavedProfile] = useState<CoachAnswers | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const questions = useMemo(() => questionsFor(answers), [answers]);
  const modelPicks = useMemo<CoachModel[]>(() => recommendModels(models, answers), [answers, models]);
  const stringPicks = useMemo<CoachString[]>(() => recommendStrings(strings, answers), [answers, strings]);
  const answerSummary = questions
    .filter((question) => question.key !== "focus" && answers[question.key])
    .map((question) => answerLabel(question, answers[question.key]));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(profileKey);
      // Local storage is browser-only: reading it after hydration keeps the
      // first render identical to the server's.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSavedProfile(JSON.parse(saved) as CoachAnswers);
    } catch {
      // A blocked or malformed local profile should never stop the coach.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, setOpen]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [completed, step]);

  const choose = (question: Question, value: string) => {
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (step >= questions.length - 1) {
      setCompleted(true);
      onComplete?.(next.focus ?? "complete");
      setSavedProfile(next);
      try { window.localStorage.setItem(profileKey, JSON.stringify(next)); } catch { /* local saving is optional */ }
    } else {
      setStep((current) => current + 1);
    }
  };

  const startFresh = () => {
    setAnswers({});
    setStep(0);
    setStarted(true);
    setCompleted(false);
  };

  const useSavedProfile = () => {
    if (!savedProfile) return;
    setAnswers(savedProfile);
    setStarted(true);
    setCompleted(true);
  };

  const comparePicks = () => {
    onCompare(modelPicks.map((model) => model.key));
    setOpen(false);
  };

  const currentQuestion = questions[step];
  const showModels = completed && answers.focus !== "strings";
  const showStrings = completed && answers.focus !== "racquets";

  return (
    <>
      <button className={`coach-launch ${raised ? "raised" : ""}`} onClick={() => setOpen(true)} aria-label="Open Baseline Coach">
        <span className="coach-launch-ball" aria-hidden="true">B</span>
        <span className="coach-launch-label"><b>Need help choosing?</b><small>Ask Baseline Coach</small></span>
        <span className="coach-launch-short" aria-hidden="true">Help me choose</span>
      </button>

      {open && (
        <div className="coach-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="coach-panel" role="dialog" aria-modal="true" aria-labelledby="coach-title">
            <header className="coach-head">
              <div><span><i /> CATALOGUE-POWERED</span><h2 id="coach-title">Baseline Coach</h2></div>
              <button onClick={() => setOpen(false)} aria-label="Close Baseline Coach">×</button>
            </header>

            <div className="coach-transcript" ref={transcriptRef} aria-live="polite">
              {!started ? (
                <div className="coach-intro">
                  <div className="coach-orbit" aria-hidden="true"><span>B</span></div>
                  <p className="coach-speaker">BASELINE COACH</p>
                  <h3>Let’s find a setup that makes sense for your game.</h3>
                  <p>I’ll ask a few quick questions, then match your answers to live Canadian racquet and string listings.</p>
                  <button className="coach-primary" onClick={startFresh}>Start my fit <span>→</span></button>
                  {savedProfile && <button className="coach-secondary" onClick={useSavedProfile}>Use my saved fit</button>}
                  <small>Your completed fit stays on this device.</small>
                </div>
              ) : completed ? (
                <div className="coach-results">
                  <div className="coach-result-intro">
                    <p className="coach-speaker">YOUR BASELINE FIT</p>
                    <h3>{answers.priority === "balanced" ? "Balanced and adaptable." : `${answerLabel(questions.find((question) => question.key === "priority")!, answers.priority)} comes first.`}</h3>
                  <p>These rankings use every choice below, verified specs, current Canadian availability and price. Style only influences the list when you asked for it.</p>
                    <div className="coach-answer-summary" aria-label="Answers used for this fit">{answerSummary.map((answer) => <span key={answer}>{answer}</span>)}</div>
                  </div>
                  <AffiliateNote show={affiliateLinksOn} />

                  {showModels && (
                    <section className="coach-result-section" aria-labelledby="coach-racquet-picks">
                      <div className="coach-result-heading"><h4 id="coach-racquet-picks">Racquet picks</h4><span>{gripLabel}</span></div>
                      <div className="coach-picks">
                        {modelPicks.map((model, index) => (
                          <article className="coach-pick" key={model.key}>
                            <span className="coach-pick-rank">0{index + 1}</span>
                            <div><small>{model.brand} · {model.head ?? "Specs verified"}</small><h5>{model.name}</h5><div className="coach-fit-tags">{modelFitTags(model, answers).map((tag: string) => <span key={tag}>{tag}</span>)}</div><p>{modelReason(model, answers)}</p></div>
                            <div className="coach-pick-deal"><span><b>{cad.format(model.price)}</b><small>{model.store}</small></span><a href={model.url} target="_blank" rel={outboundRel}>View price ↗</a></div>
                          </article>
                        ))}
                      </div>
                      {modelPicks.length >= 2 && <button className="coach-compare" onClick={comparePicks}>Compare these {modelPicks.length} racquets</button>}
                    </section>
                  )}

                  {showStrings && (
                    <section className="coach-result-section" aria-labelledby="coach-string-picks">
                      <div className="coach-result-heading"><h4 id="coach-string-picks">String picks</h4><span>Sets & packages</span></div>
                      <div className="coach-picks">
                        {stringPicks.map((item, index) => (
                          <article className="coach-pick coach-string-pick" key={item.key}>
                            <span className="coach-pick-rank">0{index + 1}</span>
                            <div><small>{item.brand} · {item.type} · {item.format}</small><h5>{item.title}</h5><div className="coach-fit-tags">{stringFitTags(item, answers).map((tag: string) => <span key={tag}>{tag}</span>)}</div><p>{stringReason(item, answers)}</p></div>
                            <div className="coach-pick-deal"><span><b>{cad.format(item.price)}</b><small>{item.store}</small></span><a href={item.url} target="_blank" rel={outboundRel}>View price ↗</a></div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  <p className="coach-caution">Comfort guidance is general equipment advice, not medical advice. If pain persists, stop playing and speak with a qualified professional.</p>
                  <button className="coach-secondary coach-start-over" onClick={startFresh}>Start over</button>
                </div>
              ) : (
                <div className="coach-questions">
                  <div className="coach-message coach-message-assistant"><span>B</span><p>Great. A few quick choices and I’ll narrow the whole market down for you.</p></div>
                  {questions.slice(0, step).map((question) => (
                    <div className="coach-history" key={question.key}>
                      <div className="coach-message coach-message-assistant"><span>B</span><p>{question.prompt}</p></div>
                      <div className="coach-message coach-message-user"><p>{answerLabel(question, answers[question.key])}</p></div>
                    </div>
                  ))}
                  {currentQuestion && (
                    <div className="coach-current-question">
                      <div className="coach-message coach-message-assistant"><span>B</span><div><p>{currentQuestion.prompt}</p><small>{currentQuestion.note}</small></div></div>
                      <div className="coach-options">
                        {currentQuestion.options.map((option) => (
                          <button key={option.value} onClick={() => choose(currentQuestion, option.value)}>
                            <span>{option.label}</span><small>{option.detail}</small><i aria-hidden="true">→</i>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
