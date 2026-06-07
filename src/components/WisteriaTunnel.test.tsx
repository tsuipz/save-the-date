import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import WisteriaTunnel from './WisteriaTunnel';

// WisteriaTunnel has no logic — it renders one <canvas> and forwards a ref.
// The ref-forwarding is its actual contract: useWisteriaTunnel attaches the 2D
// drawing context through it, so if it isn't wired the whole animation breaks.
// The id and aria-hidden are guarded too, since the CSS (#c) and a11y depend on them.
describe('WisteriaTunnel', () => {
  it('forwards canvasRef to the underlying canvas element', () => {
    const ref = createRef<HTMLCanvasElement>();

    render(<WisteriaTunnel canvasRef={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
  });

  it('renders a canvas with id "c" (the selector the fullscreen CSS targets)', () => {
    const ref = createRef<HTMLCanvasElement>();

    const { container } = render(<WisteriaTunnel canvasRef={ref} />);

    expect(container.querySelector('canvas')).toHaveAttribute('id', 'c');
  });

  it('marks the decorative canvas aria-hidden', () => {
    const ref = createRef<HTMLCanvasElement>();

    const { container } = render(<WisteriaTunnel canvasRef={ref} />);

    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
  });
});
