import React, { useState, useEffect } from 'react';
import { Textarea, TextareaProps } from '@/components/ui/textarea';

interface DebouncedTextareaProps extends Omit<TextareaProps, 'onChange'> {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
}

export function DebouncedTextarea({
  value: initialValue,
  onChange,
  debounce = 300,
  ...props
}: DebouncedTextareaProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value !== initialValue) {
        onChange(value);
      }
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, initialValue, onChange]);

  return (
    <Textarea
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
