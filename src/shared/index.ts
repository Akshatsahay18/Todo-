/**
 * Shared Utilities
 *
 * Central exports for resource definitions.
 * Import from here for clean, consistent code.
 */

// Adapter factory
export { createAdapter } from './adapter.js';

// Core Arc exports
export { createMongooseAdapter, defineResource } from '@classytic/arc';

// Permission helpers (core + application-level)
export * from './permissions.js';

// Presets
export * from './presets/index.js';
