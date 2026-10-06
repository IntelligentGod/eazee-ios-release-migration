import type { GuidanceFeature, PlanLimits, SubscriptionLimits } from '@/lib/subscriptionLimits';

/** AI chat and voice input are unlimited on every plan, so only guidance limits are set here. */
export type LimitField = GuidanceFeature;
export type LimitsForm = Record<'free' | 'pro', Record<LimitField, string>>;

export const LIMIT_FIELDS: { field: LimitField; label: string; unit: string }[] = [
  { field: 'goalGuidance', label: 'Goal guidance', unit: 'plans per day' },
  { field: 'taskGuidance', label: 'Task guidance', unit: 'guides per day' },
  { field: 'recipeSkillGuide', label: 'Recipe and skill guides', unit: 'guides per day' },
  { field: 'guidanceQuestions', label: 'Questions about a guide', unit: 'per day' },
];

const MAX_LIMIT = 100_000;

/** An empty field means unlimited. */
const toText = (value: number | null) => (value === null ? '' : String(value));

export function limitsToForm(limits: SubscriptionLimits): LimitsForm {
  const plan = (limits: PlanLimits) => Object.fromEntries(LIMIT_FIELDS.map(({ field }) => [
    field,
    toText(limits.guidance[field]),
  ])) as Record<LimitField, string>;
  return { free: plan(limits.free), pro: plan(limits.pro) };
}

/** Whole numbers from 0 (not included) up; empty for unlimited. */
export function formToLimits(form: LimitsForm): { limits: SubscriptionLimits } | { error: string } {
  const result: Partial<SubscriptionLimits> = {};
  for (const tier of ['free', 'pro'] as const) {
    const values: Partial<Record<LimitField, number | null>> = {};
    for (const { field, label } of LIMIT_FIELDS) {
      const text = form[tier][field].trim();
      if (text === '') {
        values[field] = null;
        continue;
      }
      if (!/^\d+$/.test(text) || Number(text) > MAX_LIMIT) {
        return { error: `${tier === 'free' ? 'Free' : 'Pro'}: ${label} must be a whole number from 0 to ${MAX_LIMIT}, or empty for unlimited.` };
      }
      values[field] = Number(text);
    }
    result[tier] = {
      chatMessagesPerDay: null,
      voiceMinutesPerDay: null,
      guidance: {
        goalGuidance: values.goalGuidance ?? null,
        taskGuidance: values.taskGuidance ?? null,
        recipeSkillGuide: values.recipeSkillGuide ?? null,
        guidanceQuestions: values.guidanceQuestions ?? null,
      },
    };
  }
  return { limits: result as SubscriptionLimits };
}
