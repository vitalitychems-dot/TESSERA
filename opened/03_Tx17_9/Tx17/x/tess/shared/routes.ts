import { z } from 'zod';
import { insertConversationSchema, insertMessageSchema, insertRepoSchema, conversations, messages, indexedRepos } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations' as const,
      responses: {
        200: z.array(z.custom<typeof conversations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations' as const,
      input: insertConversationSchema,
      responses: {
        201: z.custom<typeof conversations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/conversations/:id' as const,
      responses: {
        200: z.custom<typeof conversations.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/conversations/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations/:conversationId/messages' as const,
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations/:conversationId/messages' as const,
      input: z.object({ content: z.string() }),
      responses: {
        // SSE stream response
        200: z.any(),
        400: errorSchemas.validation,
      },
    }
  },
  repos: {
    list: {
      method: 'GET' as const,
      path: '/api/repos' as const,
      responses: {
        200: z.array(z.custom<typeof indexedRepos.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/repos' as const,
      input: insertRepoSchema,
      responses: {
        201: z.custom<typeof indexedRepos.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/repos/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
