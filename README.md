# Lua Encoder VIP (Node.js)

A responsive Lua editor/encoder with upload/download, Raw hosting, Loadstring generation, and JSON-file persistence.

## Requirements
- Node.js 18 or newer
- npm

## Run locally
```bash
npm install
npm start
```
Open http://localhost:3000

## Features
- Lua/Luau/TXT upload, editor, line count, copy and download
- Browser-side XOR + Base64 encoder output
- Express endpoint that stores source and returns a plain-text Raw URL and a Loadstring
- JSON persistence in `data/scripts.json`
- Recent hosted scripts and delete action
- Responsive blue premium UI

## Deploy to Render
1. Push this folder to a Git repository.
2. Create a Render **Web Service** and connect the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. If using Render's ephemeral filesystem, saved JSON content may be lost on redeploy/restart. Attach a persistent disk and set `DATA_DIR` to its mount path, or replace the JSON file storage with a managed database for production.

## Important limitations
- XOR + Base64 is obfuscation, not strong encryption. The key and decoder are in the generated Lua.
- Raw hosting stores the source code on your server. Anyone who has the Raw URL can retrieve it.
- The generated Roblox-style Loadstring requires an environment that supports `loadstring` and `game:HttpGet`; it is not standard Lua functionality.
- This app does not execute uploaded Lua code on the server.
- For production use, add authentication, quotas, abuse controls, and a real persistent database.
