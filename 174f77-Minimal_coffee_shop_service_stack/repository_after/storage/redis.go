package storage

import (
	"context"
	"fmt"
	"net"
	"time"
)

type RedisClient struct {
	addr string
}

func NewRedisClient(addr string) (*RedisClient, error) {
	client := &RedisClient{addr: addr}

	if err := client.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return client, nil
}

func (r *RedisClient) Ping() error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", r.addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.Write([]byte("PING\r\n"))
	if err != nil {
		return err
	}

	buf := make([]byte, 1024)
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, err = conn.Read(buf)
	return err
}