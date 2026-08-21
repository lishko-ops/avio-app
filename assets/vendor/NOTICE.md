# Vendored third-party libraries

- **qrcode-generator.js** — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase. MIT License. Used to render real, camera-scannable QR codes on ticket "Show QR to Enter" screens.
- **jsQR.js** — [jsQR](https://github.com/cozmo/jsQR) by cozmo. Apache-2.0 License. Used to decode QR codes from the live camera feed in Bookvado Scanner → Scan QR.

Vendored (rather than loaded from a CDN) so ticket scanning at an event entrance never depends on a third-party CDN being reachable.
