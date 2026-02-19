

import { getService, getPrisma } from "./helper";

const service = getService();
const prisma = getPrisma();

describe("Pagination Logic", () => {
    beforeEach(async () => {
        try {
            await prisma.message.deleteMany();
            await prisma.conversation.deleteMany();
        } catch (e) { }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // --- Pagination Logic ---
    it("Should return the first items on page 1 and not skip them", async () => {
        const titles = Array.from({ length: 20 }, (_, i) => `Title ${i + 1}`);
        for (const title of titles) {
            await prisma.conversation.create({ data: { title } });
        }

        const page1 = await service.getAllConversations(1, 5);
        expect(page1.conversations.length).toBe(5);

        const page2 = await service.getAllConversations(2, 5);
        expect(page2.conversations.length).toBe(5);

       
        const all = await prisma.conversation.findMany({
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: 20
        });
        const newestId = all[0].id; // Should be first item in P1
        const p1FirstId = page1.conversations[0]?.id;

        expect(p1FirstId).toBe(newestId);
    });

    // --- hasNext Calculation ---
    it("Should correctly calculate hasNext at the boundaries", async () => {
        for (let i = 0; i < 10; i++) {
            await prisma.conversation.create({ data: { title: `Boundary ${i}` } });
        }

        const result = await service.getAllConversations(1, 10);
        expect(result.pagination.hasNext).toBe(false);
    });

    // --- API Compatibility ---
    it("Should maintain specific response format", async () => {
        await prisma.conversation.create({ data: { title: "Format" } });
        const res = await service.getAllConversations(1, 1);

        const c = res.conversations[0];
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('lastMessage');
        expect(c).toHaveProperty('messageCount');
        expect(c).toHaveProperty('createdAt');
        expect(c).toHaveProperty('updatedAt');

        expect(res.pagination).toHaveProperty('totalCount');
        expect(res.pagination).toHaveProperty('totalPages');
        expect(res.pagination).toHaveProperty('hasNext');
        expect(res.pagination).toHaveProperty('hasPrev');
    });
});
