type Labels = Record<string, string | number | boolean | null | undefined>;

class InMemoryMetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();

  increment(name: string, labels: Labels = {}, value = 1) {
    const key = this.metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, labels: Labels = {}, value: number) {
    const key = this.metricKey(name, labels);
    this.gauges.set(key, value);
  }

  observe(name: string, labels: Labels = {}, value: number) {
    const key = this.metricKey(name, labels);
    const current = this.histograms.get(key) ?? [];
    current.push(value);
    this.histograms.set(key, current);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
    slowThresholdMs: number,
  ) {
    const labels = { method, route, status_code: statusCode };
    this.increment('http_requests_total', labels);
    this.observe('http_request_duration_ms', labels, durationMs);

    if (durationMs >= slowThresholdMs) {
      this.increment('http_slow_requests_total', labels);
    }
  }

  renderPrometheus(): string {
    const lines: string[] = [];

    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    for (const [key, values] of this.histograms) {
      const count = values.length;
      const sum = values.reduce((total, current) => total + current, 0);
      lines.push(`${key}_count ${count}`);
      lines.push(`${key}_sum ${sum}`);
    }

    return `${lines.join('\n')}\n`;
  }

  private metricKey(name: string, labels: Labels): string {
    const pairs = Object.entries(labels)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}="${String(value)}"`);

    return pairs.length ? `${name}{${pairs.join(',')}}` : name;
  }
}

export const observabilityMetrics = new InMemoryMetricsRegistry();
