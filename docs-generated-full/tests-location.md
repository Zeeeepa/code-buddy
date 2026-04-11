---
title: "tests — location"
module: "tests-location"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.925Z"
---
# tests — location

This document provides an overview of the `tests/location/location.test.ts` module, which is responsible for validating the functionality of the `LocationService` and its associated utility functions defined in `src/location/index.ts`.

## Location Module Tests

The `location.test.ts` file contains a comprehensive suite of tests designed to ensure the correctness, reliability, and expected behavior of the `LocationService` and its core geographical utility functions. It covers various aspects, from basic distance calculations to complex service configurations, caching, and event emissions.

### Purpose

The primary goals of this test module are:
*   **Validate Utility Functions**: Ensure that pure geographical calculation functions like `calculateDistance`, `calculateBearing`, `bearingToCardinal`, `isWithinRadius`, and `formatCoordinates` produce accurate results for various inputs and edge cases.
*   **Verify `LocationService` Core Functionality**: Confirm that the `LocationService` correctly retrieves location data, manages its configuration, handles caching, and integrates with mock locations.
*   **Test Service Interactions**: Ensure that the service correctly emits events (`location-update`, `source-change`) and responds to configuration changes.
*   **Ensure Singleton Behavior**: Validate that `getLocationService` consistently returns a single instance and that `resetLocationService` properly clears it.

### Module Structure

The tests are organized into three main `describe` blocks, reflecting the logical separation of concerns within the `src/location` module:

1.  **`Location Utilities`**: Tests for standalone, pure functions that perform geographical calculations.
2.  **`LocationService`**: Comprehensive tests for the `LocationService` class instance, covering its lifecycle, configuration, data retrieval, and various features.
3.  **`Singleton`**: Tests specifically for the `getLocationService` factory function and `resetLocationService` to ensure correct singleton pattern implementation.

```mermaid
graph TD
    A[tests/location/location.test.ts] --> B{src/location/index.ts}
    B --> C[LocationService Class]
    B --> D[getLocationService()]
    B --> E[resetLocationService()]
    B --> F[calculateDistance()]
    B --> G[calculateBearing()]
    B --> H[bearingToCardinal()]
    B --> I[isWithinRadius()]
    B --> J[formatCoordinates()]
```

### Location Utilities Tests

This section focuses on the pure utility functions that operate on `GeoCoordinates` objects (defined as `{ latitude: number; longitude: number; }`).

#### `calculateDistance(from: GeoCoordinates, to: GeoCoordinates)`
*   **Purpose**: Verifies the Haversine formula implementation for calculating the distance between two geographical points.
*   **Tests**:
    *   Calculates distance between known cities (Paris, London) to ensure approximate accuracy.
    *   Confirms zero distance for identical points.
    *   Handles points across the equator to test edge cases.

#### `calculateBearing(from: GeoCoordinates, to: GeoCoordinates)`
*   **Purpose**: Validates the calculation of the initial bearing (direction) from one point to another.
*   **Tests**:
    *   Checks bearings for cardinal directions (North, East, South, West) from a reference point.
    *   Uses `toBeCloseTo` for floating-point comparisons.

#### `bearingToCardinal(bearing: number)`
*   **Purpose**: Ensures correct conversion of a numerical bearing (0-360 degrees) into a cardinal direction string (N, NE, E, SE, S, SW, W, NW).
*   **Tests**:
    *   Covers all 8 primary cardinal directions.
    *   Verifies that 360 degrees correctly maps to 'N'.

#### `isWithinRadius(point: GeoCoordinates, center: GeoCoordinates, radiusMeters: number)`
*   **Purpose**: Confirms whether a given point falls within a specified radius of a center point.
*   **Tests**:
    *   Detects points correctly within a radius.
    *   Detects points correctly outside a radius.

#### `formatCoordinates(coords: GeoCoordinates, format: 'decimal' | 'dms')`
*   **Purpose**: Validates the formatting of `GeoCoordinates` into human-readable strings.
*   **Tests**:
    *   Formats coordinates as decimal degrees with fixed precision.
    *   Formats coordinates as Degrees, Minutes, Seconds (DMS), including correct cardinal indicators (N/S, E/W).
    *   Handles negative latitudes and longitudes for DMS formatting.

### LocationService Tests

This is the most extensive section, testing the `LocationService` class. Each test block within `LocationService` is set up with `beforeEach` and `afterEach` hooks to ensure a clean, isolated `LocationService` instance for every test.

```typescript
beforeEach(() => {
  resetLocationService(); // Ensures no shared state from previous tests
  service = new LocationService({
    cacheEnabled: false,
    reverseGeocode: false,
  });
});

afterEach(() => {
  service.shutdown(); // Cleans up any active timers/listeners
  resetLocationService();
});
```

#### Configuration
*   **`getConfig()`**: Verifies that the service returns its current configuration, including default and overridden settings.
*   **`updateConfig(newConfig: Partial<LocationServiceConfig>)`**: Ensures that configuration changes are correctly applied and reflected by `getConfig()`.

#### Location Retrieval
*   **`getCurrentLocation()`**: Tests the primary method for fetching location.
    *   Verifies that a `GeoLocation` object is returned with `latitude`, `longitude`, `timestamp`, and `source` (defaulting to 'ip').
*   **Mock Location**:
    *   `createMockLocation()`: Tests the creation of a mock location object.
    *   `setMockLocation()`: Verifies that setting a mock location causes `getCurrentLocation()` to return the mock data with 'mock' as the source.
*   **Event Emission**:
    *   `on('location-update', ...)`: Confirms that the `location-update` event is emitted after a location is successfully retrieved.

#### Caching
*   **Setup**: Tests in this block enable caching (`cacheEnabled: true, cacheTTLMs: 60000`).
*   **`getCachedLocation()`**: Verifies that a location is cached after `getCurrentLocation()` is called.
*   **Cache Hit**: Ensures that subsequent calls to `getCurrentLocation()` return the cached location (same timestamp) if within TTL.
*   **`forceRefresh: true`**: Tests that `getCurrentLocation({ forceRefresh: true })` bypasses the cache and fetches a new location.
*   **`clearCache()`**: Confirms that the cache can be explicitly cleared, resulting in `getCachedLocation()` returning `null`.

#### Reverse Geocoding
*   **Setup**: Tests in this block enable reverse geocoding (`reverseGeocode: true`).
*   **`getCurrentLocation()` with Address**: Verifies that the returned `GeoLocation` includes an `address` object with details like `city`. (Note: The test assumes a specific mock IP location that resolves to Paris).

#### Timezone
*   **`getCurrentLocation()` with Timezone**: Verifies that the returned `GeoLocation` includes a `timezone` object with an `id`.

#### Source Management
*   **`getSource()`**: Checks that the currently active location source is correctly reported.
*   **`setSource(source: LocationSource)`**: Ensures that the location source can be changed.
*   **Event Emission**:
    *   `on('source-change', ...)`: Confirms that the `source-change` event is emitted when the source is updated.

#### Distance & Direction (Service Context)
*   **Setup**: Uses `setMockLocation` to establish a known current location for the service.
*   **`getDistanceTo(target: GeoCoordinates)`**: Tests the service's ability to calculate distance from its current location to a target point, leveraging `calculateDistance`.
*   **`getBearingTo(target: GeoCoordinates)`**: Tests the service's ability to calculate bearing from its current location to a target point, leveraging `calculateBearing`.
*   **`isWithinRadius(target: GeoCoordinates, radiusMeters: number)`**: Tests the service's ability to check if a target is within a radius of its current location, leveraging `isWithinRadius`.

#### Auto-Update
*   **`startAutoUpdate()`**: Verifies that calling `startAutoUpdate()` sets the service's `isAutoUpdating` status to `true` in its statistics.
*   **`stopAutoUpdate()`**: Confirms that `stopAutoUpdate()` correctly sets `isAutoUpdating` to `false`.

#### Statistics
*   **`getStats()`**: Ensures that the `getStats()` method returns an object containing relevant operational statistics about the service, such as `enabled`, `source`, `hasCachedLocation`, and `isAutoUpdating`.

#### Manual Location
*   **`defaultLocation` config**: Tests that when the source is set to 'manual' and `defaultLocation` is configured, `getCurrentLocation()` returns this default.
*   **Error Handling**: Verifies that `getCurrentLocation({ source: 'manual' })` throws an error if no `defaultLocation` is configured.

### Singleton Tests

This section specifically tests the singleton pattern implementation for the `LocationService`.

*   **`getLocationService()`**:
    *   Verifies that multiple calls to `getLocationService()` return the *exact same instance* of `LocationService`.
*   **`resetLocationService()`**:
    *   Confirms that calling `resetLocationService()` after obtaining an instance causes `getLocationService()` to return a *new, distinct instance*.

### Contributing to Tests

When adding new features or fixing bugs in the `src/location` module, developers should:
1.  **Add New Test Cases**: Create new `it` blocks within the relevant `describe` block to cover the new functionality or specific bug fix.
2.  **Consider Edge Cases**: Think about invalid inputs, boundary conditions, and asynchronous behaviors.
3.  **Maintain Isolation**: Ensure that tests are independent and do not rely on the state set by previous tests. The `beforeEach` and `afterEach` hooks for `LocationService` are critical for this.
4.  **Use Mocks Appropriately**: For `LocationService` tests, use `createMockLocation` and `setMockLocation` to control the location data, preventing reliance on external services during testing.
5.  **Verify Event Emissions**: If your feature involves events, add tests to ensure events are emitted correctly with the expected payload.