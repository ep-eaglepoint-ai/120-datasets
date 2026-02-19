// Prisma client stub - this will be mocked in tests
const prisma = {
  conversation: {
    create: async (data: any) => data,
    findUnique: async (data: any) => null,
    findMany: async (data: any) => [],
    count: async () => 0,
    delete: async (data: any) => data,
  },
  message: {
    create: async (data: any) => data,
    findMany: async (data: any) => [],
    count: async (data?: any) => 0,
  },
};

export default prisma;

