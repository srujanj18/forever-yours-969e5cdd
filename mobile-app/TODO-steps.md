# Mobile App Bug Fixes - Fix Expo Start Errors

## Steps:

- [x] 1. Update `lib/firebase.ts`: Fix Firebase Auth initialization with AsyncStorage persistence to resolve warning
- [x] 2. Update `app/index.tsx`: Move router.replace to useEffect with ref to prevent render-time navigation error
- [x] 3. Update `lib/types.ts`: Remove unused AsyncStorage import
- [x] 4. Test changes: cd mobile-app && npx expo start --clear (verify no warning, no React error, proper auth redirect)
- [ ] 5. Complete: Use attempt_completion
