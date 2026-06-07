import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RevealCard from './RevealCard';

// RevealCard is the payload of the page — the names, the date, and the RSVP
// link are the facts guests act on, so they are what we assert. Tests go
// through the rendered output (public API), not internal structure.
describe('RevealCard', () => {
  it('renders both names and the wedding date', () => {
    render(<RevealCard show />);

    expect(screen.getByText('Patrick Tsui')).toBeInTheDocument();
    expect(screen.getByText('Shelley Shen')).toBeInTheDocument();
    expect(screen.getByText('May 29, 2027')).toBeInTheDocument();
  });

  it('renders the RSVP link pointing at the Google Form, opening safely in a new tab', () => {
    render(<RevealCard show />);

    const rsvp = screen.getByRole('link', { name: /rsvp/i });
    expect(rsvp).toHaveAttribute('href', 'https://forms.gle/onSKUD2gxz59Ybmw5');
    expect(rsvp).toHaveAttribute('target', '_blank');
    // rel must include noopener to prevent the new tab from accessing window.opener.
    expect(rsvp).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('applies the "show" class when show is true', () => {
    const { container } = render(<RevealCard show />);

    expect(container.querySelector('#revealScreen')).toHaveClass('show');
  });

  it('omits the "show" class when show is false (card stays hidden)', () => {
    const { container } = render(<RevealCard show={false} />);

    expect(container.querySelector('#revealScreen')).not.toHaveClass('show');
  });
});
