WITH RECURSIVE MessageThread AS (
    -- 1. ANCHOR MEMBER: Base Message (Depth 0)
    SELECT
        t."key" ->> 'id' AS thread_base_id,
        t."key" ->> 'id' AS current_message_id,
        t."contextInfo" ->> 'stanzaId' AS parent_message_id,
        t."message" -> 'conversation' AS message_text,
        t."pushName" AS sender_name,
        0 AS thread_depth,
        -- Initialize the history with the first message
        CONCAT(t."pushName", ' : ', t."message" -> 'conversation') AS full_thread_history
    FROM
        "Message" t
    WHERE
        -- Identify messages that are NOT replies (start of a thread)
        (t."contextInfo" IS NULL OR t."contextInfo" ->> 'stanzaId' IS NULL)
        AND t."message" -> 'conversation' IS NOT NULL
        AND t."key" ->> 'remoteJid' = '120363418663151479@g.us'

    UNION ALL

    -- 2. RECURSIVE MEMBER: Replies (Depth 1, 2, 3, etc.)
    SELECT
        mt.thread_base_id,
        t."key" ->> 'id' AS current_message_id,
        t."contextInfo" ->> 'stanzaId' AS parent_message_id,
        t."message" -> 'conversation' AS message_text,
        t."pushName" AS sender_name,
        mt.thread_depth + 1 AS thread_depth,
        -- Accumulate the history: previous history + separator + current message
        CONCAT(mt.full_thread_history, ' | ', t."pushName", ' : ', t."message" -> 'conversation') AS full_thread_history
    FROM
        "Message" t
    JOIN
        MessageThread mt ON t."contextInfo" ->> 'stanzaId' = mt.current_message_id
    WHERE
        t."contextInfo" ->> 'stanzaId' IS NOT NULL
        AND t."key" ->> 'remoteJid' = '120363418663151479@g.us'
)
-- 3. FINAL SELECTION: Output the full thread, ordered by the base message and depth
SELECT
    thread_base_id,
    thread_depth,
    current_message_id,
    sender_name,
    message_text,
    full_thread_history
FROM
    MessageThread
ORDER BY
    thread_base_id,
    thread_depth;