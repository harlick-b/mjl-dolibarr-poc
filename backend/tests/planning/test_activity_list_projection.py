from app.planning.core.presentation import activity_review_action


def test_activity_review_action_requires_the_eligible_review_stage():
    common = {
        "activity_id": "activity-1",
        "revision_id": "revision-1",
        "contributor_ids": set(),
        "prevalidated_revision_ids": set(),
    }

    assert (
        activity_review_action(
            role="VALIDATEUR_DEFINITIF", state="prevalidated", **common
        )
        == "approve"
    )
    assert (
        activity_review_action(role="AGENT_SAISIE", state="prevalidated", **common)
        is None
    )
    assert (
        activity_review_action(
            role="VALIDATEUR_DEFINITIF",
            state="prevalidated",
            **{**common, "contributor_ids": {"activity-1"}},
        )
        is None
    )
    assert (
        activity_review_action(
            role="VALIDATEUR_DEFINITIF",
            state="prevalidated",
            **{**common, "prevalidated_revision_ids": {"revision-1"}},
        )
        is None
    )
