import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

// The canvas hook can't run in jsdom and isn't App's responsibility — App owns
// the phase/timing state machine. We own the hook, so we replace it with a
// fake that records triggerZoom() calls and lets us assert App's behaviour.
const { triggerZoom } = vi.hoisted(() => ({ triggerZoom: vi.fn() }));
vi.mock('./hooks/useWisteriaTunnel', () => ({
  useWisteriaTunnel: () => ({ canvasRef: { current: null }, triggerZoom }),
}));

import App from './App';

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const enterButton = () =>
  screen.queryByRole('button', { name: /step inside/i });
const revealShown = () =>
  document.querySelector('#revealScreen')?.classList.contains('show') ?? false;

describe('App phase state machine', () => {
  beforeEach(() => {
    triggerZoom.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the enter screen and hides the reveal on first render', () => {
    setReducedMotion(false);
    render(<App />);

    expect(enterButton()).toBeInTheDocument();
    expect(revealShown()).toBe(false);
  });

  it('reveals immediately without zooming, then unmounts the enter screen, when reduced motion is preferred', () => {
    setReducedMotion(true);
    vi.useFakeTimers();
    render(<App />);

    act(() => {
      fireEvent.click(enterButton()!);
    });

    // Reveal is shown straight away and the canvas fly-through is skipped.
    expect(revealShown()).toBe(true);
    expect(triggerZoom).not.toHaveBeenCalled();
    expect(enterButton()).toBeInTheDocument();

    // The enter screen still unmounts (after the short 1500ms cleanup timer).
    act(() => vi.advanceTimersByTime(1500));
    expect(enterButton()).not.toBeInTheDocument();
  });

  it('delays the reveal, fires the zoom at 150ms, reveals at 3900ms, then unmounts the enter screen', () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    render(<App />);

    act(() => {
      fireEvent.click(enterButton()!);
    });
    // Nothing fires synchronously on click.
    expect(triggerZoom).not.toHaveBeenCalled();
    expect(revealShown()).toBe(false);

    // 150ms → zoom starts.
    act(() => vi.advanceTimersByTime(150));
    expect(triggerZoom).toHaveBeenCalledTimes(1);
    expect(revealShown()).toBe(false);

    // 3900ms → reveal fades in; enter screen still mounted.
    act(() => vi.advanceTimersByTime(3900 - 150));
    expect(revealShown()).toBe(true);
    expect(enterButton()).toBeInTheDocument();

    // 5900ms total → enter screen unmounts.
    act(() => vi.advanceTimersByTime(2000));
    expect(enterButton()).not.toBeInTheDocument();
  });

  it('ignores a second Enter click so the flow only runs once', () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    render(<App />);

    const btn = enterButton()!;
    act(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    act(() => vi.advanceTimersByTime(150));

    expect(triggerZoom).toHaveBeenCalledTimes(1);
  });
});
