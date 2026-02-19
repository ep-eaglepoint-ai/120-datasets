import { ChatService } from "./chatService";
import prisma from "./lib/database";

// Mock the prisma client
jest.mock("./lib/database", () => ({
  __esModule: true,
  default: {
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe("ChatService", () => {
  let chatService: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    chatService = new ChatService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createConversation", () => {
    it("should create a conversation successfully with a title", async () => {
      const mockConversation = {
        id: "1",
        title: "Test Chat",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.conversation.create as jest.Mock).mockResolvedValue(
        mockConversation,
      );

      const result = await chatService.createConversation("Test Chat");

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { title: "Test Chat" },
      });
      expect(result).toEqual(mockConversation);
    });

    it("should create a conversation successfully without a title", async () => {
      const mockConversation = {
        id: "1",
        title: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.conversation.create as jest.Mock).mockResolvedValue(
        mockConversation,
      );

      const result = await chatService.createConversation();

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { title: null },
      });
      expect(result).toEqual(mockConversation);
    });

    it("should throw 409 if conversation title already exists (P2002)", async () => {
      const error = { code: "P2002" };
      (prisma.conversation.create as jest.Mock).mockRejectedValue(error);

      await expect(
        chatService.createConversation("Duplicate"),
      ).rejects.toMatchObject({
        message: "Conversation title already exists",
        statusCode: 409,
      });
    });

    it("should throw 500 for other errors", async () => {
      const error = new Error("DB Error");
      (prisma.conversation.create as jest.Mock).mockRejectedValue(error);

      await expect(
        chatService.createConversation("Test"),
      ).rejects.toMatchObject({
        message: "Failed to create conversation",
        statusCode: 500,
      });
    });
  });

  describe("getConversationById", () => {
    it("should return conversation if found", async () => {
      const mockConversation = { id: "1", title: "Found", messages: [] };
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        mockConversation,
      );

      const result = await chatService.getConversationById("1");

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { messages: true },
      });
      expect(result).toEqual(mockConversation);
    });

    it("should throw 404 if conversation not found", async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        chatService.getConversationById("999"),
      ).rejects.toMatchObject({
        message: "Conversation not found",
        statusCode: 404,
      });
    });
  });

  describe("getAllConversations", () => {
    it("should return paginated conversations with default parameters", async () => {
      const mockConversations = [{ id: "1" }, { id: "2" }];
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(
        mockConversations,
      );
      (prisma.conversation.count as jest.Mock).mockResolvedValue(20);

      const result = await chatService.getAllConversations();

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        conversations: mockConversations,
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it("should handle custom pagination parameters", async () => {
      const mockConversations = [{ id: "3" }];
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(
        mockConversations,
      );
      (prisma.conversation.count as jest.Mock).mockResolvedValue(25);

      const result = await chatService.getAllConversations(2, 10);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
        skip: 10,
        take: 10,
      });
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        totalCount: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("should handle empty results", async () => {
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation.count as jest.Mock).mockResolvedValue(0);

      const result = await chatService.getAllConversations();

      expect(result.conversations).toEqual([]);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it("should handle pagination edge cases (page 0)", async () => {
      const mockConversations = [{ id: "1" }];
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(
        mockConversations,
      );
      (prisma.conversation.count as jest.Mock).mockResolvedValue(1);

      await chatService.getAllConversations(0, 20);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
        skip: -20, // (0 - 1) * 20
        take: 20,
      });
    });

    it("should handle negative page numbers", async () => {
      const mockConversations = [{ id: "1" }];
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(
        mockConversations,
      );
      (prisma.conversation.count as jest.Mock).mockResolvedValue(1);

      await chatService.getAllConversations(-1, 20);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
        skip: -40, // (-1 - 1) * 20
        take: 20,
      });
    });

    it("should handle very large limit values", async () => {
      const mockConversations: any[] = [];
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(
        mockConversations,
      );
      (prisma.conversation.count as jest.Mock).mockResolvedValue(0);

      await chatService.getAllConversations(1, 1000000);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 1000000,
      });
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation successfully", async () => {
      (prisma.conversation.delete as jest.Mock).mockResolvedValue({ id: "1" });

      const result = await chatService.deleteConversation("1");

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(result).toEqual({ message: "Conversation deleted successfully" });
    });

    it("should throw 404 if conversation not found (P2025)", async () => {
      const error = { code: "P2025" };
      (prisma.conversation.delete as jest.Mock).mockRejectedValue(error);

      await expect(chatService.deleteConversation("999")).rejects.toMatchObject(
        {
          message: "Conversation not found",
          statusCode: 404,
        },
      );
    });

    it("should throw 500 for other errors", async () => {
      const error = new Error("DB Error");
      (prisma.conversation.delete as jest.Mock).mockRejectedValue(error);

      await expect(chatService.deleteConversation("1")).rejects.toMatchObject({
        message: "Failed to delete conversation",
        statusCode: 500,
      });
    });
  });

  describe("createMessage", () => {
    it("should create a message successfully", async () => {
      const mockMessage = {
        id: "101",
        content: "Hello",
        conversationId: "1",
        isFromUser: true,
      };
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);

      const result = await chatService.createMessage("1", "Hello", true);

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { content: "Hello", isFromUser: true, conversationId: "1" },
      });
      expect(result).toEqual(mockMessage);
    });

    it("should use default isFromUser = false", async () => {
      const mockMessage = {
        id: "102",
        content: "Hi",
        conversationId: "1",
        isFromUser: false,
      };
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);

      await chatService.createMessage("1", "Hi");

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { content: "Hi", isFromUser: false, conversationId: "1" },
      });
    });

    it("should throw 404 if conversation not found (P2003)", async () => {
      const error = { code: "P2003" };
      (prisma.message.create as jest.Mock).mockRejectedValue(error);

      await expect(
        chatService.createMessage("999", "Msg"),
      ).rejects.toMatchObject({
        message: "Conversation not found",
        statusCode: 404,
      });
    });

    it("should throw 500 for other errors", async () => {
      const error = new Error("DB Error");
      (prisma.message.create as jest.Mock).mockRejectedValue(error);

      await expect(chatService.createMessage("1", "Msg")).rejects.toMatchObject(
        {
          message: "Failed to create message",
          statusCode: 500,
        },
      );
    });

    it("should handle empty string content", async () => {
      const mockMessage = {
        id: "103",
        content: "",
        conversationId: "1",
        isFromUser: false,
      };
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);

      const result = await chatService.createMessage("1", "");

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { content: "", isFromUser: false, conversationId: "1" },
      });
      expect(result).toEqual(mockMessage);
    });
  });

  describe("getMessagesByConversation", () => {
    it("should return paginated messages", async () => {
      const mockMessages = [{ id: "101" }, { id: "102" }];
      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
      (prisma.message.count as jest.Mock).mockResolvedValue(55);

      const result = await chatService.getMessagesByConversation("1", 1, 10);

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: "1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.messages).toEqual(mockMessages);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 55,
        totalPages: 6,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should handle empty messages", async () => {
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.message.count as jest.Mock).mockResolvedValue(0);

      const result = await chatService.getMessagesByConversation("1");

      expect(result.messages).toEqual([]);
      expect(result.pagination.totalCount).toBe(0);
    });
  });
});
