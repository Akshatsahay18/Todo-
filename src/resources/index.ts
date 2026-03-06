/**
 * Resources Registry
 *
 * Central registry for all API resources.
 * All resources are mounted under /api prefix via Fastify scoping.
 */

import type { FastifyInstance } from 'fastify';

// Auth is handled by Better Auth — routes at /api/auth/*
// No manual auth resource needed.

// App resources
import todoResource from './todo/todo.resource.js';

// Add more resources here:
// import productResource from './product/product.resource.js';

/**
 * All registered resources
 */
export const resources = [
  todoResource,
] as const;

/**
 * Register all resources with the app under a common prefix.
 * Fastify scoping ensures all routes are mounted at /api/*.
 * The apiPrefix option in openApiPlugin keeps OpenAPI docs in sync.
 */
export async function registerResources(app: FastifyInstance, prefix = '/api'): Promise<void> {
  await app.register(async (scope) => {
    for (const resource of resources) {
      await scope.register(resource.toPlugin());
    }
  }, { prefix });
}
