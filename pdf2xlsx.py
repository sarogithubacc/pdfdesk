import re, sys
import pdfplumber
from openpyxl import Workbook

src, dst = sys.argv[1], sys.argv[2]
BAD = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')
NUM = re.compile(r'^-?\d+(\.\d+)?$')

def clean(c):
    if c is None:
        return ''
    c = BAD.sub('', str(c)).strip()
    if NUM.match(c):
        return float(c) if '.' in c else int(c)
    return c

wb = Workbook()
wb.remove(wb.active)
n = 0
with pdfplumber.open(src) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        for j, table in enumerate(page.extract_tables(), 1):
            ws = wb.create_sheet('Page%d' % i if j == 1 else 'Page%d_T%d' % (i, j))
            for row in table:
                ws.append([clean(c) for c in row])
            n += 1
if n == 0:
    sys.exit(3)
wb.save(dst)
