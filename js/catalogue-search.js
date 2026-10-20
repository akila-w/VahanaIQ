// Local catalogue discovery never calls an external AI or transmits the query.
export function searchCatalogue(vehicles, query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return vehicles.filter(v => words.every(word => [v.make, v.model, v.name, v.year, v.body, v.fuel, v.pt].join(" ").toLowerCase().includes(word)));
}
