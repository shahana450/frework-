# Chat Bookkeeping — Design Decisions

## Architecture
- **Embedded section** on `/finance` page (not floating widget) — matches existing tab-style layout
- **No new DB tables** — reuse `fw_fin_journals`, `fw_fin_journal_lines`, `fw_fin_chart_of_accounts`
- **New table**: `fw_fin_chat_sessions` for conversation context (messages JSONB)
- **Rate limiting**: counter stored in `fw_fin_chat_sessions` row (created_at timestamp bucketing)

## API
- `POST /api/finance/chat-book` — parse NL message → JSON journal entry
- `POST /api/finance/journal` — already exists; extended to accept source='chat'
- Chat sessions stored per (business_id + user_id) to carry context

## LLM
- Model: `claude-sonnet-4-6` (already used in the project)
- Strict JSON-only system prompt; validated server-side before returning to client
- History passed as Claude messages array (last 10 messages) for context

## UI
- New "Chat" tab on finance dashboard alongside existing KPI cards
- Entry preview card rendered in chat bubble before confirmation
- Confirmation required before any DB write
- "Undo" = soft-delete (status → 'voided') within 5 min window

## Deduplication / Safety
- Entries written with `source = 'chat'` for audit trail
- Confirmation click sends entry_id back; server verifies user owns the business
- GST: defaults to Kerala intra-state (CGST+SGST) unless user specifies inter-state

## Stack
- Next.js 15 App Router, Supabase, Anthropic SDK (all pre-existing)
- No new packages needed
