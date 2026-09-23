import {
  ARM_FULL_GROWTH_COUNT,
  BODY_FULL_GROWTH_COUNT,
  BODY_SCALE_MAX,
  BODY_SCALE_MIN,
  EMPTY_LIFE_AREA_COUNTS,
  getLifeGraphBodyScale,
  getLifeGraphWeekKey,
  lifeAreaCountsToAreas,
  lifeGraphMeaningState,
  type LifeAreaCounts,
} from '@/src/blob/lifeGraph';
import { classifyLifeArea } from '@/lib/lifeAreaClassifier';

const counts = (overrides: Partial<LifeAreaCounts> = {}): LifeAreaCounts => ({
  ...EMPTY_LIFE_AREA_COUNTS,
  ...overrides,
});

describe('life graph growth', () => {
  it('starts the week as a smooth sphere with no arms', () => {
    const state = lifeGraphMeaningState(counts());

    expect(state.suppressLobes).toBe(true);
    expect(Object.values(state.areas).every((value) => value === 0)).toBe(true);
    expect(getLifeGraphBodyScale(counts())).toBe(BODY_SCALE_MIN);
  });

  it('grows only the arm for the area that was worked on', () => {
    const areas = lifeAreaCountsToAreas(counts({ health: 3 }));

    expect(areas.health).toBeCloseTo(3 / ARM_FULL_GROWTH_COUNT);
    expect(areas.work).toBe(0);
    expect(areas.relationships).toBe(0);
  });

  it('caps an arm once the area is fully grown', () => {
    const areas = lifeAreaCountsToAreas(counts({ work: ARM_FULL_GROWTH_COUNT * 3 }));

    expect(areas.work).toBe(1);
  });

  it('enlarges the whole droplet with total activity, regardless of spread', () => {
    const focused = getLifeGraphBodyScale(counts({ work: 10 }));
    const spread = getLifeGraphBodyScale(counts({ work: 5, health: 3, home: 2 }));

    expect(focused).toBeCloseTo(spread);
    expect(focused).toBeGreaterThan(BODY_SCALE_MIN);
    expect(getLifeGraphBodyScale(counts({ work: BODY_FULL_GROWTH_COUNT * 2 }))).toBe(BODY_SCALE_MAX);
  });

  it('shows arms as soon as anything is completed', () => {
    expect(lifeGraphMeaningState(counts({ growth: 1 })).suppressLobes).toBe(false);
  });
});

describe('life graph week boundary', () => {
  it('buckets from Monday so the droplet resets weekly', () => {
    // 2026-09-21 is a Monday.
    expect(getLifeGraphWeekKey(new Date(2026, 8, 21))).toBe('2026-09-21');
    expect(getLifeGraphWeekKey(new Date(2026, 8, 27))).toBe('2026-09-21');
    expect(getLifeGraphWeekKey(new Date(2026, 8, 28))).toBe('2026-09-28');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(getLifeGraphWeekKey(new Date(2026, 8, 20))).toBe('2026-09-14');
  });
});

describe('life area classifier', () => {
  it.each([
    ['Go to the gym', 'health'],
    ['Call mum about her birthday', 'relationships'],
    ['Finish the client report', 'work'],
    ['Do the laundry', 'home'],
    ['Read a book chapter', 'growth'],
  ])('reads %s as %s', (text, expected) => {
    expect(classifyLifeArea(text, 'Personal')).toBe(expected);
  });

  it('falls back to the workspace when no keyword matches', () => {
    expect(classifyLifeArea('zzzz', 'Goals')).toBe('growth');
    expect(classifyLifeArea('zzzz', 'Wishlist')).toBe('home');
  });

  it('always returns an area so no completion is lost', () => {
    expect(classifyLifeArea('', null)).toBe('work');
    expect(classifyLifeArea(null, 'Personal')).toBe('work');
  });
});
