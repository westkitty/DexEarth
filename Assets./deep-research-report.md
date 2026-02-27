# DexCraft Templates Manager Redesign Research Report

## Repository baseline and scope anchors

DexCraft currently implements template management as a compact UI embedded in the `templatesTab` inside `PrimaryPanelView`, with a name field + Save button and a small scroll region (`maxHeight: 120`) showing template apply buttons, targets, and a trash delete control. citeturn12view0

Templates are persisted locally using `StorageManager` to a `templates.json` file under Application Support, with JSON encoder/decoder configured for ISO 8601 dates. citeturn13view2 This aligns with the explicit “offline/local” constraint and the app’s own UI language indicating offline/local processing. citeturn12view0

The current template model is `PromptTemplate` with five fields: `id`, `name`, `content`, `target`, and `createdAt`. citeturn13view1 Templates are applied by setting the current prompt content and selected target in the view model. citeturn13view0

Saving templates is currently an implicit overwrite by a **case-insensitive name match**: if a template name matches (lowercased comparison), DexCraft overwrites content and target; otherwise it inserts a new template at index 0. citeturn13view0 This behavior is the required baseline to preserve, but must be made explicit and deterministic via confirmation (R4).

Filtering/sorting/search are not present today. Targets are represented by `PromptTarget` and exposed for UI via `segmentTitle`, which is the required display string for target filtering controls. citeturn14view0

## Template data model upgrade and deterministic migration

### Required schema additions

To meet R1 while remaining repository-scoped and backward compatible, `PromptTemplate` must be expanded to include:

- `category: String` (required)
- `tags: [String]` (optional, default to `[]`)
- `updatedAt: Date` (required)

All existing fields must remain supported (`id`, `name`, `content`, `target`, `createdAt`). citeturn13view1

### Backward compatibility strategy for older `templates.json`

Because templates are stored in `templates.json` and decoded at runtime via `StorageManager` citeturn13view2, decoding must tolerate older JSON objects that lack the new keys. The safest repo-aligned approach is a **custom `Decodable` implementation** for `PromptTemplate` that:

- Attempts to decode each new field as optional.
- Uses deterministic defaults when missing:
  - `category = "Uncategorized"`
  - `tags = []`
  - `updatedAt = createdAt` (preferred), otherwise a fallback if `createdAt` is missing/invalid (see below).

This plan directly satisfies the “Input: old JSON” → “Output: deterministic defaults” requirement (R1), without changing `StorageManager`’s storage location or mechanism. citeturn13view2

### Handling missing or invalid `createdAt` deterministically

R1 allows `updatedAt = Date()` when `createdAt` is missing/invalid, but unit tests in V1 require a deterministic fallback. To reconcile both, implement a *test-overridable* fallback clock:

- Production default: `PromptTemplate.migrationNow: () -> Date = { Date() }`
- Tests: override to return a fixed constant (e.g., `Date(timeIntervalSince1970: 1_700_000_000)`).

This preserves current behavior expectations while making migration unit-testable and fully deterministic in CI.

### Optional but recommended migration write-back

After decoding and applying defaults, consider immediately re-saving templates back to disk so subsequent launches load fully-populated objects through `StorageManager.saveTemplates`. citeturn13view2 This is not strictly required by R1, but reduces long-term edge cases (mixed schema on disk).

## Search, filter, and sort design that stays fast at 100+ templates

### UI structure and list virtualization

R2 requires replacing the tiny scroll area. The most robust repo-consistent change is to replace the `ScrollView(maxHeight: 120)` pattern citeturn12view0 with a resizable list region using SwiftUI `List` (or `LazyVStack` inside a `ScrollView`) keyed by `template.id`.

Apple’s SwiftUI documentation explicitly frames `List` as the primary way to present **scrollable** rows of data, including dynamic lists built from collections. citeturn17search0 In practice, `List` is also the most reliable virtualization mechanism for 100+ rows on macOS, reducing layout cost compared to eager stacks.

A concrete, testable UI acceptance target for “100+ ready”:

- The templates region must render as a `List` (preferred) or `ScrollView` + `LazyVStack`.
- The region must be given a minimum height sufficient for ~10 rows (for example `minHeight ≈ 280–340`, depending on row height), and should expand within the popover/detached window instead of being capped at 120px. This directly replaces the existing cap. citeturn12view0

### Search behavior and matching rules

R2 requires a search field that filters by:

- `name` substring, case-insensitive
- `category` substring, case-insensitive
- `tags` substring match on **any** tag, case-insensitive

Implementation spec for determinism and testability:

- Normalize both haystack and needle using the same method before matching (example: `.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: …)`).
- Search query trimming:
  - Leading/trailing whitespace ignored.
  - Empty query means “no search constraint” (passes all).

Apple’s SwiftUI guidance for adding search commonly uses `searchable(text:)` to bind search text and then updates filtered content based on that text, which fits DexCraft’s architecture. citeturn15search0

### Filter controls and deterministic AND composition

R2 requires dropdown filters:

- Category filter (dropdown)
- Target filter (dropdown using `PromptTarget.segmentTitle`) citeturn14view0
- Sort dropdown with deterministic options:
  - Recently Updated (`updatedAt` desc)
  - Recently Created (`createdAt` desc)
  - Name (A–Z) (localized/case-insensitive asc)

Composition must be deterministic AND logic:

`visibleTemplates = templates WHERE categoryFilter AND targetFilter AND searchQuery`

Implementation details that make this testable:

- Represent filters as value types:
  - `categoryFilter: String?` (`nil` = All Categories)
  - `targetFilter: PromptTarget?` (`nil` = All Targets)
  - `sortOption: TemplateSortOption`
- Define category matching as:
  - If categoryFilter is nil → pass
  - Else `template.category == categoryFilter` (exact match), after applying a canonicalization/normalization rule for storage (recommended: trimmed; preserve case as entered, but use case-insensitive equality when comparing filters).

### Sorting stability and explicit tie-breakers

To satisfy deterministic ordering (R2/R5) and V3, define tie-breakers *in the spec*, not “whatever Swift sort does”:

- Recently Updated:
  1. `updatedAt` descending
  2. `name` ascending (case-insensitive, locale-aware)
  3. `id.uuidString` ascending (final stable tie-breaker)
- Recently Created:
  1. `createdAt` descending
  2. `name` ascending
  3. `id.uuidString` ascending
- Name (A–Z):
  1. `name` ascending (case-insensitive, locale-aware)
  2. `updatedAt` descending (optional secondary)
  3. `id.uuidString` ascending

This prevents unstable ordering when many templates share identical timestamps (common when importing defaults).

### Performance plan at 100+ without stutter

R5 requires either (a) debounced search or (b) background compute → publish results on main thread.

Within DexCraft’s architecture, the most predictable approach is:

- Implement a pure function:  
  `computeVisibleTemplates(allTemplates, filters, query) -> [PromptTemplate]`
- Call it through a debounced pipeline:
  - Cancel-in-flight search task.
  - Wait 150–250ms.
  - Compute filtered/sorted list on a background context (or just after debounce; 100–500 items is still fine).
  - Assign to `@Published visibleTemplates` on the main actor.

This keeps UI smooth while preserving deterministic ordering since the computation itself is deterministic.

## Category browsing and category management UX

### Category dropdown requirements

R3 requires the category dropdown to support:

- Type-ahead search within the category list
- “All Categories”
- “Uncategorized”
- “Manage Categories…” which opens an editor sheet/popup

There are two viable implementations consistent with SwiftUI/macOS constraints:

- Minimal (likely sufficient): a `Picker` in menu style, relying on macOS menu type-to-select behavior.
- Strong match to spec: a custom popover (“intelligent dropdown”) that contains:
  - A search field
  - A filtered list of categories
  - Footer actions (“All Categories”, “Uncategorized”, “Manage Categories…”)

Because menus typically don’t embed live text fields reliably, the popover approach is more faithful to “type-ahead search within the category list.”

Category list source of truth should be derived from templates at runtime:

- `categories = unique(template.category)` plus ensure “Uncategorized” always present.
- Sorted deterministically A–Z (case-insensitive).
- Optionally display counts: “Development (12)”.

### Category editor sheet behaviors

R3 requires deterministic category operations:

- Rename category (propagate to templates)
- Merge categories A → B (propagate)
- Delete category (templates reassigned to “Uncategorized”)

A spec that avoids ambiguity:

- Categories are treated as canonical strings. The editor operates on exact category entries as shown in the dropdown (internally you may treat equality as case-insensitive to prevent duplicate categories differing only by case).
- Operations must be pure transformations on `[PromptTemplate]` returning a new array, enabling deterministic unit tests (V4).

Suggested editor UI elements:

- A list of existing categories (excluding the implicit “All Categories”).
- Rename action:
  - Select a category → enter new name → preview count of affected templates → Confirm/Cancel
- Merge action:
  - Select source category A
  - Select destination category B (cannot be A)
  - Confirm/Cancel
- Delete action:
  - Select category → confirmation dialog → reassign templates to “Uncategorized” and remove category if no templates remain

All category operations must end by persisting updated templates to `templates.json` via `StorageManager.saveTemplates`, maintaining the repo’s offline/local persistence rule. citeturn13view2

## Template save, metadata editing, duplication, and bundled default import

### Deterministic save outcomes with explicit overwrite confirmation

The current save behavior overwrites implicitly on case-insensitive match. citeturn13view0 R4 requires making this explicit:

Spec behavior:

- When user clicks Save:
  - If trimmed name is empty → disable Save or show inline validation
  - Find match where `existing.name.lowercased() == enteredName.lowercased()`
    - If match exists → show confirmation “Overwrite ‘X’?” with Yes/Cancel
      - Cancel → no changes
      - Yes → overwrite the existing template’s `content` and `target`, update `updatedAt`
        - Preserve existing `category` and `tags` unless the user explicitly uses “Edit metadata”
    - If no match → create new template:
      - `id = UUID()`
      - `name = enteredName`
      - `content = current rough input`
      - `target = selectedTarget`
      - `createdAt = now`
      - `updatedAt = now`
      - `category = selectedCategory` (default “Uncategorized”)
      - `tags = selectedTags` (default `[]`)
      - Insert at index 0 (preserves current UX expectation) citeturn13view0

### Edit metadata action

R4 requires “Edit metadata” without altering content:

- Edit category / tags / target in a modal sheet
- On save:
  - Update only metadata fields (`category`, `tags`, `target`)
  - Update `updatedAt` to now (optional but consistent with “Recently Updated” semantics)

### Duplicate action

Recommended optional behavior:

- Creates a copy with:
  - New `id`
  - `name = "\(original.name) (Copy)"` (if exists, increment: “(Copy 2)”, deterministically)
  - Same content/target/category/tags
  - `createdAt = now`, `updatedAt = now`
  - Insert at index 0

### Bundled defaults import to reach 100 templates

R6 requires a deterministic seeding mechanism with no network calls.

Spec:

- Add `DefaultTemplates.json` to the app bundle as a resource.
- Add an “Import Defaults” button in Templates UI.
- Import algorithm:
  - Load bundled defaults from `Bundle.main.url(forResource: "DefaultTemplates", withExtension: "json")` (or equivalent), then decode.
    - Swift community guidance confirms the `Bundle…url(forResource:withExtension:)` pattern yields a file URL suitable for reading bundled resources. citeturn20view3
  - Compute stable key for each default template:
    - Preferred: `slug` field stored in default JSON and generated deterministically from the default name.
    - Minimal acceptable: case-insensitive name key (matches existing overwrite logic). citeturn13view0
  - Add only missing templates:
    - `missing = defaults.filter { !existingKeys.contains($0.key) }`
  - Never overwrite user templates during import.
  - Ensure idempotency:
    - Running import twice adds 0 on the second run (V6).

Default template objects should include category/tags/updatedAt to avoid immediate migration churn.

## Codex implementation prompt and deterministic validation checklist

### Codex research and implementation prompt

Copy/paste the following into a separate Codex chat as the implementation prompt:

```text
You are working ONLY inside the existing GitHub repo westkitty/DexCraft. Do not introduce network calls, cloud sync, or any new persistence layer. Keep SwiftUI + local JSON storage via StorageManager to templates.json.

Repo touchpoints (must use these exact existing integration points):
- PrimaryPanelView.templatesTab (current Templates UI lives here and uses a tiny ScrollView maxHeight 120).
- PromptEngineViewModel (template save/apply/delete logic; currently overwrites by case-insensitive name match and inserts new at index 0).
- PromptTemplate model (currently id, name, content, target, createdAt).
- StorageManager (loads/saves templates.json in Application Support; JSON encoder/decoder uses ISO8601 strategies).
- PromptTarget.segmentTitle (use for UI display and target filter dropdown values).

Goal:
Redesign the Templates manager UI to be performant and usable at 100+ templates with categories, tags, search, deterministic filtering and sorting, category management UX, explicit overwrite confirmation, metadata editing, and a bundled defaults import that can seed ~100 templates.

Tasks:

1) Update PromptTemplate schema + migration (R1)
- Add fields:
  - category: String (required)
  - tags: [String] (optional)
  - updatedAt: Date (required)
- Keep existing fields supported: id, name, content, target, createdAt.
- Implement custom Decodable init to support old templates.json entries without new fields:
  - category defaults to "Uncategorized"
  - tags defaults to []
  - updatedAt defaults to createdAt
  - If createdAt missing/invalid, use a deterministic fallback clock:
    - Add a static closure PromptTemplate.migrationNow: () -> Date = { Date() }
    - Use migrationNow() as the fallback in decode; unit tests can override to fixed date.
- Ensure encoding writes the new fields.

2) Implement deterministic filtering/sorting (R2, R5)
- Add a pure function (unit-testable) such as:
  computeVisibleTemplates(templates: [PromptTemplate], query: String, categoryFilter: String?, targetFilter: PromptTarget?, sort: TemplateSortOption, locale: Locale) -> [PromptTemplate]
- Search rules (case-insensitive substring):
  - match in name OR category OR any tag
- Filters compose with AND logic:
  - categoryFilter AND targetFilter AND searchQuery
- Sort options:
  - Recently Updated: updatedAt desc, tie-breaker name asc (case-insensitive, locale-aware), then id.uuidString asc
  - Recently Created: createdAt desc, tie-breaker name asc, then id.uuidString asc
  - Name (A–Z): name asc (case-insensitive, locale-aware), tie-breaker updatedAt desc (optional), then id.uuidString asc
- Use stable identifiers for list rendering: template.id.

3) Redesign Templates UI inside PrimaryPanelView.templatesTab (R2)
- Replace tiny ScrollView(maxHeight: 120) with a resizable region that can show ~10+ rows:
  - Prefer List; acceptable alternative: ScrollView + LazyVStack.
- Add controls at top:
  - Search field
  - Category filter dropdown (with All Categories, Uncategorized, Manage Categories…)
  - Target filter dropdown (All Targets + PromptTarget.segmentTitle values)
  - Sort dropdown (3 options above)
- Each row should show:
  - Primary: template.name
  - Secondary: category + target
  - Tertiary: tags (if any), truncated
  - Actions: Apply (row click), Delete (trash), plus “…” menu with Edit metadata + Duplicate (optional but recommended)
- Ensure deterministic ordering and no UI stutter:
  - Debounce search/filter changes (150–250ms) using cancellable Task.sleep or Combine; compute visibleTemplates off main thread then publish on main actor.

4) Category browsing UX + editor (R3)
- Category dropdown must support type-ahead search:
  - Implement “intelligent dropdown” as a popover with a search field filtering the category list, OR a Picker menu if you can justify native type-to-select.
- Include “Manage Categories…” that opens a modal sheet.
- Category manager must support:
  - Rename category with deterministic propagation to templates
  - Merge category A → B
  - Delete category (reassign affected templates to "Uncategorized")
- Implement these ops as pure functions on [PromptTemplate] for unit testing.

5) Save / overwrite confirmation + metadata editing (R4)
- Save button must be explicit:
  - If name matches existing (case-insensitive): show Overwrite? confirmation (Yes/Cancel)
  - If new: create template with chosen category + tags + selected target
- Overwrite behavior:
  - On confirm: overwrite content + target, update updatedAt
  - Preserve existing category/tags unless user intentionally edits metadata
- Add “Edit metadata” action:
  - Change category/tags/target without altering content; update updatedAt.

6) Bundled default templates + Import Defaults (R6)
- Add DefaultTemplates.json to app bundle (no network calls).
- Add “Import Defaults” button.
- Import must be idempotent:
  - Adds only missing templates based on stable key (case-insensitive name is acceptable; slug is better).
  - Never duplicates existing templates; second import adds 0.
- Defaults should include category/tags/updatedAt to avoid migration churn.

7) Deterministic validation plan (must implement unit tests + manual steps)
- Add a DexCraftTests target if not present, using XCTest.
- Write unit tests for:
  V1 migration defaults from old JSON fixture
  V2 deterministic filtering results (exact ordered IDs)
  V3 deterministic sort with explicit tie-breakers
  V4 category rename/merge/delete propagation
  V5 overwrite confirmation logic in view model (confirm/cancel paths)
  V6 import defaults idempotency (import twice adds 0 second time)
- Also provide a short manual UI checklist to verify search/filters/row actions visually.

Deliver:
- Code changes only inside this repo.
- No new network dependencies.
- Keep StorageManager and templates.json persistence model.
```

### Deterministic validation checklist

This checklist is aligned directly to V1–V6 and can be executed via a mix of unit tests and manual UI steps.

Model migration defaults  
V1 unit test
- Given a fixture JSON array containing old entries with only `{ id, name, content, target, createdAt }`, decode them.
- Assert per decoded template:
  - `category == "Uncategorized"`
  - `tags == []`
  - `updatedAt == createdAt`
- Additional deterministic edge test:
  - Fixture missing `createdAt`: override `PromptTemplate.migrationNow` to a fixed date and assert `createdAt == fixedNow` and `updatedAt == fixedNow`.

Search + filters determinism  
V2 unit test
- With a fixed in-memory template list:
  - Query “sql” returns exactly templates whose `name` OR `category` OR any `tags[]` match case-insensitive substring “sql”.
  - Category filter “Writing” AND target filter (by `PromptTarget`) returns only those matching both.
- Assert the exact ordered array of `template.id` values.

Stable sorting  
V3 unit test
- Construct fixture templates with known timestamps and ties.
- Assert:
  - “Name (A–Z)” matches expected locale (set locale explicitly in the compute function call for determinism).
  - “Recently Updated” sorts by `updatedAt desc` with the documented tie-breakers.
  - “Recently Created” sorts by `createdAt desc` with tie-breakers.
- Validate by exact ordered `id` list.

Category management determinism  
V4 unit tests
- Rename “Dev” → “Development”:
  - Only templates previously in “Dev” change; strings match exactly.
- Merge “Dev” into “Development”:
  - All “Dev” become “Development”.
- Delete “Dev”:
  - All “Dev” become “Uncategorized”.
- Assert exact category strings and unchanged templates elsewhere.

Save behavior explicitness and safety  
V5 unit + UI test
- ViewModel unit test:
  - When saving “My Template” while “my template” exists (case-insensitive match), verify confirmation-required state is produced.
  - Cancel leaves templates unchanged.
  - Confirm overwrites `content` and `target`, and updates `updatedAt` (and preserves category/tags unless explicitly changed elsewhere).
- UI test (or manual if UI testing isn’t set up):
  - Attempt overwrite and confirm dialog appears and behaves correctly.

Import defaults idempotency and “100 templates” readiness  
V6 unit test
- Given bundled defaults list N and existing templates with K overlaps:
  - Import adds exactly `N - overlapCount`
  - Second import adds 0
- Assert template count and keys; verify no duplicate by key.

Manual UI verification (fast visual pass)
- Import defaults; ensure list shows large count and remains responsive when scrolling/searching.
- Search for a tag term; verify matches appear immediately after debounce.
- Toggle category, target, and sort; verify results change deterministically and do not jump unpredictably.
- Edit metadata on a template; verify content unchanged and list row secondary/tertiary text updates.
- Rename/merge/delete categories in the manager; verify propagation and reassignment to “Uncategorized” on delete.

