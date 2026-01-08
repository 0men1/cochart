import { IChartApi, ISeriesApi, SeriesType } from 'cochart-charts';
import { TrendLineHandler } from './primitives/TrendLine';
import { VerticalLineHandler } from './primitives/VertLine';
import { DrawingTool, BaseDrawingHandler } from '@/core/chart/drawings/types';

type HandlerConstructor = new (chart: IChartApi, series: ISeriesApi<SeriesType>) => BaseDrawingHandler;

const HANDLERS: Record<string, HandlerConstructor> = {
	'TREND_LINE': TrendLineHandler,
	'VERTICAL_LINE': VerticalLineHandler
}

export class DrawingHandlerFactory {
	constructor(
		private chart: IChartApi,
		private series: ISeriesApi<SeriesType>,
	) { }

	createHandler(tool: DrawingTool): BaseDrawingHandler | null {
		if (!tool) return null;

		const handler = HANDLERS[tool];

		if (!handler) {
			console.error("Invalid drawing tool: ", tool);
			return null;
		}

		return new handler(this.chart, this.series);
	}
}
