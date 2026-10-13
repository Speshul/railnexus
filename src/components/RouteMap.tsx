"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { useT } from "@/i18n/client";

export type MapStop = {
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  halt: boolean;
  label?: string;
  inSegment?: boolean;
  emphasis?: boolean;
};

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

export default function RouteMap({ stops, height = 420, showPassing = false }: { stops: MapStop[]; height?: number; showPassing?: boolean }) {
  const t = useT();
  const pts = stops.filter((s) => s.lat !== null && s.lng !== null);
  if (!pts.length) {
    return <div className="flex items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500" style={{ height }}>{t("map.none")}</div>;
  }
  const ll = (s: MapStop): LatLngExpression => [s.lat!, s.lng!];
  const hasSegment = pts.some((s) => s.inSegment);
  const seg = hasSegment ? pts.filter((s) => s.inSegment) : pts;
  const bounds: LatLngBoundsExpression = seg.map((s) => [s.lat!, s.lng!] as [number, number]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" style={{ height }} role="region"
      aria-label={t("map.label", { n: pts.filter((s) => s.halt).length, from: pts[0].name, to: pts[pts.length - 1].name })}>
      <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <Polyline positions={pts.map(ll)} pathOptions={{ color: hasSegment ? "#94a3b8" : "#04056f", weight: 3, opacity: 0.8 }} />
        {hasSegment && <Polyline positions={seg.map(ll)} pathOptions={{ color: "#04056f", weight: 5 }} />}
        {pts.map((s, i) =>
          s.halt || showPassing ? (
            <CircleMarker
              key={`${s.code}-${i}`}
              center={ll(s)}
              radius={s.emphasis ? 8 : s.halt ? 5 : 2.5}
              pathOptions={{
                color: s.emphasis ? "#fcb831" : s.halt ? "#04056f" : "#64748b",
                fillColor: s.emphasis ? "#fcb831" : "#ffffff",
                fillOpacity: 1,
                weight: s.halt ? 2 : 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} permanent={s.emphasis}>
                <b>{s.name}</b> ({s.code}){s.label ? <><br />{s.label}</> : null}
              </Tooltip>
            </CircleMarker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
