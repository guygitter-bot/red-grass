#!/bin/sh
# בונה את course.html מקובצי המקור (לפרסום כ-Artifact ב-claude.ai)
cd "$(dirname "$0")/src" || exit 1
{ cat 01-head.html 02-shell.html; echo "<script>"; cat 03-helpers.js 04-mocks.js 05-content-a.js 05-content-b.js 06-engine.js 07-tools.js; echo "boot();"; echo "</script>"; } > ../course.html
