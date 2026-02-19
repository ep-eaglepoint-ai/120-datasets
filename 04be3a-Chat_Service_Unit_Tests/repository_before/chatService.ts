import prisma from "./lib/database";
import { createError } from "./middleware/errorHandler";

export class ChatService {
  async createConversation(title?: string) {
    try {
      const conversation = await prisma.conversation.create({
        data: { title: title || null },
      });
      return conversation;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw createError("Conversation title already exists", 409);
      }
      throw createError("Failed to create conversation", 500);
    }
  }

  async getConversationById(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: true },
    });

    if (!conversation) {
      throw createError("Conversation not found", 404);
    }

    return conversation;
  }

  async getAllConversations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.conversation.count(),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    };
  }

  async deleteConversation(id: string) {
    try {
      await prisma.conversation.delete({ where: { id } });
      return { message: "Conversation deleted successfully" };
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw createError("Conversation not found", 404);
      }
      throw createError("Failed to delete conversation", 500);
    }
  }

  async createMessage(conversationId: string, content: string, isFromUser = false) {
    try {
      const message = await prisma.message.create({
        data: { content, isFromUser, conversationId },
      });
      return message;
    } catch (error: any) {
      if (error?.code === "P2003") {
        throw createError("Conversation not found", 404);
      }
      throw createError("Failed to create message", 500);
    }
  }

  async getMessagesByConversation(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      messages,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    };
  }
}

