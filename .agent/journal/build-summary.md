# IWSDK Daily Build #127 — Neon Dots VR (PM 2026-07-23)

## Summary
**Neon Dots VR** is a Dots and Boxes strategy game for WebXR. Players draw lines between dots on a grid; completing a box's 4th side claims it and grants an extra turn. Play against an AI opponent across 3 grid sizes and 3 difficulty levels.

## Status: ✅ DEPLOYED
- **Repo:** https://github.com/ellyz2426/neon-dots
- **Live:** https://ellyz2426.github.io/neon-dots/

## Stats
- **LOC:** 1,066 (881 TypeScript + 185 uikitml)
- **Files:** 11 (4 TS + 7 uikitml panels)
- **Rounds:** 1
- **Build Time:** ~28 min

## Features
- Dots and Boxes game board with 3D emissive dot spheres and interactive line meshes
- 3 grid sizes: 2x2 (Easy), 3x3 (Normal), 4x4 (Large)
- 3 AI difficulties: Easy (random), Medium (greedy), Hard (strategic chain analysis)
- 4 game modes: Classic, Speed (90s timer), Zen, Challenge
- 4 color schemes: Cyan, Green, Pink, Gold
- Extra turn on box completion
- 20 achievements with localStorage persistence
- 7 procedural WAV audio effects
- 7 PanelUI spatial panels (menu/hud/results/settings/pause/achievements/tutorial)
- Keyboard, mouse, and VR controller input
- Holodeck neon environment

## Key Fix
Panel layout was broken when using inline attributes on `<panel>` elements. Fixed by switching to class-based `<style>` + `<container class="root">` pattern matching working games (neon-sort etc).
