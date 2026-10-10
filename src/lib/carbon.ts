// Approximate per-passenger emissions (kg CO2e per passenger-km): Indian Railways' largely electrified
// network vs a domestic flight vs a petrol car with a couple of occupants.
const KG_PER_KM = { train: 0.03, flight: 0.15, car: 0.11 };

/** CO2 saved (kg, rounded) by taking the train instead of flying the same distance. */
export function co2SavedVsFlight(km: number) {
  return Math.max(0, Math.round(km * (KG_PER_KM.flight - KG_PER_KM.train)));
}

export function co2Trip(km: number) {
  return { train: Math.round(km * KG_PER_KM.train), flight: Math.round(km * KG_PER_KM.flight), car: Math.round(km * KG_PER_KM.car) };
}
