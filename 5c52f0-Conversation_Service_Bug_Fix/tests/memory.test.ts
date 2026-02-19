

import { getService, getPrisma } from "./helper";

const service = getService();
const prisma = getPrisma();

describe("Memory Optimization Logic", () => {
    beforeEach(async () => {
        try {
            await prisma.message.deleteMany();
            await prisma.conversation.deleteMany();
        } catch (e) { }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // --- Messages Limit ---
    it("Should limit messages in getConversationById", async () => {
        const c = await prisma.conversation.create({ data: { title: "Huge" } });

        await prisma.message.createMany({
            data: Array.from({ length: 150 }, (_, i) => ({
                conversationId: c.id,
                content: `Msg ${i}`
            }))
        });

        const result = await service.getConversationById(c.id);

        expect(result.messages.length).toBeLessThan(150);
    });
});
