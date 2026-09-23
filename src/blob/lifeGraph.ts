import type { BlobMeaningState, BlobVisualMeaning, LifeAreas } from './blobMeaning';
import { clamp01 } from './blobMeaning';

/**
 * Life Graph prototype.
 *
 * The droplet starts each week as a smooth sphere and grows an arm per life
 * area as tasks in that area are completed; the whole droplet enlarges with
 * total activity.
 *
 * Note this reads the geometry the OPPOSITE way to blobMeaning.ts, where a
 * protruding lobe means pressure or neglect. Both interpretations cannot be
 * true on one character, so this path stays behind LIFE_GRAPH_ENABLED until
 * that product decision is made.
 */
export const LIFE_GRAPH_ENABLED = true;

export const LIFE_AREA_KEYS = ['health', 'relationships', 'work', 'home', 'growth'] as const;

export type LifeAreaKey = (typeof LIFE_AREA_KEYS)[number];

export type LifeAreaCounts = Record<LifeAreaKey, number>;

export const EMPTY_LIFE_AREA_COUNTS: LifeAreaCounts = {
  health: 0,
  relationships: 0,
  work: 0,
  home: 0,
  growth: 0,
};

/** Completions in one area that grow its arm to full length. */
export const ARM_FULL_GROWTH_COUNT = 6;

/** Total completions that grow the droplet to its largest. */
export const BODY_FULL_GROWTH_COUNT = 20;

/** Smallest and largest whole-droplet scale across a week. */
export const BODY_SCALE_MIN = 1;
export const BODY_SCALE_MAX = 1.35;

/**
 * Monday-based week key, so an untouched week reads back as empty and the
 * droplet returns to a smooth sphere without a reset job.
 */
export function getLifeGraphWeekKey(now: Date = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (isoDay - 1));

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Start of the current life-graph week, for querying completions. */
export function getLifeGraphWeekStart(now: Date = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (isoDay - 1));
  return date;
}

export function getTotalLifeAreaCount(counts: LifeAreaCounts) {
  return LIFE_AREA_KEYS.reduce((total, key) => total + counts[key], 0);
}

/** Per-area arm length, 0 at the start of the week. */
export function lifeAreaCountsToAreas(counts: LifeAreaCounts): LifeAreas {
  return {
    health: clamp01(counts.health / ARM_FULL_GROWTH_COUNT),
    relationships: clamp01(counts.relationships / ARM_FULL_GROWTH_COUNT),
    work: clamp01(counts.work / ARM_FULL_GROWTH_COUNT),
    home: clamp01(counts.home / ARM_FULL_GROWTH_COUNT),
    growth: clamp01(counts.growth / ARM_FULL_GROWTH_COUNT),
  };
}

export function getLifeGraphBodyScale(counts: LifeAreaCounts) {
  const progress = clamp01(getTotalLifeAreaCount(counts) / BODY_FULL_GROWTH_COUNT);
  return BODY_SCALE_MIN + (BODY_SCALE_MAX - BODY_SCALE_MIN) * progress;
}

/**
 * Arms are driven by the area values, so balance is held high to keep the body
 * itself round - the lobes should read as growth out of a smooth sphere rather
 * than as a distorted one.
 */
/**
 * Visual output for the Life Graph, deliberately bypassing
 * computeBlobVisualMeaning: that clamps every lobe to AREA_LOBE_VISUAL_MAX
 * (~0.08, the calm-balanced silhouette) so the pressure model stays subtle,
 * which would flatten arms to nothing here.
 */
export function lifeGraphVisualMeaning(counts: LifeAreaCounts): BlobVisualMeaning {
  const areas = lifeAreaCountsToAreas(counts);
  const total = getTotalLifeAreaCount(counts);

  return {
    sphericality: 0.96,
    rippleAmp: 0,
    rippleSpeed: 0,
    areaLobes: { ...areas },
    suppressLobes: total === 0,
  };
}

export function lifeGraphMeaningState(counts: LifeAreaCounts): BlobMeaningState {
  const areas = lifeAreaCountsToAreas(counts);
  const total = getTotalLifeAreaCount(counts);

  return {
    balance: 0.95,
    stress: 0.08,
    state: 'calm',
    areas,
    suppressLobes: total === 0,
  };
}
