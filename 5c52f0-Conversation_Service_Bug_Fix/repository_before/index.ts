import { ConversationService } from "./services/conversationService";

async function main() {
  console.log("=== Conversation Service Bug Test ===\n");
  
  const conversationService = new ConversationService();
  
  console.log("ConversationService initialized successfully");
  console.log("Note: This service has the following bugs:");
  console.log("  - Pagination skip calculation wrong (page 1 skips items)");
  console.log("  - Sequential queries instead of parallel");
  console.log("  - Fetches ALL messages (memory crash risk)");
  console.log("  - Race condition in title generation");
  console.log("  - hasNext off-by-one error");
  console.log("  - Delete fails with FK constraint");
  console.log("\nFix these bugs to pass all tests.\n");
  
  console.log("=== Done ===");
}

main().catch(console.error);

