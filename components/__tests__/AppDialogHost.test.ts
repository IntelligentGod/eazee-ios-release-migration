jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

import { toDialogButtons } from '@/components/AppDialogHost';

const shape = (buttons: ReturnType<typeof toDialogButtons>) => buttons.map(({ text, tone }) => [text, tone]);

describe('toDialogButtons', () => {
  it('shows a single OK when an alert has no buttons', () => {
    expect(shape(toDialogButtons(undefined))).toEqual([['OK', 'primary']]);
  });

  it('puts the main action first and cancel last', () => {
    expect(shape(toDialogButtons([
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save' },
    ]))).toEqual([['Save', 'primary'], ['Cancel', 'secondary']]);
  });

  it('keeps destructive actions red and other choices outlined', () => {
    expect(shape(toDialogButtons([
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive' },
    ]))).toEqual([['Delete', 'destructive'], ['Cancel', 'secondary']]);

    expect(shape(toDialogButtons([
      { text: 'Privacy Policy' },
      { text: 'Not Now' },
      { text: 'Allow', isPreferred: true },
    ]))).toEqual([['Allow', 'primary'], ['Privacy Policy', 'secondary'], ['Not Now', 'secondary']]);
  });

  it('runs the original button action', () => {
    const onPress = jest.fn();
    toDialogButtons([{ text: 'OK', onPress }])[0].onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
