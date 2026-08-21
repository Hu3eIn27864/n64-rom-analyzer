export function makeUniqueSemanticNames(names: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    return count === 0 ? name : `${name}_${count}`;
  });
}
