import { execFileSync } from "node:child_process";

interface Probe {
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  streams?: { width?: number; height?: number }[];
}

/**
 * Reads pixel dimensions from a video file via ffprobe.
 *
 * Optional by design: ffprobe is not a dependency of this project, and a missing
 * binary simply means those fields stay empty rather than the ingest failing.
 */
export function probeMedia(path: string): Probe | null {
  let raw: string;
  try {
    raw = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", path],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }

  const parsed = JSON.parse(raw) as FfprobeOutput;
  const probe: Probe = {};

  const visual = parsed.streams?.find(
    (s) => s.width !== undefined && s.height !== undefined,
  );
  if (visual?.width !== undefined && visual.height !== undefined) {
    probe.width = visual.width;
    probe.height = visual.height;
  }

  return probe;
}
