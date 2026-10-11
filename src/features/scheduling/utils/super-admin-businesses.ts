export type SuperAdminBusinessSort = "name" | "newest" | "oldest";

type SortableBusiness = {
  businessId: string;
  businessName: string;
  ownerCreatedAt: string;
};

export function sortSuperAdminBusinesses<T extends SortableBusiness>(
  businesses: readonly T[],
  order: SuperAdminBusinessSort
): T[] {
  return [...businesses].sort((left, right) => {
    if (order !== "name") {
      const leftDate = Date.parse(left.ownerCreatedAt);
      const rightDate = Date.parse(right.ownerCreatedAt);
      const leftMissing = Number.isNaN(leftDate);
      const rightMissing = Number.isNaN(rightDate);

      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      if (!leftMissing) {
        const dateDifference = order === "newest" ? rightDate - leftDate : leftDate - rightDate;
        if (dateDifference !== 0) return dateDifference;
      }
    }

    return left.businessName.localeCompare(right.businessName, "es", { sensitivity: "base" }) ||
      left.businessId.localeCompare(right.businessId);
  });
}
