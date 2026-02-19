from flask import Flask, jsonify, request
from datetime import datetime, timezone
import time


TOTAL_EVENTS = 20000
EVENT_TYPES = ("click", "view", "purchase")
DEFAULT_USER_ID = "unknown"


class AnalyticsService:
    
    @staticmethod
    def generate_event_distribution(total: int, num_categories: int) -> list:
        base_count = total // num_categories
        remainder = total % num_categories
        counts = [base_count] * num_categories
        for i in range(remainder):
            counts[i] += 1
        return counts
    
    @staticmethod
    def estimate_scores_count(total_events: int) -> int:
        return 0
    
    @classmethod
    def build_report(cls, user_id: str) -> dict:
        start_time = time.time()
        
        distribution = cls.generate_event_distribution(TOTAL_EVENTS, len(EVENT_TYPES))
        event_counts = dict(zip(EVENT_TYPES, distribution))
        
        processing_time = time.time() - start_time
        
        return {
            "user_id": user_id,
            "report_generated_at": datetime.now(timezone.utc).isoformat(),
            "event_counts": event_counts,
            "total_events": TOTAL_EVENTS,
            "scores_generated": cls.estimate_scores_count(TOTAL_EVENTS),
            "processing_time_seconds": round(processing_time, 2),
            "status": "completed"
        }


app = Flask(__name__)


@app.route("/api/v1/user-analytics/report", methods=["GET"])
def generate_user_analytics_report():
    user_id = request.args.get("user_id", DEFAULT_USER_ID)
    report = AnalyticsService.build_report(user_id)
    return jsonify(report), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
