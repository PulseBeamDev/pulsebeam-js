import { useCallback, useEffect, useState } from "react";

export function useSyncURLWithState(
  paramName: string,
  initialState: string,
): [string, (newValue: string) => void] {
  // Read initial state from URL on mount
  const searchParams = new URLSearchParams(window.location.search);
  const initialValueFromURL = searchParams.get(paramName);
  if (initialValueFromURL !== null) {
    initialState = initialValueFromURL;
  }
  const [state, setState] = useState<string>(initialState);

  useEffect(() => {
    // Listen for changes in the URL (e.g., back/forward button)
    const handlePopstate = () => {
      const newSearchParams = new URLSearchParams(window.location.search);
      const newValueFromURL = newSearchParams.get(paramName);
      if (newValueFromURL !== null) {
        setState(newValueFromURL);
      } else if (initialState !== undefined) {
        setState(initialState);
      } else {
        setState(""); // Or your desired default if no initial state
      }
    };

    window.addEventListener("popstate", handlePopstate);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [paramName, initialState]);

  const updateState = useCallback((newValue: string) => {
    setState(newValue);
    const searchParams = new URLSearchParams(window.location.search);
    if (newValue) {
      searchParams.set(paramName, newValue);
    } else {
      searchParams.delete(paramName); // Remove if value is empty
    }
    const newURL =
      `${window.location.pathname}?${searchParams.toString()}${window.location.hash}`;
    window.history.pushState(null, "", newURL);
  }, [paramName]);

  return [state, updateState];
}
