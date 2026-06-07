import { useEffect, useRef, useState } from 'react';
import WisteriaTunnel from './components/WisteriaTunnel';
import FallingPetals from './components/FallingPetals';
import EnterScreen from './components/EnterScreen';
import RevealCard from './components/RevealCard';
import { useWisteriaTunnel } from './hooks/useWisteriaTunnel';

// Timing ported from the prototype's enterForest():
//   150ms  → start the canvas zoom
//   2600ms → fade in the reveal card
//   +2000ms after that → unmount the (already faded) enter screen
const ZOOM_DELAY = 150;
const REVEAL_DELAY = 2600;
const ENTER_UNMOUNT_DELAY = REVEAL_DELAY + 2000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const { canvasRef, triggerZoom } = useWisteriaTunnel();

  const [enterHidden, setEnterHidden] = useState(false);
  const [enterMounted, setEnterMounted] = useState(true);
  const [showReveal, setShowReveal] = useState(false);

  const entered = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // Same array object is mutated via push(), so this captures all timers.
    const scheduled = timers.current;
    return () => scheduled.forEach(clearTimeout);
  }, []);

  const handleEnter = () => {
    if (entered.current) return;
    entered.current = true;
    setEnterHidden(true);

    // Accessibility: skip the fly-through entirely for reduced-motion users
    // and reveal the card straight away.
    if (prefersReducedMotion()) {
      setShowReveal(true);
      timers.current.push(window.setTimeout(() => setEnterMounted(false), 1500));
      return;
    }

    timers.current.push(window.setTimeout(triggerZoom, ZOOM_DELAY));
    timers.current.push(
      window.setTimeout(() => setShowReveal(true), REVEAL_DELAY),
    );
    timers.current.push(
      window.setTimeout(() => setEnterMounted(false), ENTER_UNMOUNT_DELAY),
    );
  };

  return (
    <>
      <WisteriaTunnel canvasRef={canvasRef} />
      <FallingPetals />
      <RevealCard show={showReveal} />
      {enterMounted && <EnterScreen hidden={enterHidden} onEnter={handleEnter} />}
    </>
  );
}
