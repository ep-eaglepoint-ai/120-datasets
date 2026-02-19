
import path from 'path';
import { ConversationService as ConversationServiceType } from '../repository_before/services/conversationService';
import { PrismaClient } from '@prisma/client';

const targetRepo = process.env.TARGET_REPO || 'repository_before';

export const getService = (): ConversationServiceType => {
    // Relative to tests/ folder
    const modPath = `../${targetRepo}/services/conversationService`;
    const mod = require(modPath);
    return new mod.ConversationService();
};

export const getPrisma = (): PrismaClient => {
    const modPath = `../${targetRepo}/lib/database`;
    const mod = require(modPath);
    return mod.default;
};
