"""Command-line interface: review-guard <fetch|classify|report|submit|run>."""

from __future__ import annotations

import argparse
from typing import Sequence

from . import __version__
from .config import load_config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="review-guard",
        description="Detect Amazon reviews that violate community guidelines and "
        "prepare report-ready evidence packets. Submission is human-confirmed.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "-c", "--config", default="config.yaml",
        help="Path to config.yaml (default: ./config.yaml).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="Load and normalize reviews from the configured source.")
    p_fetch.add_argument("--source", help="Override data_source.type (csv|json|agentcentral|api).")

    p_classify = sub.add_parser("classify", help="Classify reviews against the guidelines (Claude API).")
    p_classify.add_argument("--force", action="store_true", help="Re-classify every review.")
    p_classify.add_argument("--limit", type=int, default=0, help="Max reviews to classify this run (0 = all).")

    sub.add_parser("report", help="Write the audit log and the report queue (.xlsx).")

    sub.add_parser("dashboard", help="Build the HTML review dashboard (analytics, read-only).")

    p_submit = sub.add_parser("submit", help="Process approved rows one at a time (human-confirmed).")
    p_submit.add_argument("--mode", choices=["manual", "assisted"], default="manual")
    p_submit.add_argument("--dry-run", action="store_true", help="List pending approved rows, no prompts.")

    p_run = sub.add_parser("run", help="Detection pipeline: fetch -> classify -> report.")
    p_run.add_argument("--source", help="Override data_source.type for the fetch step.")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = load_config(args.config)

    if args.command == "fetch":
        count, out = run_and_report_fetch(config, args.source)
        print(f"fetched {count} reviews -> {out}")

    elif args.command == "classify":
        from .classify import run_classify
        stats = run_classify(config, force=args.force, limit=args.limit)
        print(
            f"classified {stats['processed']} this run; {stats['total']} total "
            f"({stats['flagged']} flagged, {stats['errored']} errored)"
        )

    elif args.command == "report":
        from .report import run_report
        r = run_report(config)
        print(f"audit log appended ({r['decisions']} decisions) -> {r['audit_path']}")
        print(f"report queue: {r['flagged']} flagged (confidence >= "
              f"{config.confidence_threshold}) -> {r['queue_path']}")

    elif args.command == "dashboard":
        from .dashboard import run_dashboard
        s = run_dashboard(config)
        print(f"dashboard: {s['total_negative']} negative reviews, "
              f"{s['negative_violations']} violate policy -> {s['dashboard_path']}")

    elif args.command == "submit":
        from .submit import run_submit
        result = run_submit(config, mode=args.mode, dry_run=args.dry_run)
        if not args.dry_run:
            print(f"\nDone. submitted={result['submitted']} skipped={result['skipped']} "
                  f"-> {config.path('report_actions')}")

    elif args.command == "run":
        from .classify import run_classify
        from .report import run_report
        count, out = run_and_report_fetch(config, args.source)
        print(f"fetched {count} reviews -> {out}")
        stats = run_classify(config)
        print(f"classified {stats['processed']} this run; {stats['total']} total "
              f"({stats['flagged']} flagged, {stats['errored']} errored)")
        r = run_report(config)
        print(f"report queue: {r['flagged']} flagged -> {r['queue_path']}")
        from .dashboard import run_dashboard
        s = run_dashboard(config)
        print(f"dashboard -> {s['dashboard_path']}")
        print("Next: a human marks approved rows, then run 'review-guard submit'.")

    return 0


def run_and_report_fetch(config, source):
    from .fetch import run_fetch
    return run_fetch(config, source)


if __name__ == "__main__":
    raise SystemExit(main())
