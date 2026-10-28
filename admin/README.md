# GitHub-backed administrator beta

This is an additional page for **Chrojoh/CWag-Tracker**, not a replacement for the tracker. There is no Supabase connection and no separate server or database. GitHub remains the file store and authorization service. Only `DogInfo.xlsx` and `Data for Tracker web.xlsx` on `main` can be changed by this editor. `Cwagtracker/Tracker` is not a writable target.

## Install

Upload the complete `admin/` folder to the root of the Chrojoh beta repository in one commit. Keep the existing `vendor/xlsx.full.min.js` and logo at their current paths. After GitHub Pages deploys, open:

https://chrojoh.github.io/CWag-Tracker/admin/

The existing tracker and its offline cache do not need changing or reinstalling. The admin page itself needs an internet connection and is intended for a computer.

## Administrator access

Create a fine-grained GitHub personal access token as an account with write access to `Chrojoh/CWag-Tracker`. Select resource owner **Chrojoh**, **only CWag-Tracker**, and **Contents: Read and write**. Give it an expiry. Enter it only in the administrator page. Never put it in chat, the repository, a screenshot, a draft, or a shared file. The page keeps it in memory, not localStorage, and clears the active connection on sign-out or leaving the page. GitHub enforces repository permissions; hiding a button is not the access control.

This first beta uses GitHub authorization, not a new tracker username/password system. A read-only token cannot publish. An expired token can be replaced without changing the records.

## Edit and publish

1. Connect and load the current published workbook versions.
2. Search for a dog or trial entry and choose **Edit**, or add a new entry.
3. Enter a reason and **Save to review**. Browser-saved drafts contain no token.
4. Review old/new values, enter a publication note and tick the review confirmation.
5. Publish. Both source workbook revisions are checked again. All edited files go into **one commit**, and the branch is updated without force-pushing. If somebody changed the data meanwhile, publishing stops for a new review.
6. Wait for the GitHub Pages deployment. Owners then receive the files through the existing update process.

The workbook filenames, sheet order, additional sheets, non-edited cell values/formulas and extra columns are retained. Excel's package metadata, formatting details and compressed bytes can change when a workbook is rewritten; this beta is for these tracker data files, not arbitrary presentation workbooks. Deleting an entry clears its data row rather than shifting other rows. Matching duplicate DogInfo registrations are edited together.

## Patches

For existing entries, search for the relevant rows and choose **Export these rows for patching**. Keep `Record ID` and `Source Revision`. Change only the required values, add a reason, and upload the resulting `.xlsx` through **Upload a patch**. Remove unrelated rows from the patch if desired.

For new entries, download a blank template, use action `add`, fill the data fields and reason, and leave `Record ID` empty. Trial rows have a row ID tied to the source workbook revision. Old patches are rejected once that workbook changes; row numbers are not treated as permanent IDs across different revisions. An explicit ID and revision are required for updates/removals, so the program does not guess which similar trial result to overwrite.

Invalid and conflicting rows cannot be selected. No-change rows are skipped. Removals start unchecked and must be deliberately selected. Identical new trial entries are flagged; use `Allow Duplicate` only for a verified separate entry. At most 1,000 reviewed changes can be published together. Other records are never removed merely because they are absent from a patch.

## Recovery

- **Download current workbook backup** produces a ZIP containing the two source files and their GitHub commit reference.
- **History & restore** can review an earlier commit's workbook versions and restore them in a new normal commit. There is no force-push or deletion of branch history. A restore replaces later corrections in the affected files, so review the counts and confirmation first.
- If publishing loses its connection, the client checks whether GitHub accepted the new commit. Otherwise the draft remains and the source-revision check prevents blindly repeating an update against newer files. Check history before retrying an uncertain publication.
- To stop using this administrator beta, simply stop opening `/admin/`. The regular tracker still works. To reverse data edits, restore the reviewed workbook versions or upload a known-good backup. A separate complete `CWag-Tracker-before-admin.zip` was saved before this build.

## Testing boundary

Tests cover real workbook round-trips, patch validation, duplicate handling, preservation of other sheets, stale edits, atomic multi-file publication, competing publishers, interrupted publication, simulated GitHub authentication, browser draft recovery and XSS escaping. No real token is included in tests. Live GitHub authentication/publishing must be verified with the owner's repository-limited token; do not describe mocked API tests as a successful live deployment.
