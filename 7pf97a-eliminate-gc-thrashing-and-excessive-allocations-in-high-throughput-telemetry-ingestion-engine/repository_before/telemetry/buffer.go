package telemetry

import "sync"

type TelemetryPacket struct {
	ID        int
	Timestamp int64
	Value     float64
	Payload   [64]byte
}
type IngestionBuffer struct {
	mu   sync.Mutex
	data []TelemetryPacket
}

func NewIngestionBuffer() *IngestionBuffer {
	return &IngestionBuffer{
		data: make([]TelemetryPacket, 0),
	}
}

func (b *IngestionBuffer) Push(p TelemetryPacket) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data = append(b.data, p)
}
func (b *IngestionBuffer) Flush() []TelemetryPacket {
	b.mu.Lock()
	defer b.mu.Unlock()

	batch := b.data
	b.data = make([]TelemetryPacket, 0)
	return batch
}
