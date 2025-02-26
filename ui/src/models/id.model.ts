export type Id<_T> = (string | number) & {
  readonly __id__: unique symbol;
};

export function asId<T>(id: string | number): Id<T>;
export function asId<T>(id: string | number | null): Id<T> | null;
export function asId<T>(id: string | number | null): Id<T> | null {
  return id as Id<T> | null;
}
