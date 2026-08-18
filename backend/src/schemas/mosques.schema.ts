export const createMosqueSchema = {
  body: {
    type: 'object',
    required: ['name', 'slug', 'admin_name', 'admin_email', 'admin_password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 150 },
      slug: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-zA-Z0-9-]+$' },
      admin_name: { type: 'string', minLength: 2, maxLength: 100 },
      admin_email: { type: 'string', minLength: 5, maxLength: 255 },
      admin_password: { type: 'string', minLength: 8, maxLength: 128 },
      address: { type: 'string', maxLength: 255 },
      phone: { type: 'string', maxLength: 50 },
      email: { type: 'string', maxLength: 255 }
    },
    additionalProperties: false
  }
} as const;

export const getMosqueSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 }
    }
  }
} as const;

export const updateMosqueSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 150 },
      address: { type: ['string', 'null'] },
      phone: { type: ['string', 'null'] },
      email: { type: ['string', 'null'] },
      timezone: { type: 'string', maxLength: 50 },
      brand_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      logo_url: { type: ['string', 'null'] },
      notification_email: { type: 'boolean' },
      notification_in_app: { type: 'boolean' }
    },
    additionalProperties: false
  }
} as const;
