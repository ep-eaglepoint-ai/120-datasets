

import { getService, getPrisma } from "./helper";

const service = getService();
const prisma = getPrisma();

describe("Concurrency Logic", () => {
    beforeEach(async () => {
        try {
            await prisma.message.deleteMany();
            await prisma.conversation.deleteMany();
        } catch (e) { }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // --- Title Race Condition ---
    it("Should generate unique titles for concurrent creations", async () => {
        await prisma.conversation.deleteMany();

        const concurrent = 5;
        const promises = Array.from({ length: concurrent }, () =>
            service.createConversation({})
        );

        const results = await Promise.all(promises);
        const titles = results.map((r: { title: any; }) => r.title);
        const unique = new Set(titles);

        expect(unique.size).toBe(concurrent);
    });
});
