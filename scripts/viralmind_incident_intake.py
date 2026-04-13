#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from services.viralmind_incident_intake import sync_viralmind_incident_intake


def main() -> int:
    result = sync_viralmind_incident_intake(announce=True)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
