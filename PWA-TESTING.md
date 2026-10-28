# Installable C-WAGS beta

Open https://chrojoh.github.io/CWag-Tracker/ while connected. Wait for **Ready for offline use** before disconnecting. Initial preparation saves all three spreadsheets, JavaScript libraries, the logo, certificate templates and the custom font.

Android: use **Install tracker** when shown, or Chrome's menu → Add to Home screen / Install app. iPhone: open in Safari, Share → Add to Home Screen → Open as Web App (where offered). An installed icon opens the same tracker. Printing still requires a suitable printer or the device's PDF option.

## Update records

Replace `DogInfo.xlsx`, `Data for Tracker web.xlsx` and, when needed, `Title Placement.xlsx` in this repository using exactly these official filenames. For related spreadsheet changes, upload them together in one commit and wait for the GitHub Pages deployment to finish. No app rebuild or reinstallation is required. The starting data and application come from the official Cwagtracker/Tracker repository; uploads to this beta repository do not change the official site.

Each opening checks the files when online. **Check for updates** also checks them; choose **Load updated records** if prompted. Unchanged files use HTTP validators when provided. Changed spreadsheets are downloaded in full. All three are checked before switching the active saved dataset; failed downloads keep the prior working snapshot. One previous snapshot is retained rather than accumulating all uploads. The file-save timestamp is distinct from the latest trial date displayed in the tracker header.

## Update the program

When editing application files, increment `VERSION` in `sw.js` in the same commit. Publish the complete set of files together. Users see **Update app** once the new application files are downloaded. Data files update independently of the application version.

## Beta checks on both phones

1. Open online; wait for ready status, install, then reopen from its icon.
2. Turn on airplane mode, fully close/reopen the app, search a dog and load Owner View.
3. Tick only some dogs; check registration card, handler PDF title, numeric order, landscape print sheet and no fold lines.
4. Generate a title and Ace certificate offline; confirm custom font and template display.
5. Reconnect, publish a small known spreadsheet change, check for updates and reload; verify new data and saved owner/dog choices.
6. Try an update with no connection; the saved data must remain usable.
7. Test browser program update and **Update app** without removing the installed icon.

Browser storage can be removed by the user or operating system. Use the readiness message to confirm a complete offline copy. A phone must connect at least once to receive newer data.
