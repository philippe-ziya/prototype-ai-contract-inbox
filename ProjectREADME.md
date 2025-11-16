# Public Sector Contract Inbox - Project README

## Project Overview

A collaborative contract discovery platform that uses AI-powered semantic search to help UK businesses find relevant public sector procurement opportunities. Users create intelligent "inboxes" that continuously monitor and surface contracts based on natural language queries, with team collaboration features for sharing, saving, and managing opportunities.

## Core Value Proposition

- **Semantic Search First**: Users describe what they're looking for in plain English, AI matches contracts by meaning and relevance, not just keywords
- **Collaborative Workspaces**: Teams share inboxes, coordinate on opportunities, and build institutional knowledge together
- **Smart Recommendations**: AI analyzes company websites to suggest relevant contract searches automatically
- **Continuous Monitoring**: Inboxes update automatically as new contracts are published

## Technology Stack

### Frontend (V0 Prototype Phase)
- React with TypeScript
- shadcn/ui component library
- Tailwind CSS for styling
- Framer Motion for animations
- Responsive 3-column layout (inspired by Linear)

### Backend (Claude Code Implementation Phase)
- Semantic search using OpenAI embeddings
- Vector database (Pinecone, Weaviate, or similar)
- Contract data from UK Contracts Finder API or similar
- Real-time/polling updates for multi-user sync
- User authentication and authorization

## Key User Flows

### 1. Initial Setup & Onboarding
**Assumption**: User has already signed up and provided company URL during registration

1. User creates first inbox
2. System analyzes company profile (from URL stored in user account)
3. AI generates 3 recommended contract search prompts
4. User selects a suggestion OR writes custom prompt
5. User names the inbox (auto-suggested based on prompt)
6. Optional: Invite team members via email
7. System creates inbox and finds matching contracts
8. User lands in main 3-column interface

### 2. Main Inbox Interaction (3-Column Layout)

**Column 0**: Sidebar Navigation (64px)
- Placeholder skeleton for app-level navigation
- Future: Settings, Profile, etc.

**Column 1**: Inbox List (~20% width, collapsible)
- Shows all user's inboxes
- Each inbox displays: name, unread count badge
- Active inbox highlighted
- "+ New inbox" action
- Completely collapses (hide toggle in Column 2 header)

**Column 2**: Contract List (~35% width)
- Header shows:
  - Expand Column 1 button (when collapsed)
  - Active inbox name
  - Search prompt (truncated)
  - Member avatars
  - Stats: "X new • Y unread • Z saved"
- View tabs: All | Unread | Saved | Hidden
- Scrollable contract cards showing:
  - NEW badge (if unread by user)
  - Title, authority, value, deadline
  - Match score (e.g., "94% match")
  - Relevance snippet
  - Star icon (if saved)
  - Save/Hide action buttons
- Cards are clickable to open in Column 3

**Column 3**: Contract Detail (~45% width)
- Default state: Summary stats when no contract selected
- Selected state: Full contract details with:
  - Sticky header with Save/Hide/Export actions
  - Match score explanation ("Why this matches")
  - Key metadata grid
  - Tabs: Overview | Details | Documents | Activity
  - Activity timeline (who saved, who viewed)

**Responsive Behavior**:
- Desktop (>1512px): All 3 columns visible
- Tablet/Small Desktop (<1512px): Column 3 becomes modal overlay
- Mobile (<768px): Single column stack

### 3. Contract Actions & States

**Save Action**:
- Marks contract as saved for ALL inbox members (shared state)
- Star icon fills gold, card gets subtle gold highlight
- Toast confirmation with undo option (4 sec)
- Contract remains in All/Unread views but also appears in Saved tab
- Shows in activity timeline: "[User] saved this"

**Hide Action**:
- Removes contract from inbox for ALL members (shared state)
- Requires confirmation modal with optional feedback:
  - "Not relevant", "Wrong location", "Wrong value range", etc.
- Card animates out, others shift up
- Toast with undo option (6 sec)
- Moves to Hidden tab (only visible there)
- Can be restored from Hidden tab

**Read Status**:
- Personal to each user (NOT shared)
- Opening contract marks as read for that user
- Read contracts can be filtered out via "Unread" tab
- Visual: Unread contracts have bold title + NEW badge

**Contract States Summary**:
- **Saved**: Shared across inbox members
- **Hidden**: Shared across inbox members
- **Read**: Personal to user
- **Unread**: Default state

### 4. Creating Additional Inboxes

1. Click "+ New inbox" in Column 1
2. Modal/screen shows 3 AI-generated prompts (based on company)
3. Select suggestion OR write custom prompt
4. Name the inbox (auto-suggested)
5. Optional: Invite team members
6. Inbox created, auto-selected in Column 1

### 5. Multi-User Collaboration

**Inbox Membership**:
- Inbox owner can add/remove members via email
- All members can: view, save, hide contracts
- All members see: saved contracts, hidden contracts
- Each member tracks: their own read status

**Real-time/Sync Behavior**:
- Save/Hide actions sync across users (polling or websockets)
- Activity timeline shows who did what
- Member avatars show who's in the inbox

### 6. Inbox Management & Refinement

**Edit Inbox**:
- Click "Edit inbox" from settings
- Modify search prompt (with live preview)
- Add/remove filters (value, location, buyer type, deadline)
- See preview count: "This will match ~X contracts"
- Save changes, inbox refreshes with new results

**Advanced Filters** (optional, additive to semantic search):
- Value range slider
- Buyer type checkboxes (Local Council, NHS, Education, etc.)
- Location multi-select
- Deadline range
- CPV codes
- Filters shown as removable chips when active

**Member Management**:
- View all inbox members
- Add members by email
- Remove members
- See member activity (last active, contracts saved)

## Data Model (Simplified)

```
Users
- id
- email
- company_name
- company_url (captured at signup)
- created_at

Inboxes
- id
- name
- prompt_text (natural language query)
- filters (JSON: value, location, buyer_type, etc.)
- created_by_user_id
- created_at
- updated_at

InboxMembers
- inbox_id
- user_id
- role (owner, member)
- last_visited_at
- notification_preferences (JSON)

Contracts
- id
- title
- description
- authority_name
- value
- deadline
- published_date
- cpv_codes
- embedding (vector for semantic search)
- source_url

ContractActions (shared states)
- contract_id
- inbox_id
- action_type (saved, hidden)
- user_id (who performed action)
- feedback_reason (for hides, optional)
- created_at

UserReadStatus (personal state)
- contract_id
- inbox_id
- user_id
- read_at
```

## AI/Semantic Search Components

### Company Analysis (Signup)
- **Input**: Company URL
- **Process**: Scrape/fetch website content → LLM extracts business context
- **Output**: Industry, services, typical project size, geographic focus
- **Stored**: In user profile for generating inbox suggestions

### Prompt Generation (Inbox Creation)
- **Input**: User's company profile
- **Process**: LLM generates 3 contextual contract search prompts
- **Output**: Natural language queries like "Construction projects over £100k in the South East"

### Contract Matching (Ongoing)
- **Input**: Inbox prompt + filters
- **Process**: 
  - Embed prompt using OpenAI embeddings
  - Vector similarity search against contract embeddings
  - Apply filter constraints (value, location, etc.)
  - Rank by relevance score (0-100%)
- **Output**: Ordered list of matching contracts

### Match Explanation
- **Input**: Prompt + Contract content
- **Process**: LLM generates "why this matches" explanation
- **Output**: Natural language explanation with highlighted matching elements
- **Example**: "Strong alignment with construction focus and southeast location preference"

## Design Principles

1. **Semantic-first, filters-optional**: Start with natural language, add precision filters only when needed
2. **Transparent AI**: Always explain WHY a contract matches
3. **Collaborative by default**: Shared inboxes, shared saved/hidden states
4. **Reversible actions**: Undo for critical actions (hide, save)
5. **Progressive disclosure**: Advanced features available but not overwhelming
6. **Real-time collaboration**: Teams see each other's activity
7. **Professional B2B aesthetic**: Clean, trustworthy, inspired by Linear/Notion

## V0 Prototype Scope

The V0 prototype focuses on **frontend UI/UX** with mock data:

✅ **Included**:
- 3-column responsive layout
- Inbox creation flow with AI prompt suggestions
- Contract list with state indicators
- Contract detail view
- Save/Hide actions with confirmations
- View tabs (All, Unread, Saved, Hidden)
- Member avatars and basic collaboration UI
- Loading states, empty states, error states
- Toast notifications and modals

❌ **Not included** (Claude Code phase):
- Real semantic search / embeddings
- Actual contract data from APIs
- User authentication
- Database integration
- Real-time sync between users
- Company URL analysis
- AI prompt generation logic

## Claude Code Implementation Priorities

1. **Contract data pipeline**: Fetch from Contracts Finder API, embed descriptions
2. **Semantic search**: OpenAI embeddings + vector DB for matching
3. **User auth & permissions**: Multi-tenant inbox access
4. **Match explanations**: LLM-generated relevance reasoning
5. **Company analysis**: Website scraping + LLM extraction
6. **Real-time sync**: Polling or websockets for multi-user state
7. **Notifications**: Email digests for new matches

## Sample UK Contract Data

For realistic prototyping, use contracts like:
- **Construction**: "Building maintenance framework, Kent County Council, £250k, 30 days"
- **IT Services**: "Desktop support contract, NHS Surrey Heartlands, £75k, 14 days"
- **Professional Services**: "Management consultancy, Transport for London, £500k, 45 days"
- **Healthcare**: "Medical equipment supply, various NHS trusts, £1.2M, 60 days"

Match scores range: 65-98%  
Authorities: Local Councils, NHS Trusts, Central Government, Education, Transport

## Key Terminology

- **Inbox**: A saved search configuration (prompt + filters) that monitors contracts
- **Prompt**: Natural language description of desired contracts
- **Match Score**: AI-calculated relevance (0-100%)
- **Saved**: Contract marked important by any inbox member (shared)
- **Hidden**: Contract removed from view for all inbox members (shared)
- **Read**: Contract opened by specific user (personal)
- **Semantic Search**: AI matching by meaning, not just keywords
- **CPV Codes**: Common Procurement Vocabulary (EU classification system)

## V0 Prompts Reference

The following V0 prompts have been created for building this prototype:

1. **3-Column Layout**: Main application structure with collapsible inbox list, contract list, and detail view
2. **Inbox Setup Flow**: AI-powered prompt suggestions based on company profile
3. **Success & Loading States**: Inbox creation confirmation and transitions
4. **Save & Hide Actions**: Contract state management with confirmations and feedback

Additional prompts available for:
- Contract detail deep dive
- Advanced filter panel
- Member management
- Edit inbox modal
- Bulk actions
- Empty and error states

## File Structure (Anticipated)

```
/
├── README.md (this file)
├── frontend/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── InboxList.tsx
│   │   │   ├── ContractList.tsx
│   │   │   └── ContractDetail.tsx
│   │   ├── inbox/
│   │   │   ├── InboxSetup.tsx
│   │   │   ├── PromptSuggestions.tsx
│   │   │   └── InboxSettings.tsx
│   │   ├── contracts/
│   │   │   ├── ContractCard.tsx
│   │   │   ├── ContractActions.tsx
│   │   │   └── MatchExplanation.tsx
│   │   └── shared/
│   │       ├── ViewTabs.tsx
│   │       ├── FilterPanel.tsx
│   │       └── MemberAvatars.tsx
│   └── lib/
│       ├── api.ts
│       └── types.ts
├── backend/
│   ├── api/
│   ├── services/
│   │   ├── semantic-search.ts
│   │   ├── company-analysis.ts
│   │   └── contract-sync.ts
│   └── db/
└── docs/
    └── api.md
```

## Getting Started (For Developers)

### V0 Phase:
1. Use the V0 prompts provided to generate UI components
2. Integrate components into 3-column layout
3. Add mock data for contracts, inboxes, users
4. Test all user flows with realistic interactions
5. Ensure responsive behavior at all breakpoints

### Claude Code Phase:
1. Set up backend with Node.js/Python
2. Integrate OpenAI API for embeddings
3. Set up vector database (Pinecone/Weaviate)
4. Build contract ingestion pipeline
5. Implement semantic search endpoints
6. Connect frontend to real API
7. Add authentication (Clerk, Auth0, or similar)
8. Implement real-time updates
9. Deploy to production environment

## Success Metrics

- **Time to first relevant contract**: < 2 minutes from signup
- **Match quality**: >80% of contracts rated "good match" by users
- **Team collaboration**: Average 3+ members per inbox
- **Engagement**: Users return 3+ times per week
- **Conversion**: >60% of saved contracts result in bid submission

## Open Questions / Future Enhancements

- Role-based permissions (admin vs member vs viewer)
- Bulk actions (select multiple contracts)
- Email notifications (daily digest, instant alerts)
- Export contracts (PDF, CSV, CRM integration)
- Saved search views within an inbox
- Search history and suggestions
- Contract change tracking (amendments, deadline extensions)
- Browser extension for quick save from Contracts Finder
- Mobile app
- Analytics dashboard (success rate, value pipeline)
- Integration with bid management tools

## Contributing

When contributing to this project:

1. Follow the established design patterns from Linear/Notion
2. Maintain consistent component structure using shadcn/ui
3. Test all responsive breakpoints
4. Ensure accessibility (keyboard navigation, ARIA labels)
5. Add mock data that reflects realistic UK public sector scenarios
6. Document any new AI/semantic search components
7. Keep user interactions feeling immediate and reversible

## Contact & Support

- Project documentation: [Link to docs]
- API documentation: [Link to API docs]
- Design system: [Link to Figma/Storybook]
- Issue tracking: [Link to project board]

---

**Last Updated**: November 2025  
**Status**: V0 Prototype Phase  
**Version**: 0.1.0
