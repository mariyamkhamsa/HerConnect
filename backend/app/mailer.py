"""
Outgoing e-mail (password-reset links).

E-mail is sent over SMTP only when SMTP_HOST and SMTP_FROM are set (see .env.example).
Without them nothing is e-mailed; in development the reset link is printed in the backend
console instead (PASSWORD_RESET_LOG_LINK_WITHOUT_SMTP). Sending never raises: a delivery failure
is logged and must not change the API response (which is deliberately identical whether or not
the e-mail address belongs to an account).
"""
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("herconnect.mailer")


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Send a plain-text e-mail. Returns True on success, False if not configured or it failed."""
    if not smtp_configured():
        return False
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        with server:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 - never let a mail problem surface to the caller
        logger.exception("Could not send e-mail to %s", to_address)
        return False


def send_password_reset_email(to_address: str, reset_link: str, expires_minutes: int) -> bool:
    if not smtp_configured():
        if settings.PASSWORD_RESET_LOG_LINK_WITHOUT_SMTP:
            logger.warning(
                "SMTP is not configured - password reset e-mail NOT sent. "
                "Development reset link for %s: %s", to_address, reset_link,
            )
        else:
            logger.warning("SMTP is not configured - password reset e-mail for %s was not sent.", to_address)
        return False
    body = (
        "Hello,\n\n"
        "We received a request to reset your HerConnect password. Open the link below to choose a new one:\n\n"
        f"{reset_link}\n\n"
        f"The link works once and expires in {expires_minutes} minutes. "
        "If you did not ask for this, you can ignore this e-mail - your password stays unchanged.\n\n"
        "HerConnect"
    )
    return send_email(to_address, "Reset your HerConnect password", body)
