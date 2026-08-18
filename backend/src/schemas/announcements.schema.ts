export const createAnnouncementSchema = {
  body: {
    type: 'object',
    required: ['title', 'content', 'category'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 200 },
      content: { type: 'string', minLength: 1 },
      category: { type: 'string', enum: ['General', 'Event', 'Prayer', 'Urgent'] },
      audience: { type: 'string', enum: ['Public', 'Members', 'Staff'] },
      status: { type: 'string', enum: ['Draft', 'Scheduled', 'Published', 'Archived'] },
      publish_at: { type: 'string' },
      expiry_date: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
} as const;

export const updateAnnouncementSchema = {
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
      title: { type: 'string', minLength: 2, maxLength: 200 },
      content: { type: 'string', minLength: 1 },
      category: { type: 'string', enum: ['General', 'Event', 'Prayer', 'Urgent'] },
      audience: { type: 'string', enum: ['Public', 'Members', 'Staff'] },
      status: { type: 'string', enum: ['Draft', 'Scheduled', 'Published', 'Archived'] },
      publish_at: { type: 'string' },
      expiry_date: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
} as const;

export const announcementIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
