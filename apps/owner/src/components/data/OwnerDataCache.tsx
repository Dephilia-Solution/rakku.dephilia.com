"use client";

import { QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const Context = createContext<QueryClient | null>(null);
export function useOwnerDataCache() { return useContext(Context); }

export default function OwnerDataCache({ children }: { children: ReactNode }) {
  // A mounted authenticated shell owns the cache. Nothing is persisted to disk.
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
