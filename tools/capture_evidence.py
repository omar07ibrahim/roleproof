#!/usr/bin/env python3
"""Generate and verify RoleProof's source-bound browser evidence."""

from __future__ import annotations

import argparse
import hashlib
import html
import importlib.metadata
import io
import json
import mimetypes
import re
import shutil
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Final
from xml.etree import ElementTree

from PIL import Image, __version__ as pillow_version
from playwright.sync_api import sync_playwright


EVIDENCE_DIR: Final = Path("docs/evidence")
MANIFEST_PATH: Final = EVIDENCE_DIR / "roleproof-evidence.json"
OUTPUTS: Final = (
    "roleproof-analysis.json",
    "roleproof-cli.png",
    "roleproof-cli.txt",
    "roleproof-constraint-summary.svg",
    "roleproof-dashboard.png",
    "roleproof-full-page.png",
    "roleproof-interaction.gif",
    "roleproof-mobile.png",
    "roleproof-role-graph.svg",
    "roleproof-verification-architecture.svg",
    "roleproof-verification.json",
)
TEXT_OUTPUTS: Final = {
    ".json",
    ".svg",
    ".txt",
}
SECRET_PATTERNS: Final = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?:ghp|github_pat)_[A-Za-z0-9_]{20,}"),
    re.compile(r"(?i)(?:api[_-]?key|secret|password)s*[:=]s*S+"),
    re.compile(r"[w.+-]+@[w.-]+.[A-Za-z]{2,}"),
)
MIME: Final = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
}


class EvidenceError(RuntimeError):
    pass


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def regular_bytes(path: Path, maximum: int = 8 * 1024 * 1024) -> bytes:
    status = path.lstat()
    if not path.is_file() or path.is_symlink() or status.st_size > maximum:
        raise EvidenceError("invalid_file")
    payload = path.read_bytes()
    if len(payload) != status.st_size:
        raise EvidenceError("file_changed")
    return payload


def json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "
"
    ).encode("ascii")


def write_output(path: Path, payload: bytes) -> None:
    path.write_bytes(payload)
    path.chmod(0o644)


def source_paths(root: Path) -> list[Path]:
    fixed = [
        root / "examples/orion.synthetic.json",
        root / "package-lock.json",
        root / "package.json",
        root / "requirements/evidence-browser-image.lock.json",
        root / "requirements/evidence-browser.txt",
        root / "tools/build-site.mjs",
        root / "tools/capture_evidence.py",
        root / "web/app.js",
        root / "web/index.html",
        root / "web/styles.css",
    ]
    return sorted(
        [*fixed, *(root / "src").glob("*.mjs")],
        key=lambda item: item.relative_to(root).as_posix(),
    )


def source_records(root: Path) -> list[dict[str, object]]:
    records = []
    for path in source_paths(root):
        payload = regular_bytes(path)
        records.append(
            {
                "bytes": len(payload),
                "path": path.relative_to(root).as_posix(),
                "sha256": sha256(payload),
            }
        )
    return records


class StaticHandler(BaseHTTPRequestHandler):
    root: Path

    def do_GET(self) -> None:
        if "?" in self.path or "%" in self.path or "\" in self.path:
            self.send_error(400)
            return
        relative = "index.html" if self.path == "/" else self.path.lstrip("/")
        allowed = {
            "app.js",
            "data/analysis.receipt.json",
            "data/manifest.json",
            "data/policy.normalized.json",
            "data/role-graph.svg",
            "data/site.manifest.json",
            "data/verification.json",
            "index.html",
            "styles.css",
        }
        if relative not in allowed:
            self.send_error(404)
            return
        payload = regular_bytes(self.root / relative)
        self.send_response(200)
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; base-uri 'none'; "
            "frame-ancestors 'none'; form-action 'none'",
        )
        self.send_header("Content-Type", MIME[Path(relative).suffix])
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_: object) -> None:
        return


def start_static_server(root: Path) -> tuple[ThreadingHTTPServer, str]:
    handler = type("BoundStaticHandler", (StaticHandler,), {"root": root})
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    return server, "http://127.0.0.1:" + str(port)


def architecture_svg() -> bytes:
    modules = (
        "src/contracts.mjs",
        "src/analyze.mjs",
        "src/verify.mjs",
        "src/bundle.mjs",
        "web/app.js",
    )
    boxes = [
        (70, 210, 210, 88, "Strict policy", modules[0], "#58dfc2"),
        (350, 105, 230, 88, "Analyzer", "bounded BFS", "#70b7ff"),
        (350, 315, 230, 88, "Verifier", "Floyd-Warshall", "#ffbf69"),
        (650, 210, 230, 88, "Proof bundle", modules[3], "#c59cff"),
        (950, 210, 230, 88, "Dashboard", modules[4], "#ff8298"),
    ]
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 540" role="img" aria-labelledby="t d">',
        '<title id="t">RoleProof verification architecture</title>',
        '<desc id="d">The analyzer and verifier independently consume the same normalized policy before the bundle reaches the dashboard.</desc>',
        '<rect width="1260" height="540" rx="28" fill="#07111f"/>',
        '<text x="64" y="68" fill="#65e5ca" font-family="ui-monospace,monospace" font-size="14" font-weight="700" letter-spacing="2">ROLEPROOF · VERIFICATION ARCHITECTURE</text>',
        '<text x="64" y="116" fill="#f4f8ff" font-family="ui-sans-serif,system-ui" font-size="34" font-weight="750">Two algorithms. One closed receipt.</text>',
        '<path d="M 280 238 C 315 238 315 149 350 149" fill="none" stroke="#70b7ff" stroke-width="3"/>',
        '<path d="M 280 270 C 315 270 315 359 350 359" fill="none" stroke="#ffbf69" stroke-width="3"/>',
        '<path d="M 580 149 C 620 149 610 238 650 238" fill="none" stroke="#70b7ff" stroke-width="3"/>',
        '<path d="M 580 359 C 620 359 610 270 650 270" fill="none" stroke="#ffbf69" stroke-width="3"/>',
        '<path d="M 880 254 L 950 254" fill="none" stroke="#c59cff" stroke-width="3"/>',
    ]
    for x, y, width, height, title, detail, color in boxes:
        parts.extend(
            [
                '<g transform="translate(' + str(x) + " " + str(y) + ')">',
                '<rect width="' + str(width) + '" height="' + str(height) + '" rx="15" fill="#0d2034" stroke="' + color + '" stroke-width="2"/>',
                '<text x="18" y="35" fill="#f4f8ff" font-family="ui-sans-serif,system-ui" font-size="18" font-weight="700">' + html.escape(title) + "</text>",
                '<text x="18" y="61" fill="#91a8c1" font-family="ui-monospace,monospace" font-size="12">' + html.escape(detail) + "</text>",
                "</g>",
            ]
        )
    parts.extend(
        [
            '<text x="350" y="442" fill="#7890aa" font-family="ui-sans-serif,system-ui" font-size="14">No analyzer import</text>',
            '<text x="350" y="466" fill="#7890aa" font-family="ui-sans-serif,system-ui" font-size="14">Independent closure + witness checks</text>',
            '<text x="64" y="504" fill="#667f99" font-family="ui-monospace,monospace" font-size="12">Validated modules: ' + str(len(modules)) + " · dependency-free runtime</text>",
            "</svg>",
            "",
        ]
    )
    return "
".join(parts).encode("utf-8")


def summary_svg(receipt: dict[str, object]) -> bytes:
    summary = receipt["result"]["summary"]
    total = summary["total_constraints"]
    violations = summary["violations"]
    passes = summary["passes"]
    critical = summary["critical_violations"]
    violation_width = int(880 * violations / total)
    pass_width = 880 - violation_width
    return (
        '<?xml version="1.0" encoding="UTF-8"?>
'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 470" role="img" aria-labelledby="t d">
'
        '<title id="t">RoleProof constraint results</title>
'
        '<desc id="d">Four of five synthetic constraints violate the declared policy, including three critical violations.</desc>
'
        '<rect width="1120" height="470" rx="28" fill="#07111f"/>
'
        '<text x="64" y="66" fill="#65e5ca" font-family="ui-monospace,monospace" font-size="14" font-weight="700" letter-spacing="2">EXACT SYNTHETIC RESULT</text>
'
        '<text x="64" y="118" fill="#f4f8ff" font-family="ui-sans-serif,system-ui" font-size="34" font-weight="750">Constraint closure at a glance</text>
'
        '<rect x="64" y="176" width="' + str(violation_width) + '" height="52" rx="12" fill="#ff718c"/>
'
        '<rect x="' + str(64 + violation_width) + '" y="176" width="' + str(pass_width) + '" height="52" rx="12" fill="#72e39b"/>
'
        '<text x="64" y="280" fill="#ff9daf" font-family="ui-sans-serif,system-ui" font-size="54" font-weight="780">' + str(violations) + '</text>
'
        '<text x="112" y="276" fill="#9cafc5" font-family="ui-sans-serif,system-ui" font-size="15">verified violations</text>
'
        '<text x="410" y="280" fill="#ffbd69" font-family="ui-sans-serif,system-ui" font-size="54" font-weight="780">' + str(critical) + '</text>
'
        '<text x="458" y="276" fill="#9cafc5" font-family="ui-sans-serif,system-ui" font-size="15">critical paths</text>
'
        '<text x="746" y="280" fill="#82e8a5" font-family="ui-sans-serif,system-ui" font-size="54" font-weight="780">' + str(passes) + '</text>
'
        '<text x="792" y="276" fill="#9cafc5" font-family="ui-sans-serif,system-ui" font-size="15">closed constraint</text>
'
        '<line x1="64" y1="338" x2="1056" y2="338" stroke="#27425f"/>
'
        '<text x="64" y="382" fill="#8098b2" font-family="ui-monospace,monospace" font-size="13">policy ' + receipt["policy_sha256"][:16] + ' · result ' + receipt["result_sha256"][:16] + '</text>
'
        '<text x="64" y="414" fill="#607892" font-family="ui-sans-serif,system-ui" font-size="13">Synthetic Orion fixture · not a benchmark or live IAM attestation</text>
'
        '</svg>
'
    ).encode("utf-8")


def cli_page(stdout: str) -> str:
    escaped = html.escape(stdout)
    return (
        "<!doctype html><html><head><meta charset="utf-8"><style>"
        "*{box-sizing:border-box}body{margin:0;width:1180px;height:640px;"
        "display:grid;place-items:center;background:#06101c;color:#dceaff;"
        "font-family:ui-monospace,SFMono-Regular,monospace}"
        ".window{width:1080px;border:1px solid #2a4663;border-radius:18px;"
        "overflow:hidden;background:#091725;box-shadow:0 28px 90px #0008}"
        ".bar{height:52px;display:flex;align-items:center;gap:9px;padding:0 20px;"
        "border-bottom:1px solid #233c56;background:#0d1c2d}"
        ".dot{width:11px;height:11px;border-radius:50%;background:#ff718c}"
        ".dot:nth-child(2){background:#ffbd69}.dot:nth-child(3){background:#58dfc2}"
        ".title{margin-left:14px;color:#7990aa;font:12px ui-sans-serif,system-ui}"
        "pre{margin:0;padding:34px 38px 40px;white-space:pre-wrap;"
        "font-size:16px;line-height:1.65}.prompt{color:#58dfc2}"
        "</style></head><body><main class="window"><div class="bar">"
        "<span class="dot"></span><span class="dot"></span><span class="dot"></span>"
        "<span class="title">actual RoleProof CLI · Node 22.23.1</span></div>"
        "<pre><span class="prompt">$ roleproof audit examples/orion.synthetic.json --out roleproof-audit</span>

"
        + escaped
        + "</pre></main></body></html>"
    )


def capture(
    root: Path,
    input_root: Path,
    output_root: Path,
    source_revision: str,
    source_tree: str,
    container_image: str,
) -> None:
    if output_root.exists():
        raise EvidenceError("output_exists")
    destination = output_root / EVIDENCE_DIR
    destination.mkdir(parents=True, mode=0o755)

    dist = root / "dist"
    receipt = json.loads(regular_bytes(dist / "data/analysis.receipt.json"))
    verification = json.loads(regular_bytes(dist / "data/verification.json"))
    stdout = regular_bytes(input_root / "audit.stdout.txt").decode("utf-8")
    if (
        receipt["format"] != "roleproof.receipt.v1"
        or verification["status"] != "verified"
        or receipt["result_sha256"] != verification["result_sha256"]
        or "ROLEPROOF AUDIT VERIFIED" not in stdout
        or receipt["result_sha256"] not in stdout
    ):
        raise EvidenceError("invalid_input_binding")

    write_output(
        destination / "roleproof-analysis.json",
        json_bytes(receipt),
    )
    write_output(
        destination / "roleproof-verification.json",
        json_bytes(verification),
    )
    write_output(
        destination / "roleproof-cli.txt",
        stdout.encode("utf-8"),
    )
    shutil.copyfile(
        dist / "data/role-graph.svg",
        destination / "roleproof-role-graph.svg",
    )
    (destination / "roleproof-role-graph.svg").chmod(0o644)
    write_output(
        destination / "roleproof-verification-architecture.svg",
        architecture_svg(),
    )
    write_output(
        destination / "roleproof-constraint-summary.svg",
        summary_svg(receipt),
    )

    server, origin = start_static_server(dist)
    browser_version = ""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            browser_version = browser.version

            desktop = browser.new_context(
                viewport={"width": 1440, "height": 1000},
                device_scale_factor=1,
                color_scheme="dark",
                reduced_motion="reduce",
            )
            page = desktop.new_page()
            page.goto(origin + "/", wait_until="networkidle")
            page.wait_for_selector('body[data-ready="true"]')
            page.screenshot(
                path=destination / "roleproof-dashboard.png",
                animations="disabled",
            )
            page.screenshot(
                path=destination / "roleproof-full-page.png",
                animations="disabled",
                full_page=True,
            )

            page.set_viewport_size({"width": 1440, "height": 900})
            workspace = page.locator(".workspace")
            workspace.scroll_into_view_if_needed()
            frames: list[Image.Image] = []
            frames.append(
                Image.open(io.BytesIO(workspace.screenshot())).convert("RGB")
            )
            for selector in (
                '[data-constraint="builder-no-prod-admin"]',
                '[data-constraint="approver-no-request"]',
            ):
                page.locator(selector).click()
                frames.append(
                    Image.open(io.BytesIO(workspace.screenshot())).convert("RGB")
                )
            page.locator('[data-filter="pass"]').click()
            page.locator('[data-constraint="payroll-no-prod-deploy"]').click()
            frames.append(
                Image.open(io.BytesIO(workspace.screenshot())).convert("RGB")
            )
            frames[0].save(
                destination / "roleproof-interaction.gif",
                append_images=frames[1:],
                disposal=2,
                duration=[1000, 1000, 1000, 1400],
                loop=0,
                optimize=False,
                save_all=True,
            )
            desktop.close()

            mobile = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=1,
                color_scheme="dark",
                reduced_motion="reduce",
                is_mobile=True,
            )
            mobile_page = mobile.new_page()
            mobile_page.goto(origin + "/", wait_until="networkidle")
            mobile_page.wait_for_selector('body[data-ready="true"]')
            mobile_page.screenshot(
                path=destination / "roleproof-mobile.png",
                animations="disabled",
            )
            mobile.close()

            terminal = browser.new_context(
                viewport={"width": 1180, "height": 640},
                device_scale_factor=1,
                color_scheme="dark",
            )
            terminal_page = terminal.new_page()
            terminal_page.set_content(cli_page(stdout), wait_until="load")
            terminal_page.screenshot(
                path=destination / "roleproof-cli.png",
                animations="disabled",
            )
            terminal.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    lock = json.loads(
        regular_bytes(
            root / "requirements/evidence-browser-image.lock.json"
        )
    )
    if (
        browser_version != lock["chromium_version"]
        or importlib.metadata.version("playwright")
        != lock["playwright_version"]
        or pillow_version != "12.3.0"
    ):
        raise EvidenceError("runtime_lock_mismatch")

    records = []
    for name in OUTPUTS:
        relative = EVIDENCE_DIR / name
        payload = regular_bytes(output_root / relative)
        media_type = (
            mimetypes.guess_type(name)[0] or "application/octet-stream"
        )
        records.append(
            {
                "bytes": len(payload),
                "media_type": media_type,
                "path": relative.as_posix(),
                "sha256": sha256(payload),
            }
        )
    manifest = {
        "capture": {
            "browser": "Chromium " + browser_version,
            "container_image": container_image,
            "gif_frames": 4,
            "pillow": pillow_version,
            "playwright": importlib.metadata.version("playwright"),
            "routes": ["/", "/data/analysis.receipt.json"],
            "viewports": ["1440x1000", "390x844", "1180x640"],
        },
        "claim_boundary": {
            "contains_live_iam_data": False,
            "is_benchmark": False,
            "is_provider_attestation": False,
            "scenario": "synthetic Orion policy",
        },
        "files": records,
        "format": "roleproof.evidence.v1",
        "policy_sha256": receipt["policy_sha256"],
        "result_sha256": receipt["result_sha256"],
        "source_revision": source_revision,
        "source_tree": source_tree,
        "sources": source_records(root),
        "verification_sha256": sha256(
            json.dumps(
                verification,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ),
    }
    write_output(output_root / MANIFEST_PATH, json_bytes(manifest))
    verify_bundle(
        root,
        output_root,
        source_revision,
        source_tree,
        container_image,
    )


def verify_bundle(
    root: Path,
    output_root: Path,
    source_revision: str,
    source_tree: str,
    container_image: str,
) -> None:
    expected = {
        (EVIDENCE_DIR / name).as_posix() for name in OUTPUTS
    } | {MANIFEST_PATH.as_posix()}
    actual = {
        path.relative_to(output_root).as_posix()
        for path in output_root.rglob("*")
        if path.is_file()
    }
    if actual != expected:
        raise EvidenceError("inventory_mismatch")
    if any(path.is_symlink() for path in output_root.rglob("*")):
        raise EvidenceError("symlink_in_bundle")

    manifest = json.loads(regular_bytes(output_root / MANIFEST_PATH))
    if (
        manifest.get("format") != "roleproof.evidence.v1"
        or manifest.get("source_revision") != source_revision
        or manifest.get("source_tree") != source_tree
        or manifest.get("capture", {}).get("container_image")
        != container_image
        or manifest.get("sources") != source_records(root)
    ):
        raise EvidenceError("manifest_binding_mismatch")
    records = manifest.get("files")
    if not isinstance(records, list) or len(records) != len(OUTPUTS):
        raise EvidenceError("invalid_file_records")
    if {record.get("path") for record in records} != expected - {
        MANIFEST_PATH.as_posix()
    }:
        raise EvidenceError("file_record_inventory_mismatch")
    for record in records:
        payload = regular_bytes(output_root / record["path"])
        if (
            len(payload) != record.get("bytes")
            or sha256(payload) != record.get("sha256")
        ):
            raise EvidenceError("file_hash_mismatch")

    dimensions = {
        "roleproof-dashboard.png": (1440, 1000),
        "roleproof-mobile.png": (390, 844),
        "roleproof-cli.png": (1180, 640),
    }
    for name, expected_size in dimensions.items():
        with Image.open(output_root / EVIDENCE_DIR / name) as image:
            if image.size != expected_size or image.format != "PNG":
                raise EvidenceError("invalid_png")
    with Image.open(
        output_root / EVIDENCE_DIR / "roleproof-full-page.png"
    ) as image:
        if image.width != 1440 or image.height <= 1600:
            raise EvidenceError("invalid_full_page")
    with Image.open(
        output_root / EVIDENCE_DIR / "roleproof-interaction.gif"
    ) as image:
        if image.format != "GIF" or image.n_frames != 4:
            raise EvidenceError("invalid_gif")
        sizes = set()
        for frame in range(image.n_frames):
            image.seek(frame)
            sizes.add(image.size)
        if len(sizes) != 1:
            raise EvidenceError("gif_frame_mismatch")

    for name in OUTPUTS:
        suffix = Path(name).suffix
        if suffix not in TEXT_OUTPUTS:
            continue
        text = regular_bytes(output_root / EVIDENCE_DIR / name).decode(
            "utf-8", errors="strict"
        )
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                raise EvidenceError("secret_pattern")
        for forbidden in ("/home/", "/Users/", "file://"):
            if forbidden in text:
                raise EvidenceError("absolute_path")
        if suffix == ".svg":
            parsed = ElementTree.fromstring(text)
            if not parsed.tag.endswith("svg"):
                raise EvidenceError("invalid_svg")
            if any(
                element.tag.endswith(("script", "foreignObject", "image"))
                for element in parsed.iter()
            ):
                raise EvidenceError("unsafe_svg")

    receipt = json.loads(
        regular_bytes(
            output_root / EVIDENCE_DIR / "roleproof-analysis.json"
        )
    )
    verification = json.loads(
        regular_bytes(
            output_root / EVIDENCE_DIR / "roleproof-verification.json"
        )
    )
    stdout = regular_bytes(
        output_root / EVIDENCE_DIR / "roleproof-cli.txt"
    ).decode("utf-8")
    if (
        receipt["policy_sha256"] != manifest["policy_sha256"]
        or receipt["result_sha256"] != manifest["result_sha256"]
        or verification["result_sha256"] != receipt["result_sha256"]
        or verification["status"] != "verified"
        or receipt["result_sha256"] not in stdout
    ):
        raise EvidenceError("receipt_mismatch")


def hexadecimal(value: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise argparse.ArgumentTypeError("expected a 40-character Git object")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("generate", "verify"):
        command = subparsers.add_parser(name)
        command.add_argument("--root", type=Path, required=True)
        command.add_argument("--output-root", type=Path, required=True)
        command.add_argument("--source-revision", type=hexadecimal, required=True)
        command.add_argument("--source-tree", type=hexadecimal, required=True)
        command.add_argument("--container-image", required=True)
        if name == "generate":
            command.add_argument("--input-root", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    arguments = parse_args()
    root = arguments.root.resolve()
    output = arguments.output_root.resolve()
    if arguments.command == "generate":
        capture(
            root,
            arguments.input_root.resolve(),
            output,
            arguments.source_revision,
            arguments.source_tree,
            arguments.container_image,
        )
    else:
        verify_bundle(
            root,
            output,
            arguments.source_revision,
            arguments.source_tree,
            arguments.container_image,
        )
    print("roleproof evidence: PASS (" + arguments.command + ")")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
