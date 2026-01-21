# Garage Scholars Repo

## SchedulingSystem Deploy (Firebase Multi-Site)

Commands for the scheduling app (multi-site hosting on the `garage-scholars-v2` project):

```sh
# Login
firebase login

# Set project
firebase use garage-scholars-v2 --add

# Create hosting site
firebase hosting:sites:create garage-scholars-scheduling --project garage-scholars-v2

# Apply hosting target
firebase target:apply hosting scheduling garage-scholars-scheduling --project garage-scholars-v2

# Build app
cd schedulingsystem/app
npm run build

# Deploy hosting
cd ../
firebase deploy --only hosting:scheduling --project garage-scholars-v2

# Deploy functions
firebase deploy --only functions --project garage-scholars-v2
```
