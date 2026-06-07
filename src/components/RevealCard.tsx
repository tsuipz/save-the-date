interface Props {
  /**
   * When true, adds the `.show` class. The CSS then fades the card in and
   * runs the staggered per-line reveal via the `.d1`…`.d7` transition delays.
   */
  show: boolean;
}

// The RSVP Google Form. Change this one constant to point the button elsewhere.
// Opened in a new tab with rel="noopener" so the form can't access window.opener.
const FORM_URL = 'https://forms.gle/onSKUD2gxz59Ybmw5';

/**
 * Screen 2 — the reveal card. Lines fade in staggered (.r.dN) once `show`
 * is set. The final line (.d7) is an RSVP button linking to the Google Form.
 */
export default function RevealCard({ show }: Props) {
  return (
    <div id="revealScreen" className={show ? 'show' : undefined}>
      <div className="card">
        <div className="cbg" />
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
