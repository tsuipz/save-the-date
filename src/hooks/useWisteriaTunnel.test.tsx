import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { useWisteriaTunnel } from './useWisteriaTunnel';

/**
 * Scope note: the per-frame canvas engine inside this hook cannot run in jsdom —
 * `canvas.getContext('2d')` returns null there, so the effect bails at its guard
 * and never builds the scene or starts the rAF loop. That's why the module is
 * excluded from coverage (see vitest.config.ts) and why the drawing + animation
 * lifecycle are verified in a real browser by the Playwright suite (e2e/app.spec.ts).
 *
 * These unit tests cover only what IS reachable and meaningful in jsdom: the
 * hook's public contract (the shape it returns and the stability of triggerZoom)
 * and its resilience guards (it must mount, run, and unmount without throwing in
 * an environment that has no 2D context — jsdom, SSR, very old browsers). They
 * deliberately do not assert anything about pixels; faking a CanvasRenderingContext2D
 * to do that would be a low-fidelity test of a type we don't own.
 */

describe('useWisteriaTunnel — public contract', () => {
  it('returns a canvasRef (a ref object, initially null) and a triggerZoom function', () => {
    const { result } = renderHook(() => useWisteriaTunnel());

    expect(result.current.canvasRef).toEqual({ current: null });
    expect(typeof result.current.triggerZoom).toBe('function');
  });

  it('keeps triggerZoom referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useWisteriaTunnel());
    const first = result.current.triggerZoom;

    rerender();

    // useCallback([]) — consumers (and React memoization) rely on a stable identity.
    expect(result.current.triggerZoom).toBe(first);
  });

  it('triggerZoom returns nothing and does not throw when called without a canvas', () => {
    const { result } = renderHook(() => useWisteriaTunnel());

    expect(() => result.current.triggerZoom()).not.toThrow();
    expect(result.current.triggerZoom()).toBeUndefined();
  });
});

// A minimal consumer that wires the hook up exactly as the real <WisteriaTunnel>
// component does: attach canvasRef to a real <canvas> and fire triggerZoom on click.
function Harness() {
  const { canvasRef, triggerZoom } = useWisteriaTunnel();
  return (
    <canvas data-testid="tunnel" ref={canvasRef} onClick={() => triggerZoom()} />
  );
}

describe('useWisteriaTunnel — resilience without a 2D context (jsdom / SSR)', () => {
  it('mounts cleanly when canvasRef is never attached (effect short-circuits)', () => {
    // No canvas attached → the effect hits `if (!canvas) return` and does nothing.
    expect(() => renderHook(() => useWisteriaTunnel())).not.toThrow();
  });

  it('mounts and unmounts cleanly with a real <canvas> attached but getContext returning null', () => {
    // jsdom's getContext('2d') is null, so the effect hits `if (!context) return`
    // before adding listeners or scheduling rAF. The guard must keep this a no-op
    // rather than throwing on a null context.
    const { unmount, getByTestId } = render(<Harness />);

    expect(getByTestId('tunnel')).toBeInstanceOf(HTMLCanvasElement);
    expect(() => unmount()).not.toThrow();
  });

  it('does not register window/document listeners when there is no 2D context', () => {
    // The resize + visibilitychange listeners live past the context guard, so in
    // a context-less environment none should be attached (and thus none leak).
    const addWin = vi.spyOn(window, 'addEventListener');
    const addDoc = vi.spyOn(document, 'addEventListener');

    render(<Harness />);

    expect(addWin).not.toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addDoc).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    addWin.mockRestore();
    addDoc.mockRestore();
  });
});
