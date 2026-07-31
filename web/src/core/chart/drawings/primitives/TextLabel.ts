import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { logger } from "@cochart/protocol";
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from '../types';

// Default font size (media px). Overridable per label via options.fontSize.
const FONT_SIZE = 14;
// Rough per-character advance as a fraction of font size, used for hit-testing
// without a canvas context to measure against.
const CHAR_ADVANCE = 0.6;

// Anchor -> bounding box (media px), the label growing right/down from the point.
function textBounds(x: number, y: number, text: string, fontSize: number) {
  return {
    left: x,
    top: y,
    width: Math.max(text.length * fontSize * CHAR_ADVANCE, fontSize),
    height: fontSize,
  };
}

class TextLabelPaneRenderer implements IPrimitivePaneRenderer {
  _p1: ViewPoint;
  _options: BaseOptions;
  _isSelected: boolean;

  constructor(p1: ViewPoint, options: BaseOptions, isSelected: boolean) {
    this._p1 = p1;
    this._options = options;
    this._isSelected = isSelected;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(scope => {
      if (this._p1.x === null || this._p1.y === null) return;

      const ctx = scope.context;
      const hp = scope.horizontalPixelRatio;
      const vp = scope.verticalPixelRatio;
      const x = this._p1.x * hp;
      const y = this._p1.y * vp;

      ctx.fillStyle = this._options.color;
      ctx.font = `${(this._options.fontSize ?? FONT_SIZE) * vp}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(this._options.labelText ?? '', x, y);

      if (this._isSelected) {
        drawControlPoints(ctx, scope, [{ x, y }]);
      }
    });
  }
}

class TextLabelPaneView implements IPrimitivePaneView {
  _source: TextLabel;
  _p1: ViewPoint = { x: null, y: null };
  private _renderer: TextLabelPaneRenderer;

  constructor(source: TextLabel) {
    this._source = source;
    this._renderer = new TextLabelPaneRenderer(this._p1, this._source.options, this._source.isSelected());
  }

  update() {
    if (this._source["_previewPoints"]) {
      const points = this._source["_previewPoints"];
      this._p1.x = points[0].x;
      this._p1.y = points[0].y;
    }
    else {
      const series = this._source.series;
      this._p1.x = this._source.timeToX(this._source._p1.time);
      this._p1.y = series.priceToCoordinate(this._source._p1.price);
    }
    this._renderer._isSelected = this._source.showControlPoints();
    this._renderer._options = this._source.options;
  }

  renderer() {
    return this._renderer;
  }
}

const defaultOptions: BaseOptions = {
  color: '#ffffff',
  width: 2,
  fontSize: FONT_SIZE,
  labelText: 'Text',
};

export class TextLabel extends BaseDrawing {
  declare _options: BaseOptions;
  static requiredPoints: number = 1;

  constructor(
    points: Point[],
    options?: Partial<BaseOptions>,
    id?: string,
  ) {
    super(
      points,
      { ...defaultOptions, ...options },
      [],
      [],
      id
    );
    this.initialize();
  }

  serialize(): SerializedDrawing {
    return {
      id: this._id,
      type: DrawingType.TEXT,
      points: this._points,
      options: { ...this._options },
      isDeleted: false,
    };
  }

  get _p1(): Point { return this._points[0]; }

  protected initialize(): void {
    try {
      this._paneViews = [new TextLabelPaneView(this)];
    } catch (error) {
      logger.error(`Failed to initialize text label ${this._id}: `, error);
    }
  }

  getEditableOptions(): EditableOption[] {
    return [
      {
        key: DrawingOptionKey.LABEL_TEXT,
        label: 'Text',
        type: 'text',
        group: 'Text',
        currentValue: this._options.labelText
      },
      {
        key: DrawingOptionKey.COLOR,
        label: 'Text Color',
        type: 'color',
        group: 'Text',
        currentValue: this._options.color
      },
      {
        key: DrawingOptionKey.FONT_SIZE,
        label: 'Font Size',
        type: 'number',
        min: 8,
        max: 72,
        step: 1,
        group: 'Text',
        currentValue: this._options.fontSize ?? FONT_SIZE
      },
    ];
  }

  isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
    const coord = this.getScreenCoordinates(this._p1);
    if (coord.x === null || coord.y === null) return false;

    const b = textBounds(coord.x, coord.y, this._options.labelText ?? '', this._options.fontSize ?? FONT_SIZE);
    return GeometryUtils.isPointInRectangle(x, y, b.left, b.top, b.width, b.height);
  }

  updateAllViews() {
    this._paneViews.forEach(pv => {
      if ('update' in pv && typeof (pv as any).update === 'function') {
        (pv as any).update();
      }
    });
  }

  paneViews() {
    return this._options.visible === false ? [] : this._paneViews;
  }
}
