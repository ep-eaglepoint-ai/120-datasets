import hmac
import hashlib
import datetime
from models.db import Transaction

class InvalidSignatureError(Exception):
    """Raised when the signature verification fails."""
    pass

class ReplayAttackError(Exception):
    """Raised when the request timestamp indicates a replay attack."""
    pass

class SignatureVerifier:
    """
    Service responsible for verifying HMAC SHA256 signatures.
    """
    def verify(self, payload, received_signature, secret_key):
        """
        Verify the HMAC SHA256 signature of the incoming payload.
        """
        signed_payload = ''.join(str(payload[key]) for key in payload)
        expected_signature = hmac.new(
                secret_key.encode(),
                signed_payload.encode(),
                hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_signature, received_signature)

class WebhookValidator:
    """
    Service responsible for validating webhook request structure and checking for replay attacks.
    """
    def validate_timestamp(self, timestamp):
        """
        Validate presence of timestamp and check for replay attacks.
        """
        if timestamp is None:
            raise ValueError("Missing timestamp in payload")

        # Check for replay attacks
        time_difference = datetime.datetime.utcnow() - \
            datetime.datetime.fromtimestamp(timestamp)
        if time_difference > datetime.timedelta(minutes=5):
            raise ReplayAttackError("Replay attack detected")

    def validate_signature_header(self, signature):
        """Validate presence of signature header."""
        if not signature:
            raise ValueError("Missing signature header")

class TransactionRepository:
    """
    Repository layer to handle database interactions for Transactions.
    """
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def save_transaction(self, request_data):
        """
        Persist the transaction data to the database.
        """
        with self.session_factory() as session:
            transaction = Transaction(**request_data)
            session.add(transaction)
            session.commit()

class WebhookService:
    """
    Orchestrator handling the business logic of processing a webhook.
    """
    def __init__(self, verifier, validator, repository, secret_key):
        self.verifier = verifier
        self.validator = validator
        self.repository = repository
        self.secret_key = secret_key

    def process_webhook(self, request_data, signature):
        """
        Process the webhook: validate, verify signature, and save.
        """
        # 1. Validate Timestamp & Replay Attack
        timestamp = request_data.get('timestamp')
        self.validator.validate_timestamp(timestamp)

        # 2. Verify Signature
        if not self.verifier.verify(request_data, signature, self.secret_key):
            raise InvalidSignatureError("Invalid signature")

        # 3. Persist Data
        self.repository.save_transaction(request_data)
