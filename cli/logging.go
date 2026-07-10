package main

// Progress logging for the concurrent generate run. Image generation is slow and
// network-bound, so a full run can sit for a minute or more with the terminal
// looking frozen. This adds:
//   - live, timestamped lifecycle logs per worker (queued, picking photo,
//     generating, captioning, done) instead of buffering a page's log until it
//     finishes, and
//   - a periodic heartbeat that reports which pages are still in flight, on which
//     worker, in what phase, and for how long — so a slow or stuck page is
//     visible rather than silent.

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// heartbeatInterval is how often the heartbeat reports still-running work.
const heartbeatInterval = 15 * time.Second

// pageProgress is the live state of one in-flight page.
type pageProgress struct {
	worker int
	phase  string    // human-readable current step, e.g. "generating image"
	since  time.Time // when the current phase started
}

// progress serializes all generate-run logging and tracks in-flight pages so the
// heartbeat can describe them. All methods are safe for concurrent use.
type progress struct {
	mu       sync.Mutex
	inflight map[int]*pageProgress // page number -> live state
	stop     chan struct{}
	done     chan struct{}
}

// newProgress creates a progress tracker. Call start() to begin the heartbeat
// and stopHeartbeat() when the run is finished.
func newProgress() *progress {
	return &progress{
		inflight: make(map[int]*pageProgress),
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
}

// logf prints a single timestamped line, serialized against all other logging.
func (pr *progress) logf(format string, args ...any) {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	pr.printf(format, args...)
}

// printf prints without taking the lock (caller must hold it).
func (pr *progress) printf(format string, args ...any) {
	fmt.Printf("[%s] %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, args...))
}

// begin records that worker w has started page and logs it.
func (pr *progress) begin(page, w int, phase string) {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	pr.inflight[page] = &pageProgress{worker: w, phase: phase, since: time.Now()}
	pr.printf("worker %d: page %d — %s", w, page, phase)
}

// phase updates the current step for an in-flight page and logs the transition.
func (pr *progress) phase(page int, phase string) {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	if st, ok := pr.inflight[page]; ok {
		st.phase = phase
		st.since = time.Now()
		pr.printf("worker %d: page %d — %s", st.worker, page, phase)
	}
}

// finish removes a page from the in-flight set and logs its outcome.
func (pr *progress) finish(page int, err error) {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	st := pr.inflight[page]
	delete(pr.inflight, page)
	w := 0
	if st != nil {
		w = st.worker
	}
	if err != nil {
		pr.printf("worker %d: page %d — FAILED: %v", w, page, err)
	} else {
		pr.printf("worker %d: page %d — done (%d still running)", w, page, len(pr.inflight))
	}
}

// startHeartbeat launches the heartbeat goroutine.
func (pr *progress) startHeartbeat() {
	go func() {
		defer close(pr.done)
		t := time.NewTicker(heartbeatInterval)
		defer t.Stop()
		for {
			select {
			case <-pr.stop:
				return
			case <-t.C:
				pr.emitHeartbeat()
			}
		}
	}()
}

// stopHeartbeat stops the heartbeat goroutine and waits for it to exit.
func (pr *progress) stopHeartbeat() {
	close(pr.stop)
	<-pr.done
}

// emitHeartbeat prints one heartbeat line per in-flight page, sorted by page
// number, showing worker, phase, and elapsed time in the current phase. Silent
// when nothing is running.
func (pr *progress) emitHeartbeat() {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	if len(pr.inflight) == 0 {
		return
	}
	pages := make([]int, 0, len(pr.inflight))
	for page := range pr.inflight {
		pages = append(pages, page)
	}
	sort.Ints(pages)
	pr.printf("heartbeat: %d page(s) still running", len(pages))
	now := time.Now()
	for _, page := range pages {
		st := pr.inflight[page]
		pr.printf("  ↳ worker %d still waiting on page %d — %s (%s so far)",
			st.worker, page, st.phase, now.Sub(st.since).Round(time.Second))
	}
}
