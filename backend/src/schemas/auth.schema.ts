export const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', minLength: 5, maxLength: 255 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      phone: { type: 'string', minLength: 5, maxLength: 30 },
      role: { type: 'string' }
    },
    additionalProperties: false
  }
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const switchTenantSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9-]+$' }
    }
  }
} as const;

export const forgotPasswordSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', minLength: 3, maxLength: 255 }
    },
    additionalProperties: false
  }
} as const;

export const resetPasswordSchema = {
  body: {
    type: 'object',
    required: ['resetToken', 'newPassword'],
    properties: {
      resetToken: { type: 'string', minLength: 10 },
      newPassword: { type: 'string', minLength: 8, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

