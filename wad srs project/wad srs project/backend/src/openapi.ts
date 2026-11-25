const errorResponse = {
  description: 'Request failed.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorEnvelope' },
    },
  },
};

const dataResponse = (description: string, dataType: 'object' | 'array' = 'object') => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data:
            dataType === 'array'
              ? { type: 'array', items: { type: 'object' } }
              : { type: 'object' },
        },
      },
    },
  },
});

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
};

const jsonBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: {
    'application/json': { schema },
  },
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DabbaDash Operations API',
    version: '1.0.0',
    description:
      'Local operations API for the DabbaDash dashboard. Data endpoints use a { data: ... } success envelope; errors use { error: { code, message } }. Authentication is not enabled; the development server binds to loopback by default.',
  },
  servers: [{ url: 'http://127.0.0.1:3000' }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Check API and database health',
        responses: {
          '200': {
            description: 'Server and SQLite database are available.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'database', 'demoData'],
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    database: { type: 'string', enum: ['connected'] },
                    demoData: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '503': { description: 'Database is unavailable.' },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        summary: 'Retrieve this OpenAPI document',
        responses: { '200': { description: 'OpenAPI 3.0.3 JSON document.' } },
      },
    },
    '/api/brands': {
      get: {
        summary: 'List brands',
        responses: {
          '200': dataResponse('Brands.', 'array'),
          '500': errorResponse,
        },
      },
    },
    '/api/brands/{id}': {
      get: {
        summary: 'Get a brand',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Brand.'),
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/orders': {
      get: {
        summary: 'List orders with their items',
        responses: {
          '200': dataResponse('Orders.', 'array'),
          '500': errorResponse,
        },
      },
      post: {
        summary: 'Create an order',
        description:
          'Requires an active brand and available menu items belonging to that brand. Prices are read from the database.',
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['brandId', 'customerName', 'customerPhone', 'deliveryAddress', 'items'],
          properties: {
            brandId: { type: 'integer', minimum: 1 },
            customerName: { type: 'string', minLength: 1, maxLength: 120 },
            customerPhone: { type: 'string', minLength: 1, maxLength: 32 },
            deliveryAddress: { type: 'string', minLength: 1, maxLength: 500 },
            deliveryZoneId: { type: 'integer', minimum: 1, nullable: true },
            deliveryLatitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
            deliveryLongitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
            courierId: { type: 'integer', minimum: 1, nullable: true },
            prepTimeMinutes: { type: 'integer', minimum: 1, maximum: 240 },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['menuItemId', 'quantity'],
                properties: {
                  menuItemId: { type: 'integer', minimum: 1 },
                  quantity: { type: 'integer', minimum: 1, maximum: 99 },
                  specialInstructions: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        }),
        responses: {
          '201': dataResponse('Created order.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        summary: 'Get an order',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Order.'),
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/orders/{id}/recommended-couriers': {
      get: {
        summary: 'Recommend couriers for an order',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Eligible couriers.', 'array'),
          '400': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/orders/{id}/assign-courier': {
      patch: {
        summary: 'Assign an available courier to an order',
        parameters: [idParameter],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['courierId'],
          properties: { courierId: { type: 'integer', minimum: 1 } },
        }),
        responses: {
          '200': dataResponse('Order and assigned courier.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/orders/{id}/status': {
      patch: {
        summary: 'Advance an order status by one step',
        parameters: [idParameter],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['Received', 'In Kitchen', 'Packed', 'Out for Delivery', 'Delivered'],
            },
          },
        }),
        responses: {
          '200': dataResponse('Updated order.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/couriers': {
      get: {
        summary: 'List couriers and current workload',
        responses: {
          '200': dataResponse('Couriers.', 'array'),
          '500': errorResponse,
        },
      },
    },
    '/api/couriers/{id}': {
      get: {
        summary: 'Get a courier',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Courier.'),
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/couriers/{id}/status': {
      patch: {
        summary: 'Update courier availability',
        parameters: [idParameter],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['available', 'on-delivery', 'offline'] },
          },
        }),
        responses: {
          '200': dataResponse('Updated courier.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/zones': {
      get: {
        summary: 'List delivery zones and current counts',
        responses: {
          '200': dataResponse('Delivery zones.', 'array'),
          '500': errorResponse,
        },
      },
    },
    '/api/batches': {
      get: {
        summary: 'List delivery batches',
        responses: {
          '200': dataResponse('Batches.', 'array'),
          '500': errorResponse,
        },
      },
      post: {
        summary: 'Create a batch from selected Packed orders',
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['orderIds'],
          properties: {
            orderIds: {
              type: 'array',
              minItems: 2,
              maxItems: 20,
              uniqueItems: true,
              items: { type: 'integer', minimum: 1 },
            },
          },
        }),
        responses: {
          '201': dataResponse('Created batch.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/batches/generate': {
      post: {
        summary: 'Generate batches from eligible Packed orders',
        requestBody: jsonBody({ type: 'object', additionalProperties: false }, false),
        responses: {
          '201': dataResponse('Generated batches; may be empty.', 'array'),
          '400': errorResponse,
          '413': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/batches/{id}': {
      get: {
        summary: 'Get a batch with its orders and recommendations',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Batch.'),
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/batches/{id}/recommended-couriers': {
      get: {
        summary: 'List eligible courier recommendations for a batch',
        parameters: [idParameter],
        responses: {
          '200': dataResponse('Eligible couriers.', 'array'),
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/batches/{id}/assign-courier': {
      patch: {
        summary: 'Assign an available courier to a pending batch',
        parameters: [idParameter],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['courierId'],
          properties: { courierId: { type: 'integer', minimum: 1 } },
        }),
        responses: {
          '200': dataResponse('Assigned batch.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/batches/{id}/status': {
      patch: {
        summary: 'Advance or cancel a delivery batch',
        parameters: [idParameter],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'],
            },
          },
        }),
        responses: {
          '200': dataResponse('Updated batch.'),
          '400': errorResponse,
          '413': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '500': errorResponse,
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;
