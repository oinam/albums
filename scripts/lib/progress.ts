/**
 * A progress line for the stretches of ingest where nothing is printed and the
 * work is elsewhere: ffprobe on a video, a HEAD per file, a multi-megabyte PUT.
 *
 * On a terminal it is one line, rewritten in place and erased when the phase ends,
 * so what survives in the scrollback is the summary and nothing else. Piped or
 * redirected there is no cursor to move, so every step prints its own plain line
 * and nothing ticks.
 *
 * The clock is the honest measure here. Bytes are not: the SDK reads the whole
 * file into its chunked encoder without waiting for the socket, so a byte counter
 * on the source stream reaches 100% within a few hundred milliseconds of a PUT
 * that has seconds left to run.
 */

const TTY = process.stdout.isTTY === true;

/** Clear the whole line, then start writing at its beginning. */
const CLEAR = "\r\u001b[2K";

const TICK_MS = 250;

interface Progress {
  /** Move on to the next item. `note` is anything fixed worth showing, like a size. */
  step: (label: string, note?: string) => void;
  /** Stop the clock and erase the line so whatever prints next starts clean. */
  done: () => void;
}

export function formatBytes(count: number): string {
  const mb = count / 1024 / 1024;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(count / 1024))} KB`;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function truncate(line: string): string {
  const width = process.stdout.columns ?? 80;
  return line.length < width ? line : `${line.slice(0, width - 2)}…`;
}

export function progress(verb: string, total: number): Progress {
  const digits = String(total).length;
  let index = 0;
  let label = "";
  let note = "";
  let startedAt = 0;
  let painted = false;
  let ticker: NodeJS.Timeout | undefined;

  const paint = (): void => {
    const elapsed = Date.now() - startedAt;
    const parts = [
      `${String(index).padStart(digits)}/${total}`,
      label,
      note,
      elapsed >= 1000 ? formatElapsed(elapsed) : "",
    ].filter((part) => part !== "");
    process.stdout.write(CLEAR + truncate(`  ${verb} ${parts.join("  ")}`));
    painted = true;
  };

  return {
    step(next, detail = "") {
      index += 1;
      label = next;
      note = detail;
      startedAt = Date.now();

      if (!TTY) {
        console.log(`  ${verb} ${index}/${total}  ${label}${note ? `  ${note}` : ""}`);
        return;
      }

      paint();
      // Unreferenced: a progress line is never a reason for the process to stay up.
      ticker ??= setInterval(paint, TICK_MS).unref();
    },
    done() {
      clearInterval(ticker);
      ticker = undefined;
      if (!painted) return;
      process.stdout.write(CLEAR);
      painted = false;
    },
  };
}
