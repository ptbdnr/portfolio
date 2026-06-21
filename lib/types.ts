// Shared domain types for the blog / search / stats / chat features.

export type PostFormat = "markdown" | "html";
export type PostStatus = "draft" | "published" | "archived";

export const POST_FORMATS: PostFormat[] = ["markdown", "html"];
export const POST_STATUSES: PostStatus[] = ["draft", "published", "archived"];

export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  format: PostFormat;
  body: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// A post plus its tags and the ids of posts it links to.
export interface PostWithMeta extends Post {
  tags: string[];
  related: number[];
}

// A lightweight reference used when rendering "related posts" lists.
export interface PostRef {
  id: number;
  slug: string;
  title: string;
  status: PostStatus;
}

export type AnalyticsEventType = "pageview" | "click" | "heartbeat" | "leave";

export interface SearchResult {
  post: PostRef & { excerpt: string | null };
  score: number;
  snippet?: string;
}
