import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").optional(),
});

export const conversationParamsSchema = z.object({
  id: z.string().cuid("Invalid conversation ID format"),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ConversationParams = z.infer<typeof conversationParamsSchema>;

