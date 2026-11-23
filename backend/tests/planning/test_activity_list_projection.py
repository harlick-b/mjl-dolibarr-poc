from types import SimpleNamespace

from app.planning.core.presentation import activity_review_action
from app.planning.notifications.notification_delivery import activity_action_url


def test_activity_action_url_uses_the_approved_baseline_module():
    auth = SimpleNamespace(policy=SimpleNamespace(origin="https://mjl.example"))

    assert (
        activity_action_url(
            auth,
            SimpleNamespace(id="draft", approved_revision_id=None),
        )
        == "https://mjl.example/planning/activities/draft"
    )
    assert (
        activity_action_url(
            auth,
            SimpleNamespace(id="approved", approved_revision_id="revision-1"),
        )
        == "https://mjl.example/execution/activities/approved"
    )


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
