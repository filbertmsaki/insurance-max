import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

interface SeriesPoint {
  date: string;
  value: number;
}

interface ForecastPointResult {
  forecastDate: string;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const MOVING_AVERAGE_WINDOW = 7;
const BOUND_MULTIPLIER = 1.5;

@Injectable()
export class ForecastService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async listDefinitions(companyId: string) {
    return this.analyticsService.listForecastDefinitions(companyId);
  }

  async runForecast(
    user: { companyId: string; id: string },
    params: {
      definitionId: string;
      branchId?: string | null;
      trainingPeriodStart: string;
      trainingPeriodEnd: string;
      forecastPeriodStart: string;
      forecastPeriodEnd: string;
    },
  ) {
    const definition = await this.analyticsService.getForecastDefinition(
      params.definitionId,
    );
    if (!definition) {
      throw new NotFoundException('Forecast definition not found');
    }

    const runNo = `FR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const selectedMethod = definition.method ?? 'AUTO';

    const run = await this.analyticsService.insertForecastRun({
      companyId: user.companyId,
      branchId: params.branchId ?? null,
      definitionId: params.definitionId,
      runNo,
      trainingPeriodStart: params.trainingPeriodStart,
      trainingPeriodEnd: params.trainingPeriodEnd,
      forecastPeriodStart: params.forecastPeriodStart,
      forecastPeriodEnd: params.forecastPeriodEnd,
      selectedMethod,
      status: 'COMPLETED',
      createdBy: user.id,
    });

    const metricCode = definition.metric_code ?? definition.metricCode;
    const trainingRows = metricCode
      ? await this.analyticsService.getDailyMetrics({
          companyId: user.companyId,
          branchId: params.branchId ?? null,
          metricCode,
          from: params.trainingPeriodStart,
          to: params.trainingPeriodEnd,
        })
      : [];

    const series = this.buildDenseSeries(
      trainingRows,
      params.trainingPeriodStart,
      params.trainingPeriodEnd,
    );
    const forecastDates = this.enumerateDates(
      params.forecastPeriodStart,
      params.forecastPeriodEnd,
    );

    const points = this.computeForecastPoints(
      series,
      forecastDates,
      params.trainingPeriodStart,
      selectedMethod,
    );

    const insertedPoints = await this.analyticsService.insertForecastPoints(
      run.id,
      points,
    );
    return { run, points: insertedPoints };
  }

  /**
   * Fills every day between `from` and `to` (inclusive) with the observed
   * metric value, or 0 for days with no observation — the `ZERO`
   * gap-fill strategy configured on the seeded forecast definitions. Rows
   * come back from a raw `dataSource.query` call, so `metricDate` may be a
   * `Date` and `metricValue` a numeric-as-string; both are normalized here.
   */
  private buildDenseSeries(
    rows: Array<{ metricDate: unknown; metricValue: unknown }>,
    from: string,
    to: string,
  ): SeriesPoint[] {
    const byDate = new Map<string, number>();

    for (const row of rows) {
      const date = this.toDateKey(row.metricDate);
      const value = Number(row.metricValue ?? 0);
      byDate.set(date, Number.isFinite(value) ? value : 0);
    }

    return this.enumerateDates(from, to).map((date) => ({
      date,
      value: byDate.get(date) ?? 0,
    }));
  }

  private enumerateDates(from: string, to: string): string[] {
    const dates: string[] = [];
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);

    for (
      let cursor = start;
      cursor.getTime() <= end.getTime();
      cursor = new Date(cursor.getTime() + MILLISECONDS_PER_DAY)
    ) {
      dates.push(cursor.toISOString().slice(0, 10));
    }

    return dates;
  }

  private toDateKey(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private daysBetween(from: string, to: string): number {
    const start = new Date(`${from}T00:00:00.000Z`).getTime();
    const target = new Date(`${to}T00:00:00.000Z`).getTime();
    return Math.round((target - start) / MILLISECONDS_PER_DAY);
  }

  private computeForecastPoints(
    series: SeriesPoint[],
    forecastDates: string[],
    trainingPeriodStart: string,
    method: string,
  ): ForecastPointResult[] {
    if (!series.length) {
      // No training data at all — an honest "no signal" forecast (zero
      // prediction, zero confidence band) rather than a fabricated number.
      return forecastDates.map((forecastDate) => ({
        forecastDate,
        predictedValue: 0,
        lowerBound: 0,
        upperBound: 0,
      }));
    }

    const normalizedMethod = String(method ?? '').toUpperCase();

    if (normalizedMethod.includes('LINEAR') || normalizedMethod.includes('REGRESSION')) {
      return this.forecastLinearRegression(series, forecastDates, trainingPeriodStart);
    }

    return this.forecastMovingAverage(series, forecastDates);
  }

  private forecastLinearRegression(
    series: SeriesPoint[],
    forecastDates: string[],
    trainingPeriodStart: string,
  ): ForecastPointResult[] {
    const t = series.map((_, index) => index);
    const values = series.map((point) => point.value);
    const n = t.length;

    const meanT = t.reduce((sum, value) => sum + value, 0) / n;
    const meanY = values.reduce((sum, value) => sum + value, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let index = 0; index < n; index += 1) {
      numerator += (t[index] - meanT) * (values[index] - meanY);
      denominator += (t[index] - meanT) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanT;

    const residuals = t.map((value, index) => values[index] - (intercept + slope * value));
    const stdDev = this.standardDeviation(residuals);

    return forecastDates.map((forecastDate) => {
      const tFuture = this.daysBetween(trainingPeriodStart, forecastDate);
      const predicted = Math.max(0, intercept + slope * tFuture);

      return {
        forecastDate,
        predictedValue: this.round(predicted),
        lowerBound: this.round(Math.max(0, predicted - BOUND_MULTIPLIER * stdDev)),
        upperBound: this.round(predicted + BOUND_MULTIPLIER * stdDev),
      };
    });
  }

  private forecastMovingAverage(
    series: SeriesPoint[],
    forecastDates: string[],
  ): ForecastPointResult[] {
    const window = series.slice(-MOVING_AVERAGE_WINDOW).map((point) => point.value);
    const average = window.reduce((sum, value) => sum + value, 0) / window.length;
    const stdDev = this.standardDeviation(window.map((value) => value - average));
    const predicted = Math.max(0, average);

    return forecastDates.map((forecastDate) => ({
      forecastDate,
      predictedValue: this.round(predicted),
      lowerBound: this.round(Math.max(0, predicted - BOUND_MULTIPLIER * stdDev)),
      upperBound: this.round(predicted + BOUND_MULTIPLIER * stdDev),
    }));
  }

  private standardDeviation(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

    return Math.sqrt(variance);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
