import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.data_loader import load_locations_from_csv


def main():
    province = sys.argv[1] if len(sys.argv) > 1 else ""
    p = province.strip().lower()
    locs = load_locations_from_csv()
    cities = sorted({
        (loc.get("city") or "").strip()
        for loc in locs
        if (loc.get("province") or "").strip().lower() == p and loc.get("city")
    })
    print("\n".join(cities))


if __name__ == "__main__":
    main()
