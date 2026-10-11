"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Discovery = {
  query: string;
  city: string;
  specialty: string | null;
  setQuery: (q: string) => void;
  setCity: (c: string) => void;
  setSpecialty: (s: string | null) => void;
};

const Ctx = createContext<Discovery | null>(null);

/** Shared search state: the hero search drives the dentist results below. */
export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [specialty, setSpecialty] = useState<string | null>(null);
  return <Ctx value={{ query, city, specialty, setQuery, setCity, setSpecialty }}>{children}</Ctx>;
}

export function useDiscovery() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDiscovery outside DiscoveryProvider");
  return v;
}
