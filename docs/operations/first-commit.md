# Fresh GitHub repository — first commit

This directory is intentionally delivered **without** a `.git` directory so no historic client material can follow it into the public repository.

After one final human review:

```bash
npm ci
npm test

git init
git branch -M main
git add .
git status
git diff --cached --stat
git commit -m "Initial sanitised P2.3 baseline"
git remote add origin <NEW_GITHUB_REPOSITORY_URL>
git push -u origin main

git checkout -b develop
git push -u origin develop
```

Then connect the repository to the staging-safe Netlify configuration described in `netlify.md`.

Do not import, merge, mirror or force-push the former repository history into this repository.
