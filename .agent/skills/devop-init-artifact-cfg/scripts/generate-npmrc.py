#!/usr/bin/env python3
"""
generate_npmrc.py — Tạo file .npmrc cho Azure DevOps Artifacts

Usage:
    python3 generate_npmrc.py \
        --org conarumdc \
        --feed cdk-npm \
        --scope @cnma \
        --username myuser \
        --pat "mypattoken" \
        --email "user@company.com" \
        --target local \
        --project-dir /path/to/project
"""

import argparse
import base64
import os
import sys
from pathlib import Path


def build_npmrc_content(org: str, feed: str, scope: str, username: str, pat_b64: str, email: str) -> str:
    """Build nội dung .npmrc theo đúng chuẩn Azure DevOps Artifacts."""
    # Đảm bảo scope có dấu @ ở đầu
    if not scope.startswith("@"):
        scope = f"@{scope}"

    registry_url = f"https://pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/"
    auth_prefix = f"//pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/:"

    lines = [
        f"{scope}:registry={registry_url}",
        "always-auth=true",
        f"{auth_prefix}username={username}",
        f"{auth_prefix}_password={pat_b64}",
        f"{auth_prefix}email={email}",
        "install-links=true",
        "",  # trailing newline
    ]
    return "\n".join(lines)


def resolve_target_path(target: str, project_dir: str) -> Path:
    """Xác định đường dẫn output .npmrc."""
    if target == "global":
        return Path.home() / ".npmrc"
    else:
        # Local: trong project dir
        return Path(project_dir) / ".npmrc"


def check_gitignore(project_dir: str, npmrc_filename: str = ".npmrc") -> bool:
    """Kiểm tra .npmrc đã có trong .gitignore chưa."""
    gitignore_path = Path(project_dir) / ".gitignore"
    if not gitignore_path.exists():
        return False
    content = gitignore_path.read_text(encoding="utf-8")
    return npmrc_filename in content


def main():
    parser = argparse.ArgumentParser(
        description="Tạo .npmrc cho Azure DevOps Artifacts"
    )
    parser.add_argument("--org", required=True, help="Azure DevOps organization name")
    parser.add_argument("--feed", required=True, help="Azure Artifacts feed name")
    parser.add_argument("--scope", required=True, help="npm package scope (e.g. @cnma)")
    parser.add_argument("--username", required=True, help="Azure DevOps username")
    parser.add_argument("--pat", required=True, help="Personal Access Token (sẽ được base64-encode)")
    parser.add_argument("--email", required=True, help="Email")
    parser.add_argument(
        "--target",
        choices=["local", "global"],
        default="local",
        help="local = trong project dir, global = ~/.npmrc",
    )
    parser.add_argument(
        "--project-dir",
        default=os.getcwd(),
        help="Thư mục project (chỉ dùng khi --target=local)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ghi đè file hiện tại mà không hỏi",
    )

    args = parser.parse_args()

    # --- Base64 encode PAT ---
    pat_b64 = base64.b64encode(args.pat.encode("utf-8")).decode("utf-8")

    # --- Build nội dung ---
    content = build_npmrc_content(
        org=args.org,
        feed=args.feed,
        scope=args.scope,
        username=args.username,
        pat_b64=pat_b64,
        email=args.email,
    )

    # --- Xác định đường dẫn ---
    output_path = resolve_target_path(args.target, args.project_dir)

    # --- Kiểm tra file đã tồn tại ---
    if output_path.exists() and not args.force:
        print(f"\n⚠️  File đã tồn tại: {output_path}")
        print("Nội dung hiện tại:")
        print("-" * 40)
        print(output_path.read_text(encoding="utf-8"))
        print("-" * 40)
        answer = input("Ghi đè? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("❌ Đã hủy. File không bị thay đổi.")
            sys.exit(0)

    # --- Tạo thư mục nếu cần ---
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # --- Ghi file ---
    output_path.write_text(content, encoding="utf-8")

    # --- Output kết quả (ẩn PAT gốc) ---
    print(f"\n✅ Đã tạo file: {output_path}")
    print("\nNội dung .npmrc:")
    print("=" * 50)

    # Hiển thị content nhưng mask phần password để an toàn
    display_content = content.replace(
        f"_password={pat_b64}",
        f"_password=<base64-encoded-PAT>"
    )
    print(display_content)
    print("=" * 50)

    # --- Gợi ý .gitignore (chỉ với local) ---
    if args.target == "local":
        if not check_gitignore(args.project_dir):
            print("\n💡 Gợi ý: Thêm .npmrc vào .gitignore để tránh commit credentials:")
            print("   echo '.npmrc' >> .gitignore")
        else:
            print("\n✅ .npmrc đã có trong .gitignore")

    print("\n🚀 Thử chạy: npm install --dry-run")


if __name__ == "__main__":
    main()
