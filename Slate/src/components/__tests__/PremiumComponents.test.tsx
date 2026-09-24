import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from '../CommandPalette';
import { FloatingActionButton } from '../FloatingActionButton';

describe('Premium Components Test Suite', () => {
  it('renders CommandPalette when open', () => {
    const handleClose = vi.fn();
    const handleSetTab = vi.fn();

    render(
      <CommandPalette 
        isOpen={true} 
        onClose={handleClose} 
        setCurrentTab={handleSetTab} 
      />
    );

    expect(screen.getByPlaceholderText(/type a command or search anything/i)).toBeDefined();
    expect(screen.getByText('Slate Spotlight')).toBeDefined();
  });

  it('does not render CommandPalette when closed', () => {
    const handleClose = vi.fn();
    const handleSetTab = vi.fn();

    const { container } = render(
      <CommandPalette 
        isOpen={false} 
        onClose={handleClose} 
        setCurrentTab={handleSetTab} 
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders FloatingActionButton without crashing', () => {
    const handleSetTab = vi.fn();

    const { container } = render(
      <FloatingActionButton 
        currentTab="calendar" 
        setCurrentTab={handleSetTab} 
      />
    );

    expect(container.querySelector('button[aria-label="Create Action"]')).toBeDefined();
  });
});
