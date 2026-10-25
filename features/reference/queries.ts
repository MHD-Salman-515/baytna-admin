"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { City, Country, LocalizedText, Service } from "@/lib/api/types";

// Reference data changes rarely; cache it for the whole session.
const REFERENCE = { staleTime: Infinity, gcTime: Infinity } as const;

export const referenceKeys = {
  countries: ["countries"] as const,
  cities: (countryId: string) => ["cities", countryId] as const,
  services: ["services"] as const,
};

export function useCountries() {
  return useQuery({
    queryKey: referenceKeys.countries,
    queryFn: ({ signal }) => api.get<Country[]>("/countries", { auth: false, signal }),
    ...REFERENCE,
  });
}

/** id → name for every country, active or not. */
export function useCountryNames(): Map<string, LocalizedText> {
  const { data } = useCountries();
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

/**
 * id → name for cities in every active country. /cities requires a
 * countryId, so this issues one (cached) request per country.
 */
export function useCityNames(): Map<string, LocalizedText> {
  const { data: countries } = useCountries();
  const results = useQueries({
    queries: (countries ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({
        queryKey: referenceKeys.cities(c.id),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.get<City[]>("/cities", { auth: false, query: { countryId: c.id }, signal }),
        ...REFERENCE,
      })),
  });
  const map = new Map<string, LocalizedText>();
  for (const r of results) for (const city of r.data ?? []) map.set(city.id, city.name);
  return map;
}

export function useServiceNames(): Map<string, LocalizedText> {
  const { data } = useQuery({
    queryKey: referenceKeys.services,
    queryFn: ({ signal }) => api.get<Service[]>("/services", { auth: false, signal }),
    ...REFERENCE,
  });
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}
