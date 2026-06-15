from review_guard.fetch import extract_reviews, fetch, normalize, run_fetch


def test_normalize_maps_aliases_and_coerces_types():
    raw = {
        "reviewId": "R9",
        "ASIN": "B000000000",
        "stars": "4",
        "headline": "Solid",
        "reviewBody": "Great product",
        "author": "Dana",
        "reviewDate": "2026-05-01",
        "helpfulVotes": "7",
        "permalink": "https://amazon.de/review/R9",
    }
    rec = normalize(raw)
    assert rec["review_id"] == "R9"
    assert rec["asin"] == "B000000000"
    assert rec["rating"] == 4.0
    assert rec["title"] == "Solid"
    assert rec["body"] == "Great product"
    assert rec["helpful_votes"] == 7
    assert rec["url"].endswith("/R9")


def test_normalize_handles_missing_fields():
    rec = normalize({"id": "R1", "text": "ok"})
    assert rec["review_id"] == "R1"
    assert rec["rating"] is None
    assert rec["helpful_votes"] == 0
    assert rec["title"] == ""


def test_extract_reviews_shapes():
    assert extract_reviews([{"a": 1}]) == [{"a": 1}]
    assert extract_reviews({"reviews": [{"a": 1}]}) == [{"a": 1}]
    # ASIN-keyed mapping (agentcentral-style) flattens
    nested = {"B1": {"reviews": [{"id": "x"}]}, "B2": {"reviews": [{"id": "y"}]}}
    ids = sorted(r["id"] for r in extract_reviews(nested))
    assert ids == ["x", "y"]


def test_fetch_csv_dedupes_and_filters_by_asin(project):
    csv_path = project.source_path("path")
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.write_text(
        "review_id,asin,rating,title,body,url\n"
        "R1,B000000000,5,Good,Works well,https://x/R1\n"
        "R1,B000000000,5,Good,Works well duplicate id,https://x/R1\n"  # dup id -> last wins
        "R2,B999999999,1,Off,Other product not monitored,https://x/R2\n"  # filtered out by ASIN
        "R3,B000000001,3,,,https://x/R3\n",  # empty body -> dropped
        encoding="utf-8",
    )
    reviews = fetch(project)
    ids = {r["review_id"] for r in reviews}
    assert ids == {"R1"}
    assert reviews[0]["body"].endswith("duplicate id")


def test_run_fetch_writes_jsonl(project):
    csv_path = project.source_path("path")
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.write_text(
        "review_id,asin,rating,title,body,url\nR1,B000000000,5,Hi,Body text,https://x/R1\n",
        encoding="utf-8",
    )
    count, out = run_fetch(project)
    assert count == 1
    assert out.exists()
