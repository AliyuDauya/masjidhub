export const createProgramSchema = {
  body: {
    type: 'object',
    required: ['title', 'description', 'start_date', 'end_date', 'location'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 200 },
      description: { type: 'string', minLength: 1 },
      category: { type: 'string', maxLength: 100 },
      start_date: { type: 'string', minLength: 10 },
      end_date: { type: 'string', minLength: 10 },
      location: { type: 'string', minLength: 1, maxLength: 200 },
      max_capacity: { type: 'integer', minimum: 0 },
      visibility: { type: 'string', enum: ['Public', 'Members'] },
      status: { type: 'string', enum: ['Draft', 'Published', 'Cancelled', 'Completed'] }
    },
    additionalProperties: false
  }
} as const;

export const updateProgramSchema = {
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
      description: { type: 'string', minLength: 1 },
      category: { type: 'string', maxLength: 100 },
      start_date: { type: 'string', minLength: 10 },
      end_date: { type: 'string', minLength: 10 },
      location: { type: 'string', minLength: 1, maxLength: 200 },
      max_capacity: { type: 'integer', minimum: 0 },
      visibility: { type: 'string', enum: ['Public', 'Members'] },
      status: { type: 'string', enum: ['Draft', 'Published', 'Cancelled', 'Completed'] }
    },
    additionalProperties: false
  }
} as const;

export const programIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
