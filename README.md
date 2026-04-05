**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

Desktop patch updates (Electron title-screen patch flow):

1. Configure updater source in `.env.local` (GitHub-first recommended):

```
VITE_GITHUB_REPO=your-org/your-repo
VITE_GITHUB_ASSET_REGEX=Nebula-Havoc-.*\.exe$
```

If `VITE_GITHUB_REPO` is not set, desktop builds fall back to:

```
Churst86/nebula-havoc-copy
```

Optional custom manifest source (if not using GitHub Releases):

```
VITE_PATCH_MANIFEST_URL=https://your-domain.example.com/nebula/patch-manifest.json
```

2. Serve a JSON manifest with this shape:

```json
{
	"version": "v1.3.1",
	"url": "https://your-domain.example.com/nebula/Nebula-Havoc-v1.3.1.exe",
	"sha256": "optional_sha256_hex",
	"notes": "Optional patch notes shown in the popup"
}
```

When a newer version is detected on the title screen, players can patch in-app. The app downloads the new EXE, applies it, and restarts automatically.

Desktop mode note:

- In Electron desktop builds, the game now runs standalone and bypasses Base44 auth gating.
- Base44 auth remains enabled for browser/web mode.

Build-time version note:

- The title screen updater now reads `VITE_APP_VERSION`.
- Release workflows set this automatically to the release tag (for example `v1.3.2`).

Automated GitHub release pipeline:

- Workflow file: `.github/workflows/release-desktop.yml`
- Trigger: pushing a tag that starts with `v` (example `v1.3.1`)
- Output: builds Windows portable EXE and publishes it to the GitHub Release

One-click manual release pipeline:

- Workflow file: `.github/workflows/manual-release.yml`
- Trigger: GitHub Actions `Run workflow` button
- Inputs: version tag (required), optional release title, optional prerelease flag
- Output: creates/pushes tag, builds Windows portable EXE, publishes GitHub Release

Manual release via GitHub UI:

1. Open your repo on GitHub.
2. Go to Actions.
3. Select `Manual Desktop Release`.
4. Click `Run workflow`.
5. Enter version (example `v1.3.2`) and run.
6. Wait for success, then players can patch from title screen.

One-click from VS Code:

1. Run task: `Release: Open Manual Workflow`
	- VS Code menu: Terminal -> Run Task -> Release: Open Manual Workflow
2. Or run command:

```
npm run release:open-workflow
```

Either option opens the GitHub Actions page for the manual release workflow directly.

Release from VS Code (minimal steps):

1. Commit your changes.
2. Create a version tag:

```
git tag v1.3.1
```

3. Push branch + tag:

```
git push origin main
git push origin v1.3.1
```

After the workflow finishes, players will see the patch on title-screen update check if the tag version is newer than their current build.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
