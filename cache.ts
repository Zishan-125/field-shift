import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * Offline-first state: hydrates from AsyncStorage instantly (so the app is usable with no
 * signal in the field) and writes every change back. Swap the initial value for a
 * background sync once the API exists — the cached copy stays the source of truth offline.
 */
export function useCachedState<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`terrashift:${key}`)
      .then((raw) => { if (raw) setValue(JSON.parse(raw) as T); })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, [key]);

  const update = (v: T) => {
    setValue(v);
    AsyncStorage.setItem(`terrashift:${key}`, JSON.stringify(v)).catch(() => {});
  };
  return [value, update, hydrated];
}
