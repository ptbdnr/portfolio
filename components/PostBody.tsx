import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList } from "unified";
import type { Schema } from "hast-util-sanitize";
import { PostFormat } from "@/lib/types";
import { safeExternalUrl } from "@/lib/util";

// HTML-format posts may contain author-written markup. Start from rehype's safe
// default schema and additionally permit styling (class/style/id) and a few
// structural tags, so the author can style content while <script>, event
// handlers and javascript: URLs are still stripped.
const htmlSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "style",
      "id",
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    "section",
    "article",
    "details",
    "summary",
    "mark",
    "span",
    "div",
  ],
};

// Allow relative/anchor links through unchanged; sanitise absolute ones to
// http(s) only (blocks javascript:/data:).
function sanitizeHref(href?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  return safeExternalUrl(href) ?? undefined;
}

export default function PostBody({
  format,
  body,
}: {
  format: PostFormat;
  body: string;
}) {
  // markdown: react-markdown escapes raw HTML by default (safe) + highlight code.
  // html: additionally parse raw HTML (rehypeRaw) then sanitise it.
  const rehypePlugins: PluggableList =
    format === "html"
      ? [rehypeRaw, [rehypeSanitize, htmlSchema], rehypeHighlight]
      : [rehypeHighlight];

  return (
    <div className="post-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={rehypePlugins}
        components={{
          a: ({ node, href, ...props }) => {
            void node;
            const safe = sanitizeHref(href);
            const external = !!safe && /^https?:/i.test(safe);
            return (
              <a
                {...props}
                href={safe}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
              />
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
