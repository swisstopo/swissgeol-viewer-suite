import type { Viewer } from 'cesium';

export function getURLSearchParams(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function setURLSearchParams(params: URLSearchParams) {
  window.history.replaceState(
    {},
    '',
    `${location.pathname}?${params}${window.location.hash}`,
  );
}

export function clickOnElement(id: string) {
  document.getElementById(id)?.click();
}

export function escapeRegExp(string: string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
}

export function executeForAllPrimitives(
  viewer: Viewer,
  functionToExecute: (primitive: any) => void,
) {
  const primitives = viewer.scene.primitives;
  for (let i = 0, ii = primitives.length; i < ii; i++) {
    const primitive = primitives.get(i);
    if (primitive.ready || !primitive.readyPromise)
      functionToExecute(primitive);
    else primitive.readyPromise.then(() => functionToExecute(primitive));
  }
}

export function parseJson(
  string: string | null,
): Record<string, any> | undefined {
  if (!string) return undefined;
  try {
    return JSON.parse(string);
  } catch (_e) {
    return undefined;
  }
}

export function interpolateBetweenNumbers(
  min: number,
  max: number,
  percent: number,
): number {
  const diff = max - min;
  return min + (percent / 100) * diff;
}

export function getPercent(min: number, max: number, value: number): number {
  const diff = max - min;
  return (value / diff) * 100;
}

export function debounce(f, ms, skipFirst = false) {
  let isCooldown = false;
  let argumentsArr: any[] = [];
  return (...args) => {
    if (isCooldown) {
      argumentsArr.push([...args]);
      return;
    }
    !skipFirst && f(...args);
    isCooldown = true;
    setTimeout(() => {
      isCooldown = false;
      skipFirst = false;
      const indx = argumentsArr.length - 1;
      if (indx > -1) {
        f(...argumentsArr[indx]);
        argumentsArr = argumentsArr.splice(indx, argumentsArr.length - 1);
      }
    }, ms);
  };
}

export function isEmail(email: string | undefined) {
  if (!email) return false;
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return regex.test(email);
}
