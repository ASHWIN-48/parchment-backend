def evaluate_answer(answer: str, expected_keywords: list[str]) -> float:
    """
    Simple evaluation:
    - checks how many expected keywords appear in the answer
    - returns a score between 0 and 1
    """
    if not answer or not expected_keywords:
        return 0.0

    answer_lower = answer.lower()
    hits = sum(1 for k in expected_keywords if k.lower() in answer_lower)

    return round(hits / len(expected_keywords), 2)
