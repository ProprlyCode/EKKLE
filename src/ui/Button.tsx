import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button — the church-side primary control.
 * Flat (no shadow), sage as the scarce accent. Press feedback via scale, visible
 * focus ring, real disabled state. Variants:
 *  - primary: sage fill, the one action per view
 *  - quiet:   transparent, sage text — secondary actions
 *  - ghost:   muted text, for tertiary/inline
 */
type Variant = 'primary' | 'quiet' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium ' +
  'transition-[transform,background-color,color] duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ' +
  'motion-reduce:active:scale-100 motion-reduce:transition-none';

const variants: Record<Variant, string> = {
  primary: 'bg-sage text-canvas hover:bg-sage-soft',
  quiet: 'bg-transparent text-sage hover:bg-sage/5',
  ghost: 'bg-transparent text-muted-strong hover:text-sage hover:bg-sage/5',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});
