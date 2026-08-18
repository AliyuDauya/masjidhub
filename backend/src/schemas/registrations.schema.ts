export const registrationProgramParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;

export const attendanceCheckInSchema = {
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
      status: { type: 'string', enum: ['Attended', 'Registered', 'Cancelled'] }
    },
    additionalProperties: false
  }
} as const;
