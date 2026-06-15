from review_guard.io_utils import append_jsonl, write_jsonl
from review_guard.report import write_xlsx
from review_guard.submit import pending_rows, run_submit


def test_pending_rows_only_approved_and_not_done():
    queue = [
        {"review_id": "R1", "approve (y/n)": "y"},
        {"review_id": "R2", "approve (y/n)": ""},
        {"review_id": "R3", "approve (y/n)": "yes"},
        {"review_id": "R4", "approve (y/n)": "n"},
    ]
    pending = pending_rows(queue, done_ids={"R3"})
    ids = {r["review_id"] for r in pending}
    assert ids == {"R1"}  # R2/R4 not approved, R3 already done


def _seed_queue(project, approve_map):
    rows = [
        {
            "review_id": rid, "review_url": f"https://x/{rid}", "asin": "B0",
            "rating": 1, "date": "2026-05-01", "violation_type": "promotional",
            "confidence": 0.95, "evidence_quote": "www.x.com",
            "matched_guideline": "No URLs",
            "report_justification": "Please remove.",
            "recommended_channel": "Brand Registry > Report a Violation",
            "approve (y/n)": approve_map.get(rid, ""),
        }
        for rid in ("R1", "R2")
    ]
    write_xlsx(project.path("report_queue"), rows)


def test_run_submit_logs_confirmed_and_skips_others(project):
    _seed_queue(project, {"R1": "y", "R2": "y"})
    outputs = []
    answers = iter(["yes", "skip"])
    result = run_submit(
        project,
        mode="manual",
        input_fn=lambda _prompt: next(answers),
        print_fn=lambda *a, **k: outputs.append(" ".join(str(x) for x in a)),
    )
    assert result == {"submitted": 1, "skipped": 1}


def test_run_submit_dry_run_makes_no_prompts(project):
    _seed_queue(project, {"R1": "y"})

    def boom(_prompt):
        raise AssertionError("input should not be called in dry-run")

    result = run_submit(project, dry_run=True, input_fn=boom, print_fn=lambda *a, **k: None)
    assert result == {"submitted": 0, "skipped": 0}


def test_run_submit_idempotent_skips_already_submitted(project):
    _seed_queue(project, {"R1": "y"})
    append_jsonl(project.path("report_actions"), {"review_id": "R1", "action": "submitted"})

    def boom(_prompt):
        raise AssertionError("nothing should be pending")

    msgs = []
    result = run_submit(project, input_fn=boom, print_fn=lambda *a, **k: msgs.append(a))
    assert result == {"submitted": 0, "skipped": 0}
    assert any("No approved rows pending" in str(m) for m in msgs)
