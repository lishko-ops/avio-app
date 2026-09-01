const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getBookingNavigationDestination,
    isPlausibleAddress,
    buildAppleMapsUrl,
    buildGoogleMapsAppUrl,
    buildGoogleMapsWebUrl,
    buildWazeAppUrl,
    buildWazeWebUrl,
    shouldShowAppleMapsOption,
} = require('../directions.js');

test('business-location booking resolves to the booked business address', () => {
    const booking = { serviceLocation: 'business', address: '214 Bedford Ave, Brooklyn, NY' };
    assert.equal(getBookingNavigationDestination(booking), '214 Bedford Ave, Brooklyn, NY');
});

test('mobile/customer-location booking resolves to the service address, never the business default', () => {
    const booking = {
        serviceLocation: 'customer',
        address: 'Glam Studio, 500 Fake Business Blvd, Brooklyn, NY', // business's own default — must be ignored
        serviceAddress: { full: '99 Customer St, Queens, NY' },
    };
    assert.equal(getBookingNavigationDestination(booking), '99 Customer St, Queens, NY');
});

test('a business-location booking with a stray serviceAddress field still uses the business address', () => {
    // serviceLocation is the actual switch, not merely the presence of a serviceAddress object.
    const booking = { serviceLocation: 'business', address: '214 Bedford Ave, Brooklyn, NY', serviceAddress: { full: 'unrelated address' } };
    assert.equal(getBookingNavigationDestination(booking), '214 Bedford Ave, Brooklyn, NY');
});

test('no address at all resolves to null — Get Directions should be disabled, never open an empty map', () => {
    assert.equal(getBookingNavigationDestination({}), null);
    assert.equal(getBookingNavigationDestination(null), null);
});

test('two different bookings always resolve to their own, independent addresses', () => {
    // Guards against a stale/shared reference ever leaking one booking's destination into
    // another's directions sheet.
    const glamStudio = { serviceLocation: 'business', address: '214 Bedford Ave, Brooklyn, NY' };
    const johnBarber = { serviceLocation: 'business', address: '123 Main St, New York, NY' };
    assert.equal(getBookingNavigationDestination(glamStudio), '214 Bedford Ave, Brooklyn, NY');
    assert.equal(getBookingNavigationDestination(johnBarber), '123 Main St, New York, NY');
});

test('Apple Maps, Google Maps, and Waze all receive the exact same destination address', () => {
    const booking = { serviceLocation: 'business', address: '214 Bedford Ave, Brooklyn, NY' };
    const destination = getBookingNavigationDestination(booking);
    const encoded = encodeURIComponent(destination);
    assert.ok(buildAppleMapsUrl(destination).includes(encoded));
    assert.ok(buildGoogleMapsAppUrl(destination).includes(encoded));
    assert.ok(buildGoogleMapsWebUrl(destination).includes(encoded));
    assert.ok(buildWazeAppUrl(destination).includes(encoded));
    assert.ok(buildWazeWebUrl(destination).includes(encoded));
});

test('the same rule applies for a mobile/customer-location booking — all three apps get the service address', () => {
    const booking = { serviceLocation: 'customer', address: 'Business Default Address', serviceAddress: { full: '99 Customer St, Queens, NY' } };
    const destination = getBookingNavigationDestination(booking);
    const encoded = encodeURIComponent(destination);
    assert.equal(destination, '99 Customer St, Queens, NY');
    assert.ok(buildAppleMapsUrl(destination).includes(encoded));
    assert.ok(buildGoogleMapsAppUrl(destination).includes(encoded));
    assert.ok(buildGoogleMapsWebUrl(destination).includes(encoded));
    assert.ok(buildWazeAppUrl(destination).includes(encoded));
    assert.ok(buildWazeWebUrl(destination).includes(encoded));
    // None of the three should ever mention the business's own address instead.
    [buildAppleMapsUrl(destination), buildGoogleMapsAppUrl(destination), buildGoogleMapsWebUrl(destination), buildWazeAppUrl(destination), buildWazeWebUrl(destination)]
        .forEach((url) => assert.equal(url.includes(encodeURIComponent('Business Default Address')), false));
});

test('Google Maps and Waze each expose a native app URL distinct from their web fallback URL', () => {
    const address = '214 Bedford Ave, Brooklyn, NY';
    assert.notEqual(buildGoogleMapsAppUrl(address), buildGoogleMapsWebUrl(address));
    assert.notEqual(buildWazeAppUrl(address), buildWazeWebUrl(address));
    assert.ok(buildGoogleMapsAppUrl(address).startsWith('comgooglemaps://'));
    assert.ok(buildWazeAppUrl(address).startsWith('waze://'));
    assert.ok(buildGoogleMapsWebUrl(address).startsWith('https://'));
    assert.ok(buildWazeWebUrl(address).startsWith('https://'));
});

test('URL-significant characters in an address are safely encoded, never left raw to break the URL', () => {
    // '#' would otherwise start a URL fragment and truncate everything after it — the one
    // character in this address that MUST be escaped for the URL to still mean what it says.
    const address = '123 Main St, Apt #4, Queens, NY';
    const url = buildGoogleMapsWebUrl(address);
    assert.equal(url.includes('#4'), false);
    assert.ok(url.includes('%234'));
    assert.ok(url.includes(encodeURIComponent(address)));
});

test('isPlausibleAddress rejects empty/placeholder values, accepts a real-looking address', () => {
    assert.equal(isPlausibleAddress(''), false);
    assert.equal(isPlausibleAddress('   '), false);
    assert.equal(isPlausibleAddress('N/A'), false);
    assert.equal(isPlausibleAddress('TBD'), false);
    assert.equal(isPlausibleAddress(null), false);
    assert.equal(isPlausibleAddress(undefined), false);
    assert.equal(isPlausibleAddress('214 Bedford Ave, Brooklyn, NY'), true);
    assert.equal(isPlausibleAddress('99 Customer St, Queens, NY'), true);
});

test('shouldShowAppleMapsOption hides on Android, shows on iOS/desktop/unknown', () => {
    assert.equal(shouldShowAppleMapsOption('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36'), false);
    assert.equal(shouldShowAppleMapsOption('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'), true);
    assert.equal(shouldShowAppleMapsOption('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), true);
    assert.equal(shouldShowAppleMapsOption(''), true);
    assert.equal(shouldShowAppleMapsOption(undefined), true);
});
