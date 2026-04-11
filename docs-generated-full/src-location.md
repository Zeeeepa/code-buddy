---
title: "src — location"
module: "src-location"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.556Z"
---
# src — location

The `src/location` module provides a comprehensive service for managing and retrieving geographic location data within the application. It encapsulates location acquisition logic, caching, configuration, and offers a suite of utility functions for common geospatial calculations.

This module is designed to be the single source of truth for location information, abstracting away the complexities of different location sources (GPS, IP, manual, etc.), reverse geocoding, and timezone resolution.

## Core Concepts and Data Models

The module defines several interfaces to represent location data and configuration:

*   **`GeoCoordinates`**: The fundamental building block for any geographic point, including latitude, longitude, altitude, speed, heading, and accuracy metrics.
*   **`GeoLocation`**: Extends `GeoCoordinates` to provide a complete location context. It adds a `timestamp`, `source` (e.g., `'gps'`, `'ip'`), an optional `name`, `address` components, and `timezone` information. This is the primary data structure returned by the `LocationService`.
*   **`LocationSource`**: A union type (`'gps' | 'network' | 'ip' | 'manual' | 'cached' | 'mock'`) indicating where the location data originated.
*   **`AddressComponents`**: Detailed breakdown of a physical address (street, city, country, postal code, etc.).
*   **`TimezoneInfo`**: Information about the timezone at a given location (ID, abbreviation, UTC offset, DST status).
*   **`LocationConfig`**: An interface for configuring the `LocationService`, including settings for caching, auto-updates, preferred source, reverse geocoding, and fallback locations. `DEFAULT_LOCATION_CONFIG` provides sensible defaults.
*   **`LocationEvents`**: Defines the events emitted by the `LocationService` (`'location-update'`, `'location-error'`, `'source-change'`).

## Utility Functions

The module exports several pure functions for common geographical calculations, which can be used independently or are leveraged by the `LocationService`.

*   **`calculateDistance(point1: GeoCoordinates, point2: GeoCoordinates): number`**
    Calculates the distance in meters between two geographic points using the Haversine formula.
    *Internal calls: `toRadians`*

*   **`calculateBearing(from: GeoCoordinates, to: GeoCoordinates): number`**
    Calculates the initial bearing in degrees (0-360) from one point to another.
    *Internal calls: `toRadians`, `toDegrees`*

*   **`bearingToCardinal(bearing: number): string`**
    Converts a numeric bearing (0-360 degrees) into a cardinal direction string (e.g., 'N', 'NE', 'SW').

*   **`isWithinRadius(point: GeoCoordinates, center: GeoCoordinates, radiusMeters: number): boolean`**
    Checks if a given `point` is within a specified `radiusMeters` of a `center` point.
    *Internal calls: `calculateDistance`*

*   **`formatCoordinates(coords: GeoCoordinates, format: 'decimal' | 'dms' = 'decimal'): string`**
    Formats geographic coordinates into a human-readable string, either in decimal degrees or Degrees-Minutes-Seconds (DMS) format.

## `LocationService`

The `LocationService` class is the central component of this module. It extends `EventEmitter` to allow other parts of the application to subscribe to location updates and errors.

### Instantiation and Singleton Pattern

The `LocationService` can be instantiated directly, but it also provides a singleton pattern to ensure a single, consistent instance across the application:

*   **`getLocationService(config?: Partial<LocationConfig>): LocationService`**: Returns the singleton instance of `LocationService`, creating it if it doesn't already exist. Configuration provided here will be merged with `DEFAULT_LOCATION_CONFIG` on first creation.
*   **`resetLocationService(): void`**: Shuts down the current singleton instance and clears it, allowing a new instance to be created on the next call to `getLocationService`. This is primarily useful for testing or application resets.
    *Internal calls: `shutdown`*

### Configuration

*   **`constructor(config: Partial<LocationConfig> = {})`**: Initializes the service with default or provided configuration.
*   **`getConfig(): LocationConfig`**: Returns the current configuration of the service.
*   **`updateConfig(config: Partial<LocationConfig>): void`**: Merges the provided partial configuration with the existing one. If `autoUpdateIntervalMs` is changed, it will automatically stop and restart the auto-update mechanism.
    *Internal calls: `stopAutoUpdate`, `startAutoUpdate`*

### Location Retrieval (`getCurrentLocation`)

The core method for obtaining location data is `getCurrentLocation`. It handles source preference, caching, and post-processing.

```mermaid
graph TD
    A[getCurrentLocation(options?)] --> B{Mock Location Set?}
    B -- Yes --> Z[Return mockLocation]
    B -- No --> C{Cache Valid & Enabled?}
    C -- Yes --> Z
    C -- No --> D{Determine Source}
    D -- ip --> E[getLocationByIP()]
    D -- manual --> F[Use config.defaultLocation]
    D -- cached --> G[Return cachedLocation]
    D -- gps/network (mock) --> E
    E --> H[createLocation()]
    F --> H
    G --> H
    H --> I{Reverse Geocode Enabled & Needed?}
    I -- Yes --> J[reverseGeocode(location)]
    J --> K{Timezone Needed?}
    I -- No --> K
    K -- Yes --> L[getTimezone(location)]
    L --> M[Update Cache]
    K -- No --> M
    M --> N[Emit 'location-update']
    M --> O[Return GeoLocation]
    A --> P[Emit 'location-error']
```

1.  **Mock Location Check**: If `setMockLocation` has been used, it immediately returns the mock location.
2.  **Cache Check**: If caching is enabled (`config.cacheEnabled`) and a valid `cachedLocation` exists within `config.cacheTTLMs`, the cached location is returned. `options.forceRefresh` bypasses the cache.
3.  **Source Selection**: The location source is determined by `options.source` or the `currentSource` (which defaults to `config.preferredSource`).
    *   `'ip'`: Calls `getLocationByIP()`.
    *   `'manual'`: Uses `config.defaultLocation` if set.
    *   `'cached'`: Returns the `cachedLocation` (if available).
    *   `'gps'`, `'network'`: In the current mock implementation, these fall back to `getLocationByIP()`.
4.  **Location Object Creation**: `createLocation()` is used to standardize the `GeoLocation` object.
5.  **Post-Processing**:
    *   **Reverse Geocoding**: If `config.reverseGeocode` is true and the retrieved location doesn't already have address components, `reverseGeocode()` is called to enrich the `GeoLocation` object.
    *   **Timezone Resolution**: If the location doesn't have timezone information, `getTimezone()` is called.
6.  **Cache Update**: The newly acquired location is stored in `cachedLocation` if `config.cacheEnabled` is true.
7.  **Event Emission**: On success, a `'location-update'` event is emitted. On failure, a `'location-error'` event is emitted.

#### Internal Location Acquisition (Mock Implementations)

The current module provides mock implementations for external API calls:

*   **`getLocationByIP(): Promise<GeoLocation>`**: Simulates an IP geolocation API call, currently returning hardcoded coordinates for Paris.
    *Internal calls: `createLocation`*
*   **`reverseGeocode(location: GeoLocation): Promise<AddressComponents | undefined>`**: Simulates a reverse geocoding API call. It returns a mock address for Paris if the coordinates are close, otherwise a generic formatted string.
*   **`getTimezone(location: GeoLocation): TimezoneInfo`**: Provides a simple timezone estimation based on longitude, returning mock timezone info for Paris.

### Auto-Update

*   **`startAutoUpdate(): void`**: Initiates a `setInterval` to periodically call `getCurrentLocation({ forceRefresh: true })` based on `config.autoUpdateIntervalMs`. Errors during auto-update are emitted via `'location-error'`.
    *Internal calls: `getCurrentLocation`*
*   **`stopAutoUpdate(): void`**: Clears the auto-update interval, stopping periodic location fetches.

### Source Management

*   **`getSource(): LocationSource`**: Returns the currently active location source.
*   **`setSource(source: LocationSource): void`**: Sets the preferred location source for subsequent `getCurrentLocation` calls. Emits a `'source-change'` event.

### Mock Support (for Testing)

*   **`setMockLocation(location: GeoLocation | null): void`**: Allows setting a specific `GeoLocation` object that `getCurrentLocation` will immediately return, bypassing all other logic. Essential for predictable testing.
*   **`createMockLocation(latitude: number, longitude: number, options?: Partial<GeoLocation>): GeoLocation`**: A helper to easily create `GeoLocation` objects with a `'mock'` source for testing purposes.

### Cache Management

*   **`clearCache(): void`**: Resets the internal `cachedLocation` and `cacheTimestamp`.
*   **`getCachedLocation(): GeoLocation | null`**: Returns the currently cached `GeoLocation` object, if any.

### Distance & Direction Utilities

The `LocationService` integrates the module's utility functions for convenience:

*   **`getDistanceTo(point: GeoCoordinates): Promise<number>`**: Calculates the distance from the current location (fetched via `getCurrentLocation`) to a specified point.
    *Internal calls: `getCurrentLocation`, `calculateDistance`*
*   **`getBearingTo(point: GeoCoordinates): Promise<number>`**: Calculates the bearing from the current location to a specified point.
    *Internal calls: `getCurrentLocation`, `calculateBearing`*
*   **`isWithinRadius(center: GeoCoordinates, radiusMeters: number): Promise<boolean>`**: Checks if the current location is within a specified radius of a center point.
    *Internal calls: `getCurrentLocation`, `isWithinRadius`*

### Lifecycle and Stats

*   **`shutdown(): void`**: Cleans up the service by stopping auto-updates, clearing the cache, and removing any mock location.
    *Internal calls: `stopAutoUpdate`, `clearCache`*
*   **`getStats(): object`**: Returns an object containing various statistics about the service's current state, such as `enabled`, `source`, `hasCachedLocation`, `cacheAge`, and `isAutoUpdating`.

## How to Use

```typescript
import { getLocationService, LocationService, GeoCoordinates } from './location'; // Adjust path as needed

async function initializeLocation() {
  const locationService: LocationService = getLocationService({
    preferredSource: 'ip',
    autoUpdateIntervalMs: 5000, // Update every 5 seconds
    reverseGeocode: true,
  });

  // Listen for location updates
  locationService.on('location-update', (location) => {
    console.log('Location updated:', location.name || location.formatted, location.latitude, location.longitude);
    if (location.address) {
      console.log('Address:', location.address.formatted);
    }
    if (location.timezone) {
      console.log('Timezone:', location.timezone.id);
    }
  });

  // Listen for errors
  locationService.on('location-error', (error) => {
    console.error('Location error:', error.message);
  });

  // Start auto-updating
  locationService.startAutoUpdate();

  // Get current location once
  try {
    const currentLocation = await locationService.getCurrentLocation({ forceRefresh: true });
    console.log('Initial current location:', currentLocation.name || currentLocation.formatted);

    // Example: Calculate distance to a point
    const eiffelTower: GeoCoordinates = { latitude: 48.8584, longitude: 2.2945 };
    const distance = await locationService.getDistanceTo(eiffelTower);
    console.log(`Distance to Eiffel Tower: ${distance.toFixed(2)} meters`);

    // Example: Check if within radius
    const isNearEiffel = await locationService.isWithinRadius(eiffelTower, 2000); // 2km radius
    console.log(`Is within 2km of Eiffel Tower: ${isNearEiffel}`);

  } catch (error) {
    console.error('Failed to get initial location:', error);
  }

  // You can also manually set the source
  // locationService.setSource('manual');
  // locationService.updateConfig({ defaultLocation: { latitude: 34.0522, longitude: -118.2437 } }); // Los Angeles

  // To stop auto-updates and clean up
  // setTimeout(() => {
  //   locationService.stopAutoUpdate();
  //   console.log('Auto-update stopped.');
  //   locationService.shutdown();
  //   console.log('Location service shut down.');
  // }, 30000);
}

initializeLocation();
```

## Extension Points and Future Work

The current `LocationService` includes mock implementations for `getLocationByIP`, `reverseGeocode`, and `getTimezone`. For a production environment, these methods would need to be replaced with actual API calls to external services (e.g., Google Maps Geocoding API, OpenStreetMap Nominatim, IP geolocation providers, timezone APIs).

Additionally, support for native GPS/network location (e.g., using browser Geolocation API or a mobile SDK) would be integrated into the `getCurrentLocation` method, likely as new `case` statements within the `switch (source)` block.