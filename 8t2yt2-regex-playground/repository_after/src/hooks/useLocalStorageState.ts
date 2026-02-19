import { useCallback, useEffect, useState } from "react";

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    return fallback;
  }
};

const useLocalStorageState = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    const stored = safeParse<T>(window.localStorage.getItem(key), initialValue);
    setState(stored);
  }, [key, initialValue]);

  const updateState = useCallback(
    (value: T) => {
      setState(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    [key],
  );

  return [state, updateState];
};

export default useLocalStorageState;
