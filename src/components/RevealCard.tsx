import { useEffect, useRef } from 'react';

interface Props {
  show: boolean;
}

// The RSVP Google Form. Change this one constant to point the button elsewhere.
// Opened in a new tab with rel="noopener" so the form can't access window.opener.
const FORM_URL = 'https://forms.gle/onSKUD2gxz59Ybmw5';

const MAX_BLUR = 38;
const BLUR_DURATION = 3000;

/**
 * Screen 2 — the reveal card. Lines fade in staggered (.r.dN) once `show`
 * is set. The final line (.d7) is an RSVP button linking to the Google Form.
 *
 * The .cbg frosted-glass blur is driven frame-by-frame via rAF rather than a
 * CSS transition because backdrop-filter transitions are unreliable on iOS
 * Safari and snap to the final value immediately.
 */
export default function RevealCard({ show }: Props) {
  const cbgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!show) return;
    const cbg = cbgRef.current;
    if (!cbg) return;

    const setBlur = (px: number) => {
      cbg.style.backdropFilter = `blur(${px}px)`;
      cbg.style.setProperty('-webkit-backdrop-filter', `blur(${px}px)`);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBlur(MAX_BLUR);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / BLUR_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setBlur(eased * MAX_BLUR);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [show]);

  return (
    <div id="revealScreen" className={show ? 'show' : undefined}>
      <div className="card">
        <div className="cbg" ref={cbgRef} />
        <span className="cdeco t" aria-hidden="true">
          ✦ ✦ ✦
        </span>

        <div className="r d1 lbl" style={{ marginBottom: 24 }}>
          Please Save the Date
        </div>
        <div className="r d2 names">
          <span className="name">Shelley Shen</span>
          <span className="amp">&amp;</span>
          <span className="name">Patrick Tsui</span>
        </div>
        <div className="r d3 divl" />
        <div className="r d4 lbl" style={{ marginBottom: 14 }}>
          Are Getting Married
        </div>
        <div className="r d5 date">May 29, 2027</div>
        <div className="r d6 sub">Formal invitation to follow</div>
        <a
          className="r d7 cal-btn"
          href={FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="RSVP — opens our Google form in a new tab"
        >
          RSVP
        </a>

        <span className="cdeco b" aria-hidden="true">
          ✦ ✦ ✦
        </span>
      </div>
    </div>
  );
}
