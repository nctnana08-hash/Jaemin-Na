# Let Mastery Platform Architecture & Requirements

## MAIN GOAL
Turn Let Mastery into a responsive web-based PWA platform for LET review and adaptive learning.
Accessible via: Desktop browser, Laptop browser, Tablet browser, Mobile browser, Installed PWA.
Roles: Student, Instructor, Admin (separated, not combined).
Student side: Offline-capable (PWA, IndexedDB, pull-based sync).
Instructor/Admin side: Online-first dashboards.

## PLATFORM IDENTITY
1. Offline LET Reviewer
2. Adaptive Learning Platform (skills, weaknesses/strengths analysis)
3. Role-Based Web Management System

## ROLES
1. **Student**: Offline review, quizzes, mock exams, gamification, adaptive learning, sync.
2. **Instructor**: Content creation, questions, modules, AI drafts, student/class monitoring.
3. **Admin**: User management, roles, global curriculum, approvals, platform analytics, system settings.

## CORE FEATURES
- **Offline Mode**: PWA installable, IndexedDB for local DB, local quiz attempts -> sync when online.
- **Diagnostic Assessment**: Initial test -> learner profile -> personalized learning path.
- **Adaptive Learning Engine**: mastery computation, custom learning path.
- **Learning Quest Mode**: module learning (hook, mini lesson, quick check, challenge).
- **Gamification**: badges, streaks.
- **AI Assistant**: student explanations; instructor question/module generation.
- **Instructor CMS**: CSV/Excel bulk upload, module builder, question management, AI drafting.
- **Admin Management**: User approval, content approval, analytics, logs.

## ARCHITECTURE
- **Student**: Offline-first. 
- **Instructor & Admin**: Online-first.
- Sync strategy: Pull-based from Firestore to local IndexedDB. Upload local attempts to Firestore.

## FIRESTORE CLOUD DB
- `users`, `categories`, `topics`, `skills`, `questions`, `modules`, `diagnosticAttempts`, `quizAttempts`, `mockExamAttempts`, `learnerProfiles`, `moduleProgress`, `badges`, `classes`, `aiDrafts`, `contentVersions`, `activityLogs`, `syncLogs`.

## LOCAL DB (IndexedDB)
- `localCategories`, `localTopics`, `localSkills`, `localQuestions`, `localModules`, `localQuizAttempts`, `localProgress`, `localBadges`, `syncQueue`, `localSettings`, `contentVersion`.

## IMPLEMENTATION PRIORITY
1. Inspect repo & understand structure.
2. Replace name with "Let Mastery".
3. Improve role-based routing (Separate Student, Instructor, Admin).
4. Add responsive layout.
5. Add offline-first PWA foundation (Manifest, SW, IndexedDB).
6. Add content sync system.
7. Diagnostic assessment.
8. Learner profile & adaptive logic.
9. Offline quiz engine & Exam simulation.
10. Learning quest mode.
11. Gamification.
12. Instructor CMS improvements.
13. Admin dashboard improvements.
14. Security rules.
