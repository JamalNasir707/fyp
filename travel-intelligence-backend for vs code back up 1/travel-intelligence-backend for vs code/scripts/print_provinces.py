import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from app.data_loader import load_locations_from_csv

def main():
    locs = load_locations_from_csv()
    provinces = sorted({(loc.get("province") or "").strip() for loc in locs if loc.get("province")})
    for p in provinces:
        print(p)

if __name__ == "__main__":
    main()
