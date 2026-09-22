# Production client migration

This is deliberately written without any real client identity so it can live in the public repository.

1. From the old working Companion, export a backup and verify the file can be parsed/restored in a test copy.
2. Open the **permanent production origin** in iPhone Safari.
3. Add that origin to the Home Screen.
4. Establish the client's authenticated UUID identity when the data core is live.
5. Import the existing local record if continuity is required.
6. Complete one ordinary day until the Companion reaches “Done for today”.
7. Verify the queued `day.resolved` event receives an authenticated acknowledgement.
8. Verify the minimal coach read model shows the expected client and latest event/snapshot state.
9. Exercise one manual **Send to Coco** update and verify it appears separately.
10. Only after all checks pass, retire the previous shortcut/origin.
