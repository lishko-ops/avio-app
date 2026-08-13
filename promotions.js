// Pure promotion eligibility + pricing logic, shared by the app (loaded as a
// plain <script>, so these become globals) and the Node test suite in tests/
// (loaded via require(), so they're exported through the CommonJS guard below).

function computeDiscountAmount(type, value, originalPrice) {
    if (!(originalPrice > 0) || !(value > 0))
        return 0;
    const raw = type === 'fixed' ? value : (originalPrice * value / 100);
    const rounded = Math.round(raw * 100) / 100;
    return Math.max(0, Math.min(rounded, originalPrice));
}

function isServiceEligibleForDeal(deal, service) {
    if (!deal || !deal.eligibleServiceIds || deal.eligibleServiceIds.length === 0)
        return true;
    if (!service || !service.id)
        return false;
    return deal.eligibleServiceIds.includes(service.id);
}

// bookingCreatedAt is the moment the customer confirms the booking (ms epoch)
// — never the appointment date/time. Returns a locked promotion snapshot to
// store on the booking, or null if no promotion applies. This is the single
// authoritative pricing calculation: callers must always pass the *current*
// deal and a *freshly read* bookingCreatedAt at the moment of confirmation —
// never a value computed earlier and carried forward from an earlier screen.
function resolvePromotionSnapshot(deal, service, bookingCreatedAt) {
    if (!deal || !deal.enabled)
        return null;
    if (deal.activatedAt == null || !(bookingCreatedAt >= deal.activatedAt))
        return null;
    if (deal.expiresAt != null && !(bookingCreatedAt < deal.expiresAt))
        return null;
    if (!service || !(service.price > 0))
        return null;
    if (!isServiceEligibleForDeal(deal, service))
        return null;
    const originalPrice = service.price;
    const discountAmount = computeDiscountAmount(deal.type, deal.value, originalPrice);
    if (discountAmount <= 0)
        return null;
    const finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100;
    return {
        promotionId: deal.id,
        promotionLabel: deal.label,
        promotionType: deal.type,
        promotionValue: deal.value,
        originalPrice,
        discountAmount,
        finalPrice,
        promotionAppliedAt: bookingCreatedAt,
    };
}

// Turning a promotion ON stamps a fresh activation moment — only bookings
// created from this instant forward become eligible. Re-activating later
// (after being off) stamps a new, later moment, closing any gap.
function activatePromotion(deal, now) {
    return Object.assign({}, deal, { enabled: true, activatedAt: now });
}

// Turning a promotion OFF only stops *future* bookings from qualifying.
// It intentionally leaves activatedAt untouched — already-locked bookings
// are unaffected because they never look the deal back up.
function deactivatePromotion(deal) {
    return Object.assign({}, deal, { enabled: false });
}

function resolveProviderDeal(providerId, myProviderId, myDeal, feedList) {
    if (providerId === myProviderId)
        return myDeal || null;
    const item = (feedList || []).find((f) => f.id === providerId);
    return (item && item.deal) || null;
}

// Reproduces gross/discount/net for a stored booking, always preferring the
// values locked on the booking at confirm time over any live recalculation.
function summarizeBookingRevenue(booking) {
    const net = booking.finalPrice != null ? booking.finalPrice : booking.price;
    const gross = booking.originalPrice != null ? booking.originalPrice : net;
    const discount = booking.discountAmount != null ? booking.discountAmount : Math.max(0, gross - net);
    return { gross, discount, net };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeDiscountAmount,
        isServiceEligibleForDeal,
        resolvePromotionSnapshot,
        activatePromotion,
        deactivatePromotion,
        resolveProviderDeal,
        summarizeBookingRevenue,
    };
}
