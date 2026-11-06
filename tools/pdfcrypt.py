# Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
"""Password protection for the Loeito desktop app: PDF on stdin, PDF on stdout. Needs pypdf + cryptography.

    python pdfcrypt.py '{"encrypt": true, "password": "<b64>", "open": "<b64>", "owner": "<b64>", "allow": "print,copy"}'
Passwords arrive base64-encoded (UTF-8), exactly as Loeito sends them.
"""
import base64
import io
import json
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.constants import UserAccessPermissions as UAP


def main():
    a = json.loads(sys.argv[1])
    dec = lambda k: base64.b64decode(a.get(k) or '').decode('utf-8')
    reader = PdfReader(io.BytesIO(sys.stdin.buffer.read()))
    if reader.is_encrypted and not reader.decrypt(dec('password')):
        sys.exit('That password is not right')
    writer = PdfWriter(clone_from=reader)
    if a.get('encrypt'):
        allow = set(filter(None, (a.get('allow') or '').split(',')))
        flags = UAP(0)
        for name, bits in (('print', UAP.PRINT | UAP.PRINT_TO_REPRESENTATION), ('copy', UAP.EXTRACT | UAP.EXTRACT_TEXT_AND_GRAPHICS),
                           ('edit', UAP.MODIFY | UAP.ASSEMBLE_DOC), ('forms', UAP.FILL_FORM_FIELDS | UAP.ADD_OR_MODIFY)):
            if name in allow:
                flags |= bits
        writer.encrypt(user_password=dec('open'), owner_password=dec('owner') or None, permissions_flag=flags, algorithm='AES-256')
    out = io.BytesIO()
    writer.write(out)
    sys.stdout.buffer.write(out.getvalue())


if __name__ == '__main__':
    main()
