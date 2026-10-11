"""Package or reversibly replace only the existing Team5 static frontend.

AWS phases are intended for the already authenticated AWS CloudShell. Package is
offline. Inspect is read-only. Apply/rollback require the reviewed current index
hash and never modify config, Cognito, CloudFront settings, APIs or model code.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ACCOUNT = "998301375101"
BUCKET = "team5-evidence-998301375101-ap-northeast-2-an"
PREFIX = "web/frontend/20261006"
DOMAIN = "d2gmygchoew9ed.cloudfront.net"
ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def release_files():
    dist = (ROOT / "dist").resolve()
    paths = [dist / "index.html", dist / "logo.png"]
    for folder in ("assets", "icons", "licenses"):
        paths.extend(path for path in (dist / folder).rglob("*") if path.is_file())
    if not (dist / "assets").is_dir():
        raise ValueError("Run npm run build first")
    files = {}
    for path in paths:
        path.resolve().relative_to(dist)
        relative = path.relative_to(dist).as_posix()
        files[relative] = path.read_bytes()
    return files


def package(destination):
    files = release_files()
    manifest = {name: sha(data) for name, data in files.items()}
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr("dist/" + name, data)
        archive.writestr("dist/config.json", (ROOT / "dist/config.json").read_bytes())
        archive.writestr("release-manifest.json", json.dumps(manifest, indent=2))
        archive.write(__file__, "scripts/publish_frontend.py")
    print(json.dumps({"package": str(destination), "static_files": len(files), "index_sha256": manifest["index.html"]}))


def aws():
    import boto3
    session = boto3.Session(region_name="ap-northeast-2")
    if session.client("sts").get_caller_identity()["Account"] != ACCOUNT:
        raise ValueError("Wrong AWS account")
    s3, cf = session.client("s3"), session.client("cloudfront")
    distribution = None
    for page in cf.get_paginator("list_distributions").paginate():
        distribution = next((row for row in page["DistributionList"].get("Items", []) if row["DomainName"] == DOMAIN), None)
        if distribution:
            break
    if not distribution or not distribution["Enabled"]:
        raise ValueError("Expected active CloudFront distribution was not found")
    origins = distribution["Origins"]["Items"]
    if not any(row["DomainName"] == f"{BUCKET}.s3.ap-northeast-2.amazonaws.com" and row.get("OriginPath") == "/" + PREFIX for row in origins):
        raise ValueError("Static origin changed; review the new deployment target")
    return s3, cf, distribution["Id"]


def read(s3, key):
    return s3.get_object(Bucket=BUCKET, Key=key, ExpectedBucketOwner=ACCOUNT)["Body"].read()


def put(s3, relative, data):
    kind = {".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2"}.get(Path(relative).suffix)
    kind = kind or mimetypes.guess_type(relative)[0] or "application/octet-stream"
    s3.put_object(Bucket=BUCKET, Key=PREFIX + "/" + relative, Body=data,
        ContentType=kind, CacheControl="no-store" if relative == "index.html" else "public,max-age=31536000,immutable" if relative.startswith("assets/") else "public,max-age=3600",
        Metadata={"sha256": sha(data)}, ExpectedBucketOwner=ACCOUNT)
    if sha(read(s3, PREFIX + "/" + relative)) != sha(data):
        raise ValueError("Static file readback mismatch: " + relative)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("package", "inspect", "apply", "rollback"), default="inspect")
    parser.add_argument("--output", default=str(ROOT / "frontend-release.zip"))
    parser.add_argument("--expected-index-sha256")
    parser.add_argument("--backup-key")
    args = parser.parse_args()
    if args.phase == "package":
        package(args.output)
        return
    s3, cf, distribution_id = aws()
    index_key, config_key = PREFIX + "/index.html", PREFIX + "/config.json"
    current, config = read(s3, index_key), read(s3, config_key)
    local_config = (ROOT / "dist/config.json").read_bytes()
    same_config = json.loads(config) == json.loads(local_config)
    if not same_config:
        raise ValueError("Service config changed; review the new API/auth settings")
    if args.phase == "inspect":
        print(json.dumps({"target": "https://" + DOMAIN + "/", "current_index_sha256": sha(current), "config_matches": same_config}))
        return
    if args.expected_index_sha256 != sha(current):
        raise ValueError("Current index does not match the reviewed hash; another frontend change may have been published")
    if args.phase == "rollback":
        if not args.backup_key or not args.backup_key.startswith(PREFIX + "/releases/") or not args.backup_key.endswith("/index.html"):
            raise ValueError("A frontend release backup key is required")
        replacement = read(s3, args.backup_key)
        backup_key = args.backup_key
    else:
        files = release_files()
        manifest = json.loads((ROOT / "release-manifest.json").read_text("utf8"))
        if {name: sha(data) for name, data in files.items()} != manifest:
            raise ValueError("Release files differ from the packaged manifest")
        backup_key = PREFIX + "/releases/" + stamp() + "/index.html"
        s3.put_object(Bucket=BUCKET, Key=backup_key, Body=current, ContentType="text/html", CacheControl="no-store", ExpectedBucketOwner=ACCOUNT)
        config_backup_key = backup_key.removesuffix("index.html") + "config.json"
        s3.put_object(Bucket=BUCKET, Key=config_backup_key, Body=config, ContentType="application/json", CacheControl="no-store", ExpectedBucketOwner=ACCOUNT)
        if read(s3, backup_key) != current:
            raise ValueError("Backup readback mismatch")
        if read(s3, config_backup_key) != config:
            raise ValueError("Config backup readback mismatch")
        for name, data in files.items():
            if name != "index.html":
                put(s3, name, data)
        replacement = files["index.html"]
    # Recheck just before switching to avoid overwriting concurrent frontend work.
    if sha(read(s3, index_key)) != args.expected_index_sha256:
        raise ValueError("Index changed during upload; the active index was not replaced")
    if json.loads(read(s3, config_key)) != json.loads(local_config):
        raise ValueError("Service config changed during upload; the active index was not replaced")
    put(s3, "index.html", replacement)
    receipt = {"phase": args.phase, "target": "https://" + DOMAIN + "/", "backup_key": backup_key,
        "previous_index_sha256": sha(current), "index_sha256": sha(replacement), "config_unchanged": read(s3, config_key) == config}
    receipt_path = ROOT / ("frontend-receipt-" + stamp() + ".json")
    receipt_path.write_text(json.dumps(receipt, indent=2), "utf8")
    invalidation = cf.create_invalidation(DistributionId=distribution_id, InvalidationBatch={
        "Paths": {"Quantity": 2, "Items": ["/", "/index.html"]}, "CallerReference": "front-" + stamp()})
    receipt["invalidation_id"] = invalidation["Invalidation"]["Id"]
    receipt_path.write_text(json.dumps(receipt, indent=2), "utf8")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
