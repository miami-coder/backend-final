// Зовнішній маршрут у Google Maps. Окремий модуль — легкий юніт-тест і єдине
// місце зміни, якщо знадобиться інший провайдер карт.
export function routeUrl(venue: {
  latitude: number | null
  longitude: number | null
  address: string
  name: string
}): string {
  if (venue.latitude !== null && venue.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`
}
