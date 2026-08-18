export const platformLoginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 5, maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const updateTenantStatusSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['Active', 'Suspended'] }
    },
    additionalProperties: false
  }
} as const;
