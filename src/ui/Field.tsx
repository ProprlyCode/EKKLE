import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Form field primitives. Inputs sit slightly inset (canvas fill inside cream
 * cards) so "type here" reads without heavy borders. Dedicated control tokens,
 * visible focus ring, and helper/error slots so every field has its states.
 */

const controlBase =
  'w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage ' +
  'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-sage/40 focus-visible:border-sage/40 ' +
  'disabled:opacity-50';

interface FieldWrapProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldWrap({ label, htmlFor, hint, error, children }: FieldWrapProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-muted-strong">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-sage/80">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, hint, error, id, className, ...props }, ref) {
    const generated = useId();
    const fieldId = id ?? generated;
    return (
      <FieldWrap label={label} htmlFor={fieldId} hint={hint} error={error}>
        <input
          ref={ref}
          id={fieldId}
          className={cn(controlBase, className)}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </FieldWrap>
    );
  },
);

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, hint, error, id, className, ...props }, ref) {
    const generated = useId();
    const fieldId = id ?? generated;
    return (
      <FieldWrap label={label} htmlFor={fieldId} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(controlBase, 'resize-none leading-relaxed', className)}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </FieldWrap>
    );
  },
);
