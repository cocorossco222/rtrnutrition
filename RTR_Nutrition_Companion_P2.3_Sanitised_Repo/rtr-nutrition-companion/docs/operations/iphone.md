# iPhone Safari + Home Screen UAT

Run this on the **staging branch deploy** before production migration.

## Safari

- Open the exact staging URL in Safari.
- Complete onboarding and a daily check-in.
- Close/reopen Safari and confirm data persists.
- Exercise bottom navigation, sheets, back gesture, settings, export and restore.
- Confirm the resolved-day state is visually complete and does not nag for more activity.
- Rotate portrait/landscape once; return to portrait and check no layout corruption.

## Add to Home Screen

- Safari → Share → Add to Home Screen.
- Launch from the icon, not the Safari tab.
- Confirm icon/title/status-bar presentation.
- Repeat a check-in/edit/reopen cycle.
- Background the app, reopen it, then fully close/relaunch it.
- With the app loaded once, enable Airplane Mode and relaunch from the Home Screen. Confirm the shell opens and a local check-in can still be saved. If it cannot, treat offline relaunch as an unresolved production issue rather than assuming browser cache behaviour.
- Confirm the Home Screen app uses the same intended origin and retains its data.

## Failure gate

Do not progress to the permanent production origin with any defect involving blank launch, data loss, navigation traps, broken save/restore, or an unresolved/incorrect “Done for today” state.

## Origin warning

Safari/Home Screen data is origin-bound. Staging data is disposable test data. Do not create a real-client production record on a temporary Netlify hostname and assume it will automatically appear on the later custom domain.
