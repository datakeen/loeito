# Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
"""Loeito local server.

Serves the Loeito app and gives it what a web page alone cannot have:
  * Word / Excel / PowerPoint / OpenDocument -> PDF with Microsoft Office (Windows, tools/convert.ps1) or the free LibreOffice (Windows, macOS, Linux);
  * a small file API for Loeito's own Open / Save As sheet: browse folders, make a folder, open a file by path,
    save over the original (keeping a safety copy of the old version) and show a file in Explorer.

Python standard library only. Listens on 127.0.0.1 only, so nothing is reachable from the network, and every API
call must come from Loeito's own page (custom header + Host + Origin checks), so other websites can't use it.

    py loeito_server.py [--port 8765] [--root <folder to serve>]
"""
import argparse
import datetime
import functools
import http.server
import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
CONVERTER = os.path.join(HERE, 'tools', 'convert.ps1')
OFFICE_TYPES = {'.doc', '.docx', '.docm', '.rtf', '.odt', '.txt', '.xls', '.xlsx', '.xlsm', '.ods', '.csv', '.ppt', '.pptx', '.odp'}
OPEN_TYPES = {'.pdf', '.png', '.jpg', '.jpeg'} | OFFICE_TYPES
SAVE_TYPES = {'.pdf', '.png', '.jpg', '.jpeg', '.zip', '.txt', '.csv', '.tsv', '.json', '.xlsx', '.md', '.html', '.geojson', '.kml',
              '.gpx', '.dxf', '.ldb', '.pol', '.pli', '.xyz', '.xyn', '.svg', '.wkt'}
MAX_CONVERT = 60 * 1024 * 1024
MAX_FILE = 500 * 1024 * 1024
BAD_NAME = set('\\/:*?"<>|')
SAFETY_DIR = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'Loeito', 'Safety copies')
SAFETY_DAYS = 30


def pdf_crypto():
    """pypdf + cryptography give AES-256 passwords; both are optional (pip install pypdf cryptography)."""
    try:
        import pypdf  # noqa: F401
        import cryptography  # noqa: F401
        return True
    except ImportError:
        return False


def find_soffice():
    """The LibreOffice program, if installed (any system)."""
    for p in ('/Applications/LibreOffice.app/Contents/MacOS/soffice', r'C:\Program Files\LibreOffice\program\soffice.exe', r'C:\Program Files (x86)\LibreOffice\program\soffice.exe'):
        if os.path.exists(p):
            return p
    return shutil.which('soffice') or shutil.which('libreoffice')


def office_apps():
    """Which Office programs can be automated here (registered COM servers)."""
    found = {}
    try:
        import winreg
        for app in ('Word', 'Excel', 'PowerPoint'):
            try:
                winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, f'{app}.Application\\CLSID'))
                found[app.lower()] = True
            except OSError:
                found[app.lower()] = False
    except ImportError:  # not Windows
        pass
    return found


def known_folder(guid, fallback):
    """Desktop / Documents / Downloads as Windows knows them (they may live in OneDrive)."""
    try:
        import ctypes
        import uuid
        from ctypes import wintypes

        class GUID(ctypes.Structure):
            _fields_ = [('d1', wintypes.DWORD), ('d2', wintypes.WORD), ('d3', wintypes.WORD), ('d4', ctypes.c_ubyte * 8)]
        u = uuid.UUID(guid)
        g = GUID(u.time_low, u.time_mid, u.time_hi_version, (ctypes.c_ubyte * 8).from_buffer_copy(u.bytes[8:]))
        p = ctypes.c_wchar_p()
        if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(p)) == 0:
            path = p.value
            ctypes.windll.ole32.CoTaskMemFree(p)
            if path and os.path.isdir(path):
                return path
    except Exception:
        pass
    path = os.path.join(os.path.expanduser('~'), fallback)
    return path if os.path.isdir(path) else None


def drives():
    out = []
    letters = os.listdrives() if hasattr(os, 'listdrives') else [f'{c}:\\' for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' if os.path.exists(f'{c}:\\')]
    for root in letters:
        label = ''
        try:
            import ctypes
            buf = ctypes.create_unicode_buffer(261)
            if ctypes.windll.kernel32.GetVolumeInformationW(ctypes.c_wchar_p(root), buf, 261, None, None, None, None, 0):
                label = buf.value
        except Exception:
            pass
        letter = root.rstrip('\\')
        out.append({'name': f'{label or "Local Disk"} ({letter})', 'path': root})
    return out


def hidden(entry, st):
    if entry.name.startswith(('.', '$', '~$')) or entry.name.lower() in ('desktop.ini', 'thumbs.db'):
        return True
    return bool(getattr(st, 'st_file_attributes', 0) & (stat.FILE_ATTRIBUTE_HIDDEN | stat.FILE_ATTRIBUTE_SYSTEM))


def prune_safety():
    cutoff = time.time() - SAFETY_DAYS * 86400
    try:
        for e in os.scandir(SAFETY_DIR):
            if e.is_file() and e.stat().st_mtime < cutoff:
                os.remove(e.path)
    except OSError:
        pass


def keep_safety_copy(path):
    """Copy the file that is about to be replaced into Loeito's safety folder; returns the copy's path."""
    os.makedirs(SAFETY_DIR, exist_ok=True)
    prune_safety()
    stamp = datetime.datetime.now().strftime('%Y-%m-%d %H.%M.%S')
    dest = os.path.join(SAFETY_DIR, f'{stamp} - {os.path.basename(path)}')
    shutil.copy2(path, dest)
    os.utime(dest)  # the 30-day clock starts now
    return dest


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console calm
        if 'api/' in (self.path or ''):
            super().log_message(fmt, *args)

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, data, ctype='application/octet-stream'):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _from_loeito(self):
        # Only Loeito's own page may call the API. Other websites can't send the custom header (that needs a CORS
        # preflight, which this server never approves), and the Host check defeats DNS-rebinding tricks.
        port = self.server.server_port
        ours = {f'localhost:{port}', f'127.0.0.1:{port}'}
        origin = self.headers.get('Origin')
        return (self.headers.get('X-Loeito') == '1' and self.headers.get('Host', '') in ours
                and (origin is None or origin in {f'http://{h}' for h in ours}))

    def _query(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    def _body(self, limit):
        size = int(self.headers.get('Content-Length', 0))
        if size <= 0 or size > limit:
            return None
        return self.rfile.read(size)

    # ——— routes ———
    def do_GET(self):
        route = urllib.parse.urlparse(self.path).path
        if route == '/api/status':
            apps = office_apps()
            return self._json({'ok': True, 'app': 'loeito', 'root': os.path.normcase(self.directory), 'office': any(apps.values()) or bool(find_soffice()), 'apps': {**apps, 'libreoffice': bool(find_soffice())}, 'types': sorted(OFFICE_TYPES), 'fs': True, 'crypto': pdf_crypto()})
        if route.startswith('/api/'):
            if not self._from_loeito():
                return self._json({'error': 'Not allowed'}, 403)
            try:
                if route == '/api/fs/places':
                    return self._places()
                if route == '/api/fs/list':
                    return self._list(self._query().get('path', ''))
                if route == '/api/fs/read':
                    return self._read(self._query().get('path', ''))
            except PermissionError:
                return self._json({'error': 'Windows doesn’t allow Loeito to open that place'}, 403)
            except FileNotFoundError:
                return self._json({'error': 'That folder or file no longer exists'}, 404)
            except OSError as e:
                return self._json({'error': e.strerror or str(e)}, 500)
            return self._json({'error': 'Unknown request'}, 404)
        return super().do_GET()

    def do_POST(self):
        route = urllib.parse.urlparse(self.path).path
        if not self._from_loeito():
            return self._json({'error': 'Not allowed'}, 403)
        try:
            if route == '/api/convert':
                return self._convert()
            if route == '/api/fs/mkdir':
                return self._mkdir()
            if route == '/api/fs/write':
                return self._write()
            if route == '/api/fs/reveal':
                return self._reveal()
            if route in ('/api/pdf/encrypt', '/api/pdf/decrypt'):
                return self._crypt(route.endswith('encrypt'))
        except PermissionError:
            return self._json({'error': 'Windows doesn’t allow saving there. If the file is open in another program (e.g. Acrobat), close it and try again — or save a copy.'}, 423)
        except FileNotFoundError:
            return self._json({'error': 'That folder no longer exists'}, 404)
        except OSError as e:
            return self._json({'error': e.strerror or str(e)}, 500)
        return self.send_error(404)

    # ——— file API ———
    def _places(self):
        places = [{'id': k, 'name': n, 'path': p} for k, n, p in (
            ('desktop', 'Desktop', known_folder('B4BFCC3A-DB2C-424C-B029-7FE99A87C641', 'Desktop')),
            ('documents', 'Documents', known_folder('FDD39AD0-238F-46AF-ADB4-6C85480369C7', 'Documents')),
            ('downloads', 'Downloads', known_folder('374DE290-123F-4565-9164-39C4925E467B', 'Downloads')),
        ) if p]
        return self._json({'places': places, 'drives': drives(), 'home': os.path.expanduser('~'), 'safety': SAFETY_DIR, 'sep': os.sep})

    def _list(self, path):
        path = os.path.abspath(path)
        entries = []
        with os.scandir(path) as it:
            for e in it:
                try:
                    st = e.stat()
                    if hidden(e, st):
                        continue
                    is_dir = e.is_dir()
                    entries.append({'name': e.name, 'dir': is_dir, 'size': 0 if is_dir else st.st_size, 'mtime': int(st.st_mtime * 1000)})
                except OSError:
                    continue
                if len(entries) >= 5000:
                    break
        parent = os.path.dirname(path)
        return self._json({'path': path, 'parent': None if parent == path else parent, 'entries': entries})

    def _read(self, path):
        path = os.path.abspath(path)
        if os.path.splitext(path)[1].lower() not in OPEN_TYPES:
            return self._json({'error': 'Loeito opens PDFs, images and Office files'}, 415)
        if os.path.getsize(path) > MAX_FILE:
            return self._json({'error': 'The file is larger than 500 MB'}, 413)
        with open(path, 'rb') as f:
            return self._bytes(f.read())

    def _mkdir(self):
        q = self._query()
        parent, name = os.path.abspath(q.get('path', '')), q.get('name', '').strip().rstrip('.')
        if not name or BAD_NAME & set(name) or name in ('.', '..'):
            return self._json({'error': 'A folder name can’t contain \\ / : * ? " < > |'}, 400)
        target = os.path.join(parent, name)
        if os.path.exists(target):
            return self._json({'error': f'“{name}” already exists here'}, 409)
        os.mkdir(target)
        return self._json({'path': target})

    def _write(self):
        q = self._query()
        path = os.path.abspath(q.get('path', ''))
        name = os.path.basename(path)
        if os.path.splitext(name)[1].lower() not in SAVE_TYPES:
            return self._json({'error': 'Loeito can’t save that kind of file'}, 415)
        if not name or BAD_NAME & set(name):
            return self._json({'error': 'A file name can’t contain \\ / : * ? " < > |'}, 400)
        if not os.path.isdir(os.path.dirname(path)):
            return self._json({'error': 'That folder no longer exists'}, 404)
        exists = os.path.exists(path)
        if exists and q.get('overwrite') != '1':
            return self._json({'error': f'“{name}” already exists', 'exists': True}, 409)
        data = self._body(MAX_FILE)
        if data is None:
            return self._json({'error': 'Nothing to save, or larger than 500 MB'}, 413)
        safety = keep_safety_copy(path) if exists else None
        # write next to the target, then swap: a failed save never leaves a half-written file behind
        fd, tmp = tempfile.mkstemp(prefix='.loeito-', suffix='.tmp', dir=os.path.dirname(path))
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(data)
            os.replace(tmp, path)
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        return self._json({'path': path, 'size': len(data), 'safety': safety})

    def _reveal(self):
        path = os.path.abspath(self._query().get('path', ''))
        if not os.path.exists(path):
            return self._json({'error': 'That file no longer exists'}, 404)
        subprocess.Popen(['explorer', f'/select,{path}'] if os.path.isfile(path) else ['explorer', path])
        return self._json({'ok': True})

    # ——— Passwords (AES-256) ———
    def _crypt(self, encrypt):
        # Passwords come in headers (base64 UTF-8), never in the URL, so they never reach the console log.
        import base64
        import io
        if not pdf_crypto():
            return self._json({'error': 'Password protection needs the pypdf and cryptography packages: run  py -m pip install pypdf cryptography'}, 501)
        from pypdf import PdfReader, PdfWriter
        from pypdf.constants import UserAccessPermissions as UAP
        hdr = lambda k: base64.b64decode(self.headers.get(k, '') or '').decode('utf-8')
        data = self._body(MAX_FILE)
        if data is None:
            return self._json({'error': 'Nothing to process, or larger than 500 MB'}, 413)
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            if not reader.decrypt(hdr('X-Pdf-Password')):
                return self._json({'error': 'That password is not right'}, 403)
        writer = PdfWriter(clone_from=reader)
        if encrypt:
            user, owner = hdr('X-Open-Password'), hdr('X-Owner-Password')
            allow = set(filter(None, self.headers.get('X-Allow', '').split(',')))
            flags = UAP(0)
            for name, bits in (('print', UAP.PRINT | UAP.PRINT_TO_REPRESENTATION), ('copy', UAP.EXTRACT | UAP.EXTRACT_TEXT_AND_GRAPHICS),
                               ('edit', UAP.MODIFY | UAP.ASSEMBLE_DOC), ('forms', UAP.FILL_FORM_FIELDS | UAP.ADD_OR_MODIFY)):
                if name in allow:
                    flags |= bits
            if not (user or owner):
                return self._json({'error': 'Choose a password'}, 400)
            writer.encrypt(user_password=user, owner_password=owner or None, permissions_flag=flags, algorithm='AES-256')
        out = io.BytesIO()
        writer.write(out)
        return self._bytes(out.getvalue(), 'application/pdf')

    # ——— Office conversion ———
    def _convert(self):
        name = self._query().get('name', 'file')
        ext = os.path.splitext(name)[1].lower()
        if ext not in OFFICE_TYPES:
            return self._json({'error': f'{ext or "This"} files are not supported'}, 415)
        data = self._body(MAX_CONVERT)
        if data is None:
            return self._json({'error': 'The file is empty or larger than 60 MB'}, 413)
        work = tempfile.mkdtemp(prefix='loeito-')
        try:
            src, out = os.path.join(work, 'input' + ext), os.path.join(work, 'output.pdf')
            with open(src, 'wb') as f:
                f.write(data)
            run = None
            if any(office_apps().values()):  # Microsoft Office (Windows)
                run = subprocess.run(
                    ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', CONVERTER, '-In', src, '-Out', out],
                    capture_output=True, text=True, timeout=180)
            lo = find_soffice()
            if not os.path.exists(out) and lo:  # LibreOffice (any system)
                profile = 'file:///' + os.path.join(work, 'lo').replace('\\', '/').lstrip('/')
                run = subprocess.run([lo, '--headless', '--norestore', '-env:UserInstallation=' + profile, '--convert-to', 'pdf', '--outdir', work, src],
                                     capture_output=True, text=True, timeout=180)
                if os.path.exists(os.path.join(work, 'input.pdf')):
                    os.replace(os.path.join(work, 'input.pdf'), out)
            if run is None:
                return self._json({'error': 'Install Microsoft Office or the free LibreOffice to open this file'}, 501)
            if run.returncode != 0 or not os.path.exists(out):
                msg = (run.stderr or run.stdout or 'Conversion failed').strip().splitlines()
                return self._json({'error': next((m for m in msg if m.strip()), 'Conversion failed')[:300]}, 500)
            with open(out, 'rb') as f:
                return self._bytes(f.read(), 'application/pdf')
        except subprocess.TimeoutExpired:
            return self._json({'error': 'Office took longer than 3 minutes'}, 504)
        finally:
            shutil.rmtree(work, ignore_errors=True)


class Server(http.server.ThreadingHTTPServer):
    # Never share a port: on Windows, address reuse would let two servers listen on the same port and the browser
    # would reach whichever one Windows picks (e.g. another program's server, answering "404 File not found").
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def loeito_at(port, root):
    """Is a Loeito serving this same folder already listening on `port`?"""
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/status', timeout=1.5) as r:
            s = json.loads(r.read().decode())
        return s.get('app') == 'loeito' and s.get('root') == os.path.normcase(root)
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(description='Loeito local server')
    ap.add_argument('--port', type=int, default=8765, help='preferred port; the next free one is used if it is taken')
    ap.add_argument('--root', default=HERE, help='folder to serve (default: the Loeito folder)')
    ap.add_argument('--open', action='store_true', help='open Loeito in the browser once the server is listening')
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    handler = functools.partial(Handler, directory=root)
    for port in range(a.port, a.port + 20):
        try:
            httpd = Server(('127.0.0.1', port), handler)
        except OSError:
            if loeito_at(port, root):  # Loeito is already running: just show it
                print(f'Loeito is already running at http://localhost:{port}/ - opening it.', flush=True)
                if a.open:
                    webbrowser.open(f'http://localhost:{port}/index.html')
                return
            print(f'Port {port} is used by another program - trying {port + 1}.', flush=True)
            continue
        with httpd:
            url = f'http://localhost:{port}/index.html'
            print(f'Loeito is running at {url}  -  close this window to stop it.', flush=True)
            if a.open:
                threading.Timer(0.4, webbrowser.open, args=(url,)).start()
            httpd.serve_forever()
        return
    print('No free port found between', a.port, 'and', a.port + 19)
    sys.exit(1)


if __name__ == '__main__':
    main()
