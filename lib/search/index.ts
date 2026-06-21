import { SearchResult } from "../types";
import { KeywordProvider } from "./keyword";

// ---------------------------------------------------------------------------
// Search abstraction.
//
// The app searches blog posts through a single `SearchProvider` interface, so
// the backend can evolve from simple keyword matching to richer retrieval
// without touching call sites (the /search page and the chat grounding both
// depend only on this interface).
//
// Today: KeywordProvider (SQLite FTS5).
// Extension path (documented stubs below): a Lucene provider, a vector/
// embedding provider, a fusion provider that blends keyword + vector results,
// and a reranker stage. Selection is via the SEARCH_PROVIDER env var so swaps
// are configuration, not code changes.
// ---------------------------------------------------------------------------

export interface SearchOptions {
  limit?: number;
  tag?: string | null;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

// A reranker re-scores an initial candidate set (e.g. a cross-encoder or an
// LLM-as-judge). Implement and wrap a provider with `rerank` to enable it.
export interface Reranker {
  readonly name: string;
  rerank(query: string, candidates: SearchResult[]): Promise<SearchResult[]>;
}

let cached: SearchProvider | null = null;

// Returns the configured provider. Defaults to keyword (FTS5). Future providers
// register here behind the SEARCH_PROVIDER switch — e.g.:
//   case "embedding": return new EmbeddingProvider();   // vector similarity
//   case "lucene":    return new LuceneProvider();       // external index
//   case "fusion":    return new FusionProvider([kw, emb], reranker); // hybrid
export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  switch ((process.env.SEARCH_PROVIDER || "keyword").toLowerCase()) {
    case "keyword":
    default:
      cached = new KeywordProvider();
  }
  return cached;
}

// Convenience wrapper used by pages and chat grounding.
export async function search(
  query: string,
  opts?: SearchOptions
): Promise<SearchResult[]> {
  return getSearchProvider().search(query, opts);
}
