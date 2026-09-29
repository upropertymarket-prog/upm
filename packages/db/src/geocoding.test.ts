import { afterEach, describe, expect, it, vi } from "vitest";

import { approxOffset, geocodeAddress } from "./geocoding";

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos((a.lat * Math.PI) / 180);
  const dLat = (b.lat - a.lat) * metersPerDegreeLat;
  const dLon = (b.lon - a.lon) * metersPerDegreeLon;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

describe("approxOffset — offset determinístico (02 §11)", () => {
  const exact = { lat: 38.7223, lon: -9.1393 };

  it("é determinístico: mesmo property_id dá sempre o mesmo ponto", async () => {
    const a = await approxOffset("prop-1", exact, 400);
    const b = await approxOffset("prop-1", exact, 400);
    expect(a).toEqual(b);
  });

  it("nunca excede o raio pedido", async () => {
    const offset = await approxOffset("prop-2", exact, 400);
    expect(distanceMeters(exact, offset)).toBeLessThanOrEqual(400);
  });

  it("ids diferentes dão pontos diferentes (não fica sempre no mesmo quadrante)", async () => {
    const ids = ["prop-a", "prop-b", "prop-c", "prop-d", "prop-e"];
    const offsets = await Promise.all(ids.map((id) => approxOffset(id, exact, 400)));
    const unique = new Set(offsets.map((o) => `${o.lat.toFixed(6)},${o.lon.toFixed(6)}`));
    expect(unique.size).toBe(ids.length);
  });
});

describe("geocodeAddress — Nominatim (02 §11)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve lat/lon do primeiro resultado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ lat: "38.7223", lon: "-9.1393" }],
      }),
    );

    const result = await geocodeAddress("Rua Augusta, Lisboa");
    expect(result).toEqual({ lat: 38.7223, lon: -9.1393 });
  });

  it("devolve null sem resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    expect(await geocodeAddress("morada inexistente")).toBeNull();
  });

  it("devolve null em erro de rede, sem rebentar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    expect(await geocodeAddress("Rua Augusta, Lisboa")).toBeNull();
  });

  it("devolve null para morada vazia sem chamar a rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocodeAddress("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
