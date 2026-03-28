# COPILOT BUGFIX PROMPT

Read the repo and find all places where code violates the JGA business rules.

Then fix:
1. any frontend hardcoded pricing
2. any route that allows active status without signed contract
3. any route that allows production without deposit
4. any route that allows delivery before final payment
5. any contractor permission escalation
6. any missing ledger writes on important events

After fixes:
- summarize changed files
- list remaining TODOs
- propose tests to prove the fix
