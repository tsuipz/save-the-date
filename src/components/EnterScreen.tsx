interface Props {
  /** When true, applies the `.hide` class so the panel fades/scales out. */
  hidden: boolean;
  /** Fired when the user clicks the button — App starts the zoom→reveal flow. */
  onEnter: () => void;
}

/** Screen 1 — frosted panel with the pulsing ring + "Step Inside". */
export default function EnterScreen({ hidden, onEnter }: Props) {
  return (
    <div id="enterScreen" className={hidden ? 'hide' : undefined}>
      <div className="inner">
        <div className="eover">A Love Story Begins</div>
        <button
          id="ebtn"
          type="button"
          onClick={onEnter}
          aria-label="Step inside and reveal the save the date"
        >
          <div className="ring">
            <span className="flower" aria-hidden="true">
              🌸
            </span>
          </div>
          <span className="elbl">Step Inside</span>
        </button>
      </div>
    </div>
  );
}
