import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from openpyxl import load_workbook

def main():
    path = os.path.join(PROJECT_ROOT, "data", "travel_intelligence_dataset_v2.xlsx")
    wb = load_workbook(filename=path, read_only=True, data_only=True)
    ws = wb.active
    row = next(ws.iter_rows(min_row=1, max_row=1))
    headers = [str(c.value).strip().lower() if c.value is not None else "" for c in row]
    print("\n".join(headers))

if __name__ == "__main__":
    main()
