import { formToLimits, limitsToForm } from '@/lib/adminLimitsForm';
import { DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/subscriptionLimits';

describe('admin limits form', () => {
  it('round-trips the limits, with unlimited as an empty field', () => {
    const form = limitsToForm(DEFAULT_SUBSCRIPTION_LIMITS);
    expect(form.free.goalGuidance).toBe('0');
    expect(form.pro.goalGuidance).toBe('');
    expect(Object.keys(form.free)).not.toContain('chatMessagesPerDay');
    expect(Object.keys(form.free)).not.toContain('voiceMinutesPerDay');
    expect(formToLimits(form)).toEqual({ limits: DEFAULT_SUBSCRIPTION_LIMITS });
  });

  it('reads edited fields as numbers, and empty as unlimited', () => {
    const form = limitsToForm(DEFAULT_SUBSCRIPTION_LIMITS);
    form.free.recipeSkillGuide = '1';
    form.pro.taskGuidance = ' 90 ';
    form.free.goalGuidance = '';

    const result = formToLimits(form);
    expect('limits' in result && result.limits.free.guidance.recipeSkillGuide).toBe(1);
    expect('limits' in result && result.limits.pro.guidance.taskGuidance).toBe(90);
    expect('limits' in result && result.limits.free.guidance.goalGuidance).toBeNull();
    expect('limits' in result && result.limits.free.chatMessagesPerDay).toBeNull();
    expect('limits' in result && result.limits.free.voiceMinutesPerDay).toBeNull();
  });

  it('rejects anything that is not a whole number in range', () => {
    const form = limitsToForm(DEFAULT_SUBSCRIPTION_LIMITS);
    form.pro.taskGuidance = '2.5';
    expect(formToLimits(form)).toEqual({ error: expect.stringContaining('Pro: Task guidance') });
    form.pro.taskGuidance = '100001';
    expect(formToLimits(form)).toEqual({ error: expect.stringContaining('Pro: Task guidance') });
  });
});
