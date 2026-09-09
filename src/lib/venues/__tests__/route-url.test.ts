import { describe, expect, it } from 'vitest'
import { routeUrl } from '@/lib/venues/route-url'

describe('routeUrl', () => {
  it('є координати → Google Maps dir-URL з lat,lng', () => {
    const url = routeUrl({ latitude: 50.4477, longitude: 30.5227, address: 'Хрещатик 1', name: 'Бар' })
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=50.4477,30.5227')
  })
  it('без координат → search за «назва, адреса» (encodeURIComponent)', () => {
    const url = routeUrl({ latitude: null, longitude: null, address: 'Хрещатик 1', name: 'Бар «П»' })
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Бар «П», Хрещатик 1'),
    )
  })
})
