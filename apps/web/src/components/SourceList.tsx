import type { SourceItem } from "../lib/api";

export function SourceList({ sources }: { sources: SourceItem[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="sources-row">
      {sources.map((src) => (
        <a
          key={src.url}
          href={src.url}
          target="_blank"
          rel="noreferrer"
          className="source-link"
          title={src.title}
        >
          {src.title || src.url}
        </a>
      ))}
    </div>
  );
}

