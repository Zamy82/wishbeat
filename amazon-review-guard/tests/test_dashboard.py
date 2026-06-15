from review_guard.dashboard import compute_stats, run_dashboard
from review_guard.io_utils import write_jsonl


def _seed(project):
    write_jsonl(
        project.path("reviews"),
        [
            {"review_id": "R1", "asin": "B0", "rating": 1, "url": "https://x/R1", "title": "Kurier", "body": "DHL war unfreundlich"},
            {"review_id": "R2", "asin": "B0", "rating": 2, "url": "https://x/R2", "title": "Spam", "body": "www.x.com kaufen"},
            {"review_id": "R3", "asin": "B0", "rating": 3, "url": "https://x/R3", "title": "Naja", "body": "Ehrliche Kritik am Gerät"},
            {"review_id": "R4", "asin": "B0", "rating": 5, "url": "https://x/R4", "title": "Top", "body": "Super, aber besuche www.y.com"},
        ],
    )
    write_jsonl(
        project.path("classifications"),
        [
            {"review_id": "R1", "asin": "B0", "is_violation": True, "violation_type": "off_topic",
             "confidence": 0.9, "evidence_quote": "DHL war unfreundlich", "matched_guideline": "g", "error": None},
            {"review_id": "R2", "asin": "B0", "is_violation": True, "violation_type": "promotional",
             "confidence": 0.92, "evidence_quote": "www.x.com", "matched_guideline": "g", "error": None},
            {"review_id": "R3", "asin": "B0", "is_violation": False, "violation_type": "none",
             "confidence": 0.97, "evidence_quote": "", "matched_guideline": "", "error": None},
            # violation in a 5-star (non-negative) review
            {"review_id": "R4", "asin": "B0", "is_violation": True, "violation_type": "promotional",
             "confidence": 0.9, "evidence_quote": "www.y.com", "matched_guideline": "g", "error": None},
        ],
    )


def test_compute_stats_segments_negatives_and_violations(project):
    _seed(project)
    s = compute_stats(project)
    assert s["total"] == 4
    assert s["total_negative"] == 3            # R1, R2, R3 (<= 3 stars)
    assert s["negative_violations"] == 2       # R1, R2
    assert s["negative_clean"] == 1            # R3 honest negative
    assert s["by_type"] == {"off_topic": 1, "promotional": 1}
    assert s["violations_in_non_negative"] == 1  # R4 surfaced separately, not hidden


def test_run_dashboard_writes_html(project):
    _seed(project)
    s = run_dashboard(project)
    html = s["dashboard_path"].read_text(encoding="utf-8")
    assert "<table" in html
    assert "Kategorie" in html
    # honest negative content is shown but not marked as a violation row
    assert "Ehrliche Kritik" in html


def test_dashboard_respects_negative_threshold(project):
    _seed(project)
    project.negative_max_rating = 2  # now R3 (3 stars) is not negative
    s = compute_stats(project)
    assert s["total_negative"] == 2
    assert s["negative_violations"] == 2
