import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnterScreen from './EnterScreen';

// EnterScreen's one behaviour that matters is the button: it must be reachable
// by an accessible name and fire onEnter. The `hidden` prop drives the fade-out.
describe('EnterScreen', () => {
  it('renders the accessible "Step Inside" button', () => {
    render(<EnterScreen hidden={false} onEnter={() => {}} />);

    expect(
      screen.getByRole('button', { name: /step inside/i }),
    ).toBeInTheDocument();
  });

  it('calls onEnter when the button is clicked', async () => {
    const onEnter = vi.fn();
    render(<EnterScreen hidden={false} onEnter={onEnter} />);

    await userEvent.click(
      screen.getByRole('button', { name: /step inside/i }),
    );

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('omits the "hide" class while visible', () => {
    const { container } = render(<EnterScreen hidden={false} onEnter={() => {}} />);

    expect(container.querySelector('#enterScreen')).not.toHaveClass('hide');
  });

  it('applies the "hide" class when hidden is true', () => {
    const { container } = render(<EnterScreen hidden onEnter={() => {}} />);

    expect(container.querySelector('#enterScreen')).toHaveClass('hide');
  });
});
