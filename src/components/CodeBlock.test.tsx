import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  const mockCode = `import { Button } from '@ui/button';

export const Example = () => <Button>Click me</Button>;`;

  it('should render code with syntax highlighting', () => {
    render(<CodeBlock code={mockCode} language="typescript" />);
    expect(screen.getByText(/import/)).toBeInTheDocument();
    // Multiple instances of "Button" are expected in the rendered code
    expect(screen.getAllByText(/Button/).length).toBeGreaterThan(0);
  });

  it('should show copy button', () => {
    render(<CodeBlock code={mockCode} language="typescript" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should copy code to clipboard on button click', async () => {
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CodeBlock code={mockCode} language="typescript" />);
    const copyButton = screen.getByRole('button', { name: /copy/i });
    
    fireEvent.click(copyButton);
    
    expect(mockWriteText).toHaveBeenCalledWith(mockCode);
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it('should display filename if provided', () => {
    render(<CodeBlock code={mockCode} language="typescript" filename="example.tsx" />);
    expect(screen.getByText('example.tsx')).toBeInTheDocument();
  });

  it('should show language badge when no filename', () => {
    render(<CodeBlock code={mockCode} language="typescript" />);
    expect(screen.getByText(/typescript/i)).toBeInTheDocument();
  });

});
