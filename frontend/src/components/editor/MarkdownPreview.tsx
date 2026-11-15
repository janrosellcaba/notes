import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function allowHttp(url: string): string {
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return "";
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
            href ? (
              <a href={href} className="underline" rel="noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          code: ({ children }) => <code className="font-mono text-[13px]">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
