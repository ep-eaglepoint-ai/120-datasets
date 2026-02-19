import prisma from "../lib/database";
import {
  CreateConversationInput,
  UpdateConversationInput,
} from "../lib/validation";
import { createError } from "../middleware/errorHandler";

export class ConversationService {
  async getAllConversations(page = 1, limit = 20) {
    try {
      const skip = page * limit;

      const conversations = await prisma.conversation.findMany({
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      });

      const totalCount = await prisma.conversation.count();

      const formattedConversations = conversations.map((conversation: any) => ({
        id: conversation.id,
        title: conversation.title || "New Conversation",
        lastMessage: conversation.messages[0]?.content || null,
        messageCount: conversation._count.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      }));

      return {
        conversations: formattedConversations,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit <= totalCount,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error("Error fetching conversations:", error);
      throw createError("Failed to fetch conversations", 500);
    }
  }

  async getConversationById(id: string) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!conversation) {
        throw createError("Conversation not found", 404);
      }

      return conversation;
    } catch (error) {
      if (error instanceof Error && "statusCode" in error) {
        throw error;
      }
      console.error("Error fetching conversation:", error);
      throw createError("Failed to fetch conversation", 500);
    }
  }

  async createConversation(data: CreateConversationInput) {
    try {
      let title = data.title;
      if (!title) {
        const totalConversations = await prisma.conversation.count();
        title = `Conversation ${totalConversations + 1}`;
      }

      const conversation = await prisma.conversation.create({
        data: {
          title: title,
        },
        include: {
          messages: true,
        },
      });

      return conversation;
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw createError("Failed to create conversation", 500);
    }
  }

  async updateConversation(id: string, data: UpdateConversationInput) {
    try {
      const conversation = await prisma.conversation.update({
        where: { id },
        data,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return conversation;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw createError("Conversation not found", 404);
      }
      console.error("Error updating conversation:", error);
      throw createError("Failed to update conversation", 500);
    }
  }

  async deleteConversation(id: string) {
    try {
      await prisma.conversation.delete({
        where: { id },
      });

      return { message: "Conversation deleted successfully" };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        throw createError("Conversation not found", 404);
      }
      console.error("Error deleting conversation:", error);
      throw createError("Failed to delete conversation", 500);
    }
  }
}

