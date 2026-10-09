import "server-only";

/** Filtro "status IN (...)" sin distinguir mayúsculas (los estados son TEXT libre). */
export function statusIn(values: readonly string[]) {
  return values.flatMap((v) => [
    { status: { equals: v, mode: "insensitive" as const } },
    { status: { equals: v.replace(/_/g, " "), mode: "insensitive" as const } },
  ]);
}

export function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
