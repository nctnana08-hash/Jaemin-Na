# Security Specification for LET Mastery

## Data Invariants
1. A category can be a root (no parentId) or child.
2. A question must belong to an existing category.
3. Submissions can only be written by the user who owns them.
4. Admin can read/write everything.
5. Clients can read categories and questions but only write their own submissions.

## The "Dirty Dozen" Payloads

1. **Identity Theft (Question):** Signed-in user (non-admin) trying to delete a question.
2. **Category Hijack:** User trying to change the name of "General Education".
3. **Ghost Write:** User trying to submit an answer for another user ID.
4. **Schema Poisoning:** Submission with 1MB of text in `selectedOptionId`.
5. **Unauthorized Discovery:** Finding all submissions of another user.
6. **Orphan Question:** Creating a question with a non-existent `categoryId` (requires batch or server-side, but rules should ideally guard if possible).
7. **Score Spoofing:** User submitting `isCorrect: true` when it was actually false (Rules can't verify logic easily without a secure source, but can restrict who writes).
8. **Bulk Denial of Wallet:** Creating 10,000 empty categories.
9. **Invisible Question:** Question with no options.
10. **Admin Mimic:** User trying to mark themselves as an admin in their submission.
11. **Time Travel:** Submission with a `timestamp` in the future.
12. **Relationship Break:** Moving a question to a category that doesn't exist.

## Test Cases (Mock)
- `get(/questions/q1)` as user: ALLOW
- `create(/questions/q1)` as user: DENY
- `create(/submissions/s1)` for self: ALLOW
- `update(/submissions/s1)` changing `isCorrect`: DENY (submissions should be immutable)
