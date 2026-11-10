import pytest
from httpx import Client, ConnectTimeout, MockTransport, Request, Response
from jinja2 import UndefinedError


def test_real_email_addresses_are_normalized_without_test_domain_restriction():
    from app.auth.policy import normalize_email

    assert normalize_email("  John.Doe@Example.COM  ") == "john.doe@example.com"
    with pytest.raises(ValueError):
        normalize_email("not-an-email")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  John Doe  ", "John Doe"),
        ("Aminata Élodie Dossou", "Aminata Élodie Dossou"),
    ],
)
def test_account_names_are_trimmed_and_accept_unicode(raw, expected):
    from app.auth.policy import normalize_full_name

    assert normalize_full_name(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "John\nDoe", "x" * 201])
def test_account_names_reject_empty_control_or_oversized_values(raw):
    from app.auth.policy import normalize_full_name

    with pytest.raises(ValueError):
        normalize_full_name(raw)


def test_templates_render_escaped_personalized_html_and_plain_text():
    from app.auth.mail import MailRenderer

    message = MailRenderer().render(
        "invitation",
        recipient_name="John <Doe>",
        role_label="Superviseur",
        action_url="http://localhost:5173/invitation#selector=a&verifier=b",
        expiration_text="7 jours",
    )

    assert message.subject == "Invitation à activer votre compte"
    assert "Bonjour John &lt;Doe&gt;," in message.html
    assert (
        'href="http://localhost:5173/invitation#selector=a&amp;verifier=b"'
        in message.html
    )
    assert "Bonjour John <Doe>," in message.text
    for content in (message.html, message.text):
        assert "Superviseur" in content
        assert "la plateforme de planification et de suivi administratif" in content
        assert "Si cette invitation ne vous est pas destinée" in content


def test_login_code_keeps_leading_zero_and_notice_templates_have_no_button():
    from app.auth.mail import MailRenderer

    code = MailRenderer().render("otp", otp_code="012345", expiration_text="10 minutes")
    notice = MailRenderer().render(
        "password_reset_notice", recipient_name="Aminata Dossou"
    )

    assert "012345" in code.html and "012345" in code.text
    assert "<a " not in notice.html
    assert "Bonjour Aminata Dossou," in notice.html


def test_all_personalized_templates_and_strict_variables():
    from app.auth.mail import MailRenderer

    renderer = MailRenderer()
    recovery = renderer.render(
        "password_recovery",
        recipient_name=None,
        action_url="http://localhost:5173/reset-password#selector=a&verifier=b",
        expiration_text="10 minutes",
    )
    reminder = renderer.render(
        "activity_reminder",
        recipient_name="Aminata Dossou",
        activity_reference="ACT-2028-001",
        activity_name="Une activité <longue> " + "x" * 200,
        activity_end_date="29 février 2028",
    )
    assignment = renderer.render(
        "activity_assignment",
        recipient_name="Aminata Dossou",
        activity_reference="ACT-2028-002",
        activity_name="Concertation communale",
        pta_name="PTA 2028",
        project_name="Protection de l’enfant",
        assigner_name="Jean Superviseur",
    )

    assert "Bonjour," in recovery.html and "réinitialiser" in recovery.text
    assert "Bonjour Aminata Dossou," in reminder.html
    assert "29 février 2028" in reminder.html and "&lt;longue&gt;" in reminder.html
    assert "<a " not in reminder.html
    assert "@media only screen and (max-width:600px)" in reminder.html
    assert "Jean Superviseur" in assignment.text
    assert "ACT-2028-002" in assignment.html
    with pytest.raises(UndefinedError):
        renderer.render("activity_reminder", recipient_name="Aminata Dossou")


def test_resend_transport_returns_provider_id_and_rejects_bad_responses():
    from app.auth.mail import MailRenderer, ResendMailer

    requests: list[Request] = []

    def accepted(request: Request) -> Response:
        requests.append(request)
        return Response(200, json={"id": "provider-message"})

    message = MailRenderer().render(
        "otp", otp_code="012345", expiration_text="10 minutes"
    )
    mailer = ResendMailer(
        "secret",
        "MJL <mail@example.com>",
        "reply@example.com",
        Client(transport=MockTransport(accepted)),
    )
    assert mailer.send("john@example.com", "otp", message) == "provider-message"
    assert requests[0].headers["authorization"] == "Bearer secret"
    assert requests[0].read().decode().count("012345") == 2

    broken = ResendMailer(
        "secret",
        "mail@example.com",
        None,
        Client(transport=MockTransport(lambda request: Response(200, json={}))),
    )
    with pytest.raises(OSError):
        broken.send("john@example.com", "otp", message)


@pytest.mark.parametrize(
    ("kind", "context", "expected"),
    [
        (
            "activity_review_supervisor",
            {
                "recipient_name": "Aminata Superviseure",
                "actor_name": "Jean Agent",
                "activity_action": "activité",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation des relais",
                "project_name": "Protection de l’enfant",
                "pta_name": "PTA 2028",
                "action_url": "http://localhost/activities/activity-1",
            },
            "Une activité attend votre examen",
        ),
        (
            "activity_review_validator",
            {
                "recipient_name": "Aminata Validatrice",
                "actor_name": "Jean Superviseur",
                "activity_action": "demande de transfert annuel",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation des relais",
                "project_name": "Protection de l’enfant",
                "pta_name": "PTA 2028",
                "action_url": "http://localhost/activities/activity-1",
            },
            "attend votre approbation",
        ),
        (
            "activity_correction",
            {
                "recipient_name": None,
                "actor_name": None,
                "activity_action": "modification d’activité",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation <terrain>",
                "project_name": "Protection de l’enfant",
                "pta_name": "PTA 2028",
                "reason": "Préciser les résultats.",
                "action_url": "http://localhost/activities/activity-1",
            },
            "Une modification d’activité nécessite des corrections",
        ),
        (
            "financial_review_supervisor",
            {
                "recipient_name": "Aminata Superviseure",
                "actor_name": "Jean Agent",
                "request_label": "Demande de virement",
                "request_amount": "125 000",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation des relais",
                "action_url": "http://localhost/execution/activities/activity-1",
            },
            "125 000 F CFA",
        ),
        (
            "financial_review_validator",
            {
                "recipient_name": "Aminata Validatrice",
                "actor_name": "Jean Superviseur",
                "request_label": "Déclaration sans dépense",
                "request_amount": "0",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation des relais",
                "action_url": "http://localhost/execution/activities/activity-1",
            },
            "Déclaration sans dépense — 0 F CFA",
        ),
        (
            "financial_correction",
            {
                "recipient_name": "Aminata Agent",
                "actor_name": "Jean Validateur",
                "request_label": "Demande de financement complémentaire",
                "request_amount": "25 000",
                "activity_reference": "ACT-000021",
                "activity_name": "Formation des relais",
                "reason": "Justification à préciser.",
                "action_url": "http://localhost/execution/activities/activity-1",
            },
            "une nouvelle soumission",
        ),
    ],
)
def test_workflow_email_has_equivalent_html_and_text(kind, context, expected):
    import json

    from app.auth.mail import MailRenderer, ResendMailer

    requests: list[Request] = []

    def accepted(request: Request) -> Response:
        requests.append(request)
        return Response(200, json={"id": "plain-text-message"})

    message = MailRenderer().render(kind, **context)
    assert message.html is not None
    for content in (message.html, message.text):
        assert "ACT-000021" in content
        assert expected in content
    assert "request_reference" not in message.html
    if context["recipient_name"] is None:
        assert "Bonjour," in message.html
    if "<" in context["activity_name"]:
        assert "Formation &lt;terrain&gt;" in message.html
    mailer = ResendMailer(
        "secret",
        "MJL <mail@example.com>",
        None,
        Client(transport=MockTransport(accepted)),
    )
    assert mailer.send("aminata@example.com", kind, message) == "plain-text-message"
    payload = json.loads(requests[0].read())
    assert payload["text"] == message.text
    assert payload["html"] == message.html


def test_resend_transport_distinguishes_rejection_from_uncertain_delivery():
    from app.auth.mail import MailDeliveryUncertain, MailRenderer, ResendMailer

    message = MailRenderer().render(
        "otp", otp_code="012345", expiration_text="10 minutes"
    )
    rejected = ResendMailer(
        "secret",
        "mail@example.com",
        None,
        Client(
            transport=MockTransport(
                lambda request: Response(429, json={"message": "limited"})
            )
        ),
    )
    with pytest.raises(OSError, match="provider rejected"):
        rejected.send("john@example.com", "otp", message)

    uncertain = ResendMailer(
        "secret",
        "mail@example.com",
        None,
        Client(
            transport=MockTransport(
                lambda request: (_ for _ in ()).throw(ConnectTimeout("late"))
            )
        ),
    )
    with pytest.raises(MailDeliveryUncertain):
        uncertain.send("john@example.com", "otp", message)


@pytest.mark.parametrize("body", [None, [], "accepted", 42, {"id": "x" * 65}])
def test_resend_transport_marks_malformed_acceptance_as_uncertain(body):
    from app.auth.mail import MailDeliveryUncertain, MailRenderer, ResendMailer

    message = MailRenderer().render(
        "otp", otp_code="012345", expiration_text="10 minutes"
    )
    mailer = ResendMailer(
        "secret",
        "mail@example.com",
        None,
        Client(transport=MockTransport(lambda request: Response(200, json=body))),
    )
    with pytest.raises(MailDeliveryUncertain):
        mailer.send("john@example.com", "otp", message)
