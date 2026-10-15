import { KeyboardEventModifier, MouseButton } from 'cesium';

export enum NavigationStyle {
  Esri = 'esri',
  Modelling = 'modelling',
  RightOrbit = 'rightOrbit',
}

export interface DragInput {
  button: MouseButton;
  modifier?: KeyboardEventModifier;
}

export type NavigationAction = 'orbit' | 'zoom' | 'pan';

export interface NavigationBindings {
  pan: DragInput[];
  tilt: DragInput[];
  zoom: DragInput[];
}

export const DEFAULT_NAVIGATION_STYLE = NavigationStyle.Esri;

/** Held together with the pan button, this turns panning into orbiting. */
export const ORBIT_MODIFIER = KeyboardEventModifier.CTRL;

/** The single source of truth: which mouse button triggers which action. */
export const NAVIGATION_PROFILES: Record<
  NavigationStyle,
  Record<NavigationAction, MouseButton>
> = {
  [NavigationStyle.Esri]: {
    pan: MouseButton.LEFT,
    orbit: MouseButton.MIDDLE,
    zoom: MouseButton.RIGHT,
  },
  [NavigationStyle.Modelling]: {
    orbit: MouseButton.LEFT,
    zoom: MouseButton.MIDDLE,
    pan: MouseButton.RIGHT,
  },
  [NavigationStyle.RightOrbit]: {
    pan: MouseButton.LEFT,
    zoom: MouseButton.MIDDLE,
    orbit: MouseButton.RIGHT,
  },
};

/**
 * Derives the Cesium drag inputs of a style from its profile.
 * Orbiting is additionally available as modifier + pan button.
 */
export const getNavigationBindings = (
  style: NavigationStyle,
): NavigationBindings => {
  const profile = NAVIGATION_PROFILES[style];
  return {
    pan: [{ button: profile.pan }],
    zoom: [{ button: profile.zoom }],
    tilt: [
      { button: profile.orbit },
      { button: profile.pan, modifier: ORBIT_MODIFIER },
    ],
  };
};

const COOKIE_NAME = 'swissgeol_navigation_style';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

export const readNavigationStyle = (): NavigationStyle => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  const value = match?.slice(COOKIE_NAME.length + 1);
  return (
    Object.values(NavigationStyle).find((s) => s === value) ??
    DEFAULT_NAVIGATION_STYLE
  );
};

export const writeNavigationStyle = (style: NavigationStyle): void => {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${style}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};
