import type { GuidanceFeature, PlanLimits, SubscriptionLimits } from '@/lib/subscriptionLimits';

export type LimitField = 'chatMessagesPerDay' | 'voiceMinutesPerDay' | GuidanceFeature;
export type LimitsForm = Record<'free' | 'pro', Record<LimitField, string>>;

export const LIMIT_FIELDS: { field: LimitField; label: string; unit: string }[] = [
  { field: 'chatMessagesPerDay', label: 'AI chat messages', unit: 'per day' },
  { field: 'voiceMinutesPerDay', label: 'Voice input', unit: 'minutes per day' },
  { field: 'goalGuidance', label: 'Goal guidance', unit: 'plans per day' },
  { field: 'taskGuidance', label: 'Task guidance', unit: 'guides per day' },
  { field: 'recipeSkillGuide', label: 'Recipe and skill guides', unit: 'guides per day' },
  { field: 'guidanceQuestions', label: 'Questions about a guide', unit: 'per day' },
];

const GUIDANCE_FIELDS: GuidanceFeature[] = ['goalGuidance', 'taskGuidance', 'recipeSkillGuide', 'guidanceQuestions'];
const isGuidance = (field: LimitField): field is GuidanceFeature => (GUIDANCE_FIELDS as string[]).includes(field);

const MAX_LIMIT = 100_000;

/** An empty field means unlimited. */
const toText = (value: number | null) => (value === null ? '' : String(value));

export function limitsToForm(limits: SubscriptionLimits): LimitsForm {
  const plan = (limits: PlanLimits) => Object.fromEntries(LIMIT_FIELDS.map(({ field }) => [
    field,
    toText(isGuidance(field) ? limits.guidance[field] : limits[field]),
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
      chatMessagesPerDay: values.chatMessagesPerDay ?? null,
      voiceMinutesPerDay: values.voiceMinutesPerDay ?? null,
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
