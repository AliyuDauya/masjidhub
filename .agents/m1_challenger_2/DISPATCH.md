# DISPATCH — Milestone 1: Challenger 2

You are a teamwork_preview_challenger agent for Milestone 1.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_challenger_2`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task:
Empirically verify database migrations and clean setup:
1. Test migration deployment from clean slate:
   - Run `npx prisma migrate status` to check migration tracking.
   - Run `npm --prefix backend run db:migrate`.
   - Run `npm --prefix backend run db:generate`.
   - Run `npm --prefix backend run db:seed`.
2. Verify relational integrity:
   - Check cascading deletes (deleting a test tenant cascades to its registrations, programs, announcements).
   - Check nullification (deleting a user sets `Donation.user_id` to null).
   - Check restrict (cannot delete an author of an existing announcement).
3. Issue a clear empirical verdict: `APPROVE` or `REJECT`.
4. Write report to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_challenger_2\handoff.md` and send a message back.
