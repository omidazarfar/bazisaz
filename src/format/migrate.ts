import { FORMAT_VERSION, type GameProject } from './types';

/**
 * Old projects, made current (Phase 3). A project is plain JSON with a `formatVersion`; when the format changes
 * in a way an older project would not satisfy (a field becomes required, a value is renamed, something moves),
 * FORMAT_VERSION goes up by one and a step is added below that turns a project of the version before into one
 * of the new version. `migrate` runs every step from the project's version to the current one, before the
 * project is checked (validateProject), in the editor (opening a file, the saved project, the agent tools) and
 * in the player. Each step also gets a fixture: a project of the old version in scripts/fixtures/, which
 * scripts/fixtures.smoke.mjs opens and plays.
 *
 * Adding a field that may be left out (with a sensible meaning when it is) is not a format change and needs no
 * step: the blocks' `fallback` and the runtime's `??` cover projects saved before it.
 */

/** One step: a project of version n, as plain data, changed in place into one of version n + 1. */
type Step = (project: Record<string, unknown>) => void;

/** STEPS[n] turns version n into n + 1. Version 2 is the first: every project ever saved has at least that. */
const STEPS: Record<number, Step> = {};

/** The oldest version that can be opened. */
export const OLDEST_FORMAT = 2;

/**
 * The project, current. A project that is already current comes back as it is (the same object); an older one
 * comes back as a changed copy, the original left alone. One that is not a project, or newer than this Bazisaz
 * reads, or older than any it knows, comes back unchanged, for validateProject to say what is wrong.
 */
export function migrate<T = GameProject>(input: T): T {
  const version = (input as { formatVersion?: unknown } | null)?.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return input;
  if (version >= FORMAT_VERSION || version < OLDEST_FORMAT) return input;
  const project = structuredClone(input) as Record<string, unknown>;
  for (let v = version; v < FORMAT_VERSION; v++) {
    const step = STEPS[v];
    if (!step) throw new Error(`No way to bring a project from format ${v} to ${v + 1}.`);
    step(project);
    project.formatVersion = v + 1;
  }
  return project as T;
}

/** The steps there are, for the fixture checks: every version from the oldest has one. */
export const migrationSteps = (): number[] => Object.keys(STEPS).map(Number).sort((a, b) => a - b);
