import { execFileSync } from "node:child_process";

export interface Probe {
  width?: number;
  height?: number;
  duration?: number;
}

interface FfprobeOutput {
  format?: { duration?: string };
  streams?: { width?: number; height?: number }[];
}

/**
 * Reads duration and dimensions from a video or audio file via ffprobe.
 *
 * Optional by design: ffprobe is not a dependency of this project, and a missing
 * binary simply means those fields stay empty rather than the ingest failing.
 */
export function probeMedia(path: string): Probe | null {
  let raw: string;
  try {
    raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        path,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }

  const parsed = JSON.parse(raw) as FfprobeOutput;
  const probe: Probe = {};

  const duration = Number(parsed.format?.duration);
  if (Number.isFinite(duration) && duration > 0) probe.duration = duration;

  const visual = parsed.streams?.find(
    (s) => s.width !== undefined && s.height !== undefined,
  );
  if (visual?.width !== undefined && visual.height !== undefined) {
    probe.width = visual.width;
    probe.height = visual.height;
  }

  return probe;
}
