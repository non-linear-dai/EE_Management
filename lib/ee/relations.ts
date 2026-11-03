import type { Workspace } from "./types";
export function materialAssemblies(d: Workspace, materialId: string): string[] {
  const found = new Set(
    d.bomLines
      .filter((l) => l.materialId === materialId)
      .map(
        (l) =>
          d.boms.find((b) => b.id === l.bomId && b.status === "生效")
            ?.assemblyId,
      )
      .filter((x): x is string => !!x),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of d.bomLines)
      if (l.childAssemblyId && found.has(l.childAssemblyId)) {
        const parent = d.boms.find(
          (b) => b.id === l.bomId && b.status === "生效",
        )?.assemblyId;
        if (parent && !found.has(parent)) {
          found.add(parent);
          changed = true;
        }
      }
  }
  return [...found];
}
export function materialProducts(d: Workspace, id: string): string[] {
  const a = materialAssemblies(d, id);
  return [
    ...new Set(
      d.productAssemblies
        .filter((r) => a.includes(r.assemblyId))
        .map((r) => r.productId),
    ),
  ];
}
export function assemblyMaterials(
  d: Workspace,
  id: string,
  seen = new Set<string>(),
): string[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const bom = d.boms.find((b) => b.assemblyId === id && b.status === "生效");
  return [
    ...new Set(
      d.bomLines
        .filter((l) => l.bomId === bom?.id)
        .flatMap((l) =>
          l.materialId
            ? [l.materialId]
            : l.childAssemblyId
              ? assemblyMaterials(d, l.childAssemblyId, seen)
              : [],
        ),
    ),
  ];
}
export function wouldCycle(
  d: Workspace,
  parent: string,
  child: string,
): boolean {
  if (parent === child) return true;
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === parent) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const boms = d.boms.filter((b) => b.assemblyId === id).map((b) => b.id);
    return d.bomLines.some(
      (l) =>
        boms.includes(l.bomId) &&
        !!l.childAssemblyId &&
        visit(l.childAssemblyId),
    );
  };
  return visit(child);
}
