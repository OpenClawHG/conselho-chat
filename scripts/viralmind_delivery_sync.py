#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from services.viralmind_delivery_sync import sync_delivery_claims


def main() -> None:
    result = sync_delivery_claims()
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
