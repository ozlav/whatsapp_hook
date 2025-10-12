# WhatsApp Message Threading & Reply Handling - Implementation Plan

## Overview
This document outlines the plan for handling WhatsApp message threads and replies based on the logic defined in overview.md. The system implements a 4-step process:

1. **Step 1: Message Evaluation** - Check if message has minimum required fields (work_id, address, phone)
2. **Step 2: Reply Message Handling** - If reply, retrieve thread and check if work order exists
3. **Step 3: Update Operation** - If work order exists, perform update based on reply data
4. **Step 4: Irrelevant Message Handling** - If no work order info, ignore message

## Problem Statement
WhatsApp messages received via EvolutionAPI webhook can be:
- **Relevant messages** containing minimum required fields (work_id, address, phone) → Process as new order
- **Reply messages** without full info → Check if thread contains work order, then update if found
- **Irrelevant messages** without work order info → Ignore and skip processing

The system needs to handle threading to understand context when processing replies.

## Architecture

### Components

#### 1. Message Thread Detection (TASK 2.3)
**Purpose**: Identify reply messages and store thread relationships

**Key Functions**:
- `isReplyMessage(payload)` - Checks for `contextInfo.quotedMessage` in EvolutionAPI payload
- `extractQuotedMessageId(payload)` - Gets parent message ID
- `hasMinimumRequiredFields(llmResult)` - Checks if message has work_id, address, phone
- `isRelevantMessage(llmResult)` - Uses LLM `relevant` column to determine if message should be processed

**Database Schema**:
```prisma
model Message {
  id              String    @id @default(cuid())
  messageId       String    @unique  // WhatsApp message ID
  parentMessageId String?              // ID of quoted/replied message
  threadRootId    String?              // ID of original message in thread
  remoteJid       String               // Group/chat ID
  participant     String               // Sender
  messageText     String               // Full message content
  isReply         Boolean   @default(false)
  isRelevant      Boolean   @default(false)  // Based on LLM analysis
  hasWorkOrder    Boolean   @default(false)  // Has work_id, address, phone
  timestamp       DateTime
  processedAt     DateTime?
  
  parent          Message?  @relation("MessageThread", fields: [parentMessageId], references: [messageId])
  replies         Message[] @relation("MessageThread")
  
  @@index([parentMessageId])
  @@index([threadRootId])
  @@index([messageId])
}
```

#### 2. Thread Retrieval & Work Order Detection (TASK 2.4)
**Purpose**: Query database to get complete message thread and check if work order exists

**Key Functions**:
- `getThreadHistory(messageId)` - Recursive query to get all messages from reply back to root
- `checkThreadHasWorkOrder(messages)` - Check if any message in thread has work_id, address, phone
- `buildThreadContext(messages)` - Format thread as text for LLM

**Query Strategy**:
```sql
-- Recursive CTE to walk up the parent chain
WITH RECURSIVE thread AS (
  SELECT * FROM Message WHERE messageId = ?
  UNION ALL
  SELECT m.* FROM Message m
  INNER JOIN thread t ON m.messageId = t.parentMessageId
)
SELECT * FROM thread ORDER BY timestamp ASC;
```

#### 3. Reply Update Operation (TASK 2.5)
**Purpose**: Use LangGraph + OpenAI to analyze replies and perform update operations

**Update Types**:
- `STATUS_UPDATE` - Update job status (done, refund, cancelled, etc.)
- `PRICE_UPDATE` - Update total_price or deposit
- `NOTE_UPDATE` - Add or update notes
- `ADDRESS_UPDATE` - Update customer address
- `CUSTOMER_UPDATE` - Update customer name or phone

**LangGraph Workflow**:
```typescript
// Node 1: Build context from thread
threadContextBuilder(messages) → formatted_context

// Node 2: LLM analysis
replyAnalyzer(formatted_context, current_reply) → {
  update_type: "STATUS_UPDATE",
  target_fields: ["job_status"],
  new_values: { job_status: "done" },
  confidence: 0.95,
  reasoning: "Reply indicates job completion"
}

// Node 3: Validation
validateUpdate(analysis) → validated_update

// Node 4: Execute update
updateExecutor(validated_update) → update_result
```

**Example Prompts**:
```
System: You are analyzing a WhatsApp message thread about a work order.

Thread Context:
[Original Message]
Work ID: #87EGX9L
Customer: John Doe
Address: 123 Main St
Phone: (555) 123-4567
Job: Dryer Vent Cleaning
Total Price: $150
Deposit: $50
Status: new

[Reply 1]
"Job is done"

Your task: Determine what update to make based on the reply.
Return JSON with: update_type, target_fields, new_values, confidence
```

**Common Reply Patterns**:
| Reply Text | Update Type | Fields Updated |
|------------|-------------|----------------|
| "Job is done" | STATUS_UPDATE | `job_status: "done"` |
| "Actually it's $200" | PRICE_UPDATE | `total_price: 200` |
| "Customer wants refund" | STATUS_UPDATE | `job_status: "refund"` |
| "Adding note: was very happy" | NOTE_UPDATE | `notes: (append text)` |
| "Changed address to 456 Oak St" | ADDRESS_UPDATE | `address: "456 Oak St"` |
| "Cancelled" | STATUS_UPDATE | `job_status: "cancelled"` |

#### 4. Google Sheets Update Operations (TASK 2.6)
**Purpose**: Update existing sheet rows based on reply classification

**Key Functions**:
- `findSheetRowByMessageId(messageId)` - Locate row using message ID column
- `updateSheetRow(rowNumber, updates)` - Update specific columns
- `appendUpdateLog(messageId, updates)` - Audit trail in separate sheet

**Google Sheets Schema**:
```
Main Sheet: "Orders"
| message_id | timestamp | customer_name | address | ... | job_status | notes | last_updated |

Updates Sheet: "Audit Log"
| timestamp | original_message_id | reply_message_id | fields_updated | old_values | new_values | updated_by |
```

**Update Strategy**:
1. Search by `message_id` (primary key from original message)
2. If not found, fallback to `customer_name + start_date_time` match
3. Read current row values
4. Apply partial updates (preserve unchanged fields)
5. Write updated row
6. Log update to Audit sheet

#### 5. End-to-End Pipeline (TASK 2.7)
**Purpose**: Orchestrate complete flow from webhook to sheet update

**Pipeline Flow**:
```typescript
async function handleWebhookMessage(payload) {
  // Step 1: Parse message
  const messageData = parseEvolutionAPIPayload(payload);
  
  // Step 2: Store in database
  await storeMessage(messageData);
  
  // Step 3: Message Evaluation - Check minimum required fields
  const llmResult = await processWithLLM(messageData.text);
  const hasMinimumFields = hasMinimumRequiredFields(llmResult);
  
  if (hasMinimumFields) {
    // Process as new order
    return await processNewOrder(messageData, llmResult);
  }
  
  // Step 4: Check if reply
  if (isReplyMessage(payload)) {
    return await handleReplyMessage(messageData);
  }
  
  // Step 5: Irrelevant message - ignore
  return await ignoreMessage(messageData);
}

async function handleReplyMessage(messageData) {
  // 1. Retrieve thread
  const thread = await getThreadHistory(messageData.messageId);
  
  // 2. Check if thread has work order
  const hasWorkOrder = checkThreadHasWorkOrder(thread);
  
  if (!hasWorkOrder) {
    // No work order in thread - ignore
    return await ignoreMessage(messageData);
  }
  
  // 3. Build context and analyze reply
  const context = buildThreadContext(thread);
  const analysis = await analyzeReply(context, messageData.text);
  
  // 4. Execute update operation
  if (analysis.confidence >= 0.7) {
    const rootMessage = thread[0]; // Original work order message
    await updateGoogleSheetRow(rootMessage.messageId, analysis.new_values);
    await logUpdate(messageData.messageId, analysis);
    return { status: "updated" };
  }
  
  // Low confidence - flag for manual review
  await flagForManualReview(messageData, analysis);
  return { status: "needs_review" };
}
```

## Implementation Sequence

### Phase 1: Database & Detection (TASK 2.3)
- [ ] Add Prisma Message model with threading fields
- [ ] Create migration
- [ ] Implement reply detection functions
- [ ] Update webhook handler to detect and store replies
- [ ] Unit tests

**Deliverable**: System can identify and store reply relationships

### Phase 2: Thread Retrieval (TASK 2.4)
- [ ] Implement recursive thread query
- [ ] Add database indexes for performance
- [ ] Create thread context formatter
- [ ] Integration tests

**Deliverable**: Can retrieve complete thread history for any message

### Phase 3: LLM Classification (TASK 2.5)
- [ ] Design classification schema
- [ ] Create LangGraph nodes for classification
- [ ] Write prompts for various reply scenarios
- [ ] Add validation logic
- [ ] Test with real examples

**Deliverable**: LLM can analyze replies and determine appropriate actions

### Phase 4: Sheets Updates (TASK 2.6)
- [ ] Add message_id tracking to Sheets
- [ ] Implement row search and update functions
- [ ] Create audit log
- [ ] Handle edge cases (not found, duplicates)

**Deliverable**: Can update existing sheet rows based on classification

### Phase 5: Integration (TASK 2.7)
- [ ] Wire all components together
- [ ] Add error handling and rollback
- [ ] Implement idempotency
- [ ] Comprehensive end-to-end tests
- [ ] Performance optimization
- [ ] Documentation

**Deliverable**: Complete working system handling both original messages and replies

## Testing Strategy

### Unit Tests
- Reply detection logic
- Thread query correctness
- Classification prompt responses
- Sheet update operations

### Integration Tests
```javascript
describe('Reply Processing Pipeline', () => {
  test('Original message creates new sheet row', async () => {
    const result = await handleWebhook(originalMessagePayload);
    expect(result.status).toBe('created');
    const row = await findSheetRow(result.messageId);
    expect(row.customer_name).toBe('John Doe');
  });
  
  test('Reply "done" updates status', async () => {
    await handleWebhook(originalMessagePayload);
    await handleWebhook(replyDonePayload);
    const row = await findSheetRow(originalMessagePayload.messageId);
    expect(row.job_status).toBe('done');
  });
  
  test('Multiple replies processed correctly', async () => {
    await handleWebhook(originalMessagePayload);
    await handleWebhook(replyPriceChangePayload);
    await handleWebhook(replyAddNotesPayload);
    const row = await findSheetRow(originalMessagePayload.messageId);
    expect(row.total_price).toBe(200);
    expect(row.notes).toContain('additional info');
  });
  
  test('Reply to reply (nested) works', async () => {
    await handleWebhook(originalMessagePayload);
    await handleWebhook(reply1Payload); // Reply to original
    await handleWebhook(reply2Payload); // Reply to reply1
    const thread = await getThreadHistory(reply2Payload.messageId);
    expect(thread.length).toBe(3);
  });
});
```

## Error Handling

### Scenarios
1. **Thread retrieval fails** → Log error, flag for manual review
2. **LLM classification low confidence** → Flag for manual review
3. **Sheet row not found** → Log warning, create manual review task
4. **Sheet update fails** → Retry with exponential backoff, then alert
5. **Circular reference in thread** → Detect and break, log error

### Manual Review Queue
Create a separate sheet/database table for messages that need human review:
- Low confidence classifications
- Failed updates
- Ambiguous threads
- System errors

## Performance Considerations

### Optimization Targets
- Thread retrieval: <100ms for threads up to 50 messages
- LLM classification: <3 seconds
- Sheet updates: <2 seconds
- End-to-end pipeline: <5 seconds total

### Caching Strategy
- Cache frequently accessed threads (in-memory or Redis)
- Cache sheet row lookups by message_id
- TTL: 5-10 minutes (balance freshness vs performance)

## Security & Privacy

### Data Handling
- Store only necessary message data
- Redact sensitive information in logs (phone numbers, addresses)
- Encrypt database connection
- Secure Google Sheets credentials

### Access Control
- Limit sheet edit permissions
- Audit all updates
- Track who/what made each change

## Monitoring & Alerting

### Metrics
- Reply detection rate (% of messages identified as replies)
- Thread retrieval success rate
- Classification confidence distribution
- Sheet update success rate
- Processing time p50, p95, p99

### Alerts
- Classification failures > 5% in 5 minutes
- Sheet API errors
- Thread query timeouts
- Manual review queue growing rapidly

## Future Enhancements

### Phase 2 Features
1. **Smart Context Trimming** - For very long threads, intelligently summarize older messages
2. **Multi-message Updates** - Handle replies that reference multiple previous messages
3. **Proactive Clarification** - System sends WhatsApp message asking for clarification when uncertain
4. **Conflict Resolution** - Handle conflicting updates (e.g., two people updating same field)
5. **Undo/Revert** - Admin interface to revert incorrect updates
6. **Analytics Dashboard** - View thread statistics, common update patterns

## Dependencies

### External Services
- EvolutionAPI (WhatsApp webhook provider)
- OpenAI API (LLM classification)
- Google Sheets API (data storage)
- Railway PostgreSQL (message threading database)

### NPM Packages
- `@langchain/langgraph` - LLM workflow orchestration
- `googleapis` - Google Sheets integration
- `@prisma/client` - Database ORM
- `zod` - Schema validation

## Rollout Plan

### Stage 1: Shadow Mode (1 week)
- Deploy threading system
- Process all messages through both pipelines (old + new)
- Compare results but only use old pipeline for actual updates
- Collect metrics and identify issues

### Stage 2: Partial Rollout (1 week)
- Enable new pipeline for 10% of traffic
- Monitor error rates and manual review queue
- Adjust classification prompts based on real data

### Stage 3: Full Rollout (ongoing)
- Gradually increase to 100%
- Continue monitoring and tuning
- Gather user feedback

## Success Criteria

### Quantitative
- ✅ 95%+ reply detection accuracy
- ✅ <100ms thread retrieval time
- ✅ <5s end-to-end processing time
- ✅ >90% classification confidence
- ✅ <5% manual review rate

### Qualitative
- ✅ Users report accurate updates
- ✅ No duplicate sheet rows created
- ✅ Audit trail is clear and useful
- ✅ System handles edge cases gracefully

---

## Questions for User

1. **Thread Query**: Do you have a preferred query approach, or should I implement the recursive CTE approach described?

2. **Reply Structure**: Can you provide example EvolutionAPI payloads for reply messages? This will help confirm the exact field structure (`contextInfo`, `quotedMessage`, etc.).

3. **Confidence Threshold**: What confidence level should trigger manual review? (Suggested: <0.7)

4. **Update Priority**: Which reply types are most important to handle first?
   - Status updates ("done", "refund")
   - Price changes
   - Note additions
   - Address/customer info changes

5. **Manual Review**: Where should flagged messages go for manual review? New Google Sheet? Email notification? Dashboard?

6. **Testing**: Do you want me to start implementation immediately, or would you like to review this plan first?

