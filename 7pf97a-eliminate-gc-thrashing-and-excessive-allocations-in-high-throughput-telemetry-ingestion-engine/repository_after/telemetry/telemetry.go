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
	head int
	cap  int
}

func NewIngestionBuffer(capacity int) *IngestionBuffer {
	return &IngestionBuffer{
		data: make([]TelemetryPacket, capacity),
		cap:  capacity,
	}
}

func (b *IngestionBuffer) Push(p TelemetryPacket) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data[b.head] = p
	b.head++

	if b.head >= b.cap {
		b.head = 0
	}
}

// Flush returns packets from the buffer. The returned slice shares the backing
// array; the caller must consume it before calling Push again, or data may be overwritten.
func (b *IngestionBuffer) Flush() []TelemetryPacket {
	b.mu.Lock()
	defer b.mu.Unlock()

	batch := b.data[:b.head]
	b.head = 0
	return batch
}
