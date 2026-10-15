import { describe, expect, it } from 'vitest';
import { KeyboardEventModifier } from 'cesium';
import {
  getKeyboardModifiers,
  GestureModifier,
} from 'src/features/controls/gestures/gesture-controls.service';

describe('getKeyboardModifiers', () => {
  it('returns nothing for an empty set', () => {
    expect(getKeyboardModifiers(new Set())).toEqual([]);
  });

  it('maps every gesture modifier to its Cesium counterpart', () => {
    const modifiers = new Set([
      GestureModifier.Alt,
      GestureModifier.Control,
      GestureModifier.Shift,
    ]);
    expect(getKeyboardModifiers(modifiers)).toEqual([
      KeyboardEventModifier.CTRL,
      KeyboardEventModifier.SHIFT,
      KeyboardEventModifier.ALT,
    ]);
  });
});
