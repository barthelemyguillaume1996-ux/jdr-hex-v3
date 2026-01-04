# Building JdrHex for Linux

## Prerequisites
- Node.js (v18 or higher)
- npm

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
npm run dist
```

This command will:
1. Build the Vite frontend (`vite build`)
2. Copy all assets from `public/` to `dist/`
3. Package the Electron app with electron-builder

### 3. Output
The built application will be in `dist_electron/` directory:
- `JdrHex-*.AppImage` - AppImage format (recommended)
- `JdrHex-*.tar.gz` - Tarball format

## Troubleshooting

### Missing Textures
If textures are missing after build:

1. **Verify the build output**:
   ```bash
   ls -la dist/textures/
   ```
   Should show: `bois.png`, `eau.png`, `herbe.png`, etc.

2. **Check case sensitivity**:
   Linux is case-sensitive. Ensure all references use lowercase:
   - ✅ `/textures/bois.png`
   - ❌ `/Textures/bois.png`

3. **Verify public folder structure**:
   ```
   public/
   ├── textures/
   │   ├── bois.png
   │   ├── eau.png
   │   ├── herbe.png
   │   └── ...
   └── PNJ/
       └── ...
   ```

4. **Manual verification after build**:
   ```bash
   # Extract and check the AppImage
   ./JdrHex-*.AppImage --appimage-extract
   ls -la squashfs-root/resources/app/dist/textures/
   ```

### Permissions Issues
If you get permission errors:
```bash
chmod +x dist_electron/JdrHex-*.AppImage
```

## Running the Built App
```bash
./dist_electron/JdrHex-*.AppImage
```

Or install it system-wide by moving to `/usr/local/bin/` or `~/.local/bin/`.
