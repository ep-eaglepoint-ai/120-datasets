

import { getService, getPrisma } from "./helper";

const service = getService();
const prisma = getPrisma();

describe("Performance Logic", () => {
    beforeEach(async () => {
        try {
            await prisma.message.deleteMany();
            await prisma.conversation.deleteMany();
        } catch (e) { }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // --- Parallel Queries ---
    it("Should execute findMany and count in parallel", async () => {
        const originalFindMany = prisma.conversation.findMany;
        const originalCount = prisma.conversation.count;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        prisma.conversation.findMany = jest.fn(async (...args) => {
            await delay(100);
            return originalFindMany.apply(prisma.conversation, args as any);
        }) as any;

        prisma.conversation.count = jest.fn(async (...args) => {
            await delay(100);
            return originalCount.apply(prisma.conversation, args as any);
        }) as any;

        const start = Date.now();
        await service.getAllConversations(1, 1);
        const end = Date.now();

        const duration = end - start;

        const PARALLEL_THRESHOLD = 190; // 200ms would be sequential

        prisma.conversation.findMany = originalFindMany;
        prisma.conversation.count = originalCount;

        expect(duration).toBeLessThan(PARALLEL_THRESHOLD);
    });
});
