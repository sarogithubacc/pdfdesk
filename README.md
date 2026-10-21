# PDFDesk

Self-hosted PDF toolkit with a clean web UI.

## Tools
- In-browser (files never leave your device): Merge, Split, Extract pages, Remove pages, Rotate, JPG/PNG to PDF
- Server-side: Compress (Ghostscript), Word/PowerPoint/Excel to PDF and PDF to Word/PowerPoint (LibreOffice), PDF to Excel (pdfplumber, tables only), OCR (OCRmyPDF/Tesseract), Protect and Unlock (qpdf)

## Quick start

Requirements: a Linux server or VM with Docker and the Docker Compose plugin (`docker compose version` should work). Allow about 2 GB of disk for the image.

    git clone https://github.com/sarogithubacc/pdfdesk.git
    cd pdfdesk
    docker compose up -d --build

The first build takes several minutes. Then open `http://localhost:8080` (or `http://<server-ip>:8080` from another device; allow port 8080 in your firewall).

Check that it is running:

    docker compose ps
    curl localhost:8080/api/health

The health check should return `{"ok":true}`.

### Update

    cd pdfdesk
    git pull
    docker compose up -d --build

### Stop, logs, remove

    docker compose logs -f
    docker compose down

### Behind a reverse proxy (HTTPS)

To serve it on your own domain, point your proxy at port 3000 inside the container (or 8080 on the host). With Pangolin or Traefik, attach the container to the proxy's Docker network in `docker-compose.yml` and remove the `ports:` section so nothing is exposed directly.

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
