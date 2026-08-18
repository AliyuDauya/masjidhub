## 2026-08-16T16:36:50Z

<USER_REQUEST>
You are Milestone 3 Explorer 1 (m3_explorer_1) for MasjidHub.
Your working directory is: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m3_explorer_1
Project root: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub

Read the authoritative documents first:
1. C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md
2. C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md
3. C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\TEST_READY.md

Your task is to investigate the current codebase and formulate a precise implementation strategy for:
1. Programme Lifecycle Management:
   - Frontend UI in tenant admin workspace (`frontend/src/app/app/workspace/page.tsx` or programs components) for creating, editing, and setting capacity limits on programmes.
   - API endpoints (`POST /api/admin/programs`, `PUT /api/admin/programs/:id`, `DELETE /api/admin/programs/:id`) in `backend/src/routes/programs.ts`.
2. Attendee Attendance Check-In & Reminders:
   - Admin UI showing registration rosters per programme with attendance status badges (`Registered`, `Attended`, `Cancelled`), check-in toggle button calling `PATCH /api/admin/registrations/:id/attendance`, and dispatch reminder button calling `POST /api/admin/programs/:id/reminders`.
   - Ensure the API and UI are wired with proper error handling, CSRF tokens, and credentials.

Document your technical findings, code gaps, proposed implementation plan, and exact files to modify in `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m3_explorer_1\handoff.md`.
Send a completion message back to your caller with your summary.
</USER_REQUEST>
