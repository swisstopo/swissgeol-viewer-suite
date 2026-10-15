import { describe, expect, it } from 'vitest';
import { KeyboardEventModifier, MouseButton } from 'cesium';
import {
  getNavigationBindings,
  NavigationStyle,
  ORBIT_MODIFIER,
} from 'src/features/controls/navigation-style.model';

describe('getNavigationBindings', () => {
  it('keeps the legacy ESRI bindings', () => {
    expect(getNavigationBindings(NavigationStyle.Esri)).toEqual({
      pan: [{ button: MouseButton.LEFT }],
      zoom: [{ button: MouseButton.RIGHT }],
      tilt: [
        { button: MouseButton.MIDDLE },
        { button: MouseButton.LEFT, modifier: KeyboardEventModifier.CTRL },
      ],
    });
  });

  it.each(Object.values(NavigationStyle))(
    'orbits with the modifier on the pan button in style %s',
    (style) => {
      const { pan, tilt } = getNavigationBindings(style);
      expect(tilt).toContainEqual({
        button: pan[0].button,
        modifier: ORBIT_MODIFIER,
      });
    },
  );
});
