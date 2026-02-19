#!/usr/bin/python3
"""
API endpoint to handle incoming webhooks and verify their authenticity.
"""
import os
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from models.db import get_session
from api.services import WebhookService, SignatureVerifier, WebhookValidator, TransactionRepository, InvalidSignatureError, ReplayAttackError

webhook_blueprint = Blueprint('webhook', __name__)


def get_webhook_service():
    """
    Factory function to create WebhookService with dependencies.
    """
    secret_key = os.getenv('WEBHOOK_SECRET', '')
    verifier = SignatureVerifier()
    validator = WebhookValidator()
    repository = TransactionRepository(get_session)
    return WebhookService(verifier, validator, repository, secret_key)


@webhook_blueprint.route('/webhook', methods=['POST'])
def webhook():
    """
    Handle incoming webhook requests by verifying the signature,
    checking for replay attacks, and storing the data if valid.
    """
    try:
        request_data = request.get_json()
        if request_data is None:
            return jsonify({'error': 'Invalid JSON payload'}), 400

        signature = request.headers.get('YAYA-SIGNATURE')
        if not signature:
            return jsonify({'error': 'Missing signature header'}), 400

        timestamp = request_data.get('timestamp')
        if timestamp is None:
            return jsonify({'error': 'Missing timestamp in payload'}), 400

        service = get_webhook_service()
        service.process_webhook(request_data, signature)

        return jsonify({'message': 'Transaction recorded successfully'}), 200

    except ReplayAttackError:
        return jsonify({'status': 'Replay attack detected'}), 400
    except InvalidSignatureError:
        return jsonify({'status': 'Invalid signature'}), 403
    except (TypeError, ValueError) as e:
        return jsonify({'error': f'Invalid data: {str(e)}'}), 400
    except SQLAlchemyError as e:
        return jsonify(
            {'erro': 'Database error occurred', 'details': str(e)}), 500
    except Exception as e:
        return jsonify(
            {'error': 'An unexpected error occurred', 'details': str(e)}), 500
