export const createDonationSchema = {
  body: {
    type: 'object',
    required: ['amount', 'category', 'method'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      method: { type: 'string', enum: ['Card', 'Transfer'] },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      external_reference: { type: 'string', maxLength: 100 },
      donor_email: { type: 'string', maxLength: 255 }
    },
    additionalProperties: false
  }
} as const;

export const manualDonationSchema = {
  body: {
    type: 'object',
    required: ['amount', 'category', 'method'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      method: { type: 'string', enum: ['Cash'] },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      donor_email: { type: 'string', maxLength: 255 },
      external_reference: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
} as const;

export const queryDonationsSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Pending', 'Completed', 'Failed'] },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      reconciliation_status: { type: 'string', enum: ['Unreconciled', 'Reconciled'] },
      search: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
} as const;

export const reconcileDonationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;

export const initializePaystackSchema = {
  body: {
    type: 'object',
    required: ['amount', 'category', 'email'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      email: { type: 'string', maxLength: 255 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      callback_url: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
} as const;

export const verifyPaystackSchema = {
  body: {
    type: 'object',
    required: ['reference'],
    properties: {
      reference: { type: 'string', minLength: 1, maxLength: 100 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] }
    },
    additionalProperties: false
  }
} as const;

