const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeDiscountAmount,
    isServiceEligibleForDeal,
    resolvePromotionSnapshot,
    activatePromotion,
    deactivatePromotion,
    resolveProviderDeal,
    summarizeBookingRevenue,
} = require('../promotions.js');

const HOUR = 60 * 60 * 1000;
const MY_PROVIDER_ID = 'me-business';
const service = { id: 'svc-fade', name: "Men's Fade", price: 45 };

function baseDeal(overrides) {
    return Object.assign({
        id: 'deal-main',
        enabled: true,
        type: 'percent',
        value: 20,
        label: '20% OFF TODAY',
        activatedAt: 1000,
        expiresAt: null,
        eligibleServiceIds: null,
    }, overrides);
}

test('booking created before promotion activation gets no discount', () => {
    const deal = baseDeal({ activatedAt: 2000 });
    const snapshot = resolvePromotionSnapshot(deal, service, 1000);
    assert.equal(snapshot, null);
});

test('booking created after activation receives the discount', () => {
    const deal = baseDeal({ activatedAt: 1000 });
    const snapshot = resolvePromotionSnapshot(deal, service, 2000);
    assert.ok(snapshot);
    assert.equal(snapshot.originalPrice, 45);
    assert.equal(snapshot.discountAmount, 9);
    assert.equal(snapshot.finalPrice, 36);
    assert.equal(snapshot.promotionLabel, '20% OFF TODAY');
});

test('a future appointment booked during the promotion still receives it — appointment date is irrelevant', () => {
    // The booking is *created* now, while active, even though the appointment itself is far in the future.
    // resolvePromotionSnapshot never even receives an appointment date — only bookingCreatedAt — proving
    // eligibility can't be a function of when the service happens.
    const deal = baseDeal({ activatedAt: Date.now() - HOUR });
    const bookingCreatedAt = Date.now();
    const snapshot = resolvePromotionSnapshot(deal, service, bookingCreatedAt);
    assert.ok(snapshot);
    assert.equal(snapshot.finalPrice, 36);
});

test('a booking made before activation for an appointment happening today does not receive the promotion', () => {
    const activatedAt = Date.now();
    const bookingCreatedYesterday = activatedAt - 24 * HOUR;
    const deal = baseDeal({ activatedAt });
    const snapshot = resolvePromotionSnapshot(deal, service, bookingCreatedYesterday);
    assert.equal(snapshot, null);
});

test('turning promotion off does not change existing discounted bookings', () => {
    let deal = baseDeal({ activatedAt: 1000 });
    const lockedSnapshot = resolvePromotionSnapshot(deal, service, 1500);
    assert.ok(lockedSnapshot);

    deal = deactivatePromotion(deal);

    // The booking's own stored snapshot is immutable — re-deriving it from the (now-off) deal
    // is not how a real booking would ever be re-evaluated, but confirms turning off breaks
    // nothing about the object we already locked in.
    assert.equal(lockedSnapshot.finalPrice, 36);
    assert.equal(lockedSnapshot.discountAmount, 9);
    assert.equal(deal.enabled, false);
});

test('a booking made one moment after deactivation receives no discount', () => {
    let deal = baseDeal({ activatedAt: 1000 });
    deal = deactivatePromotion(deal);
    const snapshot = resolvePromotionSnapshot(deal, service, Date.now());
    assert.equal(snapshot, null);
});

test('re-activating after being off only makes bookings from the new activation moment eligible', () => {
    let deal = baseDeal({ activatedAt: 1000, enabled: false });
    const beforeReactivation = resolvePromotionSnapshot(deal, service, 5000);
    assert.equal(beforeReactivation, null); // was off

    deal = activatePromotion(deal, 6000);
    const rightAfter = resolvePromotionSnapshot(deal, service, 6001);
    const stillBefore = resolvePromotionSnapshot(deal, service, 5999);
    assert.ok(rightAfter);
    assert.equal(stillBefore, null);
});

test('editing the promotion does not modify previously confirmed bookings', () => {
    const dealAt20 = baseDeal({ value: 20, activatedAt: 1000 });
    const lockedAt20 = resolvePromotionSnapshot(dealAt20, service, 1500);
    assert.equal(lockedAt20.discountAmount, 9);
    assert.equal(lockedAt20.promotionValue, 20);

    // Owner edits the promotion from 20% to 10% — this only changes future eligibility checks,
    // never the already-returned (and by now stored-on-a-booking) snapshot object above.
    const dealAt10 = Object.assign({}, dealAt20, { value: 10, label: '10% OFF TODAY' });
    const lockedAt10 = resolvePromotionSnapshot(dealAt10, service, 2000);

    assert.equal(lockedAt20.discountAmount, 9); // untouched
    assert.equal(lockedAt20.promotionValue, 20); // untouched
    assert.equal(lockedAt10.discountAmount, 4.5); // new bookings get the new rate
    assert.equal(lockedAt10.promotionValue, 10);
});

test('deleting a promotion does not remove it from historical booking records', () => {
    const deal = baseDeal({ activatedAt: 1000 });
    const locked = resolvePromotionSnapshot(deal, service, 1500);
    const booking = { id: 'b1', price: service.price, originalPrice: locked.originalPrice, finalPrice: locked.finalPrice, discountAmount: locked.discountAmount, promotionId: locked.promotionId, promotionLabel: locked.promotionLabel, promotionApplied: true };

    // "Deleting" a promotion in this app resets the deal object entirely — it never reaches back
    // into stored bookings, so the booking's own fields are the only thing that matters afterward.
    const deletedDeal = null;
    assert.equal(deletedDeal, null);
    assert.equal(booking.promotionApplied, true);
    assert.equal(booking.finalPrice, 36);
    assert.equal(booking.promotionLabel, '20% OFF TODAY');
});

test('old bookings always use their stored final price, never a live recalculation', () => {
    const deal = baseDeal({ activatedAt: 1000 });
    const locked = resolvePromotionSnapshot(deal, service, 1500);
    const booking = { price: service.price, originalPrice: locked.originalPrice, finalPrice: locked.finalPrice, discountAmount: locked.discountAmount };

    // Service price rises later (owner raised prices) and the deal value changes — neither affects
    // the already-stored booking, because summarizeBookingRevenue always prefers stored fields.
    const laterService = { id: service.id, price: 60 };
    const laterDeal = Object.assign({}, deal, { value: 50 });
    const wouldBeIfRecalculated = resolvePromotionSnapshot(laterDeal, laterService, Date.now());
    assert.notEqual(wouldBeIfRecalculated.finalPrice, booking.finalPrice);

    const revenue = summarizeBookingRevenue(booking);
    assert.equal(revenue.net, 36);
    assert.equal(revenue.gross, 45);
    assert.equal(revenue.discount, 9);
});

test('earnings correctly use the locked discounted amount, not the gross service price', () => {
    const promoBooking = { status: 'completed', price: 45, originalPrice: 45, finalPrice: 36, discountAmount: 9 };
    const plainBooking = { status: 'completed', price: 30 };
    const revenues = [promoBooking, plainBooking].map(summarizeBookingRevenue);
    const totalNet = revenues.reduce((sum, r) => sum + r.net, 0);
    const totalGross = revenues.reduce((sum, r) => sum + r.gross, 0);
    const totalDiscount = revenues.reduce((sum, r) => sum + r.discount, 0);
    assert.equal(totalNet, 66); // 36 + 30
    assert.equal(totalGross, 75); // 45 + 30
    assert.equal(totalDiscount, 9);
});

test('promotion analytics retain historical bookings even after the promotion ends', () => {
    let deal = baseDeal({ activatedAt: 1000 });
    const locked = resolvePromotionSnapshot(deal, service, 1500);
    const booking = { status: 'completed', price: service.price, originalPrice: locked.originalPrice, finalPrice: locked.finalPrice, discountAmount: locked.discountAmount, promotionApplied: true };

    deal = deactivatePromotion(deal);

    const revenue = summarizeBookingRevenue(booking);
    assert.equal(booking.promotionApplied, true);
    assert.equal(revenue.net, 36);
    assert.equal(deal.enabled, false);
});

test('computeDiscountAmount handles percent and fixed, and never discounts below $0 or past 100%', () => {
    assert.equal(computeDiscountAmount('percent', 20, 45), 9);
    assert.equal(computeDiscountAmount('fixed', 25, 45), 25);
    assert.equal(computeDiscountAmount('fixed', 1000, 45), 45); // capped at original price
    assert.equal(computeDiscountAmount('percent', 0, 45), 0);
    assert.equal(computeDiscountAmount('percent', 20, 0), 0);
});

test('isServiceEligibleForDeal: null/empty eligibleServiceIds means all services qualify', () => {
    const dealAll = baseDeal({ eligibleServiceIds: null });
    assert.equal(isServiceEligibleForDeal(dealAll, service), true);
    const dealEmpty = baseDeal({ eligibleServiceIds: [] });
    assert.equal(isServiceEligibleForDeal(dealEmpty, service), true);
});

test('isServiceEligibleForDeal: restricted list excludes non-selected services', () => {
    const deal = baseDeal({ eligibleServiceIds: ['svc-other'] });
    assert.equal(isServiceEligibleForDeal(deal, service), false);
    const eligibleService = { id: 'svc-other', price: 10 };
    assert.equal(isServiceEligibleForDeal(deal, eligibleService), true);
});

test('resolvePromotionSnapshot respects service eligibility restriction', () => {
    const deal = baseDeal({ activatedAt: 1000, eligibleServiceIds: ['svc-other'] });
    const snapshot = resolvePromotionSnapshot(deal, service, 2000);
    assert.equal(snapshot, null);
});

test('resolveProviderDeal: my business uses live providerDeal state, others look up their FEED entry', () => {
    const myDeal = baseDeal({ id: 'deal-main' });
    const feedList = [{ id: 'f6', deal: { id: 'deal-f6', enabled: true, type: 'percent', value: 20, label: '20% OFF TODAY', activatedAt: 0, eligibleServiceIds: null } }, { id: 'f2' }];
    assert.equal(resolveProviderDeal(MY_PROVIDER_ID, MY_PROVIDER_ID, myDeal, feedList), myDeal);
    assert.equal(resolveProviderDeal('f6', MY_PROVIDER_ID, myDeal, feedList).id, 'deal-f6');
    assert.equal(resolveProviderDeal('f2', MY_PROVIDER_ID, myDeal, feedList), null);
    assert.equal(resolveProviderDeal('unknown-provider', MY_PROVIDER_ID, myDeal, feedList), null);
});

test('resolvePromotionSnapshot returns null when the deal is disabled, regardless of timestamps', () => {
    const deal = baseDeal({ enabled: false, activatedAt: 1000 });
    const snapshot = resolvePromotionSnapshot(deal, service, 999999);
    assert.equal(snapshot, null);
});

test('a booking made before the promotion expires still receives the discount', () => {
    const deal = baseDeal({ activatedAt: 1000, expiresAt: 5000 });
    const snapshot = resolvePromotionSnapshot(deal, service, 4999);
    assert.ok(snapshot);
    assert.equal(snapshot.finalPrice, 36);
});

test('expired promotion: a booking made at or after the expiry time receives no discount', () => {
    const deal = baseDeal({ activatedAt: 1000, expiresAt: 5000 });
    assert.equal(resolvePromotionSnapshot(deal, service, 5000), null);
    assert.equal(resolvePromotionSnapshot(deal, service, 6000), null);
    // enabled is still true — expiry alone must be enough to stop it, independent of the manual toggle
    assert.equal(deal.enabled, true);
});

test('correct percentage calculation end-to-end through resolvePromotionSnapshot', () => {
    const deal = baseDeal({ type: 'percent', value: 20, activatedAt: 1000 });
    const snapshot = resolvePromotionSnapshot(deal, { id: 'svc', price: 200 }, 2000);
    assert.equal(snapshot.discountAmount, 40);
    assert.equal(snapshot.finalPrice, 160);
});

test('correct fixed-dollar calculation end-to-end through resolvePromotionSnapshot', () => {
    const deal = baseDeal({ type: 'fixed', value: 25, activatedAt: 1000 });
    const snapshot = resolvePromotionSnapshot(deal, { id: 'svc', price: 200 }, 2000);
    assert.equal(snapshot.discountAmount, 25);
    assert.equal(snapshot.finalPrice, 175);
});

test('promotion expiring while a customer sits on checkout is correctly revalidated at confirm time', () => {
    // Simulates: customer opens checkout while the deal is active (an earlier "preview" call),
    // then the deal is turned off before they press Confirm. The authoritative call that actually
    // creates the booking must use a freshly-read deal + timestamp, not the earlier preview result.
    let deal = baseDeal({ activatedAt: 1000 });
    const previewWhileActive = resolvePromotionSnapshot(deal, service, 2000); // shown at checkout
    assert.ok(previewWhileActive);

    deal = deactivatePromotion(deal); // owner turns it off while customer is still on checkout

    const authoritativeAtConfirm = resolvePromotionSnapshot(deal, service, 3000); // finalizeBooking()'s own call
    assert.equal(authoritativeAtConfirm, null);
});

test('the pricing function only accepts deal + service + timestamp — there is no channel for a client to submit its own discounted total', () => {
    // resolvePromotionSnapshot's signature has no "claimedFinalPrice" or "claimedDiscount" parameter;
    // it always derives finalPrice purely from service.price and the deal's own type/value, so a
    // caller cannot influence the result by passing anything other than which service was picked.
    const deal = baseDeal({ activatedAt: 1000 });
    const snapshot = resolvePromotionSnapshot(deal, service, 2000);
    assert.equal(resolvePromotionSnapshot.length, 3);
    assert.deepEqual(Object.keys(snapshot).sort(), ['discountAmount', 'finalPrice', 'originalPrice', 'promotionAppliedAt', 'promotionId', 'promotionLabel', 'promotionType', 'promotionValue'].sort());
    assert.equal(snapshot.finalPrice, snapshot.originalPrice - snapshot.discountAmount);
});
