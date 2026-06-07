import type { RefObject } from 'react';

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/** The full-screen <canvas> the wisteria tunnel is rendered into. */
export default function WisteriaTunnel({ canvasRef }: Props) {
  return <canvas id="c" ref={canvasRef} aria-hidden="true" />;
}
