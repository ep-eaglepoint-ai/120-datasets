package health

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type RedisChecker interface {
	Ping() error
}

func Handler(db *sql.DB, redis RedisChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := map[string]string{
			"status":   "healthy",
			"postgres": "up",
			"redis":    "up",
		}

		if err := db.Ping(); err != nil {
			response["status"] = "unhealthy"
			response["postgres"] = "down"
		}

		if err := redis.Ping(); err != nil {
			response["status"] = "unhealthy"
			response["redis"] = "down"
		}

		w.Header().Set("Content-Type", "application/json")

		if response["status"] == "unhealthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}

		json.NewEncoder(w).Encode(response)
	}
}