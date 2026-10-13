"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { Destination } from "@/lib/explore";
import { bucketOf, BUCKETS } from "./buckets";
import { useT } from "@/i18n/client";
import { formatDuration } from "@/lib/dates";

function Fit({ bounds, selected }: { bounds: LatLngBoundsExpression | null; selected: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    // The container can still be sizing itself on first render; measure again before fitting.
    map.invalidateSize();
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  }, [map, bounds]);
  useEffect(() => {
    if (selected) map.panTo(selected, { animate: true });
  }, [map, selected]);
  return null;
}

/** Map of every reachable destination, coloured by journey time and sized by how big the station is. */
export default function ExploreMap({ origin, destinations, selected, onSelect }: {
  origin: { name: string; lat: number; lng: number };
  destinations: Destination[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const t = useT();
  // Refit only when the set of places changes (not on every selection).
  const key = destinations.map((d) => d.code).join(",");
  const bounds = useMemo<LatLngBoundsExpression | null>(
    () => [[origin.lat, origin.lng], ...destinations.map((d) => [d.lat, d.lng] as [number, number])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, origin.lat, origin.lng]
  );
  const sel = destinations.find((d) => d.code === selected);

  return (
    <div className="h-[640px] overflow-hidden rounded-md" role="region"
      aria-label={t("explore.mapLabel", { n: destinations.length, origin: origin.name })}>
      <MapContainer bounds={bounds ?? undefined} boundsOptions={{ padding: [30, 30], maxZoom: 8 }} preferCanvas scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit bounds={bounds} selected={sel ? [sel.lat, sel.lng] : null} />
        {destinations.map((d) => {
          const b = BUCKETS[bucketOf(d.fastest)];
          const isSel = d.code === selected;
          return (
            <CircleMarker
              key={d.code}
              center={[d.lat, d.lng]}
              radius={isSel ? 11 : Math.min(9, 3 + Math.log2(1 + d.size / 15))}
              pathOptions={{ color: isSel ? "#0f172a" : "#ffffff", weight: isSel ? 3 : 1, fillColor: b.color, fillOpacity: 0.9 }}
              eventHandlers={{ click: () => onSelect(d.code) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <b>{d.name}</b> · {formatDuration(d.fastest, t.locale)}
              </Tooltip>
            </CircleMarker>
          );
        })}
        <CircleMarker center={[origin.lat, origin.lng]} radius={10} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1b2559", fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -10]}><b>{origin.name}</b></Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
