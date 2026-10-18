import { describe, expect, it } from "vitest";
import { clientFormSchema } from "@/lib/validation/client";
import { phoneField, requiredPhoneField } from "@/lib/validation/common";

const base = {
  clientName: "Bar Prueba",
  whatsappE164: "+34600111222",
  driveFolderId: "drive-folder-test-0001",
  googleSheetId: "sheet-id-test-000001",
  googleSheetTab: "",
  timezone: "",
  active: true,
};

describe("teléfonos", () => {
  it.each(["+34600111222", "34600111222", "+34 600 11 12 22", "+34 (600) 111-222"])("acepta móvil español válido %s", (v) => {
    expect(requiredPhoneField.safeParse(v).success).toBe(true);
  });

  it.each(["+3460483237", "+346048232370", "3460048323"])("rechaza número español sin 9 cifras %s", (v) => {
    const r = requiredPhoneField.safeParse(v);
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes("9 cifras"))).toBe(true);
  });

  it("acepta números de otros países", () => {
    expect(requiredPhoneField.safeParse("+447700900123").success).toBe(true);
    expect(requiredPhoneField.safeParse("+584121234567").success).toBe(true);
  });

  it("normaliza espacios y guiones", () => {
    expect(requiredPhoneField.parse("+34 600-111-222")).toBe("+34600111222");
  });

  it("el campo opcional admite vacío pero no un +34 incompleto", () => {
    expect(phoneField.safeParse("").success).toBe(true);
    expect(phoneField.safeParse("+3460011122").success).toBe(false);
  });

  it("rechaza texto y formatos imposibles", () => {
    for (const v of ["abc", "+0123456789", "12", ""]) expect(requiredPhoneField.safeParse(v).success).toBe(false);
  });
});

describe("clientFormSchema", () => {
  it("aplica valores por defecto de pestaña y zona horaria", () => {
    const r = clientFormSchema.parse(base);
    expect(r.googleSheetTab).toBe("Mtr_plantilla_calendario");
    expect(r.timezone).toBe("Europe/Madrid");
  });

  it("exige nombre, carpeta de Drive y hoja válidas", () => {
    const r = clientFormSchema.safeParse({ ...base, clientName: "A", driveFolderId: "x", googleSheetId: "../etc" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["clientName", "driveFolderId", "googleSheetId"]));
  });

  it("rechaza zonas horarias inexistentes", () => {
    expect(clientFormSchema.safeParse({ ...base, timezone: "Marte/Olympus" }).success).toBe(false);
  });
});
