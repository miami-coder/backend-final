export const VENUE_CREATED = 'venue.created';
export const VENUE_UPDATED = 'venue.updated';
export const VENUE_STATUS_CHANGED = 'venue.status_changed';

export class VenueCreatedEvent {
  static readonly event = VENUE_CREATED;
  constructor(public readonly venueId: string) {}
}

export class VenueUpdatedEvent {
  static readonly event = VENUE_UPDATED;
  constructor(public readonly venueId: string) {}
}

export class VenueStatusChangedEvent {
  static readonly event = VENUE_STATUS_CHANGED;
  constructor(public readonly venueId: string, public readonly from: string, public readonly to: string) {}
}
