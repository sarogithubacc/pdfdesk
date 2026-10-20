# PDFDesk

Self-hosted PDF toolkit with a clean web UI.

## Tools
- In-browser (files never leave your device): Merge, Split, Extract pages, Remove pages, Rotate, JPG/PNG to PDF
- Server-side: Compress (Ghostscript), Office to PDF (LibreOffice), OCR (OCRmyPDF/Tesseract), Protect and Unlock (qpdf)

## Run
    docker compose up -d --build

Open http://localhost:8080

## Configuration (docker-compose.yml)
| Variable | Default | Meaning |
|---|---|---|
| MAX_MB | 100 | Max upload size |
| CONCURRENCY | 2 | Simultaneous server jobs |
| TIMEOUT_SEC | 180 | Per-job timeout |

## Notes
- Server-side tools delete uploads right after processing.
- Put it behind HTTPS and rate limiting before exposing it publicly.
- Browser tools load pdf-lib from cdnjs; host it locally for offline use.
