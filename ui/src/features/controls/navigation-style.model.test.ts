import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardEventModifier, MouseButton } from 'cesium';
import {
  getNavigationBindings,
  readNavigationStyle,
  writeNavigationStyle,
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

const stubCookies = (initial: string, protocol = 'https:') => {
  const document = { cookie: initial };
  vi.stubGlobal('document', document);
  vi.stubGlobal('location', { protocol });
  return document;
};

describe('navigation style cookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to ESRI without a cookie', () => {
    stubCookies('');
    expect(readNavigationStyle()).toBe(NavigationStyle.Esri);
  });

  it('reads a stored style among other cookies', () => {
    stubCookies('a=1; swissgeol_navigation_style=modelling; b=2');
    expect(readNavigationStyle()).toBe(NavigationStyle.Modelling);
  });

  it('falls back to ESRI for unknown values', () => {
    stubCookies('swissgeol_navigation_style=bogus');
    expect(readNavigationStyle()).toBe(NavigationStyle.Esri);
  });

  it('writes a secure cookie on https', () => {
    const doc = stubCookies('');
    writeNavigationStyle(NavigationStyle.RightOrbit);
    expect(doc.cookie).toContain('swissgeol_navigation_style=rightOrbit');
    expect(doc.cookie).toContain('; Secure');
  });

  it('omits Secure on http', () => {
    const doc = stubCookies('', 'http:');
    writeNavigationStyle(NavigationStyle.Modelling);
    expect(doc.cookie).not.toContain('Secure');
  });
});
