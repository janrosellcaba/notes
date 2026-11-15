import { Link } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function allowHttp(url: string): string {
  if (url.startsWith("/go/")) return url;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return "";
}

function withWikilinks(text: string): string {
  return text.replace(/\[\[([^\]\n]{1,200})\]\]/g, (_match, title: string) => {
    const label = title.trim();
    return `[${label}](/go/${encodeURIComponent(label)})`;
  });
}

export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="prose-notes min-h-48 flex-1 px-4 py-3 text-[16px] leading-[1.6]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={allowHttp}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("/go/") ? (
              <Link to={href} className="underline">
                {children}
              </Link>
            ) : href ? (
              <a href={href} className="underline" rel="noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          code: ({ children }) => <code className="font-mono text-[13px]">{children}</code>,
        }}
      >
        {withWikilinks(text)}
      </ReactMarkdown>
    </div>
  );
}
