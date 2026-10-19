import { describe, expect, it } from "vitest";
import { driveViewUrl, mediaThumbnailUrl, mediaViewUrl } from "@/lib/drive";

describe("previews de archivos de contenido", () => {
  it("archivos nuevos (Metricool): URL directa", () => {
    const url = "https://static.metricool.com/video/4165046/202610/abc.png";
    expect(mediaThumbnailUrl(url)).toBe(url);
    expect(mediaViewUrl(url)).toBe(url);
  });

  it("archivos antiguos (Drive): miniatura pública de Drive", () => {
    expect(mediaThumbnailUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing", 400)).toBe(
      "https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w400",
    );
  });

  it("URL vacía o no https → sin preview", () => {
    expect(mediaThumbnailUrl(null)).toBeNull();
    expect(mediaViewUrl("javascript:alert(1)")).toBeNull();
    expect(mediaThumbnailUrl("http://inseguro.test/x.jpg")).toBeNull();
  });

  it("auditorías: el PDF sigue en Drive por su id", () => {
    expect(driveViewUrl(null, "1AbCdEfGhIjKlMnOp")).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view");
    expect(driveViewUrl(null, "../x")).toBeNull();
  });
});
