# Homebridge TSVeSync Agent Guide

## Overview
- `homebridge-tsvesync` is the Homebridge/HomeKit layer on top of `tsvesync`.
- Source of truth is `src/`; `dist/` is generated output and should not be edited directly.
- Device capability changes should usually be validated in `tsvesync` first, then surfaced here through accessory/service mapping.

## Where To Look
- `package.json`: plugin metadata, version, scripts
- `src/platform.ts`: platform lifecycle and accessory registration
- `src/accessories/*.ts`: HomeKit service/characteristic mappings
- `src/utils/device-factory.ts`: model-to-accessory routing
- `src/types/*.ts`: device and library typing glue
- `src/settings.ts`: plugin configuration
- `src/__tests__/**`: Jest coverage for platform, accessories, and device behaviors

## Working Rules
- Never edit `dist/` by hand.
- Keep package version aligned with `tsvesync`.
- If a feature does not exist correctly in `tsvesync`, fix or model it there before papering over it in Homebridge.
- HomeKit responsiveness matters: characteristic updates, service choice, and accessory categories should match Home app behavior, not just compile.
- When adding a new feature or device, update the accessory mapping, device factory, types, and tests together.

## Validation
- Run `npm run build`.
- Run `npm test` for behavior changes.
- For HomeKit-specific issues, inspect the exact accessory/service mapping and use targeted tests rather than broad guesswork.

## Release Notes
- This repo normally ships with `tsvesync` on the same version.
- Coordinate changelog and release prep across both repos.
