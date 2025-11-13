import { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { TrendLineHandler } from './primitives/TrendLine';
import { VerticalLineHandler } from './primitives/VertLine';
import { DrawingTool, BaseDrawingHandler } from '@/core/chart/drawings/types';

export class DrawingHandlerFactory {
    constructor(
        private chart: IChartApi,
        private series: ISeriesApi<SeriesType>,
    ) { }

    createHandler(tool: DrawingTool): BaseDrawingHandler | null {
        switch (tool) {
            case "trendline":
                const trendLineHandler = new TrendLineHandler(this.chart, this.series);
                return trendLineHandler;

            case "verticalLine":
                const verticalLineHandler = new VerticalLineHandler(this.chart, this.series);
                return verticalLineHandler;

            default:
                return null;
        }
    }
}