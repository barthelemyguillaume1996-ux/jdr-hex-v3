---
description: Build the JdrHex Desktop Application
---

1. Stop the development server if it is running (Ctrl+C).
2. Clean the previous build (optional but recommended):
   ```powershell
   Remove-Item -Recurse -Force dist, dist_electron -ErrorAction SilentlyContinue
   ```
3. Run the distribution build command:
// turbo
   ```powershell
   npm run dist
   ```
   ```
4. The installer (Setup.exe) will be available in the `dist_electron` folder.

## Cross-Platform (Linux/Mac)
To build for Linux or macOS, it is recommended to run the build command **on that operating system**.
- **Linux**: Run `npm run dist` on a Linux machine (or WSL) to generate `.AppImage` and `.deb`.
- **Windows**: `npm run dist` generates `.exe` only (cross-compilation is often unstable).

### How to transfer to Linux (Step-by-Step)
0. **Prerequisites (Linux)**:
   If you haven't installed Node.js on your Linux machine yet, run this first:
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```

1. Copy the entire project folder `jdr-hex-v3` to a USB drive.
   - *Tip: Delete the `node_modules` folder inside before copying to save time (it is huge and Windows-specific).*
2. Copy the folder from USB to your Linux Desktop.
3. Open a terminal inside that folder.
4. **Important**: If you copied `node_modules`, delete it now.
5. Run these commands to rebuild properly:
   ```bash
   npm install
   npm run dist
   ```
6. Your Linux app (`.AppImage`) will be in `dist_electron`.
