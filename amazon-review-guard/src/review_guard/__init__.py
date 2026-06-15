"""amazon-review-guard — detect Amazon reviews that violate community
guidelines and prepare report-ready evidence packets.

Sentiment and star rating are never signals; only a clear, evidenced breach of
a specific Amazon guideline (above a configurable confidence threshold) is
flagged. Submission is always human-confirmed.
"""

__version__ = "0.1.0"

VIOLATION_TYPES = [
    "profanity",
    "hate_harassment",
    "promotional",
    "off_topic",
    "private_info",
    "illegal_dangerous",
    "plagiarized",
    "fake_incentivized",
]
