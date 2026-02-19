

import { getService, getPrisma } from "./helper";

const service = getService();
const prisma = getPrisma();

describe("Data Integrity Logic", () => {
    beforeEach(async () => {
        try {
            await prisma.message.deleteMany();
            await prisma.conversation.deleteMany();
        } catch (e) { }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // --- Delete Integrity ---
    it("Should successfully delete a conversation with messages", async () => {
        const c = await prisma.conversation.create({ data: { title: "To Delete" } });
        await prisma.message.create({
            data: { conversationId: c.id, content: "Blocker" }
        });

        await expect(service.deleteConversation(c.id)).resolves.not.toThrow();

        const check = await prisma.conversation.findUnique({ where: { id: c.id } });
        expect(check).toBeNull();
    });
});
