import type { ReactNode } from 'react';

/**
 * A deliberately tiny markdown renderer for model output.
 *
 * It emits React elements only — never `dangerouslySetInnerHTML` — so model
 * text can never inject markup. It covers the subset the analyst actually uses:
 * headings, bullet and numbered lists, paragraphs, bold, italic and inline code.
 * Anything else falls through as plain text, which is the safe failure mode.
 */

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: 3 | 4; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
const splitRow = (line: string) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

function toBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: 'code', lines: body });
      continue;
    }

    // A table needs a header row followed by the |---|---| separator.
    if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length <= 3 ? 3 : 4, text: heading[2] });
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(next) || next.trim().startsWith('```') || /^#{1,6}\s/.test(next.trim())) break;
      if (isTableRow(next)) break;
      paragraph.push(next.trim());
      i++;
    }
    blocks.push({ kind: 'p', lines: paragraph });
  }

  return blocks;
}

/** Inline pass: `code`, **bold**, *italic*. Tokenised in one regex sweep. */
const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${match.index}`;

    if (token.startsWith('`')) {
      out.push(
        <code
          key={key}
          className="rounded border border-pit-600 bg-pit-850 px-1.5 py-0.5 font-mono text-[0.85em] text-volt-light"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <em key={key} className="italic text-ink">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = toBlocks(text);

  return (
    <div className="space-y-3 text-base leading-relaxed text-ink-soft">
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        switch (block.kind) {
          case 'h':
            return block.level === 3 ? (
              <h3 key={key} className="font-display text-base font-semibold text-ink">
                {inline(block.text, key)}
              </h3>
            ) : (
              <h4 key={key} className="label-mono !text-ink-soft">
                {inline(block.text, key)}
              </h4>
            );

          case 'ul':
            return (
              <ul key={key} className="space-y-1.5">
                {block.items.map((item, ii) => (
                  <li key={`${key}-${ii}`} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-volt" />
                    <span className="min-w-0">{inline(item, `${key}-${ii}`)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={key} className="space-y-1.5">
                {block.items.map((item, ii) => (
                  <li key={`${key}-${ii}`} className="flex gap-2.5">
                    <span aria-hidden="true" className="font-mono text-sm text-volt">
                      {String(ii + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">{inline(item, `${key}-${ii}`)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div key={key} className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[22rem] border-collapse text-left text-[15px]">
                  <thead>
                    <tr>
                      {block.head.map((cell, ci) => (
                        <th
                          key={`${key}-h${ci}`}
                          scope="col"
                          className="label-mono border-b border-pit-600 px-2.5 py-1.5 align-bottom"
                        >
                          {inline(cell, `${key}-h${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={`${key}-r${ri}`} className="border-b border-pit-700/60 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={`${key}-r${ri}c${ci}`} className="px-2.5 py-1.5 align-top text-ink-soft">
                            {inline(cell, `${key}-r${ri}c${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded border border-pit-600 bg-pit-950 p-3 font-mono text-sm text-volt-light"
              >
                <code>{block.lines.join('\n')}</code>
              </pre>
            );

          default:
            return (
              <p key={key} className="break-words">
                {inline(block.lines.join(' '), key)}
              </p>
            );
        }
      })}
    </div>
  );
}
