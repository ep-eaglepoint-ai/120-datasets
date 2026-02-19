#!/usr/bin/python3
"""
Unit tests for the webhook endpoint and signature verification.
"""

import json
import os
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta
import hmac
import hashlib
from uuid import uuid4
from sqlalchemy.exc import SQLAlchemyError
from api import app
from api.webhook import verify_signature
from models.db import init_db


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

    def test_verify_signature(self):
        """
        Test signature verification function by comparing expected and
        received signatures.
        """
        expected_signature = self.generate_signature(
            self.payload, self.secret_key)
        self.assertTrue(verify_signature(
            self.payload, expected_signature, self.secret_key))

    @patch('models.db.get_session')
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

    @patch('models.db.get_session')
    def test_database_error_handling(self, mock_get_session):
        """
        Test endpoint handling of a database error by simulating a duplicate
        entry with the same ID, expecting a 500 status code.
        """
        headers = {'YAYA-SIGNATURE': self.generate_signature(
            self.payload, self.secret_key)}

        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )

        self.assertEqual(response.status_code, 200)

        response = self.app.post(
            '/webhook',
            data=json.dumps(self.payload),
            content_type='application/json',
            headers=headers
        )
        self.assertEqual(response.status_code, 500)
        self.assertIn(
                'Database error occurred', json.loads(response.data)['erro'])
