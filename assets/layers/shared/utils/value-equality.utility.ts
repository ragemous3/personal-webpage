const isComparableObject = (value: unknown): value is object =>
  typeof value === 'object' &&
  value !== null &&
  (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

const hasSameArrayShape = (left: object, right: object): boolean =>
  Array.isArray(left) === Array.isArray(right) &&
  (!Array.isArray(left) || left.length === (right as unknown[]).length);

const haveSameEntries = (left: object, right: object, seen: WeakMap<object, object>): boolean => {
  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(
      ([key, value]) => Object.hasOwn(right, key) && areValuesEqual(value, rightRecord[key], seen),
    )
  );
};

export function areValuesEqual(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, object>(),
): boolean {
  if (Object.is(left, right)) return true;
  if (!isComparableObject(left) || !isComparableObject(right)) return false;
  if (!hasSameArrayShape(left, right)) return false;
  if (seen.has(left)) return seen.get(left) === right;
  seen.set(left, right);

  return haveSameEntries(left, right, seen);
}
