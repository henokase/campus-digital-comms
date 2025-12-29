const swaggerJSDoc = require('swagger-jsdoc');

function buildSwaggerSpec() {
  const port = Number(process.env.PORT || 3000);
  const serverUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

  const definition = {
    openapi: '3.0.0',
    info: {
      title: 'Campus Digital Communication Platform (CDCP) - API Gateway',
      version: '1.0.0',
      description: 'Public API exposed by the API Gateway. All client integrations should use these endpoints.',
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object', additionalProperties: true },
              },
              required: ['code', 'message'],
            },
          },
          required: ['error'],
        },

        RegisterRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', example: 'student@example.com' },
            password: { type: 'string', example: 'Password123!' },
            role: { type: 'string', enum: ['admin', 'faculty', 'student'], example: 'student' },
            fullName: { type: 'string', nullable: true },
            department: { type: 'string', nullable: true },
            year: { type: 'integer', nullable: true },
          },
          required: ['email', 'password', 'role'],
        },

        LoginRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', example: 'student@example.com' },
            password: { type: 'string', example: 'Password123!' },
          },
          required: ['email', 'password'],
        },

        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'faculty', 'student'] },
            fullName: { type: 'string', nullable: true },
            department: { type: 'string', nullable: true },
            year: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'role'],
        },

        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
          required: ['token', 'user'],
        },

        AnnouncementTargetAudience: {
          type: 'object',
          properties: {
            roles: { type: 'array', items: { type: 'string' } },
            departments: { type: 'array', items: { type: 'string' } },
            years: { type: 'array', items: { type: 'integer' } },
          },
          additionalProperties: true,
        },

        CreateAnnouncementRequest: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string' },
            category: { type: 'string', nullable: true },
            priority: { type: 'string', nullable: true },
            targetAudience: { $ref: '#/components/schemas/AnnouncementTargetAudience' },
          },
          required: ['title', 'content', 'type'],
        },

        UpdateAnnouncementRequest: {
          allOf: [{ $ref: '#/components/schemas/CreateAnnouncementRequest' }],
        },

        Announcement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string' },
            category: { type: 'string', nullable: true },
            priority: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true },
            publishedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
            targetAudience: { type: 'object', nullable: true },
          },
          required: ['id'],
        },

        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            announcementId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            channel: { type: 'string' },
            status: { type: 'string' },
            sentAt: { type: 'string', format: 'date-time', nullable: true },
            readAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'announcementId', 'userId'],
        },

        CreateFeedbackRequest: {
          type: 'object',
          properties: {
            announcementId: { type: 'string', format: 'uuid' },
            reactionType: { type: 'string', nullable: true },
            comment: { type: 'string', nullable: true },
            rating: { type: 'integer', nullable: true },
            isAnonymous: { type: 'boolean', nullable: true },
          },
          required: ['announcementId'],
        },

        UpdateFeedbackRequest: {
          type: 'object',
          properties: {
            reactionType: { type: 'string', nullable: true },
            comment: { type: 'string', nullable: true },
            rating: { type: 'integer', nullable: true },
            isAnonymous: { type: 'boolean', nullable: true },
          },
        },

        Feedback: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            announcementId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid', nullable: true },
            reactionType: { type: 'string', nullable: true },
            comment: { type: 'string', nullable: true },
            rating: { type: 'integer', nullable: true },
            isAnonymous: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
            user: { type: 'object', nullable: true },
          },
          required: ['id', 'announcementId', 'isAnonymous'],
        },

        AnalyticsDashboard: {
          type: 'object',
          properties: {
            totalAnnouncements: { type: 'integer' },
            totalNotificationsSent: { type: 'integer' },
            totalNotificationsRead: { type: 'integer' },
            totalFeedbackCount: { type: 'integer' },
          },
          required: ['totalAnnouncements', 'totalNotificationsSent', 'totalNotificationsRead', 'totalFeedbackCount'],
        },
      },
    },
  };

  return swaggerJSDoc({
    definition,
    apis: [
      // Keep docs close to gateway behavior
      `${__dirname}/app.js`,
    ],
  });
}

module.exports = { buildSwaggerSpec };
