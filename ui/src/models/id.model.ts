/**
 * A unique identifier for a specific type `T`.
 * It can be assumed that for all `T`, this identifier identifies a specific object.
 *
 * Note that this is a tagged type around `string | number`.
 * This means this, in effect, _is_ a `string | number`,
 * which simply doesn't auto-cast *from* `string | number`,
 * but does auto-cast *to* it.
 * To cast a value to an `Id`, use {@link makeId}.
 *
 * @typeParam T The type for which the identifier applies.
 */
export type Id<_T> = (string | number) & {
  readonly __id__: unique symbol;
};

/**
 * Casts a value to an {@link Id} of a desired type.
 *
 * Note that as {@link Id} is a tagged type around `string | number`,
 * this is a no-op at runtime and simply serves to cast a value so that TypeScript is happy.
 *
 * @param id {string | number} The value to cast.
 */
export function makeId<T>(id: string | number): Id<T>;

/**
 * Casts a value to an {@link Id} of a desired type.
 * If the value is `null`, it will be returned as-is.
 *
 * Note that as {@link Id} is a tagged type around `string | number`,
 * this is a no-op at runtime and simply serves to cast a value so that TypeScript is happy.
 *
 * @param id {string | number | null} The value to cast, or `null`.
 */
export function makeId<T>(id: string | number | null): Id<T> | null;

export function makeId<T>(id: string | number | null): Id<T> | null {
  return id as Id<T> | null;
}
