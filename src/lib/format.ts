const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const relFmt = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

export function formatDateTime(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
}

export function formatRelative(value: DateInput, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relFmt.format(diffSec, "second");
  if (abs < 3600) return relFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return relFmt.format(Math.round(diffSec / 86400), "day");
  return formatDate(d);
}

export function formatBytes(bytes: number | string | bigint | null | undefined) {
  if (bytes == null) return "—";
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

/** "Clave_de_ejemplo" / "claveDeEjemplo" → "Clave de ejemplo". */
export function humanizeKey(key: string) {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function whatsappLink(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function githubUrl(owner?: string | null, repo?: string | null) {
  if (!owner || !repo) return null;
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
