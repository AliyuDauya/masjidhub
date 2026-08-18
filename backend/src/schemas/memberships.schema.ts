export const inviteMembershipSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'temporary_password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', minLength: 5, maxLength: 255 },
      role: {
        type: 'string',
        enum: ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer', 'member']
      },
      temporary_password: { type: 'string', minLength: 8, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const updateMembershipSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer', 'member']
      },
      status: {
        type: 'string',
        enum: ['Active', 'Suspended']
      }
    },
    additionalProperties: false
  }
} as const;
