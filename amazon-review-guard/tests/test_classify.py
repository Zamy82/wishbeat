import json
import types

from review_guard.classify import content_hash, run_classify
from review_guard.io_utils import read_jsonl, write_jsonl


class FakeMessages:
    """Stub for client.messages — returns canned JSON decisions in order."""

    def __init__(self, decisions):
        self._decisions = list(decisions)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        body = self._decisions.pop(0)
        block = types.SimpleNamespace(type="text", text=json.dumps(body))
        return types.SimpleNamespace(content=[block])


class FakeClient:
    def __init__(self, decisions):
        self.messages = FakeMessages(decisions)


def _seed_reviews(project):
    write_jsonl(
        project.path("reviews"),
        [
            {"review_id": "R1", "asin": "B000000000", "title": "Good", "body": "Honest opinion"},
            {"review_id": "R2", "asin": "B000000000", "title": "Spam", "body": "Visit www.x.com"},
        ],
    )


def test_content_hash_changes_with_text():
    a = content_hash({"title": "t", "body": "b"})
    assert a == content_hash({"title": "t", "body": "b"})
    assert a != content_hash({"title": "t", "body": "different"})


def test_run_classify_writes_decisions(project):
    _seed_reviews(project)
    client = FakeClient(
        [
            {
                "is_violation": False, "violation_type": "none", "evidence_quote": "",
                "matched_guideline": "", "confidence": 0.97, "justification": "Honest opinion.",
            },
            {
                "is_violation": True, "violation_type": "promotional", "evidence_quote": "www.x.com",
                "matched_guideline": "No URLs", "confidence": 0.95, "justification": "Contains URL.",
            },
        ]
    )
    stats = run_classify(project, client=client)
    assert stats["processed"] == 2
    assert stats["flagged"] == 1
    decisions = {d["review_id"]: d for d in read_jsonl(project.path("classifications"))}
    assert decisions["R2"]["violation_type"] == "promotional"
    assert decisions["R1"]["is_violation"] is False


def test_run_classify_is_idempotent(project):
    _seed_reviews(project)
    decisions = [
        {"is_violation": False, "violation_type": "none", "evidence_quote": "",
         "matched_guideline": "", "confidence": 0.9, "justification": "ok"},
        {"is_violation": False, "violation_type": "none", "evidence_quote": "",
         "matched_guideline": "", "confidence": 0.9, "justification": "ok"},
    ]
    first = FakeClient(decisions)
    run_classify(project, client=first)
    assert len(first.messages.calls) == 2

    # Second run with unchanged reviews must make zero API calls.
    second = FakeClient([])
    stats = run_classify(project, client=second)
    assert stats["processed"] == 0
    assert second.messages.calls == []


def test_run_classify_records_errors_without_crashing(project):
    _seed_reviews(project)

    class BoomMessages:
        def create(self, **kwargs):
            raise RuntimeError("api down")

    class BoomClient:
        messages = BoomMessages()

    stats = run_classify(project, client=BoomClient())
    assert stats["errored"] == 2
    assert stats["flagged"] == 0
