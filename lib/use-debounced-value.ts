"use client";

import { useEffect, useState } from "react";

/**
 * Delays a rapidly changing value (typically a search field) so server-side
 * queries are sent only after the member has stopped typing.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [value, delay]);

  return debouncedValue;
}
