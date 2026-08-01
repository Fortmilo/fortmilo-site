from __future__ import annotations

import base64
import hashlib
import subprocess
from pathlib import Path

from pypdf import PdfReader, PdfWriter

EXPECTED_DOCX_SHA256 = "90f4aaf5ce3e2e9ca2eaefa5dc2ccf3613c7fbbcade5a0da0b31b71a2a818cba"

parts = sorted(Path(".tmp").glob("evidence-v1.1.0-final.docx.b64.part-*"))
if len(parts) != 6:
    raise SystemExit(f"Expected 6 DOCX parts, found {len(parts)}")

encoded = "".join(part.read_text(encoding="utf-8") for part in parts)
docx_data = base64.b64decode(encoded)
actual = hashlib.sha256(docx_data).hexdigest()
if actual != EXPECTED_DOCX_SHA256:
    raise SystemExit(f"DOCX digest mismatch: {actual}")

work = Path("/tmp/evidence-v1.1.0")
work.mkdir(parents=True, exist_ok=True)
docx_path = work / "evidence-semantics-and-scanner-orchestration-v1.1.0.docx"
docx_path.write_bytes(docx_data)

subprocess.run(
    [
        "libreoffice",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(work),
        str(docx_path),
    ],
    check=True,
)

source_pdf = work / "evidence-semantics-and-scanner-orchestration-v1.1.0.pdf"
reader = PdfReader(str(source_pdf))
if len(reader.pages) != 16:
    raise SystemExit(f"Unexpected converted page count: {len(reader.pages)}")

writer = PdfWriter()
writer.clone_document_from_reader(reader)
metadata = dict(reader.metadata or {})
metadata.update(
    {
        "/Title": "Evidence Semantics and Scanner Orchestration",
        "/Author": "Luca Pacini",
        "/Creator": "Luca Pacini / FortMilo",
        "/Subject": "Salesforce Security Observatory - Version 1.1.0",
        "/Keywords": "Salesforce; security; evidence semantics; scanner orchestration; FortMilo; Luca Pacini; Version 1.1.0",
        "/Version": "1.1.0",
        "/SourceBaseline": "f834844b",
        "/PublicationDate": "2026-08-01",
    }
)
writer.add_metadata(metadata)

out_dir = Path("documents")
out_dir.mkdir(exist_ok=True)
stable = out_dir / "evidence-semantics-and-scanner-orchestration.pdf"
versioned = out_dir / "evidence-semantics-and-scanner-orchestration-v1.1.0.pdf"
with stable.open("wb") as handle:
    writer.write(handle)
versioned.write_bytes(stable.read_bytes())

print(stable)
print(versioned)
