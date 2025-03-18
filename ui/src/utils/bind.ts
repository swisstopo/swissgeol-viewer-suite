export const bindMethods = (object: { constructor: object }): void => {
  for (const key of Object.keys(object.constructor)) {
    const value = object[key];
    if (typeof value === 'function') {
      object[key] = value.bind(object);
    }
  }
};
