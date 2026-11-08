export interface DemoFacet {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: string;
  version: string;
  auth: "API key" | "Bearer" | "None";
  status: "Draft" | "Published";
  method: "GET" | "POST";
}

export const demoFacets: readonly DemoFacet[] = [
  {
    id: "fct_local_01",
    name: "Avalanche token snapshot",
    description:
      "Returns a normalized market and contract metadata snapshot for one token address.",
    provider: "Northstar Labs",
    category: "Blockchain data",
    version: "0.1.0",
    auth: "Bearer",
    status: "Published",
    method: "POST",
  },
  {
    id: "fct_local_02",
    name: "Weather forecast lookup",
    description:
      "Retrieves a compact forecast for a coordinate pair from an external HTTP API.",
    provider: "FACET examples",
    category: "Data retrieval",
    version: "0.1.0",
    auth: "API key",
    status: "Draft",
    method: "GET",
  },
] as const;
