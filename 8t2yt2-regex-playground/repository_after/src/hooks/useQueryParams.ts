import { useState } from "react";

const useQueryParams = () => {
  const [state, setState] = useState({
    pattern: "",
    flags: "",
    key: "",
    matches: [""],
  });

  const updateState = (next: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...next }));
  };

  return [state, updateState] as const;
};

export default useQueryParams;
