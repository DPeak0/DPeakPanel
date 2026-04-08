#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


OUTPUT_DIR = Path(os.environ.get("DOCKER_SYNC_OUTPUT", "/runtime/backend"))
CACHE_FILE = OUTPUT_DIR / ".docker-network-cache.json"
INTERVAL = float(os.environ.get("DOCKER_SYNC_INTERVAL", "5"))
HIDE_LABEL_KEYS = ("lightpanel.hidden", "dpeakpanel.hidden", "luckylightpanel.hidden")
STATE_ORDER = {
    "running": 0,
    "paused": 1,
    "restarting": 2,
    "created": 3,
    "exited": 4,
    "dead": 5,
    "unknown": 6,
}
STATE_LABELS = {
    "running": "运行中",
    "paused": "已暂停",
    "restarting": "重启中",
    "created": "已创建",
    "exited": "已停止",
    "dead": "已失效",
    "unknown": "其他状态",
}
SIZE_UNITS = {
    "B": 1,
    "KB": 1000,
    "MB": 1000**2,
    "GB": 1000**3,
    "TB": 1000**4,
    "PB": 1000**5,
    "KIB": 1024,
    "MIB": 1024**2,
    "GIB": 1024**3,
    "TIB": 1024**4,
    "PIB": 1024**5,
}


def run_command(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
      stderr = result.stderr.strip() or result.stdout.strip()
      raise RuntimeError(f"{' '.join(args)} failed: {stderr}")
    return result.stdout.strip()


def load_json_lines(*args: str) -> list[dict[str, Any]]:
    output = run_command(*args)
    if not output:
        return []
    return [json.loads(line) for line in output.splitlines() if line.strip()]


def load_containers() -> list[dict[str, Any]]:
    return load_json_lines("docker", "ps", "-a", "--no-trunc", "--format", "{{json .}}")


def load_container_details(names: list[str]) -> dict[str, dict[str, Any]]:
    if not names:
        return {}
    output = run_command("docker", "inspect", *names)
    return {
        item.get("Name", "").lstrip("/"): item
        for item in json.loads(output)
        if item.get("Name")
    }


def load_stats() -> list[dict[str, Any]]:
    return load_json_lines("docker", "stats", "--no-stream", "--no-trunc", "--format", "{{json .}}")


def load_cache() -> dict[str, Any]:
    if not CACHE_FILE.exists():
        return {"containers": {}}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"containers": {}}


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def normalize_state(raw_state: str | None) -> str:
    state = (raw_state or "").strip().lower()
    if state in STATE_ORDER:
        return state
    return "unknown"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "container"


def parse_size_to_bytes(value: str) -> int:
    cleaned = value.strip().replace(" ", "")
    if not cleaned:
        return 0
    match = re.match(r"(?i)^([0-9]*\.?[0-9]+)([kmgtp]?i?b)?$", cleaned)
    if not match:
        return 0
    number = float(match.group(1))
    unit = (match.group(2) or "B").upper()
    multiplier = SIZE_UNITS.get(unit, 1)
    return max(int(number * multiplier), 0)


def split_net_io(net_io: str) -> tuple[str, str]:
    if not net_io:
        return "0B", "0B"
    parts = [part.strip() for part in net_io.split("/")]
    if len(parts) != 2:
        return "0B", "0B"
    return parts[0], parts[1]


def truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def get_display_name(name: str, labels: dict[str, Any]) -> str:
    compose_service = labels.get("com.docker.compose.service")
    if compose_service and compose_service != name:
        return str(compose_service)
    return name


def get_description(image: str, labels: dict[str, Any]) -> str:
    compose_project = labels.get("com.docker.compose.project")
    if compose_project:
        return f"{compose_project} / {image}"
    return image


def get_icon_url(labels: dict[str, Any]) -> str:
    for key in (
        "net.unraid.docker.icon",
        "com.docker.desktop.extension.icon",
        "org.opencontainers.image.icon",
    ):
        value = labels.get(key)
        if value:
            return str(value)
    return ""


def should_hide_container(name: str, labels: dict[str, Any]) -> bool:
    if name == "lucky-light-panel-docker-sync":
        return True
    return any(truthy(labels.get(key)) for key in HIDE_LABEL_KEYS)


def build_payload() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    now = time.time()
    previous_cache = load_cache().get("containers", {})
    next_cache: dict[str, Any] = {}

    ps_items = load_containers()
    inspect_map = load_container_details([item["Names"] for item in ps_items if item.get("Names")])
    stats_items = {item["Name"]: item for item in load_stats() if item.get("Name")}

    groups_seen: dict[str, dict[str, Any]] = {}
    containers_payload: list[dict[str, Any]] = []
    stats_payload: list[dict[str, Any]] = []

    visible_items: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]] = []
    for ps_item in ps_items:
        name = ps_item.get("Names")
        if not name:
            continue
        inspect_item = inspect_map.get(name, {})
        labels = ((inspect_item.get("Config") or {}).get("Labels") or {})
        if should_hide_container(name, labels):
            continue
        visible_items.append((ps_item, inspect_item, stats_items.get(name)))

    visible_items.sort(
        key=lambda item: (
            STATE_ORDER.get(normalize_state(((item[1].get("State") or {}).get("Status"))), STATE_ORDER["unknown"]),
            item[0].get("Names", ""),
        )
    )

    for index, (ps_item, inspect_item, stats_item) in enumerate(visible_items):
        name = ps_item.get("Names", "")
        image = ps_item.get("Image", "")
        labels = ((inspect_item.get("Config") or {}).get("Labels") or {})
        inspect_state = inspect_item.get("State") or {}
        state = normalize_state(inspect_state.get("Status") or ps_item.get("State"))
        group_key = state

        groups_seen.setdefault(
            group_key,
            {
                "key": group_key,
                "name": STATE_LABELS.get(group_key, STATE_LABELS["unknown"]),
                "icon": "",
                "order": STATE_ORDER.get(group_key, STATE_ORDER["unknown"]),
            },
        )

        container_payload = {
            "key": slugify(name),
            "containerName": name,
            "containerId": ps_item.get("ID", ""),
            "displayName": get_display_name(name, labels),
            "description": get_description(image, labels),
            "iconUrl": get_icon_url(labels),
            "state": state,
            "status": ps_item.get("Status", ""),
            "groupKey": group_key,
            "order": index,
            "enable": True,
            "showStatus": True,
            "composeProject": labels.get("com.docker.compose.project", ""),
        }
        containers_payload.append(container_payload)

        if not stats_item:
            continue

        rx_text, tx_text = split_net_io(stats_item.get("NetIO", ""))
        rx_bytes = parse_size_to_bytes(rx_text)
        tx_bytes = parse_size_to_bytes(tx_text)

        previous_stats = previous_cache.get(name) or {}
        previous_timestamp = float(previous_stats.get("timestamp") or 0)
        elapsed = max(now - previous_timestamp, 0.001)

        if previous_timestamp > 0:
            rx_speed = max(int((rx_bytes - int(previous_stats.get("rx_bytes") or 0)) / elapsed), 0)
            tx_speed = max(int((tx_bytes - int(previous_stats.get("tx_bytes") or 0)) / elapsed), 0)
        else:
            rx_speed = 0
            tx_speed = 0

        next_cache[name] = {
            "timestamp": now,
            "rx_bytes": rx_bytes,
            "tx_bytes": tx_bytes,
        }

        stats_payload.append(
            {
                "key": slugify(name),
                "containerName": name,
                "displayName": container_payload["displayName"],
                "iconUrl": container_payload["iconUrl"],
                "state": state,
                "status": ps_item.get("Status", ""),
                "cpuPercent": stats_item.get("CPUPerc", "0%"),
                "memoryUsage": stats_item.get("MemUsage", "0B / 0B"),
                "memoryPercent": stats_item.get("MemPerc", "0%"),
                "networkRx": rx_text,
                "networkTx": tx_text,
                "networkRxSpeed": rx_speed,
                "networkTxSpeed": tx_speed,
            }
        )

    docker_payload = {
        "groups": sorted(groups_seen.values(), key=lambda item: (item["order"], item["name"])),
        "containers": containers_payload,
    }
    docker_stats_payload = {
        "ret": 0,
        "stats": stats_payload,
    }
    cache_payload = {
        "timestamp": now,
        "containers": next_cache,
    }
    return docker_payload, docker_stats_payload, cache_payload


def sync_once() -> None:
    docker_payload, docker_stats_payload, cache_payload = build_payload()
    write_json(OUTPUT_DIR / "docker.json", docker_payload)
    write_json(OUTPUT_DIR / "docker-stats.json", docker_stats_payload)
    write_json(CACHE_FILE, cache_payload)
    print(
        f"[docker-sync] wrote {len(docker_payload['containers'])} containers and "
        f"{len(docker_stats_payload['stats'])} stats at {time.strftime('%Y-%m-%d %H:%M:%S')}",
        flush=True,
    )


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    run_once = "--once" in sys.argv

    while True:
        try:
            sync_once()
        except Exception as exc:  # noqa: BLE001
            print(f"[docker-sync] sync failed: {exc}", file=sys.stderr, flush=True)

        if run_once:
            return 0

        time.sleep(max(INTERVAL, 1))


if __name__ == "__main__":
    raise SystemExit(main())
