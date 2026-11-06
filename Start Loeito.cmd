@echo off
rem Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
rem Loeito launcher: starts Loeito's small local server (Python standard library only) and opens it in your browser.
rem The server also saves back into your files, browses folders, and converts Word / Excel / PowerPoint files to PDF
rem with your installed Microsoft Office. Everything stays on this computer. Close this window to stop Loeito.
rem If port 8765 is busy, Loeito uses the next free port; if Loeito is already running, it simply opens it.
title Loeito
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% loeito_server.py --port 8765 --open
if errorlevel 1 pause
