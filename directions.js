// Pure "get directions" logic — destination resolution + external map URL building — shared
// by the app (loaded as a plain <script>, so these become globals) and the Node test suite in
// tests/ (loaded via require(), so they're exported through the CommonJS guard below). Kept
// free of window/navigator/DOM access so every rule here (which address wins, what a "real"
// address looks like, which apps to offer) is directly testable without a browser.

// The single source of truth for "where does this booking's Get Directions actually go" — a
// mobile/customer-location booking must resolve to the address the service happens at, never
// the business's own default location, even though both fields exist on the same booking.
function getBookingNavigationDestination(booking) {
    if (!booking)
        return null;
    if (booking.serviceLocation === 'customer' && booking.serviceAddress && booking.serviceAddress.full)
        return booking.serviceAddress.full;
    return booking.address || null;
}

// Cheap sanity check, not real geocoding: catches empty strings and obvious placeholder values
// ("N/A", "TBD", "-") without a network call, so the sheet can show a friendly error instead of
// opening a map app to nothing. A real street address always has at least one digit (a street
// number) and one letter.
function isPlausibleAddress(address) {
    if (typeof address !== 'string')
        return false;
    const trimmed = address.trim();
    if (trimmed.length < 6)
        return false;
    return /\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}

// Apple Maps has no separate "is it installed" question on iOS — the universal link always
// opens the system Maps app directly, no fallback needed.
function buildAppleMapsUrl(address) {
    return 'https://maps.apple.com/?daddr=' + encodeURIComponent(address);
}
// comgooglemaps:// only resolves if the Google Maps app is installed; the web URL is the
// fallback when it isn't (or on any platform without app-scheme support at all).
function buildGoogleMapsAppUrl(address) {
    return 'comgooglemaps://?daddr=' + encodeURIComponent(address) + '&directionsmode=driving';
}
function buildGoogleMapsWebUrl(address) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
}
// Same app-scheme/web-fallback split as Google Maps, for Waze.
function buildWazeAppUrl(address) {
    return 'waze://?q=' + encodeURIComponent(address) + '&navigate=yes';
}
function buildWazeWebUrl(address) {
    return 'https://waze.com/ul?q=' + encodeURIComponent(address) + '&navigate=yes';
}

// Apple Maps is never worth offering on Android — there's no app for it to open, and the web
// fallback is just an inferior version of Google Maps' own web page. Takes the user agent as a
// plain string (rather than reading navigator directly) so this stays testable without a DOM.
function shouldShowAppleMapsOption(userAgent) {
    return !/android/i.test(userAgent || '');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getBookingNavigationDestination,
        isPlausibleAddress,
        buildAppleMapsUrl,
        buildGoogleMapsAppUrl,
        buildGoogleMapsWebUrl,
        buildWazeAppUrl,
        buildWazeWebUrl,
        shouldShowAppleMapsOption,
    };
}
