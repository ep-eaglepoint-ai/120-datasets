#!/usr/bin/python3
"""
Unit tests for the webhook endpoint and signature verification.
"""

import json
import os
import unittest
from unittest.mock import patch, MagicMock, Mock
from datetime import datetime, timedelta
import hmac
import hashlib
from uuid import uuid4
from sqlalchemy.exc import SQLAlchemyError
from api import app
from api.services import (
    SignatureVerifier, 
    WebhookValidator, 
    TransactionRepository, 
    WebhookService,
    InvalidSignatureError,
    ReplayAttackError
)
from models.db import init_db

# Patching where it is USED, to ensure the mock is effective since
# 'get_session' is imported into 'api.webhook'
PATCH_GET_SESSION = 'api.webhook.get_session'

class WebhookTestCase(unittest.TestCase):
    """
    Test case for verifying webhook functionality, including signature
    verification, replay attack prevention, and database interactions.
    """

    def setUp(self):
        """Set up the test client and sample payload for testing."""
        self.app = app.test_client()
        self.app.testing = True
        self.secret_key = os.getenv('WEBHOOK_SECRET', '')
        self.payload = {
            "id": str(uuid4()),
            "amount": 100,
            "currency": "ETB",
            "created_at_time": 1673381836,
            "timestamp": int(
                (datetime.utcnow() - timedelta(minutes=2)).timestamp()),
            "cause": "Testing",
            "full_name": "Abebe Kebede",
            "account_name": "abebekebede1",
            "invoice_url": "https://yayawallet.com/en/invoice/xxxx"
        }
        # Ensure tables exist before tests run
        init_db()

    def generate_signature(self, payload, secret_key):
        """Helper function to generate HMAC SHA256 signature for a payload."""
        signed_payload = ''.join(str(payload[key]) for key in payload)
        return hmac.new(
            secret_key.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).hexdigest()

    # ========== Original Integration Tests ==========
    
    def test_verify_signature(self):
        """
        Test signature verification method by comparing expected and
        received signatures.
        """
        expected_signature = self.generate_signature(
            self.payload, self.secret_key)
        
        verifier = SignatureVerifier()
        self.assertTrue(verifier.verify(
            self.payload, expected_signature, self.secret_key))

    @patch(PATCH_GET_SESSION)
    def test_webhook_endpoint_success(self, mock_get_session):
        """
        Test successful handling of a valid webhook request with correct
        signature and valid timestamp. Mock database interaction.
        """
        mock_session = mock_get_session.return_value.__enter__.return_value
        mock_session.add.return_value = None
        mock_session.commit.return_value = None

        headers = {
            'YAYA-SIGNATURE': self.generate_signature(
                self.payload, self.secret_key)}
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            'Transaction recorded successfully',
            json.loads(response.data)['message'])

    def test_replay_attack_rejection(self):
        """
        Test replay attack prevention by sending a payload with an outdated
        timestamp and expect a 400 status code.
        """
        self.payload['timestamp'] = int(
            (datetime.utcnow() - timedelta(minutes=10)).timestamp())
        headers = {'YAYA-SIGNATURE': self.generate_signature(
            self.payload, self.secret_key)}
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            'Replay attack detected', json.loads(response.data)['status'])

    def test_invalid_signature(self):
        """
        Test endpoint response to an invalid signature by sending an incorrect
        signature header and expecting a 403 status code.
        """
        headers = {'YAYA-SIGNATURE': 'invalid-signature'}
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn('Invalid signature', json.loads(response.data)['status'])

    @patch(PATCH_GET_SESSION)
    def test_database_error_handling(self, mock_get_session):
        """
        Test endpoint handling of a database error by simulating a duplicate
        entry with the same ID, expecting a 500 status code.
        """
        headers = {'YAYA-SIGNATURE': self.generate_signature(
            self.payload, self.secret_key)}

        # First request - success
        mock_session = mock_get_session.return_value.__enter__.return_value
        mock_session.add.return_value = None
        mock_session.commit.return_value = None

        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 200)

        # Second request - simulate SQLAlchemyError
        mock_session.commit.side_effect = SQLAlchemyError("Duplicate entry")
        
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 500)
        self.assertIn(
                'Database error occurred', json.loads(response.data)['erro'])

    # ========== Unit Tests for SignatureVerifier Class ==========
    
    def test_signature_verifier_valid_signature(self):
        """Test SignatureVerifier with a valid signature."""
        verifier = SignatureVerifier()
        signature = self.generate_signature(self.payload, self.secret_key)
        result = verifier.verify(self.payload, signature, self.secret_key)
        self.assertTrue(result)
    
    def test_signature_verifier_invalid_signature(self):
        """Test SignatureVerifier with an invalid signature."""
        verifier = SignatureVerifier()
        result = verifier.verify(self.payload, "wrong_signature", self.secret_key)
        self.assertFalse(result)
    
    def test_signature_verifier_empty_secret(self):
        """Test SignatureVerifier with empty secret key."""
        verifier = SignatureVerifier()
        signature = self.generate_signature(self.payload, "")
        result = verifier.verify(self.payload, signature, "")
        self.assertTrue(result)
    
    def test_signature_verifier_different_secret(self):
        """Test SignatureVerifier with different secret keys."""
        verifier = SignatureVerifier()
        signature = self.generate_signature(self.payload, "secret1")
        result = verifier.verify(self.payload, signature, "secret2")
        self.assertFalse(result)
    
    def test_signature_verifier_empty_payload(self):
        """Test SignatureVerifier with empty payload."""
        verifier = SignatureVerifier()
        empty_payload = {}
        signature = self.generate_signature(empty_payload, self.secret_key)
        result = verifier.verify(empty_payload, signature, self.secret_key)
        self.assertTrue(result)

    # ========== Unit Tests for WebhookValidator Class ==========
    
    def test_validator_valid_timestamp(self):
        """Test WebhookValidator with valid recent timestamp."""
        validator = WebhookValidator()
        recent_timestamp = int((datetime.utcnow() - timedelta(minutes=2)).timestamp())
        # Should not raise any exception
        try:
            validator.validate_timestamp(recent_timestamp)
        except Exception as e:
            self.fail(f"validate_timestamp raised {e} unexpectedly")
    
    def test_validator_old_timestamp_raises_replay_error(self):
        """Test WebhookValidator raises ReplayAttackError for old timestamp."""
        validator = WebhookValidator()
        old_timestamp = int((datetime.utcnow() - timedelta(minutes=10)).timestamp())
        with self.assertRaises(ReplayAttackError):
            validator.validate_timestamp(old_timestamp)
    
    def test_validator_none_timestamp_raises_value_error(self):
        """Test WebhookValidator raises ValueError for None timestamp."""
        validator = WebhookValidator()
        with self.assertRaises(ValueError):
            validator.validate_timestamp(None)
    
    def test_validator_boundary_timestamp_exactly_5_minutes(self):
        """Test WebhookValidator with timestamp exactly at 5 minute boundary."""
        validator = WebhookValidator()
        boundary_timestamp = int((datetime.utcnow() - timedelta(minutes=5, seconds=1)).timestamp())
        with self.assertRaises(ReplayAttackError):
            validator.validate_timestamp(boundary_timestamp)
    
    def test_validator_future_timestamp(self):
        """Test WebhookValidator with future timestamp (should be valid)."""
        validator = WebhookValidator()
        future_timestamp = int((datetime.utcnow() + timedelta(minutes=1)).timestamp())
        # Should not raise any exception
        try:
            validator.validate_timestamp(future_timestamp)
        except Exception as e:
            self.fail(f"validate_timestamp raised {e} unexpectedly")
    
    def test_validator_validate_signature_header_valid(self):
        """Test WebhookValidator signature header validation with valid signature."""
        validator = WebhookValidator()
        # Should not raise any exception
        try:
            validator.validate_signature_header("valid_signature")
        except Exception as e:
            self.fail(f"validate_signature_header raised {e} unexpectedly")
    
    def test_validator_validate_signature_header_empty(self):
        """Test WebhookValidator signature header validation with empty signature."""
        validator = WebhookValidator()
        with self.assertRaises(ValueError):
            validator.validate_signature_header("")
    
    def test_validator_validate_signature_header_none(self):
        """Test WebhookValidator signature header validation with None signature."""
        validator = WebhookValidator()
        with self.assertRaises(ValueError):
            validator.validate_signature_header(None)

    # ========== Unit Tests for TransactionRepository Class ==========
    
    @patch('api.services.Transaction')
    def test_repository_save_transaction_success(self, mock_transaction_class):
        """Test TransactionRepository successfully saves transaction."""
        mock_session_factory = MagicMock()
        mock_session = MagicMock()
        mock_session_factory.return_value.__enter__.return_value = mock_session
        
        repository = TransactionRepository(mock_session_factory)
        repository.save_transaction(self.payload)
        
        mock_transaction_class.assert_called_once_with(**self.payload)
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
    
    @patch('api.services.Transaction')
    def test_repository_save_transaction_database_error(self, mock_transaction_class):
        """Test TransactionRepository propagates database errors."""
        mock_session_factory = MagicMock()
        mock_session = MagicMock()
        mock_session.commit.side_effect = SQLAlchemyError("DB Error")
        mock_session_factory.return_value.__enter__.return_value = mock_session
        
        repository = TransactionRepository(mock_session_factory)
        
        with self.assertRaises(SQLAlchemyError):
            repository.save_transaction(self.payload)
    
    @patch('api.services.Transaction')
    def test_repository_save_empty_data(self, mock_transaction_class):
        """Test TransactionRepository with empty data."""
        mock_session_factory = MagicMock()
        mock_session = MagicMock()
        mock_session_factory.return_value.__enter__.return_value = mock_session
        
        repository = TransactionRepository(mock_session_factory)
        repository.save_transaction({})
        
        mock_transaction_class.assert_called_once_with()
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    # ========== Unit Tests for WebhookService Class ==========
    
    def test_webhook_service_process_success(self):
        """Test WebhookService processes valid webhook successfully."""
        mock_verifier = Mock()
        mock_verifier.verify.return_value = True
        mock_validator = Mock()
        mock_repository = Mock()
        
        service = WebhookService(mock_verifier, mock_validator, mock_repository, self.secret_key)
        signature = self.generate_signature(self.payload, self.secret_key)
        
        service.process_webhook(self.payload, signature)
        
        mock_validator.validate_timestamp.assert_called_once_with(self.payload['timestamp'])
        mock_verifier.verify.assert_called_once_with(self.payload, signature, self.secret_key)
        mock_repository.save_transaction.assert_called_once_with(self.payload)
    
    def test_webhook_service_invalid_signature_raises_error(self):
        """Test WebhookService raises InvalidSignatureError for invalid signature."""
        mock_verifier = Mock()
        mock_verifier.verify.return_value = False
        mock_validator = Mock()
        mock_repository = Mock()
        
        service = WebhookService(mock_verifier, mock_validator, mock_repository, self.secret_key)
        
        with self.assertRaises(InvalidSignatureError):
            service.process_webhook(self.payload, "invalid_signature")
        
        # Repository should not be called if signature is invalid
        mock_repository.save_transaction.assert_not_called()
    
    def test_webhook_service_replay_attack_raises_error(self):
        """Test WebhookService raises ReplayAttackError for old timestamp."""
        mock_verifier = Mock()
        mock_validator = Mock()
        mock_validator.validate_timestamp.side_effect = ReplayAttackError("Replay detected")
        mock_repository = Mock()
        
        service = WebhookService(mock_verifier, mock_validator, mock_repository, self.secret_key)
        
        with self.assertRaises(ReplayAttackError):
            service.process_webhook(self.payload, "any_signature")
        
        # Verifier and repository should not be called if timestamp is invalid
        mock_verifier.verify.assert_not_called()
        mock_repository.save_transaction.assert_not_called()
    
    def test_webhook_service_database_error_propagates(self):
        """Test WebhookService propagates database errors."""
        mock_verifier = Mock()
        mock_verifier.verify.return_value = True
        mock_validator = Mock()
        mock_repository = Mock()
        mock_repository.save_transaction.side_effect = SQLAlchemyError("DB Error")
        
        service = WebhookService(mock_verifier, mock_validator, mock_repository, self.secret_key)
        signature = self.generate_signature(self.payload, self.secret_key)
        
        with self.assertRaises(SQLAlchemyError):
            service.process_webhook(self.payload, signature)

    # ========== Edge Case Tests for Endpoint ==========
    
    
    def test_endpoint_missing_signature_header(self):
        """Test endpoint with missing signature header."""
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Missing signature header', json.loads(response.data)['error'])
    
    def test_endpoint_missing_timestamp_in_payload(self):
        """Test endpoint with missing timestamp in payload."""
        payload_no_timestamp = self.payload.copy()
        del payload_no_timestamp['timestamp']
        
        headers = {'YAYA-SIGNATURE': self.generate_signature(payload_no_timestamp, self.secret_key)}
        response = self.app.post(
            '/webhook',
            data=json.dumps(payload_no_timestamp),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Missing timestamp in payload', json.loads(response.data)['error'])
    
    def test_endpoint_empty_signature_header(self):
        """Test endpoint with empty signature header."""
        headers = {'YAYA-SIGNATURE': ''}
        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Missing signature header', json.loads(response.data)['error'])
    
    @patch(PATCH_GET_SESSION)
    def test_endpoint_malformed_timestamp(self, mock_get_session):
        """Test endpoint with malformed timestamp value."""
        mock_session = mock_get_session.return_value.__enter__.return_value
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        
        malformed_payload = self.payload.copy()
        malformed_payload['timestamp'] = "not_a_number"
        
        headers = {'YAYA-SIGNATURE': self.generate_signature(malformed_payload, self.secret_key)}
        response = self.app.post(
            '/webhook',
            data=json.dumps(malformed_payload),
            content_type='application/json',
            headers=headers
        )
        # Should get 400 for invalid data
        self.assertEqual(response.status_code, 400)

if __name__ == "__main__":
    unittest.main()
