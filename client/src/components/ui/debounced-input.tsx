import React, { useState, useEffect } from 'react';
import { Input, InputProps } from '@/components/ui/input';

interface DebouncedInputProps extends Omit<InputProps, 'onChange'> {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
}

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 300,
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Only call onChange if value has changed from initialValue
      // This prevents firing on mount or when parent updates
      if (value !== initialValue) {
        onChange(value);
      }
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, initialValue, onChange]);

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
