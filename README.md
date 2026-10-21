# PDFDesk

Self-hosted PDF toolkit with a clean web UI.

## Tools
- In-browser (files never leave your device): Merge, Split, Extract pages, Remove pages, Rotate, JPG/PNG to PDF
- Server-side: Compress (Ghostscript), Word/PowerPoint/Excel to PDF and PDF to Word/PowerPoint (LibreOffice), PDF to Excel (pdfplumber, tables only), OCR (OCRmyPDF/Tesseract), Protect and Unlock (qpdf)

## Run
    docker compose up -d --build

Open http://localhost:8080

## Configuration (docker-compose.yml)
| Variable | Default | Meaning |
|---|---|---|
| MAX_MB | 100 | Max upload size |
| CONCURRENCY | 2 | Simultaneous server jobs |
| TIMEOUT_SEC | 180 | Per-job timeout |

## Privacy and file handling

**Browser tools** never upload anything. Everything happens on your device.

**Server tools** work like this:
1. Upload: the file goes to a temporary folder inside the container (`/tmp/pdfdesk-up`) under a random name.
2. Processing: the server creates a second temporary folder (`/tmp/job-...`) for the output and working files, and the conversion tool runs there.
3. Download: the result is sent back to the browser.
4. Cleanup: both the upload and the job folder are deleted as soon as the response finishes, including when a job fails or times out.

Files exist only in the container's own filesystem, unencrypted, for the duration of the job. The default `docker-compose.yml` has no volumes, so nothing is written to the host's folders, and there is no database, history or cache of your files.

Caveats:
- If the container crashes or the host reboots mid-job, a leftover temp file can remain until the container is recreated (`docker compose up -d --force-recreate`).
- Logs record only the error type and a short tool message, never file contents. For Protect, the password is passed to `qpdf` on its command line, so it is briefly visible to processes inside the container, but it is not logged.
- A reverse proxy (for example Pangolin/Traefik) may log request details such as URL and IP, but not the uploaded file.
- Serve the site over HTTPS so uploads are not readable in transit.

## Notes
- Put it behind HTTPS and rate limiting before exposing it publicly.
- Browser tools load pdf-lib from cdnjs; host it locally for offline use.
