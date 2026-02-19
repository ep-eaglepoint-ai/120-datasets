package config

import (
	"fmt"
	"os"
)

type Config struct {
	ServerPort     string
	PostgresHost   string
	PostgresPort   string
	PostgresUser   string
	PostgresPass   string
	PostgresDB     string
	RedisHost      string
	RedisPort      string
}

func Load() (*Config, error) {
	cfg := &Config{
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		PostgresHost:   getEnv("POSTGRES_HOST", "postgres"),
		PostgresPort:   getEnv("POSTGRES_PORT", "5432"),
		PostgresUser:   getEnv("POSTGRES_USER", ""),
		PostgresPass:   getEnv("POSTGRES_PASSWORD", ""),
		PostgresDB:     getEnv("POSTGRES_DB", "coffeedb"),
		RedisHost:      getEnv("REDIS_HOST", "redis"),
		RedisPort:      getEnv("REDIS_PORT", "6379"),
	}

	if cfg.PostgresUser == "" {
		return nil, fmt.Errorf("POSTGRES_USER is required")
	}
	if cfg.PostgresPass == "" {
		return nil, fmt.Errorf("POSTGRES_PASSWORD is required")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) PostgresDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.PostgresHost, c.PostgresPort, c.PostgresUser, c.PostgresPass, c.PostgresDB)
}

func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}