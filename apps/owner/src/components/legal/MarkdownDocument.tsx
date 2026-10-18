import type { ReactNode } from "react";

const INLINE_PATTERN = /(\*\*[^*]+\*\*|https?:\/\/[^\s<>()]+)/g;

/** Renders a deliberately small, trusted Markdown subset without HTML injection. */
export function renderInline(value: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${prefix}-strong-${index++}`}>{token.slice(2, -2)}</strong>);
    } else {
      let href = token;
      let suffix = "";
      while (/[.,;:!?]$/.test(href)) {
        suffix = href.slice(-1) + suffix;
        href = href.slice(0, -1);
      }
      nodes.push(
        <a key={`${prefix}-link-${index++}`} href={href} target="_blank" rel="noopener noreferrer">
          {href}
        </a>,
      );
      if (suffix) nodes.push(suffix);
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

export function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, "").trim());
}

export default function MarkdownDocument({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  const used = new Map<string, number>();
  let index = 0;
  let key = 0;

  const idFor = (title: string) => {
    const base = slugifyHeading(title) || `bagian-${key}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = idFor(title);
      const content = renderInline(title, `heading-${key}`);
      if (level === 1) {
        blocks.push(
          <h1 key={`h-${key++}`} id={id} className="font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            {content}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h-${key++}`} id={id} className="mt-10 scroll-mt-28 border-b border-line pb-2 font-serif text-2xl font-semibold leading-snug text-ink">
            {content}
          </h2>,
        );
      } else if (level === 3) {
        blocks.push(
          <h3 key={`h-${key++}`} id={id} className="mt-7 scroll-mt-28 text-lg font-semibold leading-snug text-ink">
            {content}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={`h-${key++}`} id={id} className="mt-5 scroll-mt-28 text-base font-semibold text-ink">
            {content}
          </h4>,
        );
      }
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${key++}`} className="my-8 border-line" />);
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\d+\.\s+/, "").trim();
        items.push(<li key={`li-${key++}`} className="pl-1">{renderInline(item, `li-${key}`)}</li>);
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="my-4 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-leaf">
          {items}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const item = lines[index].replace(/^[-*]\s+/, "").trim();
        items.push(<li key={`li-${key++}`} className="pl-1">{renderInline(item, `li-${key}`)}</li>);
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="my-4 list-disc space-y-2 pl-5 marker:text-leaf">
          {items}
        </ul>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${key++}`} className="my-3 break-words text-[14.5px] leading-7 text-muted">
        {renderInline(line.trim(), `p-${key}`)}
      </p>,
    );
    index += 1;
  }

  return (
    <div className="legal-markdown [&_a]:font-medium [&_a]:text-leaf [&_a]:underline [&_a]:decoration-leaf/30 [&_a]:underline-offset-2 hover:[&_a]:decoration-leaf [&_strong]:font-semibold [&_strong]:text-ink">
      {blocks}
    </div>
  );
}
